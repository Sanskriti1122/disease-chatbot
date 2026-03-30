import { useState } from "react";
import UploadMRI from "./components/UploadMRI.jsx";
import Chatbot   from "./components/Chatbot.jsx";

const DISCLAIMER =
  "⚕️ For educational purposes only. Not a substitute for professional medical advice. Always consult a qualified healthcare provider.";

export default function App() {
  const [prediction, setPrediction] = useState(null);

  return (
    <div className="min-h-screen grid-bg relative flex flex-col font-body selection:bg-cyan-500/30">
      
      {/* Ambient glowing blobs */}
      <div className="ambient-blob cyan fixed" />
      <div className="ambient-blob violet fixed" />

      {/* ── Floating Header ─────────────────────────────────────────── */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-7xl glass-pill rounded-full border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="px-6 py-3.5 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl glow-cyan"
              style={{ background: "linear-gradient(135deg, #0891b2, #7c3aed)" }}
            >
              🧠
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight text-white font-display">
                NeuraScan<span className="text-cyan-400"> AI</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">Brain Tumor Detection</p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-4">
            {prediction && (
              <div className="hidden sm:flex items-center gap-2 text-xs bg-acid/10 border border-acid/20 text-lime-300 rounded-full px-4 py-1.5 shadow-[0_0_15px_rgba(163,230,53,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-acid shadow-[0_0_8px_#a3e635]" />
                Scan analyzed
              </div>
            )}
            <div className="flex items-center gap-2 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-full px-4 py-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Educational only
            </div>
          </div>
        </div>
      </header>

      {/* ── Main two-panel layout ───────────────────────────── */}
      <main 
        className="flex-1 w-full max-w-7xl mx-auto px-6 pb-8 flex gap-8 z-10 relative"
        style={{ paddingTop: "140px", minHeight: "100vh" }}
      >

        {/* LEFT – MRI Upload + Prediction */}
        <aside className="w-[420px] shrink-0 flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar">

          {/* Section label */}
          <div className="flex items-center gap-3 pl-1">
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400">
              01 //
            </span>
            <span className="text-xs text-slate-300 uppercase tracking-widest font-semibold">
              Brain Scan Analysis
            </span>
          </div>

          {/* Upload component */}
          <div className="flex-1 min-h-0">
            <UploadMRI onPrediction={setPrediction} />
          </div>

          {/* Spacer + disclaimer */}
          <div className="mt-auto shrink-0">
            <div className="glass-panel rounded-2xl p-4 flex gap-3 items-start border-t border-white/5">
              <span className="text-lg mt-0.5">⚕️</span>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                {DISCLAIMER}
              </p>
            </div>
          </div>
        </aside>

        {/* Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-slate-700/50 to-transparent shrink-0 self-stretch" />

        {/* RIGHT – Chatbot */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-3 mb-5 shrink-0 pl-1">
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-violet-400">
              02 //
            </span>
            <span className="text-xs text-slate-300 uppercase tracking-widest font-semibold">
              Symptom Assistant
            </span>
          </div>
          <div className="flex-1 min-h-0 relative group">
            <div className="absolute inset-0 bg-violet-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:bg-violet-500/10" />
            <div className="relative h-full">
              <Chatbot imagePrediction={prediction} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
