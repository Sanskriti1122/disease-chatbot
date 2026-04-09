import { useState, useRef, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";

const SEVERITY = {
  HIGH:     { ring: "ring-red-500/60",    bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-400",    label: "HIGH RISK" },
  MODERATE: { ring: "ring-amber-400/60",  bg: "bg-amber-400/10",  text: "text-amber-300",  dot: "bg-amber-400",  label: "MODERATE"  },
  LOW:      { ring: "ring-acid/60",       bg: "bg-lime-400/10",   text: "text-lime-300",   dot: "bg-acid",       label: "CLEAR"     },
  UNKNOWN:  { ring: "ring-slate-600/60",  bg: "bg-slate-700/20",  text: "text-slate-400",  dot: "bg-slate-500",  label: "UNKNOWN"   },
};

function ConfidenceBar({ label, value, highlight }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-4">
      <span className={`w-36 text-right text-[11px] font-mono tracking-widest uppercase shrink-0 ${highlight ? "text-white font-bold" : "text-slate-400 font-medium"}`}>
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-2 bg-ink-950/60 rounded-full overflow-hidden border border-white/5 relative">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-1
            ${highlight ? "bg-gradient-to-r from-cyan-500 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-slate-700"}`}
          style={{ width: `${pct}%` }}
        >
        </div>
      </div>
      <span className={`w-12 text-right text-[11px] font-mono tracking-wider ${highlight ? "text-cyan-300 font-bold" : "text-slate-500 font-medium"}`}>
        {pct}%
      </span>
    </div>
  );
}

export default function UploadMRI({ onPrediction }) {
  const [dragOver, setDragOver]     = useState(false);
  const [preview, setPreview]       = useState(null);
  const [fileName, setFileName]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const fileRef                     = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/bmp", "image/tiff", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Unsupported format. Please upload JPG, PNG, BMP, TIFF, or WEBP.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File too large. Maximum size is 25 MB.");
      return;
    }

    setError(null);
    setResult(null);
    setFileName(file.name);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    // Send to backend
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API}/predict-image`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      onPrediction?.(data);
    } catch (err) {
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [onPrediction]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const sev = SEVERITY[result?.severity?.toUpperCase()] || SEVERITY.UNKNOWN;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Drop zone ── */}
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`relative rounded-3xl border cursor-pointer overflow-hidden select-none shadow-xl transition-all duration-500 group flex items-center justify-center
          ${dragOver
            ? "bg-cyan-500/10 border-cyan-400/50 scale-[1.02] shadow-[0_0_30px_rgba(34,211,238,0.2)]"
            : "glass-panel border-white/5 hover:bg-white/5 hover:border-white/10"
          }`}
        style={{ minHeight: 280 }}
      >
        {!preview && (
          <div className="absolute inset-0 radar-sweep opacity-40 group-hover:opacity-70 transition-opacity duration-700" />
        )}
        
        {preview ? (
          <>
            <img
              src={result?.annotated_image || preview}
              alt="MRI scan"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ maxHeight: 280 }}
              draggable={false}
            />
            {/* Scan animation while loading */}
            {loading && <div className="scan-overlay bg-ink-950/40" />}
            {/* Overlay hint */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent flex items-end justify-center pb-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-[13px] text-white font-medium bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                {loading ? "🔬 Analyzing…" : (result?.annotated_image ? "Tumor detected and highlighted. Click to replace." : "Click or drop to replace")}
              </span>
            </div>
          </>
        ) : (
          <div className="relative flex flex-col items-center justify-center gap-5 py-12 px-6 z-10">
            <div className="w-20 h-20 rounded-full glass-pill border border-white/10 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(139,92,246,0.15)] group-hover:-translate-y-2 transition-transform duration-500">
              <span className="animate-pulse">🧠</span>
            </div>
            <div className="text-center group-hover:-translate-y-1 transition-transform duration-500 delay-75">
              <p className="text-white font-bold font-display text-[15px] tracking-wide">
                Drop your MRI / CT scan
              </p>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">
                JPG · PNG · BMP · TIFF &nbsp;·&nbsp; Max 20MB
              </p>
            </div>
            <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-cyan-300 font-medium group-hover:bg-cyan-500/20 group-hover:border-cyan-400/30 group-hover:text-cyan-200 transition-all duration-300">
              Browse Files
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => processFile(e.target.files[0])}
      />

      {fileName && (
        <p className="text-xs text-slate-500 truncate -mt-1 ml-1">
          📎 {fileName}
        </p>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 animate-fade-up">
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !result && (
        <div className="space-y-3 animate-fade-up">
          <div className="h-24 rounded-2xl bg-slate-800/60 border border-slate-700/40 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
        </div>
      )}

      {/* ── Result card ── */}
      {result && !loading && (
        <div className={`relative rounded-3xl border-2 p-6 space-y-5 animate-fade-up shadow-2xl overflow-hidden backdrop-blur-2xl
          ${sev.label === "HIGH RISK" ? "border-red-500/30 bg-red-950/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]" :
            sev.label === "MODERATE" ? "border-amber-500/30 bg-amber-950/10 shadow-[0_0_30px_rgba(245,158,11,0.15)]" :
            sev.label === "CLEAR" ? "border-acid/30 bg-acid/10 shadow-[0_0_30px_rgba(163,230,53,0.1)]" :
            "border-white/10 glass-panel"
          }`}
        >
          {/* Decorative glow behind card content */}
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-40 pointer-events-none" style={{ backgroundColor: result.color || "#22d3ee" }} />

          {/* Header */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${sev.text}`} style={{ backgroundColor: 'currentColor' }} />
                <span className={`text-xs font-mono font-bold tracking-[0.15em] ${sev.text}`}>
                  {sev.label}
                </span>
              </div>
              <h3 className="text-xl font-bold font-display text-white leading-tight">
                {result.display_name || result.class_name || "Result"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <span className="text-base leading-none">🧠</span> {result.body_part || "Brain scan"}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4 flex flex-col items-end">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest font-semibold">Confidence</div>
              <div
                className="text-4xl font-black font-display tracking-tight drop-shadow-lg"
                style={{ color: result.color || "#22d3ee", textShadow: `0 0 20px ${result.color || '#22d3ee'}60` }}
              >
                {result.confidence_pct || `${Math.round((result.confidence || 0) * 100)}%`}
              </div>
            </div>
          </div>

          {/* Explanation */}
          {result.description && (
            <div className="bg-ink-950/40 rounded-2xl p-4 border border-white/5 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-semibold">Explanation</p>
              </div>
              <p className="text-slate-300 text-[13.5px] leading-relaxed">{result.description}</p>
            </div>
          )}

          {/* Recommendation */}
          {result.recommendation && (
            <div className="bg-cyan-500/10 rounded-2xl p-4 border border-cyan-400/20 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <p className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">Recommendation</p>
              </div>
              <p className="text-cyan-50 text-[13.5px] leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {/* Score breakdown */}
          {result.all_scores && Object.keys(result.all_scores).length > 0 && (
            <div className="pt-3 relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Score Breakdown</p>
              </div>
              <div className="grid gap-2.5">
                {Object.entries(result.all_scores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cls, score]) => (
                    <ConfidenceBar
                      key={cls}
                      label={cls}
                      value={score}
                      highlight={cls === result.class_name}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
