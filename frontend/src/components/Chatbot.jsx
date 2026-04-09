import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";

const SUGGESTED_PROMPTS = [
  "I have severe headaches and blurry vision",
  "What are symptoms of a glioma?",
  "I feel dizzy and have memory loss",
  "Explain glioma vs meningioma",
  "When should I see a neurologist?",
];

function UserBubble({ text }) {
  return (
    <div className="flex justify-end gap-3 animate-fade-up">
      <div className="max-w-[85%] bg-gradient-to-br from-violet-600 to-blue-600 text-white text-[15px] font-medium rounded-2xl rounded-tr-sm px-5 py-3.5 leading-relaxed shadow-lg shadow-violet-900/20">
        {text}
      </div>
      <div className="w-9 h-9 rounded-full bg-ink-800 border border-white/10 flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-md">
        👤
      </div>
    </div>
  );
}

function AiBubble({ text }) {
  // Render markdown-style bold (**text**) and newlines
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-sm shrink-0 mt-0.5 glow-cyan shadow-lg">
        🧠
      </div>
      <div className="max-w-[85%] glass-pill text-slate-200 text-[15px] rounded-2xl rounded-tl-sm px-5 py-3.5 leading-relaxed whitespace-pre-wrap shadow-lg">
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="text-cyan-300 font-semibold tracking-wide">
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
    <div className="flex gap-3 animate-fade-up">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-sm shrink-0 glow-cyan shadow-lg">
        🧠
      </div>
      <div className="glass-pill rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5 shadow-lg">
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
    <div className="flex flex-col h-full glass-panel rounded-3xl overflow-hidden relative z-10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-white/5 shrink-0 backdrop-blur-md">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse2 shadow-[0_0_8px_#22d3ee]" />
        <span className="text-[15px] font-bold font-display tracking-wide text-white">
          Medical AI Assistant
        </span>
        <span className="ml-auto text-xs text-slate-500 font-mono tracking-widest bg-ink-900/80 px-2.5 py-1 rounded-md border border-white/5">
          /chat-symptoms
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0 custom-scrollbar">
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
        <div className="px-6 pb-3 flex flex-wrap gap-2 shrink-0">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs bg-ink-900/40 border border-white/10 rounded-full px-4 py-2
                text-slate-300 hover:text-white hover:bg-violet-500/20 hover:border-violet-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all duration-300"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-2 shrink-0 bg-gradient-to-t from-ink-950/80 to-transparent">
        <div
          className="flex gap-3 items-end bg-ink-900/80 border border-white/10
            rounded-2xl px-4 py-3 focus-within:border-cyan-400/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all duration-300 backdrop-blur-xl"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe your symptoms… (Enter to send)"
            className="flex-1 bg-transparent text-[15px] text-slate-100 placeholder-slate-500
              outline-none resize-none py-1.5 px-1 leading-relaxed font-body"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600
              hover:from-cyan-300 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed
              flex items-center justify-center transition-all duration-300 shrink-0 shadow-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2.5 ml-2 font-medium">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}
