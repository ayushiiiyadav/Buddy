// NOTE: This file uses React.createElement instead of JSX (no Babel needed).
// Now supports Study mode + Support mode, auto-detected or manually picked.

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

// The mode toggle — lets the user pick Auto / Support / Study
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
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [emotion, setEmotion] = React.useState(null);
  const [intensity, setIntensity] = React.useState(0);
  const [needsSupport, setNeedsSupport] = React.useState(false);
  const [mode, setMode] = React.useState("auto");         // user's manual choice
  const [detectedMode, setDetectedMode] = React.useState(null); // what Buddy actually used

  function buildHistory(messageList) {
    return messageList.map((msg) => ({
      role: msg.sender === "buddy" ? "assistant" : "user",
      content: msg.text,
    }));
  }

  async function sendToBuddy(userMessage, history, selectedMode) {
    const response = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history: history, mode: selectedMode }),
    });

    const data = await response.json();
    return data;
  }

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage = input;
    const historyToSend = buildHistory(messages);

    const newMessages = [...messages, { sender: "user", text: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const data = await sendToBuddy(userMessage, historyToSend, mode);
      setMessages((prev) => [...prev, { sender: "buddy", text: data.reply }]);
      setEmotion(data.emotion);
      setIntensity(data.intensity);
      setNeedsSupport(data.needs_support);
      setDetectedMode(data.detected_mode);
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

  return e(
    "div",
    { className: "chat-screen" },
    e("h1", { className: "title" }, "Buddy"),
    e(ModeToggle, { mode, setMode }),
    emotionBadge,
    e("div", { className: "chat-window" }, chatBubbles),
    needsSupport ? e(CalmingToolkit) : null,
    e(
      "div",
      { className: "input-row" },
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