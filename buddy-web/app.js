// NOTE: This file uses React.createElement instead of JSX (no Babel needed).
// Now includes voice recording + tone analysis.

const e = React.createElement;

function BreathingExercise() {
  const [phase, setPhase] = React.useState("Click to start");
  const [isActive, setIsActive] = React.useState(false);

  function startBreathing() {
    if (isActive) return;
    setIsActive(true);

    const cycle = [
      { text: "Breathe in...", duration: 4000 },
      { text: "Hold...", duration: 4000 },
      { text: "Breathe out...", duration: 4000 },
    ];

    let i = 0;
    function runStep() {
      setPhase(cycle[i].text);
      setTimeout(() => {
        i = (i + 1) % cycle.length;
        if (i === 0) {
          setIsActive(false);
          setPhase("Click to start");
        } else {
          runStep();
        }
      }, cycle[i].duration);
    }
    runStep();
  }

  return e(
    "div",
    { className: "breathing-box" },
    e("p", { className: "breathing-text" }, phase),
    e(
      "button",
      { className: "breathing-btn", onClick: startBreathing, disabled: isActive },
      isActive ? "Breathing..." : "Start Breathing Exercise"
    )
  );
}

function CalmingToolkit() {
  return e(
    "div",
    { className: "calming-toolkit" },
    e("p", { className: "calming-title" }, "This sounds really tough. Let's slow down together 💙"),
    e(BreathingExercise),
    e(
      "div",
      { className: "calming-tips" },
      e("p", null, "• You are not alone in this"),
      e("p", null, "• It's okay to take a break"),
      e("p", null, "• One step at a time")
    )
  );
}

function ModeToggle({ mode, setMode }) {
  const options = [
    { key: "auto", label: "Auto" },
    { key: "support", label: "💙 Support" },
    { key: "study", label: "📚 Study" },
  ];

  return e(
    "div",
    { className: "mode-toggle" },
    options.map((opt) =>
      e(
        "button",
        {
          key: opt.key,
          className: "mode-btn" + (mode === opt.key ? " mode-btn-active" : ""),
          onClick: () => setMode(opt.key),
        },
        opt.label
      )
    )
  );
}

