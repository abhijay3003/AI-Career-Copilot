import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_session_secret_key_9581')
    
    # DB configuration params
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_NAME = os.getenv('DB_NAME', 'career_assistant')
    DB_USER = os.getenv('DB_USER', 'assistant_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'assistant_secure_pass')

    # Ollama Host URL configuration
    OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3')

    # Uploads rules
    UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../uploads'))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max-limit
