from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .verification_store import VerificationCodeStore

db = SQLAlchemy()
cors = CORS()
verification_codes = VerificationCodeStore()
