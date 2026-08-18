"""Snapshots of the ledger.

Uses SQLite's online backup API rather than copying the file, so a snapshot is
consistent even if the app is mid-write. One is taken automatically on every
start, which means each redeploy leaves a restore point behind.

Manually, from anywhere:

    python -m app.backup                 # take one now
    python -m app.backup --list          # what is on hand
"""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from .config import DB_PATH

KEEP = 30


def backups_dir() -> Path:
    return DB_PATH.parent / "backups"


def existing() -> list[Path]:
    directory = backups_dir()
    if not directory.is_dir():
        return []
    return sorted(directory.glob("kakeibo-*.db"), key=lambda p: p.stat().st_mtime)


def _has_rows(path: Path) -> bool:
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            return conn.execute("SELECT COUNT(*) FROM expense").fetchone()[0] > 0
        finally:
            conn.close()
    except sqlite3.Error:
        return False


def take(reason: str = "manual", force: bool = False) -> Path | None:
    """Snapshot the ledger. Skips when nothing has changed since the last one."""
    if not DB_PATH.exists() or not _has_rows(DB_PATH):
        return None

    snapshots = existing()
    if not force and snapshots:
        # Nothing written since the newest snapshot: another copy would be noise.
        # This is what stops `--reload` spamming a snapshot on every file save.
        if snapshots[-1].stat().st_mtime >= DB_PATH.stat().st_mtime:
            return None

    directory = backups_dir()
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = directory / f"kakeibo-{stamp}-{reason}.db"

    source = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    destination = sqlite3.connect(target)
    try:
        with destination:
            source.backup(destination)
    finally:
        destination.close()
        source.close()

    for stale in existing()[:-KEEP]:
        stale.unlink(missing_ok=True)

    return target


def main() -> int:
    if "--list" in sys.argv:
        snapshots = existing()
        if not snapshots:
            print("no snapshots yet")
            return 0
        print(f"{len(snapshots)} snapshot(s) in {backups_dir()}:")
        for path in reversed(snapshots):
            when = datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  {when}  {path.stat().st_size:>8,} B  {path.name}")
        return 0

    made = take("manual", force=True)
    if made is None:
        print(f"nothing to back up — {DB_PATH} is missing or empty")
        return 1
    print(f"snapshot written: {made}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
