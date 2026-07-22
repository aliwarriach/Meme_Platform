import uuid

from fastapi import WebSocket


class ConnectionManager:
    """In-memory per-user WebSocket registry, single-process only — same no-Celery/arq
    precedent as the Phase 10 challenge worker: no multi-process/multi-instance deployment
    exists yet, so a dict is sufficient. Revisit with Redis pub/sub if the app ever runs
    more than one API process."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, WebSocket] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id] = websocket

    def disconnect(self, user_id: uuid.UUID) -> None:
        self._connections.pop(user_id, None)

    def is_online(self, user_id: uuid.UUID) -> bool:
        return user_id in self._connections

    async def send_json(self, user_id: uuid.UUID, payload: dict) -> bool:
        websocket = self._connections.get(user_id)
        if websocket is None:
            return False
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            self.disconnect(user_id)
            return False


connection_manager = ConnectionManager()
