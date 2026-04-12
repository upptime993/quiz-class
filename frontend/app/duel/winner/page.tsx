"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { useDuelStore } from "@/store";
import { triggerConfetti, disconnectDuelSocket } from "@/lib/utils";

export default function DuelWinnerPage() {
  const router = useRouter();
  const { winner, finalCreator, finalOpponent, role, resetDuel } = useDuelStore();

  useEffect(() => {
    if (!winner) {
      router.replace("/duel");
      return;
    }

    triggerConfetti();
    disconnectDuelSocket();
  }, []);

  if (!winner || !finalCreator) return null;

  const iWon =
    (role === "creator" && winner === "creator") ||
    (role === "opponent" && winner === "opponent");
  const isDraw = winner === "draw";

  const winnerPlayer = winner === "creator" ? finalCreator : finalOpponent;
  const loserPlayer = winner === "creator" ? finalOpponent : finalCreator;

  const creatorScore = finalCreator.score;
  const opponentScore = finalOpponent?.score || 0;

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full blur-[120px] opacity-20 pointer-events-none"
        style={{ background: isDraw ? "#6C5CE7" : iWon ? "#FDCB6E" : "#FF4444" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">
        <div className="w-full max-w-md flex flex-col items-center">

          {/* Result headline */}
          <div className="text-center mb-8 animate-slide-down">
            <div className="text-6xl mb-4">
              {isDraw ? "🤝" : iWon ? "🏆" : "😔"}
            </div>
            <h1 className="text-4xl font-black mb-2"
              style={{
                fontFamily: "var(--font-heading)",
                background: isDraw
                  ? "linear-gradient(to right, #6C5CE7, #4ECDC4)"
                  : iWon
                    ? "linear-gradient(to right, #FDCB6E, #FF8C42)"
                    : "linear-gradient(to right, #FF4444, #FF6B6B)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              {isDraw ? "SERI!" : iWon ? "MENANG! 🎉" : "KALAH..."}
            </h1>
            <p className="text-sm opacity-60" style={{ color: "white" }}>
              {isDraw
                ? "Kalian sama-sama hebat!"
                : iWon
                  ? "Mantap! Kamu mengalahkan lawanmu!"
                  : "Jangan menyerah, coba lagi!"}
            </p>
          </div>

          {/* Score comparison card */}
          <div className="w-full p-5 rounded-2xl mb-5 animate-slide-up"
            style={{ background: "rgba(19,19,26,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>

            <div className="flex items-center gap-4">
              {/* Creator */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,60,0,0.2), rgba(255,140,0,0.1))",
                      border: winner === "creator" ? "3px solid #FDCB6E" : "2px solid rgba(255,100,50,0.3)",
                      boxShadow: winner === "creator" ? "0 0 20px rgba(253,203,110,0.4)" : "none",
                    }}>
                    <span>{finalCreator.avatar?.emoji || "🦊"}</span>
                  </div>
                  {winner === "creator" && (
                    <div className="absolute -top-2 -right-2 text-lg">👑</div>
                  )}
                </div>
                <p className="text-xs font-black text-center" style={{ color: "#FF8C42", fontFamily: "var(--font-heading)" }}>
                  {finalCreator.username}
                </p>
                <p className="text-2xl font-black" style={{ color: "white", fontFamily: "var(--font-score)" }}>
                  {creatorScore.toLocaleString()}
                </p>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,60,0,0.3), rgba(108,92,231,0.3))",
                    border: "2px solid rgba(255,255,255,0.1)",
                    color: "white",
                    fontFamily: "var(--font-score)",
                  }}>
                  VS
                </div>
              </div>

              {/* Opponent */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(78,205,196,0.1))",
                      border: winner === "opponent" ? "3px solid #FDCB6E" : "2px solid rgba(108,92,231,0.3)",
                      boxShadow: winner === "opponent" ? "0 0 20px rgba(253,203,110,0.4)" : "none",
                    }}>
                    <span>{finalOpponent?.avatar?.emoji || "🐨"}</span>
                  </div>
                  {winner === "opponent" && (
                    <div className="absolute -top-2 -right-2 text-lg">👑</div>
                  )}
                </div>
                <p className="text-xs font-black text-center" style={{ color: "var(--accent-purple-light)", fontFamily: "var(--font-heading)" }}>
                  {finalOpponent?.username || "Lawan"}
                </p>
                <p className="text-2xl font-black" style={{ color: "white", fontFamily: "var(--font-score)" }}>
                  {opponentScore.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Selisih skor */}
            {!isDraw && (
              <div className="mt-4 pt-4 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-xs opacity-40" style={{ color: "white" }}>
                  Selisih skor
                </p>
                <p className="text-lg font-black" style={{ color: "#FDCB6E", fontFamily: "var(--font-score)" }}>
                  {Math.abs(creatorScore - opponentScore).toLocaleString()} poin
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <button
              id="btn-duel-home"
              onClick={() => {
                resetDuel();
                router.push("/duel");
              }}
              className="w-full h-14 rounded-xl font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all duration-300 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #FF4444, #FF8C00)",
                color: "white",
                boxShadow: "0 4px 20px rgba(255,100,0,0.4)",
              }}>
              <span>⚔️</span>
              <span>Battle Lagi!</span>
            </button>

            <button
              onClick={() => {
                resetDuel();
                router.push("/");
              }}
              className="w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
              }}>
              🏠 Kembali ke Menu Utama
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
