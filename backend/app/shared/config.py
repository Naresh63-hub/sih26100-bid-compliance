from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'sqlite:///./backend/work/bidguard.db'
    storage_dir: Path = Path('backend/work/documents')
    api_key: str = ''
    llm_url: str = ''
    llm_api_key: str = ''
    llm_model: str = ''
    extraction_confidence_threshold: float = 0.8
    max_file_bytes: int = 10 * 1024 * 1024
    max_pages: int = 100

settings = Settings()
settings.storage_dir.mkdir(parents=True, exist_ok=True)
Path('backend/work').mkdir(parents=True, exist_ok=True)
