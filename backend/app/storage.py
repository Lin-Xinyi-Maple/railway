import base64
import hashlib
import hmac
import mimetypes
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import requests
from flask import current_app


class ObsConfigError(RuntimeError):
    pass


class ObsUploadError(RuntimeError):
    pass


def _obs_config():
    bucket = current_app.config.get("OBS_BUCKET", "").strip()
    endpoint = _normalize_url(current_app.config.get("OBS_ENDPOINT", ""))
    access_key = current_app.config.get("OBS_ACCESS_KEY_ID", "").strip()
    secret_key = current_app.config.get("OBS_SECRET_ACCESS_KEY", "").strip()
    public_base_url = _normalize_url(current_app.config.get("OBS_PUBLIC_BASE_URL", ""))
    if not all([bucket, endpoint, access_key, secret_key]):
        raise ObsConfigError("OBS 未配置完整，请在 .env 中填写 OBS_BUCKET、OBS_ENDPOINT、OBS_ACCESS_KEY_ID、OBS_SECRET_ACCESS_KEY")
    return bucket, endpoint, access_key, secret_key, public_base_url


def _normalize_url(value):
    value = (value or "").strip().rstrip("/")
    if value and not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


def _obs_object_url(endpoint, bucket, object_key):
    parts = urlsplit(endpoint)
    host = parts.netloc
    if host.startswith(f"{bucket}."):
        return f"{endpoint}/{object_key}"
    if host.startswith("obs."):
        bucket_host = f"{bucket}.{host}"
        return urlunsplit((parts.scheme, bucket_host, f"/{object_key}", "", ""))
    return f"{endpoint}/{bucket}/{object_key}"


def _detect_image_extension(content):
    if content.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return "gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "webp"
    return ""


def upload_image_to_obs(file_storage, folder):
    filename = file_storage.filename or "image"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        raise ValueError("只支持 jpg、png、webp、gif 图片")

    content = file_storage.read()
    if not content:
        raise ValueError("图片文件不能为空")
    if len(content) > 5 * 1024 * 1024:
        raise ValueError("图片不能超过 5MB")
    detected_ext = _detect_image_extension(content)
    if not detected_ext:
        raise ValueError("文件内容不是受支持的图片格式")
    if detected_ext != ("jpeg" if ext == "jpg" else ext):
        raise ValueError("图片扩展名与文件内容不一致")

    content_type = file_storage.mimetype or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    bucket, endpoint, access_key, secret_key, public_base_url = _obs_config()
    object_key = f"{folder}/{datetime.now(timezone.utc):%Y%m}/{uuid4().hex}.{ext}"
    date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    canonical_resource = f"/{bucket}/{object_key}"
    canonical_headers = "x-obs-acl:public-read\n"
    string_to_sign = f"PUT\n\n{content_type}\n{date}\n{canonical_headers}{canonical_resource}"
    signature = base64.b64encode(
        hmac.new(secret_key.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")
    url = _obs_object_url(endpoint, bucket, object_key)
    response = requests.put(
        url,
        data=content,
        headers={
            "Authorization": f"OBS {access_key}:{signature}",
            "Content-Type": content_type,
            "Date": date,
            "x-obs-acl": "public-read",
        },
        timeout=30,
    )
    if not response.ok:
        detail = response.text.strip()[:500] or response.reason
        raise ObsUploadError(f"OBS 上传失败：HTTP {response.status_code}，{detail}")
    return {
        "url": f"{public_base_url}/{object_key}" if public_base_url else url,
        "object_key": object_key,
    }
