"""Extract text content from URLs/webpages."""
from __future__ import annotations

import ipaddress
import re
from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from httpx import URL

from app.core.url_validator import validate_and_resolve_url

from .base import ExtractedPage

MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB
FETCH_TIMEOUT = 30  # seconds
MAX_REDIRECTS = 3

CONTENT_TAGS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "td",
    "th",
    "pre",
    "blockquote",
    "div",
]
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
NESTED_BLOCK_TAGS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "ul",
    "ol",
    "table",
    "pre",
    "blockquote",
]
BOILERPLATE_RE = re.compile(
    r"\b("
    r"ad|ads|advert|banner|breadcrumb|byline|cookie|comments?|consent|"
    r"footer|header|login|menu|modal|nav|newsletter|popup|promo|"
    r"recommend|related|share|sidebar|signin|signup|social|subscribe|toolbar"
    r")\b",
    re.IGNORECASE,
)
WHITESPACE_RE = re.compile(r"[ \t\r\f\v]+")


def _read_response_bytes_limited(
    response: httpx.Response,
    *,
    max_content_size: int = MAX_CONTENT_SIZE,
) -> bytes:
    content_length = response.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_content_size:
                raise ValueError("URL_CONTENT_TOO_LARGE")
        except ValueError as exc:
            if str(exc) == "URL_CONTENT_TOO_LARGE":
                raise

    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_bytes():
        total += len(chunk)
        if total > max_content_size:
            raise ValueError("URL_CONTENT_TOO_LARGE")
        chunks.append(chunk)
    return b"".join(chunks)


def _build_host_header(parsed: urlparse, resolved_ip: str) -> str:
    """Build a correct Host header value.

    Brackets IPv6 literals and includes port only when non-default for scheme.
    """
    hostname = parsed.hostname or ""
    # Bracket IPv6 literals in Host header
    try:
        addr = ipaddress.ip_address(hostname)
        if isinstance(addr, ipaddress.IPv6Address):
            hostname = f"[{hostname}]"
    except ValueError:
        pass  # Regular hostname, no bracketing needed

    port = parsed.port
    default_port = 443 if parsed.scheme == "https" else 80
    if port and port != default_port:
        return f"{hostname}:{port}"
    return hostname


def _fetch_with_safe_redirects(url: str) -> tuple[str, str, str, bytes]:
    """Fetch a URL, manually following redirects and validating each hop.

    Uses DNS-pinned connections: validate_and_resolve_url returns a resolved IP
    that is used directly for the connection, preventing DNS rebinding attacks.
    A fresh httpx.Client is created per hop to avoid TLS connection reuse
    with stale SNI context across different hostnames.
    """
    current_url, resolved_ip = validate_and_resolve_url(url)
    seen_urls: set[str] = {current_url}

    for _hop in range(MAX_REDIRECTS + 1):
        # Pin connection to resolved IP to prevent DNS rebinding
        parsed = urlparse(current_url)
        pinned_url = str(URL(current_url).copy_with(host=resolved_ip))
        host_header = _build_host_header(parsed, resolved_ip)

        # Fresh client per hop to prevent TLS connection reuse with stale SNI
        with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=False) as client:
            with client.stream(
                "GET",
                pinned_url,
                headers={
                    "Host": host_header,
                    "User-Agent": "Mozilla/5.0 (compatible; DocTalk/1.0)",
                },
                extensions=(
                    {"sni_hostname": parsed.hostname}
                    if parsed.scheme == "https"
                    else None
                ),
            ) as response:
                if response.is_redirect:
                    location = response.headers.get("location", "")
                    if not location:
                        raise ValueError("REDIRECT_NO_LOCATION")

                    redirect_url = urljoin(current_url, location)

                    if redirect_url in seen_urls:
                        raise ValueError("REDIRECT_LOOP")
                    seen_urls.add(redirect_url)

                    # Re-validate and re-resolve each redirect hop
                    current_url, resolved_ip = validate_and_resolve_url(redirect_url)
                    continue

                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                encoding = response.encoding or "utf-8"
                body = _read_response_bytes_limited(response)
                return current_url, content_type, encoding, body

    raise ValueError("TOO_MANY_REDIRECTS")


