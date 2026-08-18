# syntax=docker/dockerfile:1
#
# One image, one port, one process: the Remix SPA is built and handed to
# FastAPI, which serves both the API and the interface. No Node at runtime.

# ---------------------------------------------------------------- build the UI
FROM node:22-alpine AS web

WORKDIR /build

# Lockfile first, so `npm ci` is cached until dependencies actually change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ------------------------------------------------------------------- run it
FROM python:3.12-slim AS app

ARG UID=1000
ARG GID=1000

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    KAKEIBO_DB=/data/kakeibo.db \
    KAKEIBO_FRONTEND_DIST=/app/web

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=web /build/build/client ./web

# Run unprivileged. UID matches the host user by default so a bind-mounted
# ./data stays writable without chowning anything.
RUN groupadd --gid "${GID}" kakeibo \
 && useradd --uid "${UID}" --gid "${GID}" --create-home --shell /usr/sbin/nologin kakeibo \
 && mkdir -p /data \
 && chown -R "${UID}:${GID}" /data /app

USER kakeibo

VOLUME ["/data"]
EXPOSE 8004

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8004/api/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
