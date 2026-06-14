import os
from typing import Any, Dict

try:
    from supabase import create_client, Client
except Exception:
    create_client = None
    Client = None


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key or create_client is None:
        return None
    _client = create_client(url, key)
    return _client


def log_generation(req, kind: str, payload: Dict[str, Any]):
    client = _get_client()
    if client is None:
        return
    record = {
        "user_id": req.user_id,
        "kind": kind,
        "genre": req.genre,
        "payload": payload,
        "opt_in": req.opt_in,
    }
    client.table("ai_generations").insert(record).execute()


def store_feedback(user_id: str, accepted: bool, pattern: Dict[str, Any], genre: str):
    client = _get_client()
    if client is None:
        return
    client.table("ai_feedback").insert(
        {
            "user_id": user_id,
            "accepted": accepted,
            "pattern": pattern,
            "genre": genre,
        }
    ).execute()


def store_midi(user_id: str, midi_url: str):
    client = _get_client()
    if client is None:
        return
    client.table("midi_files").insert({"user_id": user_id, "midi_url": midi_url}).execute()


def enqueue_training_batch(user_id: str, batch_id: str):
    client = _get_client()
    if client is None:
        return
    client.table("training_batches").insert({"user_id": user_id, "batch_id": batch_id}).execute()
