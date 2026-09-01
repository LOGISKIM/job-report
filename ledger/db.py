"""SQLite 저장소. 표준 라이브러리만 사용한다."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from parser import Transaction

DEFAULT_DB = Path(__file__).parent / "ledger.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    merchant    TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    installment TEXT NOT NULL DEFAULT '일시불',
    canceled    INTEGER NOT NULL DEFAULT 0,
    category    TEXT,
    source      TEXT NOT NULL DEFAULT 'webhook',
    raw         TEXT,
    created_at  TEXT NOT NULL,
    UNIQUE (ts, merchant, amount, canceled)
);
"""


def connect(db_path: Path = DEFAULT_DB) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def insert(conn: sqlite3.Connection, tx: Transaction, source: str = "webhook",
           category: Optional[str] = None) -> bool:
    """저장 성공 시 True, 중복이면 False."""
    try:
        conn.execute(
            "INSERT INTO transactions (ts, merchant, amount, installment, canceled,"
            " category, source, raw, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (
                tx.ts.isoformat(), tx.merchant, tx.amount, tx.installment,
                int(tx.canceled), category, source, tx.raw,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def insert_many(conn: sqlite3.Connection, txs: Iterable[Transaction],
                source: str) -> tuple[int, int]:
    """(신규 저장 건수, 중복 스킵 건수)를 반환."""
    added = skipped = 0
    for tx in txs:
        if insert(conn, tx, source=source):
            added += 1
        else:
            skipped += 1
    return added, skipped


def fetch_between(conn: sqlite3.Connection, start: datetime, end: datetime) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM transactions WHERE ts >= ? AND ts < ? ORDER BY ts",
        (start.isoformat(), end.isoformat()),
    ).fetchall()
