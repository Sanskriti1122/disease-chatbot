import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SUGGESTED_PROMPTS = [
  "I have severe headaches and blurry vision",
  "What are symptoms of a glioma?",
  "I feel dizzy and have memory loss",
  "Explain glioma vs meningioma",
  "When should I see a neurologist?",
];

function UserBubble({ text }) {
  return (
    <div className="flex justify-end gap-2.5 animate-fade-up">
      <div className="max-w-[78%] bg-cyan-500/20 border border-cyan-500/30 text-slate-200 text-sm rounded-2xl rounded-tr-sm px-4 py-3 leading-relaxed">
        {text}
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-sm shrink-0 mt-0.5">
        👤
      </div>
    </div>
  );
}

function AiBubble({ text }) {
  // Render markdown-style bold (**text**) and newlines
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="flex gap-2.5 animate-fade-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm shrink-0 mt-0.5 glow-cyan">
        🧠
      </div>
      <div className="max-w-[78%] bg-slate-800/70 border border-slate-700/60 text-slate-200 text-sm rounded-2xl rounded-tl-sm px-4 py-3 leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="text-cyan-300 font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 animate-fade-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm shrink-0 glow-cyan">
        🧠
      </div>
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

export default function Chatbot({ imagePrediction }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello! I'm your AI medical assistant. Describe your neurological symptoms and I'll help explain possible conditions.\n\nYou can also upload a brain scan on the left — I'll automatically incorporate those results.\n\n⚕️ I provide educational information only. Always consult a qualified doctor.",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const bottomRef             = useRef(null);
  const textareaRef           = useRef(null);

  // Track last injected prediction to avoid duplicate injections
  const lastPredRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-inject image prediction context as assistant message
  useEffect(() => {
    if (!imagePrediction || imagePrediction === lastPredRef.current) return;
    if (!imagePrediction.class_name && !imagePrediction.display_name) return;
    lastPredRef.current = imagePrediction;

    const name  = imagePrediction.display_name || imagePrediction.class_name;
    const conf  = imagePrediction.confidence_pct
      || `${Math.round((imagePrediction.confidence || 0) * 100)}%`;
    const rec   = imagePrediction.recommendation || "";
    const desc  = imagePrediction.description || "";

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `🔬 **Brain scan analyzed!**\n\n**${name}** detected with **${conf}** confidence.\n\n${desc}\n\n💊 ${rec}\n\nFeel free to ask me anything about this finding or your symptoms.`,
      },
    ]);
  }, [imagePrediction]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);

    const userMsg   = { role: "user", text: msg };
    const newMsgs   = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    // Build history for API (exclude opening assistant greeting for brevity)
    const history = newMsgs.slice(1, -1).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const body = {
        message: msg,
        history,
        image_prediction: imagePrediction || null,
      };

      const res = await fetch(`${API}/chat-symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.response || data.message || "No response from server.";
      setMessages([...newMsgs, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(`Chat error: ${err.message}`);
      setMessages([
        ...newMsgs,
        {
          role: "assistant",
          text: "⚠️ I couldn't reach the server. Please make sure the backend is running on port 8000.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, imagePrediction]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-full bg-slate-900/30 rounded-2xl border border-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/60 shrink-0">
        <div className="w-2 h-2 rounded-full bg-acid animate-pulse2" />
        <span className="text-sm font-semibold font-display text-slate-200">
          Medical AI Assistant
        </span>
        <span className="ml-auto text-xs text-slate-600 font-mono">
          /chat-symptoms
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={i} text={m.text} />
          ) : (
            <AiBubble key={i} text={m.text} />
          )
        )}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {showSuggestions && (
        <div className="px-5 pb-3 flex flex-wrap gap-2 shrink-0">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1.5
                text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all duration-150"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 text-xs text-red-400 shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <div className="px-5 pb-5 shrink-0">
        <div
          className="flex gap-2 items-end bg-slate-800/50 border border-slate-700/50
            rounded-2xl px-3 py-2 focus-within:border-cyan-500/50 transition-colors duration-200"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe your symptoms… (Enter to send)"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600
              outline-none resize-none py-1 px-1 leading-relaxed font-body"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600
              hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed
              flex items-center justify-center transition-all duration-150 shrink-0 glow-cyan"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5 ml-1">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}
