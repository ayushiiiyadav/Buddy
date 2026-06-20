// NOTE: This file uses React.createElement instead of JSX (no Babel needed).
// This version is connected to the real Buddy backend running on localhost:8000.

const e = React.createElement;

function App() {
  const [messages, setMessages] = React.useState([
    { sender: "buddy", text: "Hey! How are you feeling today? 💙" },
  ]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false); // shows "Buddy is typing..."

  // This is the real function that talks to your FastAPI backend
  async function sendToBuddy(userMessage) {
    const response = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });

    const data = await response.json();
    return data.reply;
  }

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage = input;
    const newMessages = [...messages, { sender: "user", text: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const buddyReply = await sendToBuddy(userMessage);
      setMessages((prev) => [...prev, { sender: "buddy", text: buddyReply }]);
    } catch (error) {
      // shows up if the backend isn't running, or something went wrong
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

  // show a "Buddy is typing..." bubble while waiting for the reply
  if (isTyping) {
    chatBubbles.push(
      e(
        "div",
        { key: "typing", className: "chat-bubble buddy-bubble typing-bubble" },
        "Buddy is typing..."
      )
    );
  }

  return e(
    "div",
    { className: "chat-screen" },
    e("h1", { className: "title" }, "Buddy"),
    e("div", { className: "chat-window" }, chatBubbles),
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