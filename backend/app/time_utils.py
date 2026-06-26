from datetime import datetime, timedelta, timezone


def beijing_now():
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
