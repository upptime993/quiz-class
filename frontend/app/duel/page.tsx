"use client";

import { useRouter } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { useDuelStore } from "@/store";
import { useEffect } from "react";

export default function DuelModePage() {
  const router = useRouter();
  const { resetDuel } = useDuelStore();

  useEffect(() => {
    resetDuel();
  }, []);

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />

      {/* Ambient orbs */}
      <div className="absolute top-[15%] left-[20%] w-[280px] h-[280px] rounded-full blur-[120px] opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #FF4444, #FF8C00)" }} />
      <div className="absolute bottom-[20%] right-[15%] w-[220px] h-[220px] rounded-full blur-[100px] opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #6C5CE7, #4ECDC4)" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-10 animate-slide-down">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-40 animate-pulse-glow"
                style={{ background: "linear-gradient(135deg, #FF4444, #FF8C00)" }} />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border animate-bounce-idle"
                style={{
                  background: "linear-gradient(145deg, rgba(255,60,0,0.8), rgba(255,140,0,0.9))",
                  borderColor: "rgba(255,255,255,0.15)",
                  fontSize: 44,
                }}>
                ⚔️
              </div>
            </div>

            <h1 className="text-4xl font-black mb-2 tracking-tight"
              style={{
                fontFamily: "var(--font-heading)",
                background: "linear-gradient(to right, #FFF 20%, #FF8C42 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              Mode 1v1 Battle
            </h1>
            <p className="text-sm font-medium opacity-60" style={{ color: "white" }}>
              Tantang temanmu dalam duel quiz seru! 🔥
            </p>
          </div>

          {/* Mode Cards */}
          <div className="flex flex-col gap-4 animate-slide-up" style={{ animationDelay: "0.15s" }}>

            {/* Buat Room */}
            <button
              id="btn-create-room"
              onClick={() => router.push("/duel/create")}
              className="w-full p-6 rounded-2xl text-left transition-all duration-300 active:scale-95 group relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(255,60,60,0.12), rgba(255,140,0,0.08))",
                border: "1px solid rgba(255,100,50,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,100,50,0.6)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,60,60,0.2), rgba(255,140,0,0.14))";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(255,100,0,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,100,50,0.3)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,60,60,0.12), rgba(255,140,0,0.08))";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-10 group-hover:opacity-20 transition-opacity select-none">
                🏰
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: "rgba(255,100,0,0.2)", border: "1px solid rgba(255,100,50,0.4)" }}>
                  🏆
                </div>
                <div>
                  <p className="text-lg font-black mb-1" style={{ color: "#FF8C42", fontFamily: "var(--font-heading)" }}>
                    Buat Room
                  </p>
                  <p className="text-xs opacity-60 leading-relaxed" style={{ color: "white" }}>
                    Pilih quiz, generate token, dan undang teman untuk bertarung
                  </p>
                </div>
                <div className="ml-auto text-xl opacity-40 group-hover:opacity-80 group-hover:translate-x-1 transition-all">
                  →
                </div>
              </div>
            </button>

            {/* Gabung Room */}
            <button
              id="btn-join-room"
              onClick={() => router.push("/duel/join")}
              className="w-full p-6 rounded-2xl text-left transition-all duration-300 active:scale-95 group relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(108,92,231,0.12), rgba(78,205,196,0.08))",
                border: "1px solid rgba(108,92,231,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(108,92,231,0.6)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(108,92,231,0.2), rgba(78,205,196,0.14))";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(108,92,231,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(108,92,231,0.3)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(108,92,231,0.12), rgba(78,205,196,0.08))";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-10 group-hover:opacity-20 transition-opacity select-none">
                🗡️
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: "rgba(108,92,231,0.2)", border: "1px solid rgba(108,92,231,0.4)" }}>
                  🎫
                </div>
                <div>
                  <p className="text-lg font-black mb-1" style={{ color: "var(--accent-purple-light)", fontFamily: "var(--font-heading)" }}>
                    Gabung Room
                  </p>
                  <p className="text-xs opacity-60 leading-relaxed" style={{ color: "white" }}>
                    Masukkan kode token yang dibagikan temanmu
                  </p>
                </div>
                <div className="ml-auto text-xl opacity-40 group-hover:opacity-80 group-hover:translate-x-1 transition-all">
                  →
                </div>
              </div>
            </button>
          </div>

          {/* Info chips */}
          <div className="flex gap-2 mt-6 justify-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {[
              { emoji: "⚡", label: "Real-time" },
              { emoji: "🎯", label: "Head-to-Head" },
              { emoji: "🏆", label: "Winner Takes All" },
            ].map((f) => (
              <div key={f.label}
                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)",
                }}>
                <span>{f.emoji}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="w-full mt-6 py-2 text-sm font-semibold transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
          >
            ← Kembali ke Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
}
