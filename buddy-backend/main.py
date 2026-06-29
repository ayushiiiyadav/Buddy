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
import sqlite3
from datetime import datetime

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

DB_PATH = os.path.join(os.path.dirname(__file__), "buddy.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            emotion TEXT,
            intensity INTEGER,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

def create_conversation(title):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (title, created_at) VALUES (?, ?)",
        (title, datetime.now().isoformat()),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def save_message(conversation_id, role, content, emotion=None, intensity=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO messages (conversation_id, role, content, emotion, intensity, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (conversation_id, role, content, emotion, intensity, datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()

def load_conversation_list():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at FROM conversations ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": row[0], "title": row[1], "created_at": row[2]} for row in rows]

def load_all_user_messages():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM messages WHERE role = 'user' ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]

def load_conversation_messages(conversation_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, content, emotion, intensity, timestamp FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"role": row[0], "content": row[1], "emotion": row[2], "intensity": row[3], "timestamp": row[4]}
        for row in rows
    ]

def delete_conversation(conversation_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()

def update_conversation_title(conversation_id, title):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conversation_id))
    conn.commit()
    conn.close()

class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[HistoryMessage] = []
    mode: Optional[str] = "auto"
    voice_tone: Optional[str] = None
    conversation_id: Optional[int] = None

BUDDY_SYSTEM_PROMPT = """
You are Buddy — a warm, caring best friend AND a study companion.
You remember the conversation so far and respond with that context in mind.

LANGUAGE RULE (very important):
- Detect the language the user is writing in.
- If the user writes in Hinglish (a mix of Hindi and English, using Roman script —
  for example: "yaar mujhe bahut stress ho raha hai" or "bro I'm so tired yaar"),
  you MUST reply in Hinglish too — the same casual Roman-script Hindi-English mix.
  Do NOT reply in pure Hindi, do NOT use Devanagari script, and do NOT reply in
  formal English. Match their vibe — use words like yaar, bhai, arre, sach mein,
  bilkul, ekdum, etc. naturally, just like a desi best friend would.
- If the user writes in pure English, reply in English.
- If the user writes in pure Hindi (Devanagari), reply in Hindi.
- Always mirror the user's language style — this is non-negotiable.

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
  "reply": "your response to the user here, matching the mode and language below",
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
BREATHING_INTENSITY_THRESHOLD = 90
ANXIETY_RELATED_EMOTIONS = {"anxious", "panicked", "breathless", "overwhelmed", "scared", "fearful", "nervous"}

@app.post("/chat")
def chat(request: ChatRequest):
    messages = [{"role": "system", "content": BUDDY_SYSTEM_PROMPT}]

    for past_msg in request.history:
        messages.append({"role": past_msg.role, "content": past_msg.content})

    if request.mode in ("support", "study"):
        mode_instruction = f"(The user has manually selected '{request.mode}' mode for this message — follow that mode regardless of what you'd otherwise detect, unless intensity is very high.)"
        messages.append({"role": "system", "content": mode_instruction})

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

    try:
        intensity = int(data.get("intensity", 0))
    except (ValueError, TypeError):
        intensity = 0

    emotion = data.get("emotion", "neutral")
    reply = data.get("reply", "I'm here for you.")

    conversation_id = request.conversation_id
    if conversation_id is None:
        title = request.message[:40] + ("..." if len(request.message) > 40 else "")
        conversation_id = create_conversation(title)

    save_message(conversation_id, "user", request.message, emotion, intensity)
    save_message(conversation_id, "assistant", reply, emotion, intensity)

    emotion_lower = emotion.lower().strip()
    needs_breathing = intensity >= BREATHING_INTENSITY_THRESHOLD and emotion_lower in ANXIETY_RELATED_EMOTIONS

    return {
        "reply": reply,
        "emotion": emotion,
        "intensity": intensity,
        "needs_support": intensity >= HIGH_INTENSITY_THRESHOLD,
        "needs_breathing": needs_breathing,
        "detected_mode": data.get("detected_mode", "support"),
        "conversation_id": conversation_id,
    }

@app.get("/conversations")
def get_conversations():
    return {"conversations": load_conversation_list()}

PERSONALITY_PROMPT = """
You are an insightful, warm observer analyzing someone's messages to a companion app
over time, to reflect their personality back to them — like a thoughtful friend who has
been paying close attention.

Based on everything this person has said, identify real patterns: how they communicate,
what they care about, recurring emotional themes, strengths, and areas they might want to
grow in. Be specific and grounded in what they actually said — avoid generic horoscope-like
statements that could apply to anyone.

Be kind but honest. Growth areas should be framed gently and constructively, never harshly.
If there isn't much to go on yet, say so honestly rather than inventing traits.

Respond ONLY with valid JSON in exactly this format, nothing else:

{
  "summary": "a warm 2-3 sentence overview of who this person seems to be",
  "strengths": ["3-5 specific strength traits, each as a short phrase"],
  "growth_areas": ["2-4 specific, gently-framed growth areas, each as a short phrase"],
  "recurring_themes": ["2-4 topics or concerns that come up repeatedly for this person"]
}
"""

@app.get("/personality-insight")
def personality_insight():
    user_messages = load_all_user_messages()

    if len(user_messages) < 5:
        return {
            "summary": "We need a few more conversations together before I can reflect on your personality meaningfully. Keep chatting with me, and check back soon!",
            "strengths": [],
            "growth_areas": [],
            "recurring_themes": [],
        }

    all_messages_text = "\n".join(f"- {msg}" for msg in user_messages)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": PERSONALITY_PROMPT},
            {"role": "user", "content": f"Here are all the messages this person has sent over time:\n\n{all_messages_text}"},
        ],
        response_format={"type": "json_object"},
    )

    raw_reply = response.choices[0].message.content
    data = json.loads(raw_reply)

    return {
        "summary": data.get("summary", "I don't have enough to go on yet."),
        "strengths": data.get("strengths", []),
        "growth_areas": data.get("growth_areas", []),
        "recurring_themes": data.get("recurring_themes", []),
    }

@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: int):
    return {"messages": load_conversation_messages(conversation_id)}

@app.delete("/conversations/{conversation_id}")
def remove_conversation(conversation_id: int):
    delete_conversation(conversation_id)
    return {"status": "Conversation deleted"}

@app.post("/analyze-voice")
async def analyze_voice(audio: UploadFile = File(...)):
    suffix = "." + (audio.content_type or "audio/ogg").split("/")[-1].split(";")[0]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
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
            "transcript": transcript_text,
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