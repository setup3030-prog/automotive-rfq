"""
AI-powered competitor price estimation using Claude API.

Sends RFQ technical parameters to claude-haiku, which applies
typical injection molding benchmark rates per country and returns
estimated competitor selling prices with rationale.
"""

from __future__ import annotations
import json
import os
import logging
from typing import Optional

from app.schemas.rfq import (
    CompetitorAnalysisRequest,
    CompetitorAnalysisResponse,
    CountryEstimate,
)

logger = logging.getLogger(__name__)

_COUNTRIES = "Germany (DE), Czech Republic (CZ), Slovakia (SK), Romania (RO)"


def _build_prompt(req: CompetitorAnalysisRequest) -> str:
    grade = req.material_grade or "standard thermoplastic"
    tool_note = f"{req.tool_cost_eur:,.0f} EUR" if req.tool_cost_eur else "customer-owned"
    return f"""You are an injection molding cost analyst with deep knowledge of European manufacturing costs.

Estimate the unit selling price a manufacturer from each listed country would charge for this part.
Apply typical injection molding industry benchmark rates for that country (machine hour rate, labor rate, energy rate).
Then add a realistic 12-18% margin to arrive at the selling price range.

Part parameters:
- Cycle time: {req.cycle_time_s:.1f}s  |  Cavities: {req.cavities}  |  OEE: {req.oee_pct:.0f}%
- Shot weight: {req.shot_weight_kg:.4f} kg  |  Material: {grade} at {req.material_price_eur:.2f} EUR/kg
- Annual volume: {req.annual_volume:,} pcs  |  Tool cost: {tool_note}

Countries to estimate: {_COUNTRIES}

Instructions:
1. For each country, select realistic mid-range benchmark rates (IM industry, 100-300t machines)
2. Calculate: parts_per_hour = (3600 / cycle_time) * cavities * (oee/100)
3. machine_cost = machine_rate / parts_per_hour
4. material_cost = shot_weight * material_price / (1 - 0.03)  [3% scrap]
5. labor_cost = labor_rate / parts_per_hour
6. energy_cost = energy_rate / parts_per_hour
7. tool_amort = tool_cost_eur / annual_volume
8. total_cost = sum of above
9. selling price range = total_cost * 1.12 to total_cost * 1.18

Return ONLY valid JSON — no other text, no markdown, no explanation outside the JSON:
{{
  "countries": [
    {{
      "country": "Germany",
      "code": "DE",
      "machine_rate_eur": 78,
      "labor_rate_eur": 40,
      "energy_rate_eur": 0.21,
      "est_cost_eur": 0.0,
      "est_price_low_eur": 0.0,
      "est_price_high_eur": 0.0,
      "rationale": "One sentence: main cost driver for this country."
    }}
  ],
  "summary": "1-2 sentences on competitive positioning vs Poland."
}}"""


def run_competitor_analysis(req: CompetitorAnalysisRequest) -> CompetitorAnalysisResponse:
    """
    Call Claude API and return structured competitor analysis.
    Raises ValueError if ANTHROPIC_API_KEY is not configured.
    Raises RuntimeError on API / parsing errors.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. "
            "Add it to your environment variables (Vercel → Settings → Environment Variables)."
        )

    # Import here so the module loads even when anthropic is not installed yet
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropic package is not installed. Run: pip install anthropic"
        ) from exc

    client = anthropic.Anthropic(api_key=api_key)

    prompt = _build_prompt(req)

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        logger.error("Claude API call failed: %s", exc)
        raise RuntimeError(f"Claude API error: {exc}") from exc

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Claude returned invalid JSON: %s", raw[:500])
        raise RuntimeError(f"AI returned non-JSON response: {exc}") from exc

    countries = [
        CountryEstimate(
            country=c.get("country", ""),
            code=c.get("code", ""),
            machine_rate_eur=float(c.get("machine_rate_eur", 0)),
            labor_rate_eur=float(c.get("labor_rate_eur", 0)),
            energy_rate_eur=float(c.get("energy_rate_eur", 0)),
            est_cost_eur=float(c.get("est_cost_eur", 0)),
            est_price_low_eur=float(c.get("est_price_low_eur", 0)),
            est_price_high_eur=float(c.get("est_price_high_eur", 0)),
            rationale=str(c.get("rationale", "")),
        )
        for c in data.get("countries", [])
    ]

    return CompetitorAnalysisResponse(
        countries=countries,
        summary=str(data.get("summary", "")),
    )
