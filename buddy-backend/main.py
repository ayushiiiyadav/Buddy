# Buddy backend — FastAPI server that talks to Groq
# Now also analyzes voice tone (pitch, energy, pace) using Librosa

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import librosa
import numpy as np
import tempfile

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[HistoryMessage] = []
    mode: Optional[str] = "auto"
    voice_tone: Optional[str] = None  # new — a short description of voice tone, if available

BUDDY_SYSTEM_PROMPT = """
You are Buddy — a warm, caring best friend AND a study companion.
You remember the conversation so far and respond with that context in mind.
Sometimes you will also be given a description of the user's VOICE TONE
(detected from their actual voice recording, separate from their words).
Use it as an extra clue about how they're really feeling — voice tone can
reveal stress or calm that the words alone might not show.

When the user sends a voice message, you will receive their ACTUAL TRANSCRIBED WORDS,
not just a generic placeholder. Treat this exactly like a normal typed message —
read what they actually said and respond to the real content and specifics of it,
giving real, concrete advice or answers, not vague responses like "let's talk about it."
The voice tone is additional context, not a replacement for actually answering what they said.

You operate in one of two modes for each message:
- "support" mode: the user needs emotional support. Prioritize empathy, comfort, and gentle encouragement.
- "study" mode: the user needs academic help — explaining concepts, summarizing, solving doubts,
  making study plans, quizzing them, or breaking down problems step by step.

You must respond ONLY with valid JSON in exactly this format, nothing else, no extra text:

{
  "reply": "your response to the user here, matching the mode below",
  "emotion": "one word like happy, sad, anxious, stressed, angry, calm, confused, excited",
  "intensity": a number from 0 to 100 representing how strong that emotion seems,
  "detected_mode": "support" or "study" — whichever this message actually needs
}

Guidelines for intensity:
- 0-34 = mild / low intensity
- 35-69 = moderate intensity
- 70-100 = high intensity, possibly urgent emotional distress

If intensity is high, prioritize emotional support over academic help regardless of mode.
"""

HIGH_INTENSITY_THRESHOLD = 70

@app.post("/chat")
def chat(request: ChatRequest):
    messages = [{"role": "system", "content": BUDDY_SYSTEM_PROMPT}]

    for past_msg in request.history:
        messages.append({"role": past_msg.role, "content": past_msg.content})

    if request.mode in ("support", "study"):
        mode_instruction = f"(The user has manually selected '{request.mode}' mode for this message — follow that mode regardless of what you'd otherwise detect, unless intensity is very high.)"
        messages.append({"role": "system", "content": mode_instruction})

    # If we have voice tone info, tell the AI about it alongside the message
    user_content = request.message
    if request.voice_tone:
        user_content = f"{request.message}\n\n[Voice tone detected: {request.voice_tone}]"

    messages.append({"role": "user", "content": user_content})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        response_format={"type": "json_object"},
    )

    raw_reply = response.choices[0].message.content
    data = json.loads(raw_reply)

    # Force intensity to be a real number, since the AI sometimes returns it as text (e.g. "75" instead of 75)
    try:
        intensity = int(data.get("intensity", 0))
    except (ValueError, TypeError):
        intensity = 0

    return {
        "reply": data.get("reply", "I'm here for you."),
        "emotion": data.get("emotion", "neutral"),
        "intensity": intensity,
        "needs_support": intensity >= HIGH_INTENSITY_THRESHOLD,
        "detected_mode": data.get("detected_mode", "support"),
    }

# ---------- NEW: Voice analysis endpoint (tone + transcription) ----------
@app.post("/analyze-voice")
async def analyze_voice(audio: UploadFile = File(...)):
    # Save the uploaded audio to a temporary file so Librosa + Whisper can read it
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # ---- Part 1: Transcribe the actual words using Groq's Whisper model ----
        transcript_text = ""
        try:
            with open(tmp_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3-turbo",
                )
            transcript_text = transcription.text
        except Exception as transcribe_error:
            print("Transcription failed:", transcribe_error)
            transcript_text = ""

        # ---- Part 2: Analyze tone using Librosa (pitch, energy, pace) ----
        y, sr = librosa.load(tmp_path)

        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = pitches[magnitudes > np.median(magnitudes)]
        avg_pitch = float(np.mean(pitch_values)) if len(pitch_values) > 0 else 0.0

        rms = librosa.feature.rms(y=y)
        avg_energy = float(np.mean(rms))

        zcr = librosa.feature.zero_crossing_rate(y)
        avg_zcr = float(np.mean(zcr))

        tone_description_parts = []

        if avg_pitch > 200:
            tone_description_parts.append("higher pitch (could indicate stress or excitement)")
        elif avg_pitch > 0:
            tone_description_parts.append("lower/calmer pitch")

        if avg_energy > 0.05:
            tone_description_parts.append("louder/more energetic voice")
        else:
            tone_description_parts.append("softer, quieter voice")

        if avg_zcr > 0.1:
            tone_description_parts.append("fast speech pace")
        else:
            tone_description_parts.append("slower speech pace")

        tone_description = ", ".join(tone_description_parts)

        return {
            "voice_tone": tone_description,
            "transcript": transcript_text,  # the user's actual words, now included
            "raw": {
                "avg_pitch": round(avg_pitch, 2),
                "avg_energy": round(avg_energy, 4),
                "avg_zcr": round(avg_zcr, 4),
            },
        }
    finally:
        os.remove(tmp_path)

@app.get("/")
def home():
    return {"status": "Buddy backend is running"}