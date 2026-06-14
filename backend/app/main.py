from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
import time

from models.inference import (
    generate_drums,
    generate_bassline,
    generate_melody,
    generate_chords,
    generate_arrangement,
)
from services.legal import enforce_phase0
from services.db import log_generation, store_feedback, store_midi, enqueue_training_batch

app = FastAPI(title="Beat Addicts AI Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerationRequest(BaseModel):
    user_id: str = Field(default="local-user")
    genre: Optional[str] = None
    mood: Optional[str] = None
    complexity: Optional[int] = None
    density: Optional[int] = None
    opt_in: bool = False
    license_ok: bool = False
    generation_limit_ok: bool = False
    preferences: Dict[str, Any] = Field(default_factory=dict)
    # optional mapping of instrument -> local sample id (metadata only)
    sample_config: Optional[Dict[str, str]] = None
    seed: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate/drums")
def drums(req: GenerationRequest):
    enforce_phase0(req)
    result = generate_drums(req)
    # ensure sampleMapping present so frontend can map instruments -> local sample ids
    if isinstance(result, dict):
        if "sampleMapping" not in result:
            result["sampleMapping"] = req.sample_config or {}
        if "seed" not in result:
            result["seed"] = req.seed or f"backend-{int(time.time())}"

    log_generation(req, "drums", result)
    return result


@app.post("/generate/bassline")
def bassline(req: GenerationRequest):
    enforce_phase0(req)
    result = generate_bassline(req)
    log_generation(req, "bassline", result)
    return result


@app.post("/generate/melody")
def melody(req: GenerationRequest):
    enforce_phase0(req)
    result = generate_melody(req)
    log_generation(req, "melody", result)
    return result


@app.post("/generate/chords")
def chords(req: GenerationRequest):
    enforce_phase0(req)
    result = generate_chords(req)
    log_generation(req, "chords", result)
    return result


@app.post("/generate/arrangement")
def arrangement(req: GenerationRequest):
    enforce_phase0(req)
    result = generate_arrangement(req)
    log_generation(req, "arrangement", result)
    return result


class PulseRequest(BaseModel):
    message: str
    conversationHistory: Optional[list] = None


@app.post("/pulse/chat")
def pulse_chat(req: PulseRequest):
    # Placeholder so frontend can route all AI traffic through the same backend.
    return {"reply": "Pulse is online. AI backend connected."}


class FeedbackRequest(BaseModel):
    user_id: str
    accepted: bool
    genre: Optional[str] = None
    pattern: Dict[str, Any] = Field(default_factory=dict)


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    store_feedback(req.user_id, req.accepted,
                   req.pattern, req.genre or "unknown")
    return {"status": "ok"}


class MidiRequest(BaseModel):
    user_id: str
    midi_url: str


@app.post("/midi")
def midi(req: MidiRequest):
    store_midi(req.user_id, req.midi_url)
    return {"status": "ok"}


class TrainingBatchRequest(BaseModel):
    user_id: str
    batch_id: str


@app.post("/training/batch")
def training_batch(req: TrainingBatchRequest):
    enqueue_training_batch(req.user_id, req.batch_id)
    return {"status": "ok"}
