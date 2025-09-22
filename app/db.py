# app/db.py
import os
import sqlite3
from typing import List, Literal, Optional, Tuple, TypedDict

DB_PATH = os.getenv("DB_PATH", "./var/data.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.row_factory = sqlite3.Row
_conn.execute("PRAGMA journal_mode=WAL;")
_conn.executescript(
    """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  persona_slug TEXT,
  summary TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  role TEXT CHECK (role IN ('system','user','assistant')),
  content TEXT,
  created_at INTEGER
);
"""
)
_conn.commit()

Role = Literal["system", "user", "assistant"]

class ChatMessage(TypedDict):
    role: Role
    content: str

def create_session(persona_slug: Optional[str] = None) -> str:
    import uuid, time
    sid = str(uuid.uuid4())
    _conn.execute(
        "INSERT INTO sessions (id, persona_slug, summary, created_at) VALUES (?,?,?,?)",
        (sid, persona_slug, None, int(time.time() * 1000)),
    )
    _conn.commit()
    return sid

def get_session(session_id: str) -> Optional[sqlite3.Row]:
    cur = _conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,))
    return cur.fetchone()

def append_message(session_id: str, role: Role, content: str) -> None:
    import time
    _conn.execute(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (?,?,?,?)",
        (session_id, role, content, int(time.time() * 1000)),
    )
    _conn.commit()

def get_recent_messages(session_id: str, limit: int = 30) -> List[ChatMessage]:
    cur = _conn.execute(
        "SELECT role, content FROM messages WHERE session_id=? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    )
    rows = cur.fetchall()
    # reverse to old->new
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

def count_messages(session_id: str) -> int:
    cur = _conn.execute("SELECT COUNT(1) AS c FROM messages WHERE session_id=?", (session_id,))
    row = cur.fetchone()
    return int(row["c"] if row and row["c"] is not None else 0)

def set_summary(session_id: str, summary: str) -> None:
    _conn.execute("UPDATE sessions SET summary=? WHERE id=?", (summary, session_id))
    _conn.commit()
