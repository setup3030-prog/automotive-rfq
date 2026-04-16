"""
PDF Quote export service.
Uses fpdf2 - pure Python, no C extensions, safe on Vercel serverless.
"""

from __future__ import annotations
from io import BytesIO
from datetime import datetime, timezone
from fpdf import FPDF


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe(text: str) -> str:
    """Strip characters outside Latin-1 range (e.g. emoji) so Helvetica doesn't crash."""
    return text.encode("latin-1", errors="ignore").decode("latin-1")


def _f(value: float, decimals: int = 4) -> str:
    """Format a float with thousands separator."""
    return f"{value:,.{decimals}f}"


def _pct(value: float) -> str:
    """Format a fraction (0–1) as percentage string."""
    return f"{value * 100:.1f} %"


# ── PDF class ─────────────────────────────────────────────────────────────────

class _QuotePDF(FPDF):
    """Branded FPDF subclass with header/footer."""

    def header(self) -> None:
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(255, 255, 255)
        self.set_fill_color(15, 40, 80)
        self.cell(0, 11, "  AUTOMOTIVE INJECTION MOLDING  --  QUOTE", fill=True,
                  new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(100, 120, 160)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5,
                  f"  Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  |  CONFIDENTIAL",
                  new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def footer(self) -> None:
        self.set_y(-13)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(160, 160, 160)
        self.cell(0, 6,
                  f"Page {self.page_no()}  |  Internal use only  |  automotive-rfq",
                  align="C")


# ── Section helpers ───────────────────────────────────────────────────────────

def _section_header(pdf: FPDF, title: str) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(25, 55, 105)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 7, f"  {title}", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)


def _two_col(pdf: FPDF, rows: list[tuple[str, str]]) -> None:
    """Label / value pairs table."""
    pdf.set_font("Helvetica", "", 9)
    for label, value in rows:
        pdf.set_fill_color(242, 244, 250)
        pdf.cell(58, 6, f"  {label}", fill=True, border=0)
        pdf.set_fill_color(255, 255, 255)
        pdf.cell(122, 6, f"  {value}", fill=True, border=0, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)


