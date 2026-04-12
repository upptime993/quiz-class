"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LeaderboardRow } from "@/components/QuizComponents";
import { AvatarRenderer } from "@/components/Avatar";
import {
  ParticleBackground,
  GlassCard,
  Badge,
  AnimatedNumber,
  ScoreBadge,
} from "@/components/UI";
import { usePlayerStore, useQuizStore } from "@/store";
import { getPlayerSocket, soundManager, formatTime } from "@/lib/utils";

type ResultPhase = "reveal" | "leaderboard" | "waiting_next";

export default function ResultPage() {
  const router = useRouter();
  const { username, avatar, score, setScore } = usePlayerStore();
  const { setIsAnswered } = usePlayerStore();
  const {
    result,
    leaderboard,
    questionIndex,
    currentQuestion,
    setLeaderboard,
    setCurrentQuestion,
    setQuestionIndex,
    setAnsweredCount,
    setResult,
    setStatus,
    setFinalLeaderboard,
  } = useQuizStore();

  const [phase, setPhase] = useState<ResultPhase>("reveal");
  const [nextCountdown, setNextCountdown] = useState(5);
  const [showPoints, setShowPoints] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false);

  // Guard
  useEffect(() => {
    if (!result) {
      router.replace("/lobby");
      return;
    }

    // Play sound
    if (result.myIsCorrect) {
      soundManager.play("correct");
    } else {
      soundManager.play("wrong");
    }

    // Update score di store
    if (result.myPointsEarned) {
      setScore(score + result.myPointsEarned);
    }

    // Show points after delay
    setTimeout(() => setShowPoints(true), 600);

    // Move to leaderboard after 3s
    timerRef.current = setTimeout(() => {
      setPhase("leaderboard");
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Socket: terima leaderboard & next question
  useEffect(() => {
    const socket = getPlayerSocket();

    socket.on("session:questionEnd", (data: {
      correctAnswer: string;
      leaderboard: any[];
      questionIndex: number;
    }) => {
      setLeaderboard(data.leaderboard);
    });

    socket.on("session:nextQuestion", (data: {
      countdown: number;
      nextQuestionIndex: number;
    }) => {
      setStatus("between");
      setPhase("waiting_next");

      // Countdown ke soal berikutnya
      let count = data.countdown || 5;
      setNextCountdown(count);

      const interval = setInterval(() => {
        count--;
        setNextCountdown(count);
        if (count <= 0) clearInterval(interval);
      }, 1000);
    });

    socket.on("session:questionStart", (data: any) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      if (timerRef.current) clearTimeout(timerRef.current);

      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setAnsweredCount(0);
      setResult(null);
      setIsAnswered(false); // CRITICAL: reset for next question
      setStatus("active");

      router.push("/quiz");
    });

    socket.on("session:finished", (data: any) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      if (timerRef.current) clearTimeout(timerRef.current);

      setFinalLeaderboard(data.finalLeaderboard);
      setStatus("finished");
      router.push("/winner");
    });

    return () => {
      socket.off("session:questionEnd");
      socket.off("session:nextQuestion");
      socket.off("session:questionStart");
      socket.off("session:finished");
    };
  }, []);

  if (!result) return null;

  const isCorrect = result.myIsCorrect ?? false;
  const isTextType = result.answerType === "text";
  const myRank = leaderboard.findIndex((e) => e.username === username) + 1;

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col">
      <ParticleBackground />

      <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

        {/* ── Phase: Result Reveal ── */}
        {phase === "reveal" && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">

            {/* Big result icon */}
            <div
              className="animate-pop-in mb-6"
              style={{
                fontSize: 100,
                filter: `drop-shadow(0 0 30px ${isCorrect
                  ? "rgba(0,184,148,0.6)"
                  : "rgba(255,107,107,0.6)"
                })`,
              }}
            >
              {isCorrect ? "🎉" : "😅"}
            </div>

            {/* Result text */}
            <div className="text-center mb-6 animate-slide-up">
              <h1
                className="text-3xl font-black mb-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: isCorrect
                    ? "var(--accent-green)"
                    : "var(--accent-red)",
                }}
              >
                {isCorrect
                  ? "Jawaban Kamu BENER!"
                  : "Yah Salah..."}
              </h1>
              <p
                className="text-lg font-bold"
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {isCorrect ? "KEREN! 🔥" : "Nice Try! 💪"}
              </p>
            </div>

            {/* Avatar */}
            <div
              className="mb-6 animate-pop-in delay-200"
              style={{ animationFillMode: "both" }}
            >
              <AvatarRenderer
                avatar={avatar}
                size={80}
                animate={isCorrect ? "dance" : "idle"}
                showAccessories
              />
            </div>

            {/* Answer detail card */}
            <GlassCard
              className="w-full p-5 mb-4 animate-slide-up delay-300"
              animate={false}
            >
              <div className="space-y-3">
                {/* Correct answer */}
                <div className="flex items-center justify-between">
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Jawaban benar:
                  </p>
                  <div
                    className="px-3 py-1 rounded-lg font-bold text-sm"
                    style={{
                      background: "rgba(0,184,148,0.15)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(0,184,148,0.3)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {isTextType ? result.correctAnswer : `Pilihan ${result.correctAnswer}`}
                  </div>
                </div>

                {/* My answer */}
                {result.myAnswer && result.myAnswer !== "TIMEOUT" && (
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Jawaban kamu:
                    </p>
                    <div
                      className="px-3 py-1 rounded-lg font-bold text-sm"
                      style={{
                        background: isCorrect
                          ? "rgba(0,184,148,0.15)"
                          : "rgba(255,107,107,0.15)",
                        color: isCorrect
                          ? "var(--accent-green)"
                          : "var(--accent-red)",
                        border: `1px solid ${isCorrect
                          ? "rgba(0,184,148,0.3)"
                          : "rgba(255,107,107,0.3)"
                        }`,
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {isTextType ? result.myAnswer : `Pilihan ${result.myAnswer}`}
                    </div>
                  </div>
                )}

                {/* Timeout */}
                {(!result.myAnswer || result.myAnswer === "TIMEOUT") && (
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Status:
                    </p>
                    <Badge variant="red">⏰ Waktu Habis</Badge>
                  </div>
                )}

                {/* Response time */}
                {result.myResponseTime && result.myAnswer !== "TIMEOUT" && (
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Waktu jawab:
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: "var(--accent-yellow)",
                        fontFamily: "var(--font-score)",
                      }}
                    >
                      ⚡ {formatTime(result.myResponseTime)}
                    </p>
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    margin: "4px 0",
                  }}
                />

                {/* Points earned */}
                <div className="flex items-center justify-between">
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Poin didapat:
                  </p>
                  {showPoints && (
                    <ScoreBadge
                      points={result.myPointsEarned ?? 0}
                      isCorrect={isCorrect}
                    />
                  )}
                </div>

                {/* Total score */}
                <div className="flex items-center justify-between">
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Total skor:
                  </p>
                  <p
                    className="text-lg font-black"
                    style={{
                      fontFamily: "var(--font-score)",
                      color: "var(--accent-purple-light)",
                    }}
                  >
                    <AnimatedNumber value={score + (result.myPointsEarned ?? 0)} />
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Transition hint */}
            <p
              className="text-xs animate-fade-in delay-500"
              style={{ color: "var(--text-muted)" }}
            >
              Menampilkan leaderboard...
            </p>
          </div>
        )}

        {/* ── Phase: Leaderboard ── */}
        {phase === "leaderboard" && (
          <div className="flex-1 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="text-center mb-5">
              <div style={{ fontSize: 48 }} className="animate-bounce-idle mb-2">
                🏆
              </div>
              <h2
                className="text-2xl font-black"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                Leaderboard Sementara
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Soal {(questionIndex ?? 0) + 1} selesai!
              </p>

              {/* My rank */}
              {myRank > 0 && (
                <div
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full animate-pop-in"
                  style={{
                    background: "rgba(108,92,231,0.15)",
                    border: "1px solid rgba(108,92,231,0.3)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>
                    {myRank <= 3 ? ["🥇", "🥈", "🥉"][myRank - 1] : `#${myRank}`}
                  </span>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: "var(--accent-purple-light)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Posisi kamu: #{myRank}
                  </p>
                </div>
              )}
            </div>

            {/* Leaderboard list */}
            <div className="flex-1 scroll-container space-y-2 mb-4">
              {leaderboard.length > 0 ? (
                leaderboard.slice(0, 10).map((entry, i) => (
                  <LeaderboardRow
                    key={entry.username}
                    entry={entry}
                    isMe={entry.username === username}
                    animated
                    delay={i * 60}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    Menunggu data leaderboard...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phase: Waiting Next ── */}
        {phase === "waiting_next" && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
            <div style={{ fontSize: 72 }} className="animate-bounce-idle mb-4">
              ⏳
            </div>
            <h2
              className="text-2xl font-black text-center mb-2"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              Soal Berikutnya...
            </h2>
            <p
              className="text-base mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Bersiap-siap ya! 💪
            </p>

            {/* Countdown circle */}
            <div
              className="flex items-center justify-center w-28 h-28 rounded-full mb-4 animate-pulse-glow"
              style={{
                background: "rgba(108,92,231,0.15)",
                border: "3px solid var(--accent-purple)",
                boxShadow: "0 0 30px rgba(108,92,231,0.3)",
              }}
            >
              <span
                className="text-5xl font-black"
                style={{
                  fontFamily: "var(--font-score)",
                  color: "var(--accent-purple-light)",
                }}
              >
                {nextCountdown}
              </span>
            </div>

            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              detik lagi...
            </p>

            {/* My current stats */}
            <GlassCard className="w-full mt-6 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AvatarRenderer
                    avatar={avatar}
                    size={44}
                    animate="idle"
                    showAccessories
                  />
                  <div>
                    <p
                      className="font-bold text-sm"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {username}
                    </p>
                    {myRank > 0 && (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Posisi #{myRank}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-xl font-black"
                    style={{
                      fontFamily: "var(--font-score)",
                      color: "var(--accent-purple-light)",
                    }}
                  >
                    <AnimatedNumber
                      value={score + (result?.myPointsEarned ?? 0)}
                    />
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    poin
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Top 5 Leaderboard Temporary */}
            {leaderboard.length > 0 && (
              <div className="w-full mt-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                <p className="text-xs font-bold text-center mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  👑 Top 5 Sementara
                </p>
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <LeaderboardRow
                      key={entry.username}
                      entry={entry}
                      isMe={entry.username === username}
                      animated={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}