"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PodiumCard, LeaderboardRow } from "@/components/QuizComponents";
import { ParticleBackground, Button, GlassCard, CreditFooter } from "@/components/UI";
import { usePlayerStore, useQuizStore } from "@/store";
import {
  soundManager,
  triggerConfetti,
  formatScore,
  getRankEmoji,
} from "@/lib/utils";

type WinnerPhase =
  | "intro"
  | "reveal_3"
  | "reveal_2"
  | "reveal_1"
  | "podium"
  | "full_board";

export default function WinnerPage() {
  const router = useRouter();
  const { username, avatar } = usePlayerStore();
  const { finalLeaderboard, resetQuiz } = useQuizStore();

  const [phase, setPhase] = useState<WinnerPhase>("intro");
  const [suspenseText, setSuspenseText] = useState("");
  const hasInit = useRef(false);

  const top3 = finalLeaderboard.slice(0, 3);
  const myEntry = finalLeaderboard.find((e) => e.username === username);
  const myRank = myEntry?.rank ?? 0;

  // Guard
  useEffect(() => {
    if (finalLeaderboard.length === 0) {
      router.replace("/lobby");
      return;
    }

    if (hasInit.current) return;
    hasInit.current = true;

    soundManager.play("winner");
    runRevealSequence();
  }, []);

  const runRevealSequence = async () => {
    // Phase 1: Intro suspense
    await sleep(500);
    setSuspenseText("Quiz sudah selesai! 🎊");
    await sleep(1500);
    setSuspenseText("Penasaran gak sih siapa Juaranya...? 🤔");
    await sleep(2000);

    // Phase 2: Reveal 3rd place
    if (top3.length >= 3) {
      setPhase("reveal_3");
      await sleep(2500);
    }

    // Phase 3: Reveal 2nd place
    if (top3.length >= 2) {
      setPhase("reveal_2");
      await sleep(2500);
    }

    // Phase 4: Reveal 1st place (big reveal!)
    setPhase("reveal_1");
    await sleep(500);
    triggerConfetti();
    await sleep(3000);

    // Phase 5: Full podium
    setPhase("podium");
    triggerConfetti();
    await sleep(2000);
  };

  const handleViewFullBoard = () => setPhase("full_board");

  const handlePlayAgain = () => {
    resetQuiz();
    router.replace("/");
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  // ── Intro Phase ──
  if (phase === "intro") {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center px-6">
        <ParticleBackground />
        <div className="text-center relative z-10 animate-fade-in">
          <div
            className="text-8xl mb-8 animate-bounce-idle"
            style={{
              filter: "drop-shadow(0 0 40px rgba(253,203,110,0.5))",
            }}
          >
            🏆
          </div>
          <h1
            className="text-3xl font-black mb-4 leading-tight"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {suspenseText}
          </h1>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  background: "var(--accent-purple)",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Reveal Phases ──
  if (phase === "reveal_3" || phase === "reveal_2" || phase === "reveal_1") {
    const revealEntry =
      phase === "reveal_3"
        ? top3[2]
        : phase === "reveal_2"
        ? top3[1]
        : top3[0];

    const revealRank =
      phase === "reveal_3" ? 3 : phase === "reveal_2" ? 2 : 1;

    const revealMessages: Record<number, string[]> = {
      3: ["Juara Ketiga kita adalah...", "🥉"],
      2: ["Juara Kedua kita adalah...", "🥈"],
      1: ["Dan JUARA PERTAMA kita adalah...", "🥇"],
    };

    if (!revealEntry) return null;

    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center px-6">
        <ParticleBackground />
        <div className="text-center relative z-10 max-w-sm w-full">

          {/* Rank label */}
          <p
            className="text-lg font-bold mb-2 animate-slide-down"
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {revealMessages[revealRank][0]}
          </p>

          {/* Rank emoji */}
          <div
            className="text-6xl mb-6 animate-pop-in"
            style={{
              filter: `drop-shadow(0 0 20px ${
                revealRank === 1
                  ? "rgba(255,215,0,0.6)"
                  : revealRank === 2
                  ? "rgba(192,192,192,0.5)"
                  : "rgba(205,127,50,0.5)"
              })`,
            }}
          >
            {revealMessages[revealRank][1]}
          </div>

          {/* Avatar */}
          <div
            className="flex justify-center mb-4 animate-winner"
            style={{
              filter: `drop-shadow(0 0 30px ${
                revealRank === 1
                  ? "rgba(255,215,0,0.4)"
                  : "rgba(108,92,231,0.3)"
              })`,
            }}
          >
            <div
              style={{
                fontSize: revealRank === 1 ? 100 : 80,
              }}
              className="animate-dance"
            >
              {revealEntry.avatar.emoji}
            </div>
          </div>

          {/* Username */}
          <h2
            className="text-4xl font-black mb-2 animate-slide-up"
            style={{
              fontFamily: "var(--font-heading)",
              color:
                revealRank === 1
                  ? "#FFD700"
                  : revealRank === 2
                  ? "#C0C0C0"
                  : "#CD7F32",
              textShadow: `0 0 30px ${
                revealRank === 1
                  ? "rgba(255,215,0,0.5)"
                  : "rgba(255,255,255,0.2)"
              }`,
            }}
          >
            {revealEntry.username}
          </h2>

          {/* Score */}
          <p
            className="text-xl font-bold animate-slide-up delay-200"
            style={{
              fontFamily: "var(--font-score)",
              color: "var(--text-secondary)",
            }}
          >
            {formatScore(revealEntry.score)} poin
          </p>

          {/* Selamat */}
          {revealEntry.username === username && (
            <div
              className="mt-6 px-6 py-3 rounded-2xl animate-pop-in"
              style={{
                background: "rgba(108,92,231,0.2)",
                border: "1px solid rgba(108,92,231,0.4)",
              }}
            >
              <p
                className="text-lg font-black"
                style={{
                  color: "var(--accent-purple-light)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                🎊 Selamat, itu KAMU! 🎊
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Podium Phase ──
  if (phase === "podium") {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col">
        <ParticleBackground />

        <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

          {/* Header */}
          <div className="text-center mb-6 animate-slide-down">
            <div
              className="text-5xl mb-2"
              style={{
                filter: "drop-shadow(0 0 20px rgba(253,203,110,0.5))",
              }}
            >
              🏆
            </div>
            <h1
              className="text-3xl font-black"
              style={{
                fontFamily: "var(--font-heading)",
                background:
                  "linear-gradient(135deg, #FFD700, var(--accent-purple-light))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Quiz Selesai!
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Berikut para pemenang kita! 🎉
            </p>
          </div>

          {/* Podium */}
          <div className="flex items-end justify-center gap-2 mb-6">
            {/* 2nd place */}
            {top3[1] && (
              <div className="animate-winner delay-200" style={{ opacity: 0 }}>
                <PodiumCard entry={top3[1]} delay={200} />
              </div>
            )}

            {/* 1st place (center, bigger) */}
            {top3[0] && (
              <div className="animate-winner" style={{ opacity: 0 }}>
                <PodiumCard entry={top3[0]} delay={0} />
              </div>
            )}

            {/* 3rd place */}
            {top3[2] && (
              <div className="animate-winner delay-400" style={{ opacity: 0 }}>
                <PodiumCard entry={top3[2]} delay={400} />
              </div>
            )}
          </div>

          {/* My result (if not top 3) */}
          {myRank > 3 && myEntry && (
            <GlassCard className="p-4 mb-4 animate-slide-up">
              <p
                className="text-xs font-bold mb-2 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Posisi Kamu
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-score)",
                    }}
                  >
                    #{myRank}
                  </div>
                  <span style={{ fontSize: 32 }}>{avatar.emoji}</span>
                  <p
                    className="font-bold"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--accent-purple-light)",
                    }}
                  >
                    {username} (Kamu)
                  </p>
                </div>
                <p
                  className="font-black text-lg"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--text-primary)",
                  }}
                >
                  {formatScore(myEntry.score)}
                </p>
              </div>
            </GlassCard>
          )}

          {/* Action buttons */}
          <div className="space-y-3 animate-slide-up delay-500">
            <button
              onClick={handleViewFullBoard}
              className="btn-secondary w-full"
            >
              📊 Lihat Semua Peringkat
            </button>
            <Button onClick={handlePlayAgain}>
              <span>🔄</span>
              <span>Main Lagi</span>
            </Button>
          </div>

          <CreditFooter />
        </div>
      </div>
    );
  }

  // ── Full Leaderboard Phase ──
  if (phase === "full_board") {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col">
        <ParticleBackground />

        <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5 animate-slide-down">
            <button
              onClick={() => setPhase("podium")}
              className="p-2 rounded-xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              ← Kembali
            </button>
            <div>
              <h2
                className="text-xl font-black"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                📊 Semua Peringkat
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {finalLeaderboard.length} peserta
              </p>
            </div>
          </div>

          {/* Full list */}
          <div className="flex-1 scroll-container space-y-2 mb-4">
            {finalLeaderboard.map((entry, i) => (
              <LeaderboardRow
                key={entry.username}
                entry={entry}
                isMe={entry.username === username}
                animated
                delay={i * 40}
              />
            ))}
          </div>

          {/* Back to home */}
          <Button onClick={handlePlayAgain} className="animate-slide-up">
            <span>🏠</span>
            <span>Kembali ke Beranda</span>
          </Button>

          <CreditFooter />
        </div>
      </div>
    );
  }

  return null;
}