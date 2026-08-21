import uuid

from fastapi import WebSocket

from app.websockets.pubsub import RedisPubSubBus, pubsub_bus


class ConnectionManager:
    """Per-pod local WebSocket registry, backed by a Redis pub/sub bus for cross-pod
    delivery (Roadmap_Scaling.md A1). Actual `WebSocket` objects are inherently
    per-process, so the local dict stays — what changes is what happens when the socket
    *isn't* local: publish onto that user's Redis channel instead of dropping the message.
    """

    def __init__(self, bus: RedisPubSubBus | None = None) -> None:
        self._connections: dict[uuid.UUID, WebSocket] = {}
        self.bus = bus or pubsub_bus

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id] = websocket
        await self.bus.subscribe(user_id)
        await self.bus.mark_online(user_id)

    async def disconnect(self, user_id: uuid.UUID) -> None:
        self._connections.pop(user_id, None)
        await self.bus.unsubscribe(user_id)
        await self.bus.mark_offline(user_id)

    async def is_online(self, user_id: uuid.UUID) -> bool:
        """Async now — presence for a user not held locally is a Redis round trip. Callers
        that used to call this synchronously must `await` it."""
        if user_id in self._connections:
            return True
        return await self.bus.is_online(user_id)

    async def send_json(self, user_id: uuid.UUID, payload: dict) -> bool:
        """Returns whether the recipient was online (locally, or on another pod via
        presence) at send time — **not** "delivered to a live socket" as before: this pod
        cannot synchronously confirm that a remote pod's local send actually succeeded.
        This is acceptable because the fallback path a caller takes on a falsy/uncertain
        result is a persisted inbox row or push notification either way, never a delivery
        guarantee — but callers must not treat a truthy return as delivery confirmation.
        """
        websocket = self._connections.get(user_id)
        if websocket is not None:
            try:
                await websocket.send_json(payload)
                return True
            except Exception:
                await self.disconnect(user_id)
        online = await self.bus.is_online(user_id)
        await self.bus.publish(user_id, payload)
        return online

    async def deliver_local(self, user_id: uuid.UUID, payload: dict) -> None:
        """Callback registered with this pod's `RedisPubSubBus.start()` — invoked when
        another pod publishes for a user this pod actually holds a local socket for."""
        websocket = self._connections.get(user_id)
        if websocket is None:
            return
        try:
            await websocket.send_json(payload)
        except Exception:
            await self.disconnect(user_id)

    async def close_all(self, code: int = 1012) -> None:
        """Called from `app/main.py`'s graceful shutdown (Roadmap_Scaling.md A3) —
        sends every locally-held socket a real close frame (default 1012, "Service
        Restart") so clients reconnect deliberately rather than hang on a half-open
        connection until their own read eventually times out."""
        for user_id, websocket in list(self._connections.items()):
            try:
                await websocket.close(code=code)
            except Exception:
                pass
            await self.disconnect(user_id)


connection_manager = ConnectionManager()
