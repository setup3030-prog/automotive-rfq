"""
Smoke tests for competitor_ai.run_competitor_analysis.
No real API key required — all Gemini calls are mocked.
"""
import json
import sys
import types
import importlib
import pytest
from unittest.mock import patch, MagicMock

from app.schemas.rfq import CompetitorAnalysisRequest

# ─── helpers ──────────────────────────────────────────────────────────────────

VALID_JSON = json.dumps({
    "countries": [
        {"country": "Germany",        "code": "DE", "machine_rate_eur": 78,  "labor_rate_eur": 40,
         "energy_rate_eur": 0.22, "est_cost_eur": 1.20, "est_price_low_eur": 1.34, "est_price_high_eur": 1.42,
         "rationale": "High machine rates offset by precision."},
        {"country": "Czech Republic", "code": "CZ", "machine_rate_eur": 45,  "labor_rate_eur": 12,
         "energy_rate_eur": 0.18, "est_cost_eur": 0.72, "est_price_low_eur": 0.81, "est_price_high_eur": 0.85,
         "rationale": "Low labor drives competitiveness."},
        {"country": "Slovakia",       "code": "SK", "machine_rate_eur": 42,  "labor_rate_eur": 11,
         "energy_rate_eur": 0.17, "est_cost_eur": 0.68, "est_price_low_eur": 0.76, "est_price_high_eur": 0.80,
         "rationale": "Similar to CZ, slightly cheaper energy."},
        {"country": "Romania",        "code": "RO", "machine_rate_eur": 32,  "labor_rate_eur": 7,
         "energy_rate_eur": 0.14, "est_cost_eur": 0.52, "est_price_low_eur": 0.58, "est_price_high_eur": 0.62,
         "rationale": "Lowest labor cost in the group."},
    ],
    "summary": "Poland sits between CZ/SK and DE on cost structure.",
})

BASE_REQ = CompetitorAnalysisRequest(
    cycle_time_s=32.0,
    cavities=2,
    oee_pct=82.0,
    shot_weight_kg=0.085,
    material_grade="PP GF30",
    material_price_eur=1.80,
    annual_volume=250_000,
    tool_cost_eur=45_000,
    eur_rate=4.28,
    scrap_rate_pct=3.0,
)


def _mock_client(response_text: str):
    """Return a mock genai.Client whose models.generate_content returns response_text."""
    mock_response = MagicMock()
    mock_response.text = response_text

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response

    mock_client_instance = MagicMock()
    mock_client_instance.models = mock_models

    mock_genai = MagicMock()
    mock_genai.Client.return_value = mock_client_instance

    mock_types = MagicMock()
    mock_genai_types = MagicMock()

    return mock_genai, mock_types


# ─── tests ────────────────────────────────────────────────────────────────────

def test_missing_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    from app.services import competitor_ai
    with pytest.raises(ValueError, match="GEMINI_API_KEY is not set"):
        competitor_ai.run_competitor_analysis(BASE_REQ)


def test_missing_package(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    # Setting a sys.modules entry to None makes any `from google import genai` raise ImportError
    with patch.dict(sys.modules, {"google.genai": None, "google.genai.types": None}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        with pytest.raises(RuntimeError, match="google-genai package is not installed"):
            competitor_ai.run_competitor_analysis(BASE_REQ)

    # Restore module for subsequent tests
    importlib.reload(competitor_ai)


def test_happy_path(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    mock_genai, mock_types = _mock_client(VALID_JSON)

    with patch.dict(sys.modules, {"google.genai": mock_genai, "google.genai.types": mock_types}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        result = competitor_ai.run_competitor_analysis(BASE_REQ)

    assert len(result.countries) == 4
    codes = {c.code for c in result.countries}
    assert codes == {"DE", "CZ", "SK", "RO"}
    assert all(c.est_cost_eur > 0 for c in result.countries)
    assert all(c.est_price_low_eur <= c.est_price_high_eur for c in result.countries)
    assert result.summary != ""


def test_empty_text(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    mock_genai, mock_types = _mock_client("")

    with patch.dict(sys.modules, {"google.genai": mock_genai, "google.genai.types": mock_types}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        with pytest.raises(RuntimeError, match="empty response"):
            competitor_ai.run_competitor_analysis(BASE_REQ)


def test_invalid_json(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    mock_genai, mock_types = _mock_client("not a json {{{")

    with patch.dict(sys.modules, {"google.genai": mock_genai, "google.genai.types": mock_types}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        with pytest.raises(RuntimeError, match="non-JSON"):
            competitor_ai.run_competitor_analysis(BASE_REQ)


def test_missing_countries_array(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    mock_genai, mock_types = _mock_client('{"summary": "ok"}')

    with patch.dict(sys.modules, {"google.genai": mock_genai, "google.genai.types": mock_types}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        with pytest.raises(RuntimeError, match="'countries' array"):
            competitor_ai.run_competitor_analysis(BASE_REQ)


def test_markdown_fences_stripped(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    fenced = f"```json\n{VALID_JSON}\n```"
    mock_genai, mock_types = _mock_client(fenced)

    with patch.dict(sys.modules, {"google.genai": mock_genai, "google.genai.types": mock_types}):
        from app.services import competitor_ai
        importlib.reload(competitor_ai)
        result = competitor_ai.run_competitor_analysis(BASE_REQ)

    assert len(result.countries) == 4


def test_scrap_rate_in_prompt(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    from app.services import competitor_ai
    req = CompetitorAnalysisRequest(
        cycle_time_s=32.0, cavities=2, oee_pct=82.0, shot_weight_kg=0.085,
        material_price_eur=1.80, annual_volume=250_000, tool_cost_eur=0,
        eur_rate=4.28, scrap_rate_pct=8.0,
    )
    prompt = competitor_ai._build_prompt(req)
    assert "Scrap: 8.0%" in prompt
