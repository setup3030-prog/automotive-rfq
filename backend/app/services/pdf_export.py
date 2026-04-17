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
    # Use the raw (pre-sanitize) string for logic so emoji don't affect branching.
    decision_raw = str(data.get("decision", "-"))
    decision = _safe(decision_raw)
    ctrl = decision_raw.upper().replace(" ", "").replace("-", "")
    if "NOGO" in ctrl:
        bg = (170, 25, 25)
    elif "CAUTION" in ctrl or "RISK" in ctrl:
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


# ── CFO Summary PDF ───────────────────────────────────────────────────────────

def _watermark(pdf: FPDF) -> None:
    """Print diagonal CONFIDENTIAL watermark on current page."""
    pdf.set_font("Helvetica", "B", 38)
    pdf.set_text_color(220, 220, 220)
    with pdf.rotation(angle=45, x=105, y=148):
        pdf.text(x=30, y=165, txt="CONFIDENTIAL — INTERNAL USE ONLY")
    pdf.set_text_color(0, 0, 0)


def _flag_cell(pdf: FPDF, value: str, flag: str) -> None:
    """Single cell with green/yellow/red background."""
    colors = {"green": (218, 248, 218), "yellow": (255, 255, 210), "red": (255, 218, 218)}
    pdf.set_fill_color(*colors.get(flag, (240, 240, 240)))
    pdf.cell(40, 6, value, fill=True, align="C")


def generate_cfo_summary_pdf(data: dict) -> bytes:
    """
    Build a 1-2 page internal CFO summary PDF.
    ``data`` must contain pre-calculated financial fields:
      program, customer, rfq_date, quoting_engineer, currency,
      npv, irr, payback_months, roce_y3, peak_wc, tooling_exposure,
      meets_hurdle, pnl_years, top_risks, fx_summary, conditions
    """
    pdf = _QuotePDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=14, top=18, right=14)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    cur = _safe(data.get("currency", "PLN"))

    # ── Watermark ────────────────────────────────────────────────
    _watermark(pdf)

    # ── Header ───────────────────────────────────────────────────
    _section_header(pdf, "CFO PROGRAM SUMMARY — CONFIDENTIAL")
    _two_col(pdf, [
        ("Program",          _safe(data.get("program", "-"))),
        ("Customer",         _safe(data.get("customer", "-"))),
        ("Quoting Engineer", _safe(data.get("quoting_engineer", "-"))),
        ("Date",             _safe(data.get("rfq_date", "-"))),
    ])

    # ── 1. KPI Financial ─────────────────────────────────────────
    _section_header(pdf, "1. Financial KPIs")
    kpis = [
        ("Program NPV",      data.get("npv_str", "-"),          data.get("npv_flag", "green")),
        ("IRR",              data.get("irr_str", "-"),           data.get("irr_flag", "green")),
        ("Payback",          data.get("payback_str", "-"),       data.get("payback_flag", "green")),
        ("ROCE Y3",          data.get("roce_str", "-"),          data.get("roce_flag", "green")),
        ("Peak WC",          data.get("peak_wc_str", "-"),       data.get("wc_flag", "green")),
        ("Tooling Exposure", data.get("tooling_str", "-"),       "none"),
    ]
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(50, 75, 130)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(90, 6, "  KPI", fill=True)
    pdf.cell(40, 6, "Value", fill=True, align="C")
    pdf.cell(40, 6, "Status", fill=True, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    for label, value, flag in kpis:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_fill_color(242, 244, 250)
        pdf.cell(90, 6, f"  {_safe(label)}", fill=True)
        pdf.set_fill_color(255, 255, 255)
        pdf.cell(40, 6, _safe(str(value)), fill=True, align="C")
        _flag_cell(pdf, flag.upper() if flag != "none" else "-", flag)
        pdf.ln()
    pdf.ln(3)

    # ── 2. P&L Summary ───────────────────────────────────────────
    pnl_rows = data.get("pnl_years", [])
    if pnl_rows:
        _section_header(pdf, "2. P&L Summary")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(50, 75, 130)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(20, 6, "Year", fill=True)
        pdf.cell(45, 6, f"Revenue ({cur})", fill=True, align="R")
        pdf.cell(30, 6, "GM%", fill=True, align="R")
        pdf.cell(45, 6, f"EBITDA ({cur})", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        for row in pnl_rows[:7]:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_fill_color(248, 249, 253)
            pdf.cell(20, 6, _safe(str(row.get("year", ""))), fill=True)
            pdf.cell(45, 6, _safe(str(row.get("revenue", ""))), fill=True, align="R")
            pdf.cell(30, 6, _safe(str(row.get("gm_pct", ""))), fill=True, align="R")
            pdf.cell(45, 6, _safe(str(row.get("ebitda", ""))), fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    # ── 3. Top Risks ──────────────────────────────────────────────
    top_risks = data.get("top_risks", [])
    if top_risks:
        _section_header(pdf, "3. Top Risk Scenarios")
        for risk in top_risks[:3]:
            pdf.set_font("Helvetica", "", 9)
            flag = "green" if risk.get("still_meets_hurdle") else "red"
            colors = {"green": (218, 248, 218), "red": (255, 218, 218)}
            pdf.set_fill_color(*colors.get(flag, (240, 240, 240)))
            pdf.cell(0, 6, f"  {_safe(risk.get('name',''))}  |  DNPV: {_safe(risk.get('delta_npv_str',''))}  |  {_safe(risk.get('status',''))}",
                     fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    # ── 4. FX Exposure ────────────────────────────────────────────
    fx = data.get("fx_summary", {})
    if fx:
        _section_header(pdf, "4. FX Exposure Summary")
        _two_col(pdf, [
            ("Net Open Position (EUR)", _safe(fx.get("net_open_str", "-"))),
            ("Natural Hedge",            _safe(fx.get("natural_hedge_str", "-"))),
            ("Hedge Ratio",              _safe(fx.get("hedge_ratio_str", "-"))),
            ("Margin Impact EUR +10%",   _safe(fx.get("margin_plus_str", "-"))),
        ])

    # ── 5. Recommendation ────────────────────────────────────────
    _section_header(pdf, "5. GO / NO-GO Recommendation")
    meets = data.get("meets_hurdle", False)
    bg = (20, 110, 40) if meets else (170, 25, 25)
    label = "GO" if meets else "NO GO"
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(*bg)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, f"   {label}", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)
    conditions = data.get("conditions", [])
    if conditions:
        pdf.set_font("Helvetica", "", 9)
        for c in conditions:
            pdf.cell(0, 6, f"  * {_safe(str(c))}", new_x="LMARGIN", new_y="NEXT")

    # Watermark on every page
    for pg in range(1, pdf.page + 1):
        pdf.page = pg
        _watermark(pdf)
    pdf.page = pdf.pages

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
