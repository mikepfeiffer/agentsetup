"""Payments service (demo stub)."""


def charge(request_id: str, amount_cents: int) -> bool:
    """Idempotent charge keyed by request_id. Amount is in minor units."""
    raise NotImplementedError
