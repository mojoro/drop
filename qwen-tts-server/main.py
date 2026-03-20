"""
Qwen3-TTS sidecar for Drop.

Exposes the same HTTP contract as tts-server/main.py so the Next.js
app can treat it as a drop-in alternative TTS backend:

  GET  /health           → {"status": "ok", "model_loaded": bool}
  GET  /tts/voices       → {"builtin": [...], "custom": []}
  POST /tts/generate     → audio/wav (StreamingResponse)

Uses the Qwen3-TTS-12Hz-*-CustomVoice model by default — 9 named
speakers, no reference audio required. Set QWEN_MODEL to override.

GPU is strongly recommended. CPU inference works but is very slow.
"""

import io
import logging
import os
from contextlib import asynccontextmanager

import numpy as np
import scipy.io.wavfile as wav
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from qwen_tts import Qwen3TTSModel

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")
logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

MODEL_ID = os.environ.get(
    "QWEN_MODEL",
    "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.bfloat16 if DEVICE == "cuda" else torch.float32

BUILTIN_VOICES = [
    "ryan",      # Dynamic male, English
    "serena",    # Warm female, Chinese-accented English
    "aiden",     # Sunny American male, English
    "vivian",    # Bright young female
    "uncle_fu",  # Seasoned male, low timbre
    "dylan",     # Youthful Beijing male
    "eric",      # Lively Sichuan male
    "ono_anna",  # Playful Japanese female
    "sohee",     # Warm Korean female
]

# Map app language names → Qwen3-TTS language strings.
# Unsupported languages fall back to "Auto" (model auto-detects).
LANGUAGE_MAP: dict[str, str] = {
    "English":    "English",
    "German":     "German",
    "French":     "French",
    "Spanish":    "Spanish",
    "Italian":    "Italian",
    "Portuguese": "Portuguese",
    "Japanese":   "Japanese",
    "Chinese":    "Chinese",
    "Korean":     "Korean",
    "Russian":    "Russian",
    "Dutch":      "Auto",
    "Polish":     "Auto",
    "Arabic":     "Auto",
    "Hindi":      "Auto",
    "Turkish":    "Auto",
}

# ── Global state ──────────────────────────────────────────────────────────────

model: Qwen3TTSModel | None = None


def get_model() -> Qwen3TTSModel:
    global model
    if model is None:
        raise RuntimeError("Model not loaded")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    logger.info(f"Device: {DEVICE.upper()}")
    if DEVICE == "cpu":
        logger.warning("No CUDA GPU found — running on CPU. Inference will be slow.")
    logger.info(f"Loading {MODEL_ID} (first run downloads several GB — please wait)...")
    model = Qwen3TTSModel.from_pretrained(MODEL_ID, device_map=DEVICE, dtype=DTYPE)
    logger.info("Qwen3-TTS model ready.")
    yield


app = FastAPI(title="Drop Qwen TTS Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────


class GenerateRequest(BaseModel):
    text: str
    voice: str = "ryan"
    language: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/tts/voices")
def list_voices():
    # CustomVoice models have no custom/cloned voice support — just the built-ins.
    return {"builtin": BUILTIN_VOICES, "custom": []}


@app.post("/tts/generate")
def generate(req: GenerateRequest):
    m = get_model()

    speaker = req.voice if req.voice in BUILTIN_VOICES else "ryan"
    lang = LANGUAGE_MAP.get(req.language or "English", "Auto")

    try:
        # generate_custom_voice returns (List[np.ndarray], sample_rate)
        wavs, sr = m.generate_custom_voice(
            text=req.text,
            language=lang,
            speaker=speaker,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qwen3-TTS generation failed: {e}")

    audio = wavs[0]

    # Ensure float32 in [-1, 1] for scipy WAV output
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)

    buf = io.BytesIO()
    wav.write(buf, sr, audio)
    buf.seek(0)

    return StreamingResponse(buf, media_type="audio/wav", headers={
        "Content-Disposition": "inline; filename=drop_qwen.wav",
    })
