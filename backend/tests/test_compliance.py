from datetime import date
from decimal import Decimal
import pytest
from app.domain.compliance import evaluate, money
from app.domain.schemas import RequirementData, Rule

def make_req(rule_type: str, key: str, minimum=None, unit="crore", mandatory=True, confirmed=True) -> RequirementData:
    rule_dict = {"type": rule_type, "key": key, "unit": unit}
    if minimum is not None:
        rule_dict["minimum"] = minimum
    if rule_type == "average":
        rule_dict["years"] = ["FY 2021-22", "FY 2022-23", "FY 2023-24"]
    rule = Rule(**rule_dict)
    return RequirementData(
        code="REQ-TEST",
        text=f"Test clause for {key}",
        category="Financial",
        mandatory=mandatory,
        weight=10,
        source_document="doc-1",
        source_page=1,
        source_chunk="chunk-1",
        source_quote=f"Minimum {key}: {minimum} {unit}",
        confidence=0.95,
        confirmed=confirmed,
        evidence_required=f"Valid {key} certification",
        rule=rule
    )

def test_money_converter():
    assert money("5", "crore") == Decimal("5")
    assert money("50", "lakh") == Decimal("0.5")
    assert money("50000000", "inr") == Decimal("5")

def test_minimum_turnover_compliant():
    req = make_req("minimum", "turnover", minimum=5.0, unit="crore")
    chunks = [
        {"id": "c1", "document_id": "d1", "page_number": 1, "text": "Annual turnover = 7.2 crore."}
    ]
    res = evaluate(req, chunks, as_of=date(2026, 9, 9))
    assert res["status"] == "COMPLIANT"
    assert "7.2" in res["calculation"]

def test_minimum_turnover_non_compliant():
    req = make_req("minimum", "turnover", minimum=5.0, unit="crore")
    chunks = [
        {"id": "c1", "document_id": "d1", "page_number": 1, "text": "Annual turnover = 3.8 crore."}
    ]
    res = evaluate(req, chunks, as_of=date(2026, 9, 9))
    assert res["status"] == "NON_COMPLIANT"

def test_missing_evidence_needs_review():
    req = make_req("minimum", "turnover", minimum=5.0, unit="crore")
    chunks = [
        {"id": "c1", "document_id": "d1", "page_number": 1, "text": "Unrelated text without keyword."}
    ]
    res = evaluate(req, chunks, as_of=date(2026, 9, 9))
    assert res["status"] == "NEEDS_REVIEW"
    assert res["detail"] == "MISSING"

def test_unconfirmed_clause_needs_review():
    req = make_req("minimum", "turnover", minimum=5.0, unit="crore", confirmed=False)
    chunks = [
        {"id": "c1", "document_id": "d1", "page_number": 1, "text": "Annual turnover = 7.2 crore."}
    ]
    res = evaluate(req, chunks, as_of=date(2026, 9, 9))
    assert res["status"] == "NEEDS_REVIEW"
    assert res["detail"] == "UNCONFIRMED"

def test_conflicting_evidence_needs_review():
    req = make_req("minimum", "turnover", minimum=5.0, unit="crore")
    chunks = [
        {"id": "c1", "document_id": "d1", "page_number": 1, "text": "Annual turnover = 7.2 crore."},
        {"id": "c2", "document_id": "d2", "page_number": 3, "text": "Annual turnover = 4.1 crore."}
    ]
    res = evaluate(req, chunks, as_of=date(2026, 9, 9))
    assert res["status"] == "NEEDS_REVIEW"
    assert res["detail"] == "CONFLICT"
