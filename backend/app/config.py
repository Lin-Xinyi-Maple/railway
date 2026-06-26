import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@127.0.0.1:3306/website2026?charset=utf8mb4",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False
    CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",") if origin.strip()]
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.qq.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_AUTH_CODE = os.getenv("SMTP_AUTH_CODE", "")
    SMTP_TIMEOUT_SECONDS = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    SMTP_USE_STARTTLS = os.getenv("SMTP_USE_STARTTLS", "false").lower() in {"1", "true", "yes", "on"}
    ADMIN_INVITE_CODE = os.getenv("ADMIN_INVITE_CODE", "000000")
    JWT_ACCESS_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_DAYS", "7"))
    JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30"))
    VERIFICATION_CODE_TTL_SECONDS = int(os.getenv("VERIFICATION_CODE_TTL_SECONDS", "600"))
    BAIDU_MAP_AK = os.getenv("BAIDU_MAP_AK", "")
    OBS_ACCESS_KEY_ID = os.getenv("OBS_ACCESS_KEY_ID", "")
    OBS_SECRET_ACCESS_KEY = os.getenv("OBS_SECRET_ACCESS_KEY", "")
    OBS_BUCKET = os.getenv("OBS_BUCKET", "")
    OBS_ENDPOINT = os.getenv("OBS_ENDPOINT", "")
    OBS_PUBLIC_BASE_URL = os.getenv("OBS_PUBLIC_BASE_URL", "")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    MAIL_FROM = os.getenv("MAIL_FROM", "鲜域农品 <onboarding@resend.dev>")
