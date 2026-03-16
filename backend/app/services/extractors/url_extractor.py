"""Extract text content from URLs/webpages."""
from __future__ import annotations

import ipaddress
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
    title = ''
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        title = url.split('//')[-1].split('/')[0]  # domain as fallback

    # Remove non-content elements
    for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header',
                               'aside', 'noscript', 'iframe', 'form']):
        tag.decompose()

    # Try to find main content area
    main_content = (
        soup.find('main') or
        soup.find('article') or
        soup.find(attrs={'role': 'main'}) or
        soup.find(id='content') or
        soup.find(class_='content') or
        soup.body or
        soup
    )

    # Extract text sections
    pages: List[ExtractedPage] = []
    current_text = []
    current_title = None
    page_num = 1

    for element in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'pre', 'blockquote', 'div']):
        text = element.get_text(separator=' ', strip=True)
        if not text:
            continue

        if element.name in ('h1', 'h2', 'h3'):
            # Start new section at headings
            if current_text:
                combined = '\n'.join(current_text)
                if combined.strip():
                    pages.append(ExtractedPage(
                        page_number=page_num,
                        text=combined,
                        section_title=current_title,
                    ))
                    page_num += 1
                current_text = []
            current_title = text
        else:
            current_text.append(text)
            # Split at ~3000 chars
            if sum(len(t) for t in current_text) > 3000:
                combined = '\n'.join(current_text)
                pages.append(ExtractedPage(
                    page_number=page_num,
                    text=combined,
                    section_title=current_title,
                ))
                page_num += 1
                current_text = []
                current_title = None

    # Flush remaining
    if current_text:
        combined = '\n'.join(current_text)
        if combined.strip():
            pages.append(ExtractedPage(
                page_number=page_num,
                text=combined,
                section_title=current_title,
            ))

    if not pages:
        raise ValueError("NO_TEXT_CONTENT")

    return title, pages, None
