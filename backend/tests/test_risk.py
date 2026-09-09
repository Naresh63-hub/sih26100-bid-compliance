import pytest
from app.domain.risk import risk_assessment, name_anomalies

def test_risk_assessment_all_compliant():
    results = [
        {
            "requirement_id": "r1",
            "code": "REQ-1",
            "status": "COMPLIANT",
            "detail": "THRESHOLD",
            "reason": "Satisfies rule",
            "requirement": {"weight": 10, "category": "Technical", "evidence_required": "Doc 1"},
            "evidence": [{"text": "Quote 1"}]
        }
    ]
    summary = risk_assessment(results, [])
    assert summary["score"] == 0
    assert summary["level"] == "LOW"
    assert summary["compliance"] == 100

def test_risk_assessment_with_non_compliant_and_anomaly():
    results = [
        {
            "requirement_id": "r1",
            "code": "REQ-1",
            "status": "NON_COMPLIANT",
            "detail": "THRESHOLD",
            "reason": "Fails threshold",
            "requirement": {"weight": 20, "category": "Financial", "evidence_required": "Doc 1"},
            "evidence": [{"text": "Quote 1"}]
        }
    ]
    anomalies = [
        {"kind": "COMPANY_NAME_CONFLICT", "reason": "Name mismatch across documents", "evidence": []}
    ]
    summary = risk_assessment(results, anomalies)
    assert summary["score"] > 50
    assert summary["compliance"] == 0
    assert len(summary["factors"]) == 2

def test_name_anomalies_detection():
    chunks = [
        {"id": "c1", "text": "Company name: Vayuna Engineering Pvt Ltd"},
        {"id": "c2", "text": "Company name: Vayuna Global Solutions Ltd"}
    ]
    anomalies = name_anomalies(chunks)
    assert len(anomalies) == 1
    assert anomalies[0]["kind"] == "COMPANY_NAME_CONFLICT"
