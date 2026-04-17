"""
AI-powered competitor price estimation using Google Gemini API (google-genai SDK).

Sends RFQ technical parameters to Gemini, which applies
typical injection molding benchmark rates per country and returns
estimated competitor selling prices with rationale.
"""

from __future__ import annotations
import json
import os
import time
import logging

from app.schemas.rfq import (
    CompetitorAnalysisRequest,
    CompetitorAnalysisResponse,
    CountryEstimate,
)

logger = logging.getLogger(__name__)

_COUNTRIES = "Germany (DE), Czech Republic (CZ), Slovakia (SK), Romania (RO)"
_DEFAULT_MODEL = "gemini-2.5-flash"


def _build_prompt(req: CompetitorAnalysisRequest) -> str:
    grade = req.material_grade or "standard thermoplastic"
    tool_note = f"{req.tool_cost_eur:,.0f} EUR" if req.tool_cost_eur else "customer-owned"
    scrap = req.scrap_rate_pct
    return f"""You are an injection molding cost analyst with deep knowledge of European manufacturing costs.

Estimate the unit selling price a manufacturer from each listed country would charge for this part.
Apply typical injection molding industry benchmark rates for that country (machine hour rate, labor rate, energy rate).
Then add a realistic 12-18% margin to arrive at the selling price range.

Part parameters:
- Cycle time: {req.cycle_time_s:.1f}s  |  Cavities: {req.cavities}  |  OEE: {req.oee_pct:.0f}%
- Shot weight: {req.shot_weight_kg:.4f} kg  |  Material: {grade} at {req.material_price_eur:.2f} EUR/kg
- Annual volume: {req.annual_volume:,} pcs  |  Tool cost: {tool_note}  |  Scrap: {scrap:.1f}%

Countries to estimate: {_COUNTRIES}

Instructions:
1. For each country, select realistic mid-range benchmark rates (IM industry, 100-300t machines)
2. Calculate: parts_per_hour = (3600 / cycle_time) * cavities * (oee/100)
3. machine_cost = machine_rate / parts_per_hour
4. material_cost = shot_weight * material_price / (1 - scrap_rate/100)
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


def _strip_markdown_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return raw


def run_competitor_analysis(req: CompetitorAnalysisRequest) -> CompetitorAnalysisResponse:
    """
    Call Gemini API and return structured competitor analysis.
    Raises ValueError if GEMINI_API_KEY is not configured.
    Raises RuntimeError on API / parsing errors.
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. "
            "Add it to your environment variables (Vercel -> Settings -> Environment Variables). "
            "Get a key at https://aistudio.google.com/apikey."
        )

    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError as exc:
        raise RuntimeError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    model_name = os.getenv("GEMINI_MODEL", _DEFAULT_MODEL)
    prompt = _build_prompt(req)

    client = genai.Client(api_key=api_key)

    _RETRYABLE = (IOError, OSError, ConnectionError, TimeoutError)
    _MAX_RETRIES = 3
    _BACKOFF = [0.5, 1.0, 2.0]

    response = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1024,
                    response_mime_type="application/json",
                ),
            )
            break  # success
        except Exception as exc:
            exc_name = type(exc).__name__
            exc_str = str(exc).lower()
            # Retry on network / overload errors (503, 429, timeouts)
            retryable = (
                isinstance(exc, _RETRYABLE)
                or "503" in exc_str
                or "429" in exc_str
                or "timeout" in exc_str
                or "overload" in exc_str
            )
            if retryable and attempt < _MAX_RETRIES - 1:
                wait = _BACKOFF[attempt]
                logger.warning(
                    "Gemini API attempt %d/%d failed (%s: %s) — retrying in %.1fs",
                    attempt + 1, _MAX_RETRIES, exc_name, exc, wait,
                )
                time.sleep(wait)
            else:
                logger.error("Gemini API call failed after %d attempt(s): %s", attempt + 1, exc)
                raise RuntimeError(f"Gemini API error: {exc}") from exc

    try:
        raw = (response.text or "").strip()
    except Exception as exc:
        logger.error("Gemini response has no text: %s", exc)
        raise RuntimeError(f"Gemini returned empty response: {exc}") from exc

    if not raw:
        raise RuntimeError("Gemini returned empty response text.")

    raw = _strip_markdown_fences(raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON: %s", raw[:500])
        raise RuntimeError(f"AI returned non-JSON response: {exc}") from exc

    countries_raw = data.get("countries")
    if not isinstance(countries_raw, list) or not countries_raw:
        raise RuntimeError("AI response is missing 'countries' array or it is empty.")

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
        for c in countries_raw
    ]

    return CompetitorAnalysisResponse(
        countries=countries,
        summary=str(data.get("summary", "")),
    )
