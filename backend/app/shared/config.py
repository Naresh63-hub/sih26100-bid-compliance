from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dynamically locate root .env
ROOT_DIR = Path(__file__).resolve().parents[3] if len(Path(__file__).resolve().parents) >= 4 else Path('.')
ENV_FILE = ROOT_DIR / '.env' if (ROOT_DIR / '.env').exists() else Path('.env')

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE) if ENV_FILE.exists() else None, extra='ignore')
    
    # Supabase Configuration
    supabase_url: str = 'https://staolrteifagjcoklrcn.supabase.co'
    supabase_service_role_key: str = ''
    supabase_anon_key: str = ''
    
    # Database
    database_url: str = 'sqlite:///./backend/work/bidguard.db'
    
    # Local transient working directories
    storage_dir: Path = Path('backend/work/documents')
    temp_dir: Path = Path('backend/work/tmp')
    
    # Auth & LLM
    api_key: str = 'bidguard-internal-secure-key'
    llm_url: str = ''
    llm_api_key: str = ''
    llm_model: str = ''
    extraction_confidence_threshold: float = 0.8
    
    # Limits
    max_file_bytes: int = 10 * 1024 * 1024
    max_pages: int = 100

settings = Settings()
settings.storage_dir.mkdir(parents=True, exist_ok=True)
settings.temp_dir.mkdir(parents=True, exist_ok=True)
Path('backend/work').mkdir(parents=True, exist_ok=True)
