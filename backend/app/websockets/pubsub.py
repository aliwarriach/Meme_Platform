"""Redis pub/sub bus behind the per-user WebSocket connection manager
(Roadmap_Scaling.md A1). A `WebSocket` object is inherently per-process, so once more
than one API/realtime pod exists, a message for a user connected to *another* pod has to
travel through something shared. This is that something:

- **Per-user channels** (`ws:user:{user_id}`), not one global channel every pod filters
  locally — a pod only receives messages for users it actually holds a local socket for.
- **A TTL presence key** (`ws:online:{user_id}`), not a set — self-healing if a pod dies
  uncleanly (the key just expires) rather than marking a user online forever.
"""

import asyncio
import contextlib
import json
import logging
import uuid
from collections.abc import Awaitable, Callable

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

PRESENCE_TTL_SECONDS = 60
PRESENCE_HEARTBEAT_SECONDS = 30

# Identifies which pod currently holds a user's socket, for debugging/observability only
# — no code path branches on comparing this against another pod's id.
POD_ID = uuid.uuid4().hex

OnMessage = Callable[[uuid.UUID, dict], Awaitable[None]]


def _channel(user_id: uuid.UUID) -> str:
    return f"ws:user:{user_id}"


def _presence_key(user_id: uuid.UUID) -> str:
    return f"ws:online:{user_id}"


class RedisPubSubBus:
    """One instance per pod. Owns the pod's single long-lived pub/sub connection —
    separate from `app/core/redis.py`'s arq enqueue pool, since a connection in subscribe
    mode can't serve other Redis commands — plus per-user heartbeat tasks that refresh the
    presence TTL while a socket lives.
    """

    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._pubsub = None
        self._listen_task: asyncio.Task | None = None
        self._heartbeats: dict[uuid.UUID, asyncio.Task] = {}
        self._on_message: OnMessage | None = None

    def _get_redis(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    async def start(self, on_message: OnMessage) -> None:
        """Call once per pod (`app/main.py`'s `lifespan`). `on_message` is invoked with
        every message this pod's listener receives on a channel it's subscribed to — i.e.
        for a user this pod actually holds a local socket for."""
        self._on_message = on_message
        redis = self._get_redis()
        self._pubsub = redis.pubsub()
        self._listen_task = asyncio.create_task(self._listen())

    async def stop(self) -> None:
        if self._listen_task is not None:
            self._listen_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listen_task
            self._listen_task = None
        for task in self._heartbeats.values():
            task.cancel()
        self._heartbeats.clear()
        if self._pubsub is not None:
            await self._pubsub.aclose()
            self._pubsub = None
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def _listen(self) -> None:
        # Deliberately not `pubsub.listen()`: that async generator's own loop condition is
        # `while self.subscribed`, i.e. it returns immediately (no error, no re-entry) the
        # moment zero channels are subscribed — which is exactly the state at pod startup,
        # before any user has connected. A background task started once at startup
        # (`app/main.py`'s lifespan) must survive that, so this polls instead: `get_message`
        # only needs the pubsub connection to exist (set on the first ever subscribe), not
        # a currently non-empty channel set.
        assert self._pubsub is not None
        while True:
            if self._pubsub.connection is None:
                await asyncio.sleep(0.1)
                continue
            try:
                message = await self._pubsub.get_message(timeout=1.0)
            except Exception:
                logger.exception("Redis pub/sub read failed, retrying")
                await asyncio.sleep(0.5)
                continue
            if message is None or message["type"] != "message":
                continue
            try:
                user_id = uuid.UUID(message["channel"].removeprefix("ws:user:"))
                payload = json.loads(message["data"])
            except (ValueError, TypeError, json.JSONDecodeError):
                logger.warning("Dropping malformed pubsub message on %s", message.get("channel"))
                continue
            if self._on_message is not None:
                await self._on_message(user_id, payload)

    async def subscribe(self, user_id: uuid.UUID) -> None:
        if self._pubsub is None:
            # Bus never started (e.g. no real ASGI lifespan in this test/process) — the
            # local socket still works, it just can't receive cross-pod deliveries.
            return
        await self._pubsub.subscribe(_channel(user_id))

    async def unsubscribe(self, user_id: uuid.UUID) -> None:
        if self._pubsub is None:
            return
        await self._pubsub.unsubscribe(_channel(user_id))

    async def publish(self, user_id: uuid.UUID, payload: dict) -> None:
        redis = self._get_redis()
        await redis.publish(_channel(user_id), json.dumps(payload))

    async def is_online(self, user_id: uuid.UUID) -> bool:
        redis = self._get_redis()
        return bool(await redis.exists(_presence_key(user_id)))

    async def mark_online(self, user_id: uuid.UUID) -> None:
        redis = self._get_redis()
        await redis.set(_presence_key(user_id), POD_ID, ex=PRESENCE_TTL_SECONDS)
        existing = self._heartbeats.pop(user_id, None)
        if existing is not None:
            existing.cancel()
        self._heartbeats[user_id] = asyncio.create_task(self._heartbeat(user_id))

    async def mark_offline(self, user_id: uuid.UUID) -> None:
        task = self._heartbeats.pop(user_id, None)
        if task is not None:
            task.cancel()
        redis = self._get_redis()
        await redis.delete(_presence_key(user_id))

    async def _heartbeat(self, user_id: uuid.UUID) -> None:
        redis = self._get_redis()
        with contextlib.suppress(asyncio.CancelledError):
            while True:
                await asyncio.sleep(PRESENCE_HEARTBEAT_SECONDS)
                await redis.set(_presence_key(user_id), POD_ID, ex=PRESENCE_TTL_SECONDS)


pubsub_bus = RedisPubSubBus()
