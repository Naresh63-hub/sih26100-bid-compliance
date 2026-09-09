import hashlib
import pytest
from app.infrastructure.documents import parse_document, split_chunks

def test_parse_txt_document():
    content = "Tender clause 1: Minimum turnover 5 crore.\fClause 2: Experience 5 years.".encode("utf-8")
    parsed = parse_document("tender.txt", content)
    assert len(parsed.pages) == 2
    assert parsed.mime == "text/plain"
    assert parsed.sha256 == hashlib.sha256(content).hexdigest()

def test_parse_empty_document_raises_value_error():
    with pytest.raises(ValueError, match="non-empty"):
        parse_document("empty.txt", b"")

def test_parse_unsupported_extension_raises_value_error():
    with pytest.raises(ValueError, match="PDF or UTF-8 TXT"):
        parse_document("bid.docx", b"Sample content")

def test_split_chunks():
    pages = ["Line one.\nLine two.", "Page two line one."]
    chunks = split_chunks("doc-1", pages)
    assert len(chunks) == 3
    assert chunks[0]["page_number"] == 1
    assert chunks[0]["text"] == "Line one."
    assert chunks[2]["page_number"] == 2
    assert chunks[2]["text"] == "Page two line one."
