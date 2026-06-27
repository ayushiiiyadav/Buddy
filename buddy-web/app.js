// NOTE: This file uses React.createElement instead of JSX (no Babel needed).
// Now includes voice recording + tone analysis + live waveform visualizer.

const e = React.createElement;

// ---- Waveform visualizer ----
// Draws a live oscilloscope-style wave while recording, flatlines when voice goes silent.
function WaveformVisualizer({ isRecording, analyserRef }) {
  const canvasRef = React.useRef(null);
  const animFrameRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    function drawFlatline() {
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.strokeStyle = "#a0aec0";
      ctx.lineWidth = 2;
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    }

    function drawWave() {
      if (!analyserRef.current) { drawFlatline(); return; }
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function loop() {
        animFrameRef.current = requestAnimationFrame(loop);
        analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, W, H);
        ctx.beginPath();
        ctx.strokeStyle = "#f6ad55";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";

        const sliceWidth = W / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v / 2) * H;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      }
      loop();
    }

    if (isRecording) {
      drawWave();
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      drawFlatline();
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording]);

  return e("canvas", {
    ref: canvasRef,
    width: 200,
    height: 36,
    className: "waveform-canvas",
    title: isRecording ? "Recording..." : "Microphone idle",
  });
}

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

function CalmingToolkit({ showBreathing, onDismiss }) {
  return e(
    "div",
    { className: "calming-toolkit" },
    e(
      "div",
      { className: "calming-toolkit-header" },
      e("p", { className: "calming-title" }, "This sounds really tough. Let's slow down together 💛"),
      e("button", { className: "calming-dismiss-btn", onClick: onDismiss, title: "Dismiss" }, "✕")
    ),
    showBreathing ? e(BreathingExercise) : null,
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
    { key: "support", label: "💛 Support" },
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

function PersonalityPanel({ isOpen, isLoading, data, onClose }) {
  const renderList = (items, className) =>
    items && items.length > 0
      ? e(
          "ul",
          { className: "personality-list" },
          items.map((item, i) => e("li", { key: i, className: className }, item))
        )
      : null;

  return e(
    "div",
    { className: "personality-overlay" + (isOpen ? " personality-overlay-visible" : "") },
    e("div", { className: "personality-click-catcher", onClick: onClose }),
    e(
      "div",
      {
        className: "personality-panel" + (isOpen ? " personality-panel-open" : ""),
        onClick: (ev) => ev.stopPropagation(),
      },
      e(
        "div",
        { className: "personality-header" },
        e("span", { className: "personality-header-title" }, "🧠 Your Personality Reflection"),
        e("button", { className: "personality-close-btn", onClick: onClose }, "✕")
      ),
      isLoading
        ? e("p", { className: "personality-loading" }, "Reflecting on everything we've talked about...")
        : data &&
          e(
            "div",
            { className: "personality-content" },
            e("p", { className: "personality-summary" }, data.summary),
            data.strengths && data.strengths.length > 0 &&
              e(
                "div",
                { className: "personality-section" },
                e("h3", { className: "personality-section-title" }, "✨ Strengths"),
                renderList(data.strengths, "personality-strength-item")
              ),
            data.growth_areas && data.growth_areas.length > 0 &&
              e(
                "div",
                { className: "personality-section" },
                e("h3", { className: "personality-section-title" }, "🌱 Growth areas"),
                renderList(data.growth_areas, "personality-growth-item")
              ),
            data.recurring_themes && data.recurring_themes.length > 0 &&
              e(
                "div",
                { className: "personality-section" },
                e("h3", { className: "personality-section-title" }, "🔁 Recurring themes"),
                renderList(data.recurring_themes, "personality-theme-item")
              )
          )
    )
  );
}

function Sidebar({ isOpen, conversationList, activeId, onSelect, onDelete, onNewChat, onClose }) {
  return e(
    "div",
    { className: "sidebar-overlay" + (isOpen ? " sidebar-overlay-visible" : "") },
    e(
      "div",
      {
        className: "sidebar" + (isOpen ? " sidebar-open" : ""),
        onClick: (ev) => ev.stopPropagation(),
      },
      e("button", { className: "new-chat-btn", onClick: onNewChat }, "+ New Chat"),
      e(
        "div",
        { className: "sidebar-list" },
        conversationList.length === 0
          ? e("p", { className: "sidebar-empty" }, "No past conversations yet")
          : conversationList.map((conv) =>
              e(
                "div",
                {
                  key: conv.id,
                  className: "sidebar-item" + (conv.id === activeId ? " sidebar-item-active" : ""),
                  onClick: () => onSelect(conv.id),
                },
                e("span", { className: "sidebar-item-title" }, conv.title),
                e(
                  "button",
                  {
                    className: "sidebar-delete-btn",
                    onClick: (ev) => {
                      ev.stopPropagation();
                      onDelete(conv.id, ev);
                    },
                    title: "Delete",
                  },
                  "✕"
                )
              )
            )
      )
    ),
    e("div", { className: "sidebar-click-catcher", onClick: onClose })
  );
}

function App() {
  const [messages, setMessages] = React.useState([
    { sender: "buddy", text: "Hey! How are you feeling today? 💛" },
  ]);
  const [conversationId, setConversationId] = React.useState(null);
  const conversationIdRef = React.useRef(null);
  const [conversationList, setConversationList] = React.useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isPersonalityOpen, setIsPersonalityOpen] = React.useState(false);
  const [personalityData, setPersonalityData] = React.useState(null);
  const [isLoadingPersonality, setIsLoadingPersonality] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [emotion, setEmotion] = React.useState(null);
  const [intensity, setIntensity] = React.useState(0);
  const [needsSupport, setNeedsSupport] = React.useState(false);
  const [needsBreathing, setNeedsBreathing] = React.useState(false);
  const [dismissedToolkit, setDismissedToolkit] = React.useState(false);
  const [mode, setMode] = React.useState("auto");
  const [detectedMode, setDetectedMode] = React.useState(null);

  // ---- Voice recording state ----
  const [isRecording, setIsRecording] = React.useState(false);
  const [voiceTone, setVoiceTone] = React.useState(null);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = React.useState(false);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const chatBottomRef = React.useRef(null);
  const analyserRef = React.useRef(null);   // ← Web Audio analyser for waveform
  const audioCtxRef = React.useRef(null);   // ← AudioContext

  // ---- Load conversations on startup ----
  React.useEffect(() => {
    refreshConversationList();
  }, []);

  // ---- Auto-scroll on new messages ----
  React.useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  async function refreshConversationList() {
    try {
      const response = await fetch("http://localhost:8000/conversations");
      const data = await response.json();
      setConversationList(data.conversations || []);
    } catch (err) {
      console.error("Could not load conversation list:", err);
    }
  }

  async function openPersonalityPanel() {
    setIsPersonalityOpen(true);
    setIsLoadingPersonality(true);
    try {
      const response = await fetch("http://localhost:8000/personality-insight");
      const data = await response.json();
      setPersonalityData(data);
    } catch (err) {
      console.error("Could not load personality insight:", err);
      setPersonalityData({
        summary: "Hmm, I couldn't reach my brain (backend). Is it running?",
        strengths: [],
        growth_areas: [],
        recurring_themes: [],
      });
    } finally {
      setIsLoadingPersonality(false);
    }
  }

  async function openConversation(id) {
    try {
      const response = await fetch(`http://localhost:8000/conversations/${id}/messages`);
      const data = await response.json();

      const restored = data.messages.map((msg) => ({
        sender: msg.role === "assistant" ? "buddy" : "user",
        text: msg.content,
      }));

      setMessages(restored.length > 0 ? restored : [{ sender: "buddy", text: "Hey! How are you feeling today? 💛" }]);
      setConversationId(id);
      conversationIdRef.current = id;
      setIsSidebarOpen(false);

      const last = data.messages[data.messages.length - 1];
      if (last) {
        setEmotion(last.emotion);
        setIntensity(last.intensity || 0);
      }
    } catch (err) {
      console.error("Could not open conversation:", err);
    }
  }

  function startNewChat() {
    setMessages([{ sender: "buddy", text: "Hey! How are you feeling today? 💛" }]);
    setConversationId(null);
    conversationIdRef.current = null;
    setEmotion(null);
    setIntensity(0);
    setNeedsSupport(false);
    setNeedsBreathing(false);
    setDismissedToolkit(false);
    setVoiceTone(null);
    setIsAnalyzingVoice(false);
    setIsSidebarOpen(false);
  }

  async function deleteConversation(id, event) {
    event.stopPropagation();
    const confirmed = window.confirm("Delete this conversation permanently?");
    if (!confirmed) return;

    try {
      await fetch(`http://localhost:8000/conversations/${id}`, { method: "DELETE" });
      await refreshConversationList();
      if (conversationId === id) startNewChat();
    } catch (err) {
      console.error("Could not delete conversation:", err);
    }
  }

  function buildHistory(messageList) {
    return messageList.map((msg) => ({
      role: msg.sender === "buddy" ? "assistant" : "user",
      content: msg.text,
    }));
  }

  // ---- Voice recording + waveform (no live transcription) ----
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // --- Web Audio setup for the live waveform ---
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (audioErr) {
        console.warn("Web Audio setup failed (waveform won't show):", audioErr);
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Tear down Web Audio graph
        analyserRef.current = null;
        if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
        await analyzeVoice(audioBlob);
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

  async function sendVoiceOnlyMessage(transcript, tone) {
    const historyToSend = buildHistory(messages);

    const messageText = transcript && transcript.trim() !== ""
      ? transcript
      : "[shared a voice message, but I couldn't make out clear words]";

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
      setNeedsBreathing(data.needs_breathing);
      setDetectedMode(data.detected_mode);
      setVoiceTone(null);

      if (conversationIdRef.current === null && data.conversation_id) {
        setConversationId(data.conversation_id);
        conversationIdRef.current = data.conversation_id;
        refreshConversationList();
      }
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
        voice_tone: tone,
        conversation_id: conversationIdRef.current,
      }),
    });
    return await response.json();
  }

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage = input;
    const historyToSend = buildHistory(messages);
    const toneToSend = voiceTone;

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
      setNeedsBreathing(data.needs_breathing);
      setDetectedMode(data.detected_mode);
      setVoiceTone(null);
      if (data.needs_support) setDismissedToolkit(false);

      if (conversationIdRef.current === null && data.conversation_id) {
        setConversationId(data.conversation_id);
        conversationIdRef.current = data.conversation_id;
        refreshConversationList();
      }
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
          (detectedMode ? ` · ${detectedMode === "study" ? "📚 Study mode" : "💛 Support mode"}` : "")
      )
    : null;

  const voiceTonePreview = voiceTone
    ? e("div", { className: "voice-tone-preview" }, `🎙️ Voice tone detected: ${voiceTone}`)
    : isAnalyzingVoice
    ? e("div", { className: "voice-tone-preview" }, "🎙️ Analyzing your voice...")
    : null;

  return e(
    "div",
    { className: "app-wrapper" },
    e(Sidebar, {
      isOpen: isSidebarOpen,
      conversationList: conversationList,
      activeId: conversationId,
      onSelect: openConversation,
      onDelete: deleteConversation,
      onNewChat: startNewChat,
      onClose: () => setIsSidebarOpen(false),
    }),
    e(PersonalityPanel, {
      isOpen: isPersonalityOpen,
      isLoading: isLoadingPersonality,
      data: personalityData,
      onClose: () => setIsPersonalityOpen(false),
    }),
    e(
      "div",
      { className: "chat-screen" },
      e(
        "div",
        { className: "header-row" },
        e(
          "button",
          { className: "menu-btn", onClick: () => setIsSidebarOpen(true), title: "Past conversations" },
          "☰"
        ),
        e("h1", { className: "title" }, "Buddy"),
        e(
          "div",
          { className: "header-right-group" },
          e(
            "button",
            { className: "personality-btn", onClick: openPersonalityPanel, title: "Your personality reflection" },
            "🧠"
          ),
          e("button", { className: "clear-btn", onClick: startNewChat, title: "New chat" }, "✚")
        )
      ),
      e(ModeToggle, { mode, setMode }),
      emotionBadge,
      e(
        "div",
        { className: "chat-window" },
        chatBubbles,
        e("div", { ref: chatBottomRef })
      ),
      (needsSupport && !dismissedToolkit)
        ? e(CalmingToolkit, { showBreathing: needsBreathing, onDismiss: () => setDismissedToolkit(true) })
        : null,
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
        // Waveform — only visible while mic is active
        isRecording ? e(WaveformVisualizer, { isRecording, analyserRef }) : null,
        e("input", {
          className: "chat-input",
          placeholder: "Type a message...",
          value: input,
          onChange: (ev) => setInput(ev.target.value),
          onKeyDown: (ev) => ev.key === "Enter" && sendMessage(),
        }),
        e("button", { className: "send-btn", onClick: sendMessage }, "Send")
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));

// ---- Subtle 3D tilt on mouse move ----
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  document.addEventListener("mousemove", (ev) => {
    const card = document.querySelector(".chat-screen");
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;

    const offsetX = (ev.clientX - cardCenterX) / window.innerWidth;
    const offsetY = (ev.clientY - cardCenterY) / window.innerHeight;

    const maxTilt = 2.5;
    const tiltX = (-offsetY * maxTilt).toFixed(2);
    const tiltY = (offsetX * maxTilt).toFixed(2);

    card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });
}