"""kaKeiBo — a local, single-screen kakeibo ledger.

FastAPI serves the JSON API and, once the Remix SPA is built, the app itself.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import backup
from .config import CORS_ORIGINS, CURRENCY, DB_PATH, FRONTEND_DIST, LOCALE
from .db import init_db
from .models import CATEGORIES, CATEGORY_META
from .routers import (
    accounts,
    budget,
    compare,
    dashboard,
    expenses,
    months,
    rewards,
)


log = logging.getLogger("kakeibo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Snapshot before touching anything, so every restart and redeploy leaves a
    # restore point. Skipped when nothing has changed since the last one.
    snapshot = backup.take("startup")
    if snapshot:
        log.info("ledger snapshot: %s", snapshot)

    applied = init_db()
    if applied:
        log.info("applied schema migrations: %s", applied)

    yield


app = FastAPI(
    title="kaKeiBo",
    description="Household financial ledger, kakeibo style. Local, single user, no auth.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(expenses.router)
app.include_router(months.router)
app.include_router(compare.router)
app.include_router(budget.router)
app.include_router(accounts.router)
app.include_router(accounts.transfers)
app.include_router(rewards.router)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "database": str(DB_PATH),
        "currency": CURRENCY,
        "locale": LOCALE,
        "categories": list(CATEGORIES),
        "category_meta": CATEGORY_META,
        "frontend_built": FRONTEND_DIST.is_dir(),
        "schema_version": _schema_version(),
        "snapshots": len(backup.existing()),
        "latest_snapshot": (
            backup.existing()[-1].name if backup.existing() else None
        ),
    }


def _schema_version() -> int:
    from .db import connect
    from .migrations import current_version

    conn = connect()
    try:
        return current_version(conn)
    finally:
        conn.close()


# ---------------------------------------------------------------- the SPA
# Served only once `npm run build` has produced it; in development the Remix dev
# server hosts the UI and proxies /api here instead.
if FRONTEND_DIST.is_dir():
    index_file = FRONTEND_DIST / "index.html"

    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets", check_dir=False),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index_file)

else:

    @app.get("/", include_in_schema=False)
    def not_built() -> JSONResponse:
        return JSONResponse(
            {
                "message": "API is running. The UI has not been built yet.",
                "build_the_ui": "cd frontend && npm install && npm run build",
                "or_run_it_in_dev": "cd frontend && npm run dev  (http://localhost:8004)",
                "api_docs": "/docs",
            }
        )
