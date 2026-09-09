import pytest
from app.api.routes import config
from app.api.dependencies import Principal

def test_config_endpoint():
    user = Principal(user_id="officer@mopng.gov.in", role="OFFICER")
    result = config(user=user)
    assert result["user"] == "officer@mopng.gov.in"
    assert result["role"] == "OFFICER"
    assert "document_formats" in result
    assert "PDF" in result["document_formats"]
    assert "TXT" in result["document_formats"]