def _clean_text(text: str) -> str:
    text = WHITESPACE_RE.sub(" ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _meta_content(soup: BeautifulSoup, *names: str) -> str:
    for name in names:
        tag = (
            soup.find("meta", attrs={"name": name})
            or soup.find("meta", attrs={"property": name})
            or soup.find("meta", attrs={"itemprop": name})
        )
        if tag and tag.get("content"):
            return _clean_text(str(tag["content"]))
    return ""


def _is_boilerplate_tag(tag) -> bool:
    attrs: list[str] = []
    for attr_name in ("id", "class", "role", "aria-label", "data-testid"):
        value = tag.get(attr_name)
        if isinstance(value, list):
            attrs.extend(str(v) for v in value)
        elif value:
            attrs.append(str(value))
    style = str(tag.get("style", ""))
    if "display:none" in style.replace(" ", "").lower() or tag.has_attr("hidden"):
        return True
    return bool(attrs and BOILERPLATE_RE.search(" ".join(attrs)))


def _inside_boilerplate(element, root) -> bool:
    for parent in element.parents:
        if parent is root:
            return False
        if getattr(parent, "name", None) in ("body", "html", "[document]"):
            return False
        if _is_boilerplate_tag(parent):
            return True
    return False


def _should_skip_element(element, root) -> bool:
    if _inside_boilerplate(element, root) or _is_boilerplate_tag(element):
        return True

    # Parent containers duplicate all child text. Keep div text only when it is
    # an actual leaf-like text block, not a wrapper around article structure.
    if element.name == "div" and element.find(NESTED_BLOCK_TAGS, recursive=True):
        return True

    if element.name in ("li", "td", "th") and element.find(["p", "ul", "ol"], recursive=True):
        return True

    if element.find_parent(["pre", "blockquote"]) and element.name not in ("pre", "blockquote"):
        return True

    return False


def _format_element_text(element) -> str:
    text = _clean_text(element.get_text(separator=" ", strip=True))
    if not text:
        return ""

    if element.name in HEADING_TAGS:
        level = min(max(int(element.name[1]), 1), 6)
        return f"{'#' * level} {text}"
    if element.name == "li":
        return f"- {text}"
    if element.name == "blockquote":
        return "\n".join(f"> {line}" for line in text.splitlines() if line.strip())
    if element.name == "pre":
        return f"```\n{text}\n```"
    return text


def _dedupe_key(block: str) -> str:
    text = block.lstrip("#- >").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text[:500]


def _extract_article_blocks(soup: BeautifulSoup, title: str) -> list[str]:
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "form", "svg"]):
        tag.decompose()

    for tag in soup.find_all(_is_boilerplate_tag):
        tag.decompose()

    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.find(id="content")
        or soup.find(class_="content")
        or soup.body
        or soup
    )

    blocks: list[str] = []
    seen: set[str] = set()
    for element in main_content.find_all(CONTENT_TAGS):
        if _should_skip_element(element, main_content):
            continue
        block = _format_element_text(element)
        if len(block.lstrip("#- >").strip()) < 2:
            continue
        key = _dedupe_key(block)
        if key in seen:
            continue
        seen.add(key)
        blocks.append(block)

    if title and not any(block.startswith("# ") for block in blocks[:3]):
        blocks.insert(0, f"# {title}")

    return blocks


def _split_blocks_into_pages(blocks: list[str], fallback_title: str) -> list[ExtractedPage]:
    pages: list[ExtractedPage] = []
    current_blocks: list[str] = []
    current_title: str | None = fallback_title[:200] if fallback_title else None
    current_chars = 0
    page_num = 1

    def flush_page() -> None:
        nonlocal page_num, current_chars
        if not current_blocks:
            return
        content = "\n\n".join(current_blocks).strip()
        if content:
            pages.append(
                ExtractedPage(
                    page_number=page_num,
                    text=content,
                    section_title=current_title,
                )
            )
            page_num += 1
        current_blocks.clear()
        current_chars = 0

    for block in blocks:
        if block.startswith("#"):
            heading = block.lstrip("#").strip()
            if current_blocks:
                flush_page()
            current_title = heading[:200] if heading else current_title

        current_blocks.append(block)
        current_chars += len(block)
        if current_chars >= 3000:
            flush_page()

    flush_page()
    return pages


def fetch_and_extract_url(url: str) -> Tuple[str, List[ExtractedPage], Optional[bytes]]:
    """Fetch URL and extract text content.

    Returns:
        (title, pages, pdf_bytes_or_none)
        - If the URL points to a PDF, returns (filename, [], pdf_bytes)
        - Otherwise returns (title, extracted_pages, None)
    """
    final_url, content_type, encoding, response_body = _fetch_with_safe_redirects(url)

    # If URL returns a PDF, signal caller to use PDF pipeline
    if 'application/pdf' in content_type:
        # Extract filename from URL or Content-Disposition
        filename = urlparse(final_url).path.rstrip('/').split('/')[-1]
        if not filename.lower().endswith('.pdf'):
            filename = 'downloaded.pdf'
        return filename, [], response_body

    # Parse HTML
    html = response_body.decode(encoding, errors="replace")
    soup = BeautifulSoup(html, 'html.parser')

    # Extract title
    title = ""
    og_title = _meta_content(soup, "og:title", "twitter:title")
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if og_title:
        title = og_title
    if not title:
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        title = url.split('//')[-1].split('/')[0]  # domain as fallback

    blocks = _extract_article_blocks(soup, _clean_text(title))
    pages = _split_blocks_into_pages(blocks, _clean_text(title))

    if not pages:
        raise ValueError("NO_TEXT_CONTENT")

    return title, pages, None
