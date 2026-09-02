# syntax=docker/dockerfile:1
#
# Roadmap_Scaling.md A6 — one image, three roles. The Deployment (Helm, C2) overrides the
# command per role; the image itself never changes:
#   api      -> gunicorn app.main:app -k uvicorn.workers.UvicornWorker
#   realtime -> same app, tuned worker count + raised fd limit (set at the Deployment level)
#   worker   -> arq app.workers.arq_worker.WorkerSettings
# One image is simpler to build/tag/version than three, and guarantees identical code
# across all three roles.

FROM python:3.13-slim AS builder

# Build tools live only in this stage — a C compiler has no reason to exist in the
# shipped image (attack surface + size, and it's what "docker history shows no build
# toolchain in the final layer" checks for).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv
ENV PATH="/venv/bin:${PATH}"

WORKDIR /build
# prod.lock is the pip-compile --generate-hashes output — fully resolved and
# self-contained (no further -r includes), so it's the only requirements file the image
# needs. --require-hashes refuses to install anything that doesn't match its pinned
# hashes, the supply-chain floor the lockfile exists for.
COPY requirements/prod.lock ./requirements/prod.lock
RUN pip install --no-cache-dir --require-hashes -r requirements/prod.lock


FROM python:3.13-slim AS final

# Never run as root.
RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

RUN chown -R app:app /app
USER app

EXPOSE 8000

# Liveness probe target once this runs under K8s (C2) — checked here too so a plain
# `docker run` + curl proves the same thing this phase's TEST section asks for.
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
