# Buddy backend — FastAPI server that talks to Groq (instead of Anthropic)
# Groq uses the same format as OpenAI's API, so we use the "openai" package
# but point it at Groq's servers instead.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os

# Load the secret API key from the .env file
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Point the OpenAI client at Groq's servers instead of OpenAI's
client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

app = FastAPI()

# Allow your frontend (running on Live Server / file:// / localhost) to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development only — fine for now
    allow_methods=["*"],
    allow_headers=["*"],
)

# This defines what a request from the frontend should look like:
# { "message": "I'm stressed about my exam" }
class ChatRequest(BaseModel):
    message: str

# Buddy's personality — this is the most important part of the whole backend
BUDDY_SYSTEM_PROMPT = """
You are Buddy — a warm, caring best friend and study companion.
You detect the emotional tone behind what the user says and respond with empathy first,
then offer practical help (academic or emotional) based on how intense their situation seems.
Keep replies short, warm, and natural — like a real friend texting back, not a formal assistant.
"""

@app.post("/chat")
def chat(request: ChatRequest):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": BUDDY_SYSTEM_PROMPT},
            {"role": "user", "content": request.message},
        ],
    )
    reply = response.choices[0].message.content
    return {"reply": reply}

# Just a basic check — visiting http://localhost:8000 in browser should show this
@app.get("/")
def home():
    return {"status": "Buddy backend is running"}