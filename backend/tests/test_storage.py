import pytest
from app.infrastructure.storage import (
    SupabaseStorageService,
    get_storage_service,
    TENDER_BUCKET,
    BIDDER_BUCKET,
    REPORTS_BUCKET,
    temp_pdf_file
)

def test_storage_upload_and_download():
    service = get_storage_service()
    content = b"%PDF-1.4 test tender document content"
    path = "test-assessment-1/test-doc-1.pdf"
    
    # Upload
    stored_path = service.upload_file(TENDER_BUCKET, path, content, "application/pdf")
    assert stored_path == f"{TENDER_BUCKET}/{path}"
    
    # Download
    retrieved = service.download_file(TENDER_BUCKET, path)
    assert retrieved == content

def test_bidder_storage_path_format():
    service = get_storage_service()
    content = b"%PDF-1.4 bidder experience document"
    path = "bidder-uuid-1/exp-doc-1.pdf"
    
    stored_path = service.upload_file(BIDDER_BUCKET, path, content, "application/pdf")
    assert stored_path == f"{BIDDER_BUCKET}/{path}"
    
    retrieved = service.download_file(BIDDER_BUCKET, path)
    assert retrieved == content

def test_generated_reports_storage():
    service = get_storage_service()
    content = b"%PDF-1.4 compliance assessment report"
    path = "assessment-uuid-1/report-1.pdf"
    
    stored_path = service.upload_file(REPORTS_BUCKET, path, content, "application/pdf")
    assert stored_path == f"{REPORTS_BUCKET}/{path}"
    
    retrieved = service.download_file(REPORTS_BUCKET, path)
    assert retrieved == content

def test_missing_file_raises_not_found():
    service = get_storage_service()
    with pytest.raises(FileNotFoundError):
        service.download_file(TENDER_BUCKET, "non-existent-dir/missing-file.pdf")

def test_temp_pdf_file_cleanup():
    content = b"%PDF-1.4 transient parsing bytes"
    with temp_pdf_file(content) as temp_path:
        assert temp_path.exists()
        assert temp_path.read_bytes() == content
    assert not temp_path.exists()
