from datetime import UTC, datetime, timedelta


class VerificationCodeStore:
    def __init__(self):
        self._memory = {}
        self._ttl_seconds = 600

    def init_app(self, app):
        self._ttl_seconds = int(app.config.get("VERIFICATION_CODE_TTL_SECONDS", 600))

    def _purge_expired(self):
        now = datetime.now(UTC)
        expired_keys = [key for key, (_, expires_at) in self._memory.items() if expires_at <= now]
        for key in expired_keys:
            self._memory.pop(key, None)

    def set(self, email, code):
        self._purge_expired()
        key = self._key(email)
        self._memory[key] = (code, datetime.now(UTC) + timedelta(seconds=self._ttl_seconds))

    def get(self, email):
        self._purge_expired()
        key = self._key(email)
        value = self._memory.get(key)
        if not value:
            return None
        code, expires_at = value
        if expires_at <= datetime.now(UTC):
            self._memory.pop(key, None)
            return None
        return code

    def delete(self, email):
        key = self._key(email)
        self._memory.pop(key, None)

    @staticmethod
    def _key(email):
        return f"verification_code:{(email or '').strip().lower()}"
