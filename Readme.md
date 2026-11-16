# Buddy 💛

Buddy is an emotion-aware companion app that detects how you're feeling through text and voice tone, then responds with calibrated empathy and practical help. It acts as both an emotional support friend and a study companion — giving real-time advice based on the intensity of your situation.

---

## What Buddy does

- Detects your **emotion and intensity** (0–100) from every message you send
- Responds differently based on intensity — gentle encouragement at low levels, crisis-mode support at high levels
- Shows a **calming toolkit** (breathing exercise + grounding tips) when you're feeling anxious at very high intensity (90+)
- Analyzes your **voice tone** (pitch, energy, pace) when you use the mic button
- **Transcribes your actual spoken words** using Groq Whisper so it understands what you said, not just how you sounded
- Automatically detects whether you need **emotional support or study help**, with a manual override toggle
- Replies in **Hinglish** if you write in Hinglish — mirrors your language naturally like a real desi friend
- Maintains **full conversation memory** within each session
- Saves **permanent chat history** across sessions in a local SQLite database
- Supports **multiple separate conversations** via a ChatGPT-style sidebar
- Generates a **personality reflection panel** (🧠) by analyzing everything you've ever said across all your conversations
- **Smart auto-scroll** — scrolls to newest message on arrival only if you were already near the bottom

---

## Tech stack

### Frontend
| Tool | Purpose |
|---|---|
| HTML + CSS + JavaScript | Core structure, styling, and logic |
| React 18 (via CDN) | UI components, state management, dynamic updates |
| `React.createElement` | JSX-free React (no build tool needed) |
| Google Fonts — Fraunces + Inter | Typography |
| Browser `getUserMedia` + `MediaRecorder` | Microphone access and voice recording |

### Backend
| Tool | Purpose |
|---|---|
| Python 3.11+ | Backend language |
| FastAPI | Web framework, REST API endpoints |
| Uvicorn | ASGI server that runs FastAPI |
| SQLite (built into Python) | Permanent local database for chat history |
| python-dotenv | Loads the API key from the `.env` file |
| python-multipart | Enables FastAPI to receive uploaded audio files |

### AI and Audio
| Tool | Purpose |
|---|---|
| Groq API | Hosts the AI models — used for chat and transcription |
| Llama 3.3 70B (via Groq) | The language model powering Buddy's responses |
| Groq Whisper (`whisper-large-v3-turbo`) | Speech-to-text transcription of voice recordings |
| Librosa | Audio analysis — extracts pitch, energy, and speech pace from recordings |
| NumPy | Numerical processing used alongside Librosa |
| OpenAI Python SDK | Used to call Groq's OpenAI-compatible API |

---

## Project structure

```
Buddy/
├── buddy-backend/
│   ├── main.py              # FastAPI server — all endpoints and AI logic
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Your Groq API key (never committed to GitHub)
│   └── buddy.db             # SQLite database — created automatically on first run
│
├── buddy-web/
│   ├── index.html           # Entry point — loads React and app.js
│   ├── app.js               # All React components and frontend logic
│   └── style.css            # Full design system — warm terracotta palette
│
├── clear_all_chats.py       # One-time utility to wipe all chat history
├── .gitignore
└── README.md
```

---

## Setup and installation

### Prerequisites
- Python 3.11 or higher
- A free Groq API key from [console.groq.com](https://console.groq.com)
- VS Code with the **Live Server** extension

### 1. Clone the repository

```bash
git clone github.com/ayushiiiyadav/Buddy.git
cd buddy
```

### 2. Set up the backend

```bash
cd buddy-backend
pip install -r requirements.txt
```

### 3. Add your Groq API key

Create a file called `.env` inside `buddy-backend/` with exactly this content:

```
GROQ_API_KEY=gsk_your_actual_key_here
```

No quotes, no spaces around the `=`.

### 4. Start the backend server

```bash
uvicorn main:app --reload --port 8000
```

Wait for `Application startup complete.` — keep this terminal open while using Buddy.

### 5. Open the frontend

In VS Code, right-click `buddy-web/index.html` → **Open with Live Server**.

Buddy opens in your browser at `http://127.0.0.1:5500/buddy-web/index.html`.

---

## Important Live Server setting

Live Server must be told to ignore the backend folder — otherwise it auto-refreshes the browser every time the database updates, disrupting conversations mid-reply.

In VS Code: **File → Preferences → Settings** → search `liveServer.settings.ignoreFiles` → **Edit in settings.json** and add:

```json
"liveServer.settings.ignoreFiles": [
  ".vscode/**",
  "**/*.scss",
  "**/*.sass",
  "**/*.ts",
  "node_modules/**",
  "buddy-backend/**"
]
```

---

## Python dependencies

```
fastapi
uvicorn
openai
python-dotenv
python-multipart
librosa
numpy
```

Install all at once:

```bash
pip install -r requirements.txt
```

---

## API endpoints

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/chat` | Send a message, get Buddy's reply + emotion data |
| `POST` | `/analyze-voice` | Upload audio, get transcription + voice tone |
| `GET` | `/conversations` | List all past conversations |
| `GET` | `/conversations/{id}/messages` | Load one specific conversation |
| `DELETE` | `/conversations/{id}` | Delete a conversation permanently |
| `GET` | `/personality-insight` | Analyze all past messages, return personality reflection |
| `GET` | `/` | Health check — confirms backend is running |

---

## Features in detail

### Emotion detection
Every message is analyzed for emotion (happy, sad, anxious, stressed, etc.) and intensity (0–100). The intensity score drives Buddy's behavior — mild messages get gentle replies, high-intensity messages trigger deeper emotional support.

### Calming toolkit
Appears automatically when intensity crosses 70. The breathing exercise specifically only shows when intensity is 90+ AND the detected emotion is anxiety-related (anxious, panicked, overwhelmed, etc.).

### Voice input
Click the 🎙️ button to record. Buddy transcribes your words (Groq Whisper) and analyzes your tone (Librosa) simultaneously. Both feed into the reply. Works standalone — no typing required.

### Hinglish support
Buddy automatically detects Hinglish (Hindi + English in Roman script) and mirrors that language style back — using words like yaar, bhai, arre, ekdum naturally, just like a real desi friend.

### Personality reflection
Click 🧠 to generate a fresh personality analysis from everything you've ever said across all conversations — strengths, growth areas, and recurring themes, grounded in what you actually said.

### Conversation history
Every message is saved permanently in a local SQLite database (`buddy.db`). The sidebar lets you switch between past conversations, start new ones, and delete any you no longer want.

### Smart auto-scroll
The chat automatically scrolls to the newest message when it arrives — but only if you were already near the bottom. If you've scrolled up to read older history, it never interrupts you.

---

## What's not committed to GitHub

```
.env                  # contains your secret API key
buddy.db              # contains your personal conversation history
__pycache__/
*.pyc
venv/
clear_all_chats.py
```

---

## Roadmap

- [ ] Facial expression detection via webcam (face-api.js)
- [ ] Deploy online so Buddy is accessible from any device

---

## Built by

Ayushi — built from scratch as a hands-on learning project, one feature at a time.
