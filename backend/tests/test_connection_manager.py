"""Roadmap_Scaling.md A1 — proves the Redis pub/sub bus behind `ConnectionManager`
actually bridges two independent pods, plus the presence-key semantics it relies on.
Uses a fake WebSocket and two standalone `RedisPubSubBus` instances (not the shared
`connection_manager`/`pubsub_bus` singletons) against the same real Redis, so each pair
genuinely stands in for two separate API pods.
"""

import asyncio
import uuid

from app.websockets import pubsub as pubsub_module
from app.websockets.connection_manager import ConnectionManager
from app.websockets.pubsub import RedisPubSubBus


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.closed = False
        self.close_code: int | None = None

    async def accept(self) -> None:
        pass

    async def send_json(self, payload: dict) -> None:
        if self.closed:
            raise RuntimeError("socket closed")
        self.sent.append(payload)

    async def close(self, code: int = 1000) -> None:
        self.closed = True
        self.close_code = code


async def _make_manager() -> ConnectionManager:
    manager = ConnectionManager(RedisPubSubBus())
    await manager.bus.start(manager.deliver_local)
    return manager


async def _wait_until(predicate, timeout: float = 2.5) -> None:
    elapsed = 0.0
    step = 0.05
    while not predicate():
        await asyncio.sleep(step)
        elapsed += step
        if elapsed >= timeout:
            raise AssertionError("condition never became true")


async def test_message_sent_on_one_pod_is_delivered_to_a_socket_held_by_another():
    """This is the test that proves the phase: A holds the socket, B sends — the payload
    must arrive at A's socket via Redis, not just return a truthy `send_json`."""
    manager_a = await _make_manager()
    manager_b = await _make_manager()
    try:
        user_id = uuid.uuid4()
        socket = FakeWebSocket()
        await manager_a.connect(user_id, socket)

        delivered = await manager_b.send_json(user_id, {"type": "ping"})
        await _wait_until(lambda: bool(socket.sent))

        assert delivered is True
        assert socket.sent == [{"type": "ping"}]
    finally:
        await manager_a.disconnect(user_id)
        await manager_a.bus.stop()
        await manager_b.bus.stop()


async def test_is_online_is_true_from_a_manager_holding_no_local_socket():
    manager_a = await _make_manager()
    manager_b = await _make_manager()
    try:
        user_id = uuid.uuid4()
        await manager_a.connect(user_id, FakeWebSocket())

        assert await manager_b.is_online(user_id) is True
    finally:
        await manager_a.disconnect(user_id)
        await manager_a.bus.stop()
        await manager_b.bus.stop()


async def test_presence_key_expires_once_the_heartbeat_stops(monkeypatch):
    monkeypatch.setattr(pubsub_module, "PRESENCE_TTL_SECONDS", 1)
    manager = await _make_manager()
    try:
        user_id = uuid.uuid4()
        await manager.connect(user_id, FakeWebSocket())
        # `manager.bus.is_online` (not `manager.is_online`) — the latter short-circuits
        # True on the local socket dict regardless of presence-key state, which is exactly
        # right for a real caller but would make this test meaningless. `bus.is_online` is
        # the pure Redis presence check another pod's manager would actually perform.
        assert await manager.bus.is_online(user_id) is True

        # Kill the heartbeat without a clean disconnect — simulates a pod dying uncleanly.
        manager.bus._heartbeats.pop(user_id).cancel()

        await asyncio.sleep(1.3)
        assert await manager.bus.is_online(user_id) is False
    finally:
        manager._connections.pop(user_id, None)
        await manager.bus.stop()


async def test_close_all_sends_a_close_frame_and_clears_the_local_registry():
    """Roadmap_Scaling.md A3 — graceful shutdown sends every locally-held socket a real
    close frame (so clients reconnect deliberately) rather than just dropping them."""
    manager = await _make_manager()
    try:
        user_id = uuid.uuid4()
        socket = FakeWebSocket()
        await manager.connect(user_id, socket)

        await manager.close_all()

        assert socket.closed is True
        assert socket.close_code == 1012
        assert user_id not in manager._connections
        assert await manager.bus.is_online(user_id) is False
    finally:
        await manager.bus.stop()


async def test_send_json_falls_back_to_publish_when_no_pod_holds_the_socket():
    """No manager anywhere holds a socket for this user — `send_json` must not raise, and
    must report the user offline so the caller takes its persisted-inbox fallback path."""
    manager = await _make_manager()
    try:
        user_id = uuid.uuid4()
        delivered = await manager.send_json(user_id, {"type": "ping"})
        assert delivered is False
    finally:
        await manager.bus.stop()
