"""Cluster-internal autoscaling signals (Roadmap_Scaling.md C4) - not for client use.
Reachable through the ALB's api catch-all route like any other endpoint, so it's
token-gated rather than trusting network position alone; the token lives in the same
Terraform-managed K8s Secret (app-secrets) both this process and KEDA's
TriggerAuthentication read from.
"""

import hmac

from arq.constants import default_queue_name
from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.core.redis import get_arq_pool
from app.websockets.pubsub import pubsub_bus

router = APIRouter(prefix="/internal/metrics", tags=["internal-metrics"])


def _check_token(x_internal_token: str | None) -> None:
    # Fails closed: no configured token (local dev, tests) means no request is ever
    # authorized, never "allow everything since nothing is set to check against".
    if not settings.internal_metrics_token or not x_internal_token:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
    if not hmac.compare_digest(x_internal_token, settings.internal_metrics_token):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")


@router.get("/ws-connections")
async def ws_connection_count(x_internal_token: str | None = Header(default=None)) -> dict[str, int]:
    """Aggregate (cluster-wide, not per-pod) active WebSocket connection count - the
    metric KEDA's realtime ScaledObject polls (deploy/helm/templates/scaledobject-realtime.yaml)."""
    _check_token(x_internal_token)
    return {"connections": await pubsub_bus.connection_count()}


@router.get("/arq-queue-depth")
async def arq_queue_depth(x_internal_token: str | None = Header(default=None)) -> dict[str, int]:
    """arq's queue (WorkerSettings sets no custom queue_name, so this is its default,
    `default_queue_name` == "arq:queue") is a Redis *sorted set* (ZADD, scored by
    due-timestamp - arq.connections.ArqRedis.enqueue_job), not a list. KEDA ships no
    sorted-set scaler at all (only redis-lists and redis-streams variants, confirmed
    against its docs 2026-08-26) - a `redis` trigger's `listLength` calls LLEN, which
    errors (WRONGTYPE) against a ZSET key and silently reads as zero forever. This
    endpoint is the metrics-api workaround KEDA's worker ScaledObject polls instead
    (deploy/helm/templates/scaledobject-worker.yaml)."""
    _check_token(x_internal_token)
    pool = await get_arq_pool()
    return {"depth": await pool.zcard(default_queue_name)}
