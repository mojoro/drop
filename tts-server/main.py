import io
import uuid
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wav
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pocket_tts import TTSModel

app = FastAPI(title="Drop TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global state ---

VOICES_DIR = Path(__file__).parent / "voices"
VOICES_DIR.mkdir(exist_ok=True)

BUILTIN_VOICES = ["alba", "marius", "javert", "jean", "fantine", "cosette", "eponine", "azelma"]

model: TTSModel | None = None
voice_states: dict[str, object] = {}


def get_model() -> TTSModel:
    global model
    if model is None:
        model = TTSModel.load_model()
    return model


def get_voice_state(voice: str):
    if voice in voice_states:
        return voice_states[voice]

    m = get_model()

    if voice in BUILTIN_VOICES:
        state = m.get_state_for_audio_prompt(voice)
    else:
        # Custom cloned voice — look for saved WAV
        wav_path = VOICES_DIR / f"{voice}.wav"
        if not wav_path.exists():
            raise HTTPException(404, f"Voice '{voice}' not found")
        state = m.get_state_for_audio_prompt(str(wav_path))

    voice_states[voice] = state
    return state


# --- Routes ---


class GenerateRequest(BaseModel):
    text: str
    voice: str = "alba"


@app.get("/tts/voices")
def list_voices():
    custom = [p.stem for p in VOICES_DIR.glob("*.wav")]
    return {
        "builtin": BUILTIN_VOICES,
        "custom": custom,
    }


@app.post("/tts/generate")
def generate(req: GenerateRequest):
    m = get_model()
    state = get_voice_state(req.voice)
    audio = m.generate_audio(state, req.text)

    buf = io.BytesIO()
    wav.write(buf, 24000, np.array(audio))
    buf.seek(0)

    return StreamingResponse(buf, media_type="audio/wav", headers={
        "Content-Disposition": "inline; filename=drop_tts.wav",
    })


@app.post("/tts/clone-voice")
async def clone_voice(
    name: str = Form(...),
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.endswith(".wav"):
        raise HTTPException(400, "Upload a WAV file")

    safe_name = "".join(c for c in name if c.isalnum() or c in "-_").lower()
    if not safe_name:
        safe_name = uuid.uuid4().hex[:8]

    dest = VOICES_DIR / f"{safe_name}.wav"
    content = await file.read()
    dest.write_bytes(content)

    # Pre-load the voice state
    voice_states.pop(safe_name, None)
    get_voice_state(safe_name)

    return {"voice": safe_name, "message": f"Voice '{safe_name}' cloned successfully"}


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}
