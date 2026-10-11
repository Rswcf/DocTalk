"""Synthetic PDFs for the parse v5 heading size rule
(.collab/plans/2026-10-11-parse-heading-body-size.md). Each case writes <name>.pdf and
<name>.truth.json (the lines a human calls headings) into the output folder; the rng is
reseeded per case, so every file is reproducible on its own.

  python .collab/scripts/parse_heading_synth.py <out-dir>

Each case reproduces a failure mode measured on the owner's private corpus (2026-10-11):

S1 broker_chart_heavy   10pt body column + 5.5pt chart labels + 6.5pt tables (line median < body/1.25)
S2 two_body_sizes       10pt main text, then a 7.6pt disclosure appendix with more characters
S3 paper_12pt           12pt body, 9pt footnotes/tables/references over many pages
S4 normal_paper         10pt two-column paper, 12pt headings (control)
S5 cjk_broker           10.5pt Chinese body, 6.5pt chart labels, 14pt headings
S6 slides               landscape deck: 28pt titles, 18/14pt bullets
S7 wrapped_and_callout  3-line 18pt heading, 12pt pull quote, 10pt body, one-line bullets
S8 chart_deck           landscape chart-only deck: 12pt titles, 9pt legends, 7pt footnotes
S9 small_appendix       10pt body, then a 7pt appendix with 10pt headings
S10a/b ocr_jitter       10pt body with per-line size jitter of 0.4 / 1.2pt (OCR-like noise)
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import fitz

WORDS = (
    "the data center capex cycle remains strong as hyperscalers expand capacity for model training "
    "and inference while power availability and grid interconnection become binding constraints on "
    "new campus construction we raise our estimates for accelerator shipments and networking revenue "
    "but see downside risk to margins if memory pricing normalizes faster than expected in the second "
    "half of the year investors should weigh utilization rates against depreciation schedules and the "
    "pace of enterprise adoption which remains uneven across regions and industries"
).split()
CJK = (
    "原油价格在供给冲击下大幅上涨全球经济增速放缓通胀压力上升央行被迫收紧货币政策需求端随之走弱"
    "我们复盘历次石油危机发现油价见顶往往领先于经济衰退库存周期与地缘政治共同决定价格中枢"
)

rng = random.Random(20261011)


def sentence(n_words: int) -> str:
    w = [rng.choice(WORDS) for _ in range(n_words)]
    w[0] = w[0].capitalize()
    return " ".join(w) + "."


def paragraph(n_sent: int) -> str:
    return " ".join(sentence(rng.randint(10, 22)) for _ in range(n_sent))


def cjk_paragraph(n_chars: int) -> str:
    out = []
    while len("".join(out)) < n_chars:
        start = rng.randint(0, len(CJK) - 20)
        out.append(CJK[start:start + rng.randint(12, 20)] + "。")
    return "".join(out)[:n_chars]


def wrap(text: str, width: float, size: float, font: str) -> list[str]:
    lines, cur = [], ""
    for word in text.split(" "):
        trial = (cur + " " + word).strip()
        if fitz.get_text_length(trial, fontname=font, fontsize=size) > width and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def wrap_cjk(text: str, width: float, size: float) -> list[str]:
    per_line = max(1, int(width // size))
    return [text[i:i + per_line] for i in range(0, len(text), per_line)]


class Writer:
    def __init__(self, width=612, height=792):
        self.doc = fitz.open()
        self.w, self.h = width, height
        self.truth: list[dict] = []
        self.page = None
        self.page_no = 0

    def new_page(self):
        self.page = self.doc.new_page(width=self.w, height=self.h)
        self.page_no += 1
        return self.page

    def line(self, x, y, text, size, font="helv", heading=False):
        self.page.insert_text((x, y), text, fontsize=size, fontname=font)
        if heading:
            self.truth.append({"page": self.page_no, "text": text})
        return y + size * 1.25

    def block(self, x, y, text, width, size, font="helv", leading=1.25, heading=False):
        for ln in wrap(text, width, size, font):
            y = self.line(x, y, ln, size, font, heading)
            y += size * (leading - 1.25)
        return y

    def save(self, out: Path, name: str):
        self.doc.save(out / f"{name}.pdf")
        (out / f"{name}.truth.json").write_text(json.dumps(self.truth, indent=1), encoding="utf-8")


def chart(wr: Writer, x0, y0, w, h, n_series=3, label_size=5.5, exhibit=1):
    y = wr.line(x0, y0, f"Exhibit {exhibit}: Capex by hyperscaler, US$ bn", 8, "hebo")
    for i, tick in enumerate(["250", "200", "150", "100", "50", "0"]):
        wr.line(x0, y + 8 + i * (h / 6), tick, label_size)
    years = ["2021", "2022", "2023", "2024", "2025E", "2026E"]
    for i, yr in enumerate(years):
        wr.line(x0 + 18 + i * (w - 20) / 6, y + h + 8, yr, label_size)
    for s in range(n_series):
        wr.line(x0 + 10 + s * (w / n_series), y + h + 18, ["Microsoft", "Alphabet", "Amazon", "Meta"][s % 4], label_size)
    for i in range(6):
        wr.line(x0 + 22 + i * (w - 20) / 6, y + h * 0.45, f"{rng.randint(40, 240)}", label_size)
    return wr.line(x0, y + h + 30, "Source: Company data, Example Research estimates", 6)


def table(wr: Writer, x0, y0, cols, rows, size=6.5, colw=60):
    y = y0
    for c, head in enumerate(["Company", "FY24", "FY25E", "FY26E", "EV/EBITDA"][:cols]):
        wr.page.insert_text((x0 + c * colw, y), head, fontsize=size, fontname="hebo")
    y += size * 1.5
    for r in range(rows):
        for c in range(cols):
            cell = ["Nvidia", "Broadcom", "AMD", "Micron", "SK Hynix", "TSMC", "Oracle", "Arista"][r % 8] if c == 0 else f"{rng.uniform(1, 99):.1f}"
            wr.page.insert_text((x0 + c * colw, y), cell, fontsize=size, fontname="helv")
        y += size * 1.4
    return y


def disclosure_pages(wr: Writer, n_pages, size, title_size=9):
    for _ in range(n_pages):
        wr.new_page()
        y = wr.line(40, 60, "Disclosure appendix", title_size, "hebo", heading=True)
        y += 4
        while y < wr.h - 60:
            y = wr.block(40, y, paragraph(4), wr.w - 80, size) + size * 0.6


def s1_broker(out: Path):
    wr = Writer()
    for p in range(8):
        wr.new_page()
        y = wr.line(40, 70, f"Global Technology: section {p + 1} capex outlook", 14, "hebo", heading=True)
        y += 6
        body_x, body_w = 40, 330
        y = wr.block(body_x, y, paragraph(5), body_w, 10)
        y += 8
        y = wr.line(body_x, y, "Power is the binding constraint", 11, "hebo", heading=True)
        y = wr.block(body_x, y, paragraph(4), body_w, 10)
        y += 8
        y = wr.block(body_x, y, paragraph(3), body_w, 10)
        # right-hand chart column
        cy = chart(wr, 395, 90, 170, 120, exhibit=2 * p + 1)
        chart(wr, 395, cy + 20, 170, 120, exhibit=2 * p + 2)
        table(wr, 40, max(y + 20, 560), 5, 8, colw=70)
    disclosure_pages(wr, 2, 6.5)
    wr.save(out, "S1_broker_chart_heavy")


def s2_two_body(out: Path):
    wr = Writer()
    for p in range(4):
        wr.new_page()
        y = wr.line(50, 70, f"China Musings: theme {p + 1}", 12, "hebo", heading=True)
        y += 6
        for _ in range(4):
            y = wr.block(50, y, paragraph(4), 510, 10) + 8
        chart(wr, 50, y + 10, 250, 100, exhibit=p + 1, label_size=6)
    disclosure_pages(wr, 6, 7.6)
    wr.save(out, "S2_two_body_sizes")


def s3_paper(out: Path):
    wr = Writer()
    sec = 0
    for p in range(30):
        wr.new_page()
        y = 72
        if p % 3 == 0:
            sec += 1
            y = wr.line(72, y, f"{sec} Section heading number {sec}", 14, "hebo", heading=True) + 6
        if p % 3 == 1:
            y = wr.line(72, y, f"{sec}.1 Data and identification", 12, "hebo", heading=True) + 4
        y = wr.block(72, y, paragraph(5), 468, 12, leading=1.5) + 10
        if p % 2 == 0:
            # table of 9pt numbers
            for r in range(10):
                for c in range(6):
                    wr.page.insert_text((72 + c * 78, y), f"{rng.uniform(-3, 9):.3f}" if c else f"Row label {r}", fontsize=9, fontname="helv")
                y += 12
        else:
            y = wr.block(72, y, paragraph(4), 468, 12, leading=1.5) + 10
        # footnotes 9pt
        fy = 640
        for k in range(3):
            fy = wr.block(72, fy, f"{p * 3 + k + 1} " + paragraph(1), 468, 9)
    # references
    for p in range(6):
        wr.new_page()
        y = 72
        if p == 0:
            y = wr.line(72, y, "References", 14, "hebo", heading=True) + 6
        while y < 720:
            y = wr.block(72, y, "Author, A. and B. Author (2024). " + sentence(14), 468, 9) + 3
    wr.save(out, "S3_paper_12pt")


def s4_normal_paper(out: Path):
    wr = Writer()
    wr.new_page()
    y = wr.line(120, 80, "A Normal Two Column Paper About Attention", 17, "hebo", heading=True)
    y = wr.line(200, y + 4, "Author One, Author Two", 11)
    for p in range(6):
        if p:
            wr.new_page()
            y = 60
        for col_x in (54, 318):
            cy = y + 20
            cy = wr.line(col_x, cy, f"{p + 1}.{1 if col_x == 54 else 2} Section title", 12, "hebo", heading=True) + 4
            while cy < 700:
                cy = wr.block(col_x, cy, paragraph(3), 240, 10) + 6
            wr.line(col_x, 720, f"Figure {p + 1}: A caption that explains the figure in eight point text.", 8)
    wr.new_page()
    y = wr.line(54, 60, "References", 12, "hebo", heading=True) + 4
    while y < 740:
        y = wr.block(54, y, "[1] Author, A. " + sentence(12), 500, 9) + 2
    wr.save(out, "S4_normal_paper")


def s5_cjk(out: Path):
    wr = Writer()
    for p in range(6):
        wr.new_page()
        y = wr.line(40, 70, f"石油危机复盘之{p + 1}：油价与衰退", 14, "china-s", heading=True) + 6
        for _ in range(3):
            for ln in wrap_cjk(cjk_paragraph(260), 330, 10.5):
                y = wr.line(40, y, ln, 10.5, "china-s")
            y += 8
        # chart labels
        cy = wr.line(395, 90, f"图表{p + 1}：布伦特油价（美元/桶）", 8, "china-s")
        for i in range(30):
            wr.line(395 + (i % 5) * 34, cy + 10 + (i // 5) * 16, ["2008", "2014", "2020", "120", "80", "40"][i % 6], 6.5)
        wr.line(395, cy + 120, "资料来源：Wind，示例研究所", 6.5, "china-s")
        table(wr, 40, 600, 5, 8, size=6.5, colw=70)
    disclosure_pages(wr, 1, 7)
    wr.save(out, "S5_cjk_broker")


def s6_slides(out: Path):
    wr = Writer(792, 612)
    for p in range(10):
        wr.new_page()
        y = wr.line(50, 80, f"Quarterly results slide {p + 1}", 28, "hebo", heading=True) + 10
        for b in range(4):
            y = wr.line(70, y + 6, "• " + sentence(7)[:60], 18)
            y = wr.line(100, y + 2, "– " + sentence(6)[:55], 14)
        wr.line(50, 580, "Note: non-GAAP measures are reconciled in the appendix of this presentation.", 9)
    wr.save(out, "S6_slides")


def s7_wrapped(out: Path):
    wr = Writer()
    wr.new_page()
    y = 80
    for ln in ["Why the memory upcycle has further to run:", "pricing, capacity discipline and", "the HBM transition"]:
        y = wr.line(50, y, ln, 18, "hebo", heading=True)
    y += 8
    y = wr.block(50, y, paragraph(5), 330, 10) + 10
    # pull quote callout to the right (12pt, 4 lines)
    qy = 120
    for ln in wrap("“We think HBM demand will outgrow supply through 2027 even as capacity doubles.”", 160, 12, "helv"):
        qy = wr.line(400, qy, ln, 12)
    # one-line bullets
    for b in ["• DRAM contract prices rose for a fourth straight quarter.", "• NAND inventories normalized at module makers.", "• HBM remains sold out into next year."]:
        y = wr.line(50, y + 4, b, 10)
    y += 10
    y = wr.line(50, y, "Key risks", 12, "hebo", heading=True)
    y = wr.block(50, y, paragraph(3), 330, 10) + 10
    y = wr.block(50, y, paragraph(3), 330, 10)
    chart(wr, 395, 300, 170, 140, exhibit=1)
    table(wr, 50, max(y + 20, 600), 5, 8, colw=70)
    wr.save(out, "S7_wrapped_and_callout")

def s8_chart_deck(out: Path):
    wr = Writer(792, 612)
    for p in range(12):
        wr.new_page()
        wr.line(40, 50, f"Fixed income yields and spreads, slide {p + 1}", 12, "hebo", heading=True)
        for cx in (40, 420):
            y = wr.line(cx, 90, f"Yield by sector, {2015 + p}–{2026}", 9, "hebo")
            for i, tick in enumerate(["8%", "6%", "4%", "2%", "0%"]):
                wr.line(cx, y + 10 + i * 40, tick, 9)
            for i, lab in enumerate(["Treasuries", "Agency MBS", "IG Corp", "HY Corp", "Municipals", "Securitized"]):
                wr.line(cx + 30 + (i % 3) * 110, y + 215 + (i // 3) * 12, lab, 9)
            for i in range(6):
                wr.line(cx + 30 + i * 55, y + 200, f"{rng.uniform(1, 8):.1f}%", 9)
        fy = 520
        for ln in wrap("Source: FactSet, Bloomberg, J.P. Morgan Asset Management. " + paragraph(2), 700, 7, "helv")[:3]:
            fy = wr.line(40, fy, ln, 7)
        wr.line(40, 590, "Guide to the Markets – U.S. Data are as of September 30, 2026.", 7)
    wr.save(out, "S8_chart_deck")


def s9_small_appendix(out: Path):
    wr = Writer()
    for p in range(4):
        wr.new_page()
        y = wr.line(50, 70, f"Main report theme {p + 1}", 14, "hebo", heading=True) + 6
        for _ in range(5):
            y = wr.block(50, y, paragraph(4), 510, 10) + 8
    for p in range(6):
        wr.new_page()
        y = wr.line(50, 60, ["Analyst certification", "Important disclosures", "Rating definitions",
                             "Distribution of ratings", "Regional disclosures", "Contact information"][p], 10, "hebo", heading=True) + 4
        while y < wr.h - 60:
            y = wr.block(50, y, paragraph(5), 510, 7) + 5
    wr.save(out, "S9_small_appendix")


def s10_ocr_jitter(out: Path, name: str, jitter: float):
    wr = Writer()
    jr = random.Random(7)
    for p in range(6):
        wr.new_page()
        y = wr.line(60, 70, f"Chapter {p + 1}: scanned report section", 14 + jr.uniform(-jitter, jitter), "hebo", heading=True) + 6
        for _ in range(5):
            for ln in wrap(paragraph(4), 480, 10, "helv"):
                y = wr.line(60, y, ln, 10 + jr.uniform(-jitter, jitter))
            y += 6
    wr.save(out, name)


CASES = [
    ("S1", s1_broker), ("S2", s2_two_body), ("S3", s3_paper), ("S4", s4_normal_paper), ("S5", s5_cjk),
    ("S6", s6_slides), ("S7", s7_wrapped), ("S8", s8_chart_deck), ("S9", s9_small_appendix),
    ("S10a", lambda out: s10_ocr_jitter(out, "S10a_ocr_jitter_small", 0.4)),
    ("S10b", lambda out: s10_ocr_jitter(out, "S10b_ocr_jitter_large", 1.2)),
]

if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, make in CASES:
        rng.seed(20261011)
        make(out)
        print("wrote", name)
