# 🧸 Buddy — Your AI Companion

Buddy is an AI companion app built to offer emotional support and study help. It listens, responds with empathy, and adapts to how you speak — including Hinglish — while giving you tools to calm down when things feel like too much.

> ⚠️ Buddy is a supportive companion, not a replacement for professional mental health care. If you're in crisis, please reach out to a licensed professional or a crisis helpline.

---

## ✨ Features

- **Conversational AI support** — powered by the Groq API for fast, natural responses
- **Hinglish detection** — understands and responds naturally when you mix Hindi and English
- **Emotional support mode** — a companion that listens and responds with care
- **Study help mode** — assistance with academic questions and study planning
- **Calming toolkit** — a dismissible panel with grounding exercises for moments of stress
- **Voice analysis** — uses `librosa` to analyze vocal tone/patterns
- **Waveform visualizer** — real-time audio visualization built with the Web Audio API
- **Auto-scroll chat** — smooth, always-in-view conversation experience

---

## 🛠️ Tech Stack

**Frontend**
- React (using `React.createElement` — no JSX/Babel build step)
- Web Audio API (waveform visualization)

**Backend**
- FastAPI
- SQLite
- Groq API (LLM responses)
- librosa (audio/voice analysis)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- Python 3.10+
- A [Groq API key](https://console.groq.com)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=sqlite:///./buddy.db
```

Run the backend:
```bash
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```

The app should now be running at `http://localhost:3000` (frontend) with the API at `http://localhost:8000` (backend).

---

## 📁 Project Structure

```
buddy/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.js
│   │   └── ...
│   └── package.json
├── backend/
│   ├── main.py
│   ├── models/
│   ├── routes/
│   ├── requirements.txt
│   └── buddy.db
└── README.md
```

---

## 🧠 Known Limitations

- **Speech-to-text**: An earlier attempt at live transcription was reverted due to a Firefox/`librosa` incompatibility with `audio/webm` recordings. Voice *analysis* works; live STT is currently not supported.

---

## 🗺️ Roadmap

- [ ] Resolve Firefox `audio/webm` STT compatibility
- [ ] Add persistent user profiles
- [ ] Expand calming toolkit exercises
- [ ] Deploy live demo

---

## 👩‍💻 Author

**Ayushi Yadav**
[GitHub](https://github.com/ayushiiiyadav)