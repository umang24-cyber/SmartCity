"""
backend_python/utils/cache.py
==============================
Thread-safe, TTL-based in-memory cache.

All cache operations are synchronous and safe to call from any async
FastAPI handler without blocking the event loop (dict reads/writes in
CPython are GIL-protected and effectively atomic for single key ops).

For production, swap the backing store with Redis:
  - Replace _cache dict with an aioredis connection pool.
  - set_cached/get_cached become async.
"""

import time
import threading
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Internal store: key → {"value": Any, "expires": float (epoch seconds)}
_cache: dict[str, dict] = {}
_lock = threading.Lock()


def get_cached(key: str) -> Optional[Any]:
    """
    Returns the cached value for *key* if it exists and has not expired.
    Returns None on a cache miss or expiry (also deletes the stale entry).
    """
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        if time.monotonic() < entry["expires"]:
            return entry["value"]
        # Expired — evict
        del _cache[key]
        logger.debug("Cache miss (expired): %s", key)
        return None


def set_cached(key: str, value: Any, ttl: int = 300) -> None:
    """
    Stores *value* under *key* with a TTL of *ttl* seconds.
    Overwrites any existing entry for the same key.
    """
    if ttl <= 0:
        raise ValueError(f"TTL must be positive; got {ttl}")
    with _lock:
        _cache[key] = {
            "value": value,
            "expires": time.monotonic() + ttl,
        }
    logger.debug("Cache set: %s (TTL=%ds)", key, ttl)


def invalidate(key: str) -> bool:
    """
    Removes a single key from the cache.
    Returns True if the key existed, False otherwise.
    """
    with _lock:
        existed = key in _cache
        _cache.pop(key, None)
    if existed:
        logger.debug("Cache invalidated: %s", key)
    return existed


def invalidate_prefix(prefix: str) -> int:
    """
    Removes all keys that start with *prefix*.
    Returns the number of keys deleted.
    """
    with _lock:
        keys_to_delete = [k for k in _cache if k.startswith(prefix)]
        for k in keys_to_delete:
            del _cache[k]
    if keys_to_delete:
        logger.debug("Cache invalidated %d keys with prefix '%s'", len(keys_to_delete), prefix)
    return len(keys_to_delete)


def cache_size() -> int:
    """Returns the number of entries currently in the cache (including expired)."""
    with _lock:
        return len(_cache)


def purge_expired() -> int:
    """
    Evicts all expired entries.  Call periodically if memory is a concern.
    Returns the number of entries removed.
    """
    now = time.monotonic()
    with _lock:
        expired_keys = [k for k, v in _cache.items() if now >= v["expires"]]
        for k in expired_keys:
            del _cache[k]
    if expired_keys:
        logger.debug("Cache purged %d expired entries", len(expired_keys))
    return len(expired_keys)


class TTLCache:
    """
    OOP wrapper around the module-level free functions.

    Provides a namespaced, instance-level TTL cache so services can do:

        _cache = TTLCache(ttl=3600)
        _cache.set("key", value)
        _cache.get("key")   # → value or None

    All instances share the same backing dict (_cache module global)
    but use a namespace prefix to avoid key collisions.
    """

    def __init__(self, ttl: int = 300, namespace: str = "") -> None:
        if ttl <= 0:
            raise ValueError(f"TTL must be positive; got {ttl}")
        self._ttl = ttl
        self._ns  = namespace  # optional prefix for key isolation

    def _key(self, key: str) -> str:
        return f"{self._ns}:{key}" if self._ns else key

    def get(self, key: str) -> Optional[Any]:
        """Returns cached value or None on miss/expiry."""
        return get_cached(self._key(key))

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Stores value with ttl (defaults to instance ttl)."""
        set_cached(self._key(key), value, ttl or self._ttl)

    def delete(self, key: str) -> bool:
        """Removes a single key. Returns True if it existed."""
        return invalidate(self._key(key))

    def clear_prefix(self, prefix: str) -> int:
        """Removes all keys sharing a prefix. Returns count deleted."""
        return invalidate_prefix(self._key(prefix))
