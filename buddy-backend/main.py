# Buddy backend — FastAPI server that talks to Groq
# Now supports two modes: emotional support and study help,
# either auto-detected or manually chosen by the user.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

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
    # "auto" = let the AI decide, "support" = force emotional mode, "study" = force study mode
    mode: Optional[str] = "auto"

BUDDY_SYSTEM_PROMPT = """
You are Buddy — a warm, caring best friend AND a study companion.
You remember the conversation so far and respond with that context in mind.

You operate in one of two modes for each message:
- "support" mode: the user needs emotional support. Prioritize empathy, comfort, and gentle encouragement.
- "study" mode: the user needs academic help — explaining concepts, summarizing, solving doubts,
  making study plans, quizzing them, or breaking down problems step by step. Be clear and helpful,
  still warm in tone, like a friend who's good at the subject helping you out.

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

    # If the user manually picked a mode, tell the AI to follow it directly
    if request.mode in ("support", "study"):
        mode_instruction = f"(The user has manually selected '{request.mode}' mode for this message — follow that mode regardless of what you'd otherwise detect, unless intensity is very high.)"
        messages.append({"role": "system", "content": mode_instruction})

    messages.append({"role": "user", "content": request.message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        response_format={"type": "json_object"},
    )

    raw_reply = response.choices[0].message.content
    data = json.loads(raw_reply)

    intensity = data.get("intensity", 0)

    return {
        "reply": data.get("reply", "I'm here for you."),
        "emotion": data.get("emotion", "neutral"),
        "intensity": intensity,
        "needs_support": intensity >= HIGH_INTENSITY_THRESHOLD,
        "detected_mode": data.get("detected_mode", "support"),
    }

@app.get("/")
def home():
    return {"status": "Buddy backend is running"}