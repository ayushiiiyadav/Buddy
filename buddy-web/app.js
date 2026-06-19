// NOTE: This file uses React.createElement instead of JSX.
// This is exactly what JSX turns into behind the scenes anyway —
// we're just skipping Babel entirely since it wasn't working.
// No Babel script needed anymore. This WILL work.

const e = React.createElement; // short name so the code below is easier to read

function App() {
  const [messages, setMessages] = React.useState([
    { sender: "buddy", text: "Hey! How are you feeling today? 💙" },
  ]);
  const [input, setInput] = React.useState("");

  function sendMessage() {
    if (input.trim() === "") return;

    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "buddy", text: "Got it — I'm here with you. (Backend not connected yet)" },
      ]);
    }, 500);
  }

  // Each chat bubble, built with createElement instead of JSX
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