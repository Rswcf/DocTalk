"""Extract text content from URLs/webpages."""
from __future__ import annotations

from typing import List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from .base import ExtractedPage

MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB
FETCH_TIMEOUT = 30  # seconds


def fetch_and_extract_url(url: str) -> Tuple[str, List[ExtractedPage], Optional[bytes]]:
    """Fetch URL and extract text content.

    Returns:
        (title, pages, pdf_bytes_or_none)
        - If the URL points to a PDF, returns (filename, [], pdf_bytes)
        - Otherwise returns (title, extracted_pages, None)
    """
    with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
        response = client.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; DocTalk/1.0)',
        })
        response.raise_for_status()

    content_type = response.headers.get('content-type', '').lower()

    if len(response.content) > MAX_CONTENT_SIZE:
        raise ValueError("URL_CONTENT_TOO_LARGE")

    # If URL returns a PDF, signal caller to use PDF pipeline
    if 'application/pdf' in content_type:
        # Extract filename from URL or Content-Disposition
        filename = url.rstrip('/').split('/')[-1]
        if not filename.lower().endswith('.pdf'):
            filename = 'downloaded.pdf'
        return filename, [], response.content

    # Parse HTML
    soup = BeautifulSoup(response.text, 'html.parser')

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