def _cost_table(pdf: FPDF, rows: list[tuple[str, float]], total: float, cur: str) -> None:
    """Cost breakdown table: Component | Cost/part | Share."""
    # Header row
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(50, 75, 130)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(95, 6, "  Component", fill=True)
    pdf.cell(45, 6, f"Cost / Part ({cur})", fill=True, align="R")
    pdf.cell(40, 6, "Share", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    even = True
    for label, value in rows:
        pdf.set_font("Helvetica", "", 9)
        bg = (248, 249, 253) if even else (236, 238, 246)
        pdf.set_fill_color(*bg)
        share = value / total * 100 if total else 0
        pdf.cell(95, 6, f"  {label}", fill=True)
        pdf.cell(45, 6, _f(value, 4), fill=True, align="R")
        pdf.cell(40, 6, f"{share:.1f} %", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
        even = not even

    # Total row
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(190, 210, 245)
    pdf.cell(95, 7, "  TOTAL MANUFACTURING COST", fill=True)
    pdf.cell(45, 7, _f(total, 4), fill=True, align="R")
    pdf.cell(40, 7, "100.0 %", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)


def _pricing_table(pdf: FPDF, rows: list[tuple[str, float, float]], cur: str) -> None:
    """Pricing strategy table: Scenario | Price | Margin."""
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(50, 75, 130)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(80, 6, "  Scenario", fill=True)
    pdf.cell(60, 6, f"Unit Price ({cur})", fill=True, align="R")
    pdf.cell(40, 6, "Margin", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    row_colors = [(255, 218, 218), (255, 255, 210), (218, 248, 218)]
    for i, (label, price, margin) in enumerate(rows):
        pdf.set_font("Helvetica", "", 9)
        pdf.set_fill_color(*row_colors[i % 3])
        pdf.cell(80, 6, f"  {label}", fill=True)
        pdf.cell(60, 6, _f(price, 4), fill=True, align="R")
        pdf.cell(40, 6, _pct(margin), fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)


# ── Main builder ──────────────────────────────────────────────────────────────

def generate_quote_pdf(data: dict) -> bytes:
    """
    Build a professional A4 PDF quote and return raw bytes.
    ``data`` is the validated PDFExportRequest as a dict.
    """
    pdf = _QuotePDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=14, top=18, right=14)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    cur = data.get("currency", "PLN")
    total = data.get("total_cost", 1) or 1

    # ── 1. RFQ Identity ──────────────────────────────────────────
    _section_header(pdf, "1. RFQ Details")
    _two_col(pdf, [
        ("RFQ / Project Name",   _safe(data.get("rfq_name") or "-")),
        ("Customer",             _safe(data.get("customer") or "-")),
        ("Part Number",          _safe(data.get("part_number") or "-")),
        ("Part Description",     _safe(data.get("part_description") or "-")),
        ("Quoting Engineer",     _safe(data.get("quoting_engineer") or "-")),
        ("RFQ Date",             _safe(data.get("rfq_date") or "-")),
        ("Annual Volume (mid)",  f"{data.get('annual_volume', 0):,} pcs"),
        ("Currency",             _safe(cur)),
    ])

    # ── 2. Process Parameters ────────────────────────────────────
    _section_header(pdf, "2. Process Parameters")
    _two_col(pdf, [
        ("Cycle Time",  f"{data.get('cycle_time_s', 0):.1f} s"),
        ("Cavities",    str(data.get("cavities", 1))),
        ("OEE",         f"{data.get('oee_pct', 0):.1f} %"),
        ("Scrap Rate",  f"{data.get('scrap_rate_pct', 0):.2f} %"),
    ])

    # ── 3. Cost Breakdown ─────────────────────────────────────────
    _section_header(pdf, "3. Cost Breakdown  (per part)")
    cost_rows = [
        ("Machine & Process",       data.get("machine_cost", 0)),
        ("Material",                data.get("material_cost", 0)),
        ("Tooling Amortization",    data.get("tooling_cost", 0)),
        ("Labor (direct + indirect)", data.get("labor_cost", 0)),
        ("Energy",                  data.get("energy_cost", 0)),
        ("Overhead",                data.get("overhead_cost", 0)),
        ("Logistics & Packaging",   data.get("logistics_packaging", 0)),
    ]
    _cost_table(pdf, cost_rows, total, cur)

    # ── 4. Pricing Strategy ──────────────────────────────────────
    _section_header(pdf, "4. Pricing Strategy")
    _pricing_table(pdf, [
        ("Walk-Away  (min. margin)",  data.get("walk_away_price", 0),   data.get("walk_away_margin", 0)),
        ("Aggressive",               data.get("aggressive_price", 0),  data.get("aggressive_margin", 0)),
        ("Target",                   data.get("target_price_calc", 0), data.get("target_margin", 0)),
    ], cur)

    # ── 5. Final Unit Price (highlighted) ────────────────────────
    target_price = data.get("target_price_calc", 0)
    annual_vol = data.get("annual_volume", 0)

    pdf.set_font("Helvetica", "B", 13)
    pdf.set_fill_color(0, 95, 40)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 12,
             f"   FINAL UNIT PRICE (Target):   {_f(target_price, 4)} {cur}",
             fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_fill_color(235, 248, 235)
    pdf.cell(0, 6,
             f"   Total Annual Project Value (at mid volume):   {_f(target_price * annual_vol, 2)} {cur}",
             fill=True, new_x="LMARGIN", new_y="NEXT")

    ctp = data.get("customer_target_price")
    if ctp:
        gap = target_price - ctp
        gap_str = f"+{_f(gap, 4)}" if gap >= 0 else _f(gap, 4)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_fill_color(250, 248, 220)
        pdf.cell(0, 6,
                 f"   Customer Target Price: {_f(ctp, 4)} {cur}   |   Gap (our target vs customer): {gap_str} {cur}",
                 fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── 6. Decision ───────────────────────────────────────────────
    decision = _safe(str(data.get("decision", "-")))
    upper = decision.upper()
    if "NO GO" in upper or "NO-GO" in upper:
        bg = (170, 25, 25)
    elif "CAUTION" in upper or "RISK" in upper:
        bg = (160, 120, 0)
    else:
        bg = (20, 110, 40)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(*bg)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, f"   DECISION:  {decision}", fill=True,
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    # ── Return bytes ──────────────────────────────────────────────
    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