function App() {
  const [messages, setMessages] = React.useState([
    { sender: "buddy", text: "Hey! How are you feeling today? 💙" },
  ]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [emotion, setEmotion] = React.useState(null);
  const [intensity, setIntensity] = React.useState(0);
  const [needsSupport, setNeedsSupport] = React.useState(false);
  const [mode, setMode] = React.useState("auto");
  const [detectedMode, setDetectedMode] = React.useState(null);

  // ---- Voice recording state ----
  const [isRecording, setIsRecording] = React.useState(false);
  const [voiceTone, setVoiceTone] = React.useState(null); // human-readable tone description
  const [isAnalyzingVoice, setIsAnalyzingVoice] = React.useState(false);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);

  // ---- Load saved chat history once, when the app first opens ----
  React.useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch("http://localhost:8000/history");
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          const restored = data.messages.map((msg) => ({
            sender: msg.role === "assistant" ? "buddy" : "user",
            text: msg.content,
          }));
          setMessages(restored);

          // Restore the most recent emotion/intensity reading too, if available
          const last = data.messages[data.messages.length - 1];
          if (last.emotion) setEmotion(last.emotion);
          if (last.intensity != null) setIntensity(last.intensity);
        }
      } catch (err) {
        console.error("Could not load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, []); // empty array = runs once, only when the app first loads

  // ---- Clear all saved history ----
  async function clearHistory() {
    const confirmed = window.confirm("This will permanently delete all your chat history with Buddy. Continue?");
    if (!confirmed) return;

    try {
      await fetch("http://localhost:8000/history", { method: "DELETE" });
      setMessages([{ sender: "buddy", text: "Hey! How are you feeling today? 💙" }]);
      setEmotion(null);
      setIntensity(0);
      setNeedsSupport(false);
    } catch (err) {
      console.error("Could not clear history:", err);
    }
  }

  function buildHistory(messageList) {
    return messageList.map((msg) => ({
      role: msg.sender === "buddy" ? "assistant" : "user",
      content: msg.text,
    }));
  }

  // Starts recording from the microphone
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await analyzeVoice(audioBlob);
        // stop the mic stream fully once we're done
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Couldn't access your microphone. Please allow mic permission and try again.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // Sends the recorded audio to the backend for transcription + tone analysis
  async function analyzeVoice(audioBlob) {
    setIsAnalyzingVoice(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");

      const response = await fetch("http://localhost:8000/analyze-voice", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setVoiceTone(data.voice_tone);

      // If the user hasn't typed anything, send to Buddy automatically
      // using the real transcribed words + the detected tone
      if (input.trim() === "") {
        await sendVoiceOnlyMessage(data.transcript, data.voice_tone);
      }
    } catch (err) {
      console.error("Voice analysis error:", err);
      setVoiceTone(null);
    } finally {
      setIsAnalyzingVoice(false);
    }
  }

  // Sends a message to Buddy using the actual transcribed words + voice tone
  async function sendVoiceOnlyMessage(transcript, tone) {
    const historyToSend = buildHistory(messages);

    // Fallback in case transcription came back empty (e.g. silence, or transcription failed)
    const messageText = transcript && transcript.trim() !== ""
      ? transcript
      : "[shared a voice message, but I couldn't make out clear words]";

    // Show the actual transcribed text in the chat, not just a generic "(voice message)" label
    const displayText = transcript && transcript.trim() !== "" ? `🎙️ ${transcript}` : "🎙️ (voice message)";

    const newMessages = [...messages, { sender: "user", text: displayText }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const data = await sendToBuddy(messageText, historyToSend, mode, tone);
      setMessages((prev) => [...prev, { sender: "buddy", text: data.reply }]);
      setEmotion(data.emotion);
      setIntensity(data.intensity);
      setNeedsSupport(data.needs_support);
      setDetectedMode(data.detected_mode);
      setVoiceTone(null);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "buddy", text: "Hmm, I couldn't reach my brain (backend). Is it running?" },
      ]);
      console.error("Error talking to Buddy backend:", error);
    } finally {
      setIsTyping(false);
    }
  }

  async function sendToBuddy(userMessage, history, selectedMode, tone) {
    const response = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        history: history,
        mode: selectedMode,
        voice_tone: tone, // include detected voice tone, if any
      }),
    });

    const data = await response.json();
    return data;
  }

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage = input;
    const historyToSend = buildHistory(messages);
    const toneToSend = voiceTone; // use whatever tone was last detected

    const newMessages = [...messages, { sender: "user", text: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const data = await sendToBuddy(userMessage, historyToSend, mode, toneToSend);
      setMessages((prev) => [...prev, { sender: "buddy", text: data.reply }]);
      setEmotion(data.emotion);
      setIntensity(data.intensity);
      setNeedsSupport(data.needs_support);
      setDetectedMode(data.detected_mode);
      setVoiceTone(null); // clear it after use, so it doesn't carry over to unrelated future messages
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "buddy", text: "Hmm, I couldn't reach my brain (backend). Is it running?" },
      ]);
      console.error("Error talking to Buddy backend:", error);
    } finally {
      setIsTyping(false);
    }
  }

  const chatBubbles = messages.map((msg, index) =>
    e(
      "div",
      {
        key: index,
        className: msg.sender === "buddy" ? "chat-bubble buddy-bubble" : "chat-bubble user-bubble",
      },
      msg.text
    )
  );

  if (isTyping) {
    chatBubbles.push(
      e("div", { key: "typing", className: "chat-bubble buddy-bubble typing-bubble" }, "Buddy is typing...")
    );
  }

  const emotionBadge = emotion
    ? e(
        "div",
        { className: "emotion-badge" },
        `Detected: ${emotion} (intensity: ${intensity}/100)` +
          (detectedMode ? ` · ${detectedMode === "study" ? "📚 Study mode" : "💙 Support mode"}` : "")
      )
    : null;

  // Shows the detected voice tone as a small pending chip before sending
  const voiceTonePreview = voiceTone
    ? e("div", { className: "voice-tone-preview" }, `🎙️ Voice tone detected: ${voiceTone}`)
    : isAnalyzingVoice
    ? e("div", { className: "voice-tone-preview" }, "🎙️ Analyzing your voice...")
    : null;

  return e(
    "div",
    { className: "chat-screen" },
    e(
      "div",
      { className: "header-row" },
      e("h1", { className: "title" }, "Buddy"),
      e("button", { className: "clear-btn", onClick: clearHistory, title: "Clear chat history" }, "🗑️")
    ),
    e(ModeToggle, { mode, setMode }),
    emotionBadge,
    isLoadingHistory
      ? e("p", { className: "loading-text" }, "Loading your past conversations...")
      : e("div", { className: "chat-window" }, chatBubbles),
    needsSupport ? e(CalmingToolkit) : null,
    voiceTonePreview,
    e(
      "div",
      { className: "input-row" },
      e(
        "button",
        {
          className: "mic-btn" + (isRecording ? " mic-btn-active" : ""),
          onClick: isRecording ? stopRecording : startRecording,
          title: isRecording ? "Stop recording" : "Record your voice",
        },
        isRecording ? "⏹️" : "🎙️"
      ),
      e("input", {
        className: "chat-input",
        placeholder: "Type a message...",
        value: input,
        onChange: (ev) => setInput(ev.target.value),
        onKeyDown: (ev) => ev.key === "Enter" && sendMessage(),
      }),
      e("button", { className: "send-btn", onClick: sendMessage }, "Send")
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));