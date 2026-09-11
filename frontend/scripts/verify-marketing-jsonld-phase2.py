"""Verify phase 2 JSON-LD against prerendered DOM, never translation/source files.

Run after npm run build: python3 scripts/verify-marketing-jsonld-phase2.py
Scripts (including JSON-LD and React hydration data) cannot contribute visible text.
"""

import json
from html.parser import HTMLParser
from pathlib import Path

BUILD = Path(__file__).resolve().parents[1] / '.next/server/app'
ORIGIN = 'https://www.doctalk.site'
LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi']
# Expected rendered FAQ counts, explicitly scoped to the 22 requested pages.
PAGES = {
    'alternatives': 0,
    'alternatives/askyourpdf': 5,
    'alternatives/chatpdf': 5,
    'alternatives/humata': 5,
    'alternatives/notebooklm': 5,
    'alternatives/pdf-ai': 5,
    'compare': 0,
    'compare/askyourpdf': 4,
    'compare/chatpdf': 5,
    'compare/humata': 4,
    'compare/notebooklm': 5,
    'compare/pdf-ai': 4,
    'features': 0,
    'features/citations': 5,
    'features/free-demo': 5,
    'features/multi-format': 5,
    'features/multilingual': 4,
    'features/performance-modes': 4,
    'demo': 0,
    'pricing': 0,
    'tools': 0,
    'trust': 0,
}


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []

    def all(self, predicate):
        found = [self] if predicate(self) else []
        for child in self.children:
            if isinstance(child, Node):
                found.extend(child.all(predicate))
        return found

    def has_class(self, name):
        return name in self.attrs.get('class', '').split()

    def text(self):
        if self.tag in ('script', 'style', 'template'):
            return ''
        return ''.join(child if isinstance(child, str) else child.text() for child in self.children)


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.current = self.root
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def only(nodes):
    assert len(nodes) == 1, f'Expected one DOM node, got {len(nodes)}'
    return nodes[0]


def verify(route, locale, count):
    local_path = f'{locale}/{route}' if locale != 'en' else route
    root = Document((BUILD / f'{local_path}.html').read_text()).root
    blocks = []
    for script in root.all(lambda n: n.tag == 'script' and n.attrs.get('type') == 'application/ld+json'):
        data = json.loads(''.join(script.children))
        blocks.extend(data if isinstance(data, list) else [data])
    software = route.startswith('features/') or route == 'pricing'
    types = ['Article'] + (['FAQPage'] if count else []) + ['BreadcrumbList']
    if software:
        types.append('SoftwareApplication')
    if route == 'features/citations':
        types.append('HowTo')
    if route == 'tools':
        types.append('CollectionPage')
    assert [block['@type'] for block in blocks] == types, 'Missing, unexpected, or duplicate block'
    schemas = {block['@type']: block for block in blocks}
    for block in blocks:
        if block['@type'] == 'BreadcrumbList':
            assert 'inLanguage' not in block
        else:
            assert block['inLanguage'] == locale

    hero = only(root.all(lambda n: n.tag == 'h1'))
    lede = only(hero.parent.all(lambda n: n.has_class('ed-lede'))).text()
    article = schemas['Article']
    assert article['headline'] == hero.text()
    assert article['description'] == lede
    assert article['mainEntityOfPage']['@id'] == f'{ORIGIN}/{local_path}'
    assert article['image'] == f'{ORIGIN}/opengraph-image'
    assert article['publisher']['logo'] == f'{ORIGIN}/logo-icon.png'
    crumbs = root.all(lambda n: n.has_class('ed-crumb'))
    expected_crumbs = [dict({'@type': 'ListItem', 'position': i + 1, 'name': n.text()},
                           **({'item': ORIGIN + n.attrs['href']} if 'href' in n.attrs else {}))
                       for i, n in enumerate(crumbs)]
    assert schemas['BreadcrumbList']['itemListElement'] == expected_crumbs

    buttons = root.all(lambda n: n.tag == 'button' and n.attrs.get('id', '').startswith('ed-faq-btn-'))
    panels = root.all(lambda n: n.attrs.get('id', '').startswith('ed-faq-panel-'))
    assert len(buttons) == len(panels) == count, 'Visible FAQ count differs'
    visible = []
    for button, panel in zip(buttons, panels):
        assert button.attrs['aria-controls'] == panel.attrs['id']
        question = only(button.all(lambda n: n.has_class('ed-h3'))).text()
        answer = only(panel.all(lambda n: n.tag == 'p')).text()
        visible.append((question, answer))
    emitted = [(item['name'], item['acceptedAnswer']['text'])
               for item in schemas.get('FAQPage', {}).get('mainEntity', [])]
    assert emitted == visible, 'FAQ questions/answers differ in text or order'

    if software:
        application = schemas['SoftwareApplication']
        assert application['description'] == lede
        destination = '/pricing' if route == 'pricing' else '/demo' if route == 'features/free-demo' else ''
        assert application['url'] == ORIGIN + (f'/{locale}' if locale != 'en' else '') + (destination or ('/' if locale == 'en' else ''))
        if route == 'pricing':
            assert 'FAQPage' not in schemas
            offers = application['offers']['offers']
            assert [offer['price'] for offer in offers] == ['0', '9.99', '19.99']
            visible_paragraphs = [n.text() for n in root.all(lambda n: n.tag == 'p')]
            visible_headings = [n.text() for n in root.all(lambda n: n.tag in ('h2', 'h3'))]
            for offer in offers:
                assert offer['name'] in visible_headings
                assert offer['description'] in visible_paragraphs
    if route == 'features/citations':
        how_to = schemas['HowTo']
        step_numbers = root.all(lambda n: n.has_class('ed-num'))
        visible_steps = [
            {'@type': 'HowToStep', 'position': i + 1,
             'name': only(n.parent.all(lambda c: c.tag == 'h3')).text(),
             'text': only(n.parent.all(lambda c: c.tag == 'p')).text()}
            for i, n in enumerate(step_numbers)
        ]
        assert len(visible_steps) == 3
        assert how_to['step'] == visible_steps
        assert how_to['name'] in [n.text() for n in root.all(lambda n: n.tag == 'h2')]
        assert how_to['description'] in [n.text() for n in root.all(lambda n: n.tag == 'p')]
        assert all(q != 'Does citation highlighting work with DOCX and PPTX?' for q, _ in emitted)
    if route == 'tools':
        assert schemas['CollectionPage']['name'] == hero.text()
        assert schemas['CollectionPage']['description'] == lede
        assert schemas['CollectionPage']['url'] == f'{ORIGIN}/{local_path}'


if __name__ == '__main__':
    for route, count in PAGES.items():
        for locale in LOCALES:
            try:
                verify(route, locale, count)
            except Exception as error:
                raise AssertionError(f'/{locale}/{route}: {error}') from error
        print(f'PASS /{route}: {len(LOCALES)} locales, {count} FAQ pairs per locale')
    print(f'PASS: {len(PAGES) * len(LOCALES)} prerendered URLs; '
          f'{sum(PAGES.values()) * len(LOCALES)} exact FAQ pairs; '
          f'{3 * len(LOCALES)} exact HowTo steps; no FAQPage on pricing.')
