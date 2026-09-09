import logging
from pathlib import Path
from tempfile import NamedTemporaryFile
from contextlib import contextmanager
import httpx
from app.shared.config import settings

logger = logging.getLogger('bidguard.storage')

TENDER_BUCKET = 'tender-documents'
BIDDER_BUCKET = 'bidder-documents'
REPORTS_BUCKET = 'generated-reports'

class SupabaseStorageService:
    def __init__(self):
        self.base_url = settings.supabase_url.rstrip('/') if settings.supabase_url else ''
        self.service_key = settings.supabase_service_role_key or settings.supabase_anon_key or settings.api_key
        self.storage_endpoint = f"{self.base_url}/storage/v1" if self.base_url else ""
        self.is_configured = bool(self.base_url and self.service_key and 'your-' not in self.service_key)
        self.local_fallback_dir = settings.storage_dir
        self.local_fallback_dir.mkdir(parents=True, exist_ok=True)

    def _headers(self, mime_type: str = 'application/pdf') -> dict:
        return {
            'Authorization': f'Bearer {self.service_key}',
            'apikey': self.service_key,
            'Content-Type': mime_type,
            'x-upsert': 'true'
        }

    def upload_file(self, bucket: str, path: str, content: bytes, mime_type: str = 'application/pdf') -> str:
        """
        Uploads file content to Supabase Storage bucket.
        Returns the full storage_path string: '{bucket}/{path}'.
        """
        storage_path = f"{bucket}/{path}"
        if self.is_configured:
            try:
                url = f"{self.storage_endpoint}/object/{bucket}/{path}"
                with httpx.Client(timeout=30.0) as client:
                    res = client.post(url, headers=self._headers(mime_type), content=content)
                    if res.status_code in (200, 201):
                        logger.info("Uploaded document to Supabase Storage: %s", storage_path)
                        return storage_path
                    else:
                        logger.warning("Supabase Storage REST returned status %d: %s. Using local fallback.", res.status_code, res.text)
            except Exception as exc:
                logger.warning("Supabase Storage upload failed: %s. Storing in local cache.", exc)

        # Fallback persistence to local storage directory matching bucket structure
        local_target = self.local_fallback_dir / bucket / path
        local_target.parent.mkdir(parents=True, exist_ok=True)
        local_target.write_bytes(content)
        logger.info("Persisted document to storage path: %s", storage_path)
        return storage_path

    def download_file(self, bucket: str, path: str) -> bytes:
        """
        Retrieves file bytes from Supabase Storage or local cache.
        """
        storage_path = f"{bucket}/{path}"
        if self.is_configured:
            try:
                url = f"{self.storage_endpoint}/object/authenticated/{bucket}/{path}"
                with httpx.Client(timeout=30.0) as client:
                    res = client.get(url, headers=self._headers())
                    if res.status_code == 200:
                        return res.content
            except Exception as exc:
                logger.warning("Supabase Storage download request failed: %s. Checking local cache.", exc)

        # Check local fallback directory
        local_target = self.local_fallback_dir / bucket / path
        if local_target.is_file():
            return local_target.read_bytes()

        # Legacy flat filename fallback
        flat_target = self.local_fallback_dir / Path(path).name
        if flat_target.is_file():
            return flat_target.read_bytes()

        raise FileNotFoundError(f"Storage object not found: {storage_path}")

    def delete_file(self, bucket: str, path: str) -> bool:
        """
        Deletes file from Supabase Storage and local cache.
        """
        storage_path = f"{bucket}/{path}"
        deleted = False
        if self.is_configured:
            try:
                url = f"{self.storage_endpoint}/object/{bucket}/{path}"
                with httpx.Client(timeout=15.0) as client:
                    res = client.delete(url, headers=self._headers())
                    if res.status_code == 200:
                        deleted = True
            except Exception as exc:
                logger.warning("Supabase Storage delete request failed: %s", exc)

        local_target = self.local_fallback_dir / bucket / path
        if local_target.exists():
            local_target.unlink()
            deleted = True
        return deleted

    def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str | None:
        """
        Generates a signed download URL for client access.
        """
        if not self.is_configured:
            return None
        try:
            url = f"{self.storage_endpoint}/object/sign/{bucket}/{path}"
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=self._headers('application/json'), json={'expiresIn': expires_in})
                if res.status_code == 200:
                    data = res.json()
                    signed = data.get('signedURL') or data.get('signedUrl')
                    if signed:
                        return f"{self.base_url}/storage/v1{signed}"
        except Exception as exc:
            logger.warning("Supabase Storage sign URL request failed: %s", exc)
        return None

storage_service = SupabaseStorageService()

def get_storage_service() -> SupabaseStorageService:
    return storage_service

@contextmanager
def temp_pdf_file(content: bytes):
    """
    Context manager creating a temporary local file for PyMuPDF processing,
    ensuring cleanup after parsing.
    """
    temp_file = NamedTemporaryFile(delete=False, suffix='.pdf', dir=str(settings.temp_dir))
    try:
        temp_file.write(content)
        temp_file.flush()
        temp_file.close()
        yield Path(temp_file.name)
    finally:
        temp_path = Path(temp_file.name)
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass
