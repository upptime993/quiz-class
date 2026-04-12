"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  QuestionCard,
  AnswerOption,
  TimerCircle,
  ConfirmModal,
  CountdownOverlay,
  WaitingAnswerScreen,
} from "@/components/QuizComponents";
import MatchingQuestion from "@/components/MatchingQuestion";
import { ParticleBackground, GlassCard } from "@/components/UI";
import { usePlayerStore, useQuizStore } from "@/store";
import { getPlayerSocket, soundManager } from "@/lib/utils";
import { useTimer } from "@/hooks/useQuiz";

export default function QuizPage() {
  const router = useRouter();
  const { username, token, currentAnswer, isAnswered,
    setCurrentAnswer, setIsAnswered } = usePlayerStore();
  const {
    status, countdown, currentQuestion,
    questionIndex, answeredCount, participantCount,
    setStatus, setCurrentQuestion, setQuestionIndex,
    setAnsweredCount, setResult, setLeaderboard,
    setCountdown, setFinalLeaderboard,
  } = useQuizStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [textAnswer, setTextAnswer] = useState("");
  const answerTimeRef = useRef<number>(Date.now());
  // Ref ini TIDAK digunakan untuk blok navigasi — hanya untuk cek duplikat submit
  const submittedRef = useRef(false);
  // Ref ini khusus untuk blok duplikat navigasi saat session:finished
  const finishedNavigatedRef = useRef(false);

  const duration = currentQuestion?.duration || 20;
  const isAnsweredRef = useRef(false);

  useEffect(() => {
    isAnsweredRef.current = isAnswered;
  }, [isAnswered]);

  // ─── Timer (display + sync dari server) ──────────────────────
  const handleTimerEnd = useCallback(() => {
    // Timer lokal habis — kalau belum jawab, kirim TIMEOUT
    if (!isAnsweredRef.current && !submittedRef.current) {
      submittedRef.current = true;
      const socket = getPlayerSocket();
      socket.emit("player:answer", {
        questionIndex,
        answer: "TIMEOUT",
        responseTime: duration * 1000,
      });
      setIsAnswered(true);
      setIsWaiting(true);
    }
  }, [questionIndex, duration, setIsAnswered]);

  const timer = useTimer(duration, undefined, handleTimerEnd);

  // ─── Guard: redirect jika tidak ada token/question ───────────
  useEffect(() => {
    if (!token || !username) {
      router.replace("/");
      return;
    }
    if (!currentQuestion) {
      router.replace("/lobby");
      return;
    }
  }, []);

  // ─── Reset state & mulai timer setiap soal baru ──────────────
  useEffect(() => {
    if (!currentQuestion) return;
    setSelectedAnswer(null);
    setIsWaiting(false);
    setShowConfirm(false);
    setIsAnswered(false);
    setTextAnswer("");
    submittedRef.current = false;
    answerTimeRef.current = Date.now();
    timer.start();
  }, [currentQuestion, questionIndex]);

  // ─── Socket listeners ─────────────────────────────────────────
  useEffect(() => {
    const socket = getPlayerSocket();

    // Update jumlah player yang sudah jawab
    socket.on("session:playerAnswered", (data: {
      username: string;
      answeredCount: number;
      totalParticipants: number;
    }) => {
      setAnsweredCount(data.answeredCount);
    });

    // Soal baru dimulai
    socket.on("session:questionStart", (data: any) => {
      timer.stop();
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsWaiting(false);
      setShowCountdown(false);
      setAnsweredCount(0);
      setResult(null);
      answerTimeRef.current = Date.now();
    });

    // ─── SYNC TIMER DARI SERVER ────────────────────────────────
    // Setiap detik, server mengirim remaining time.
    // Ini memastikan semua device punya timer yang sinkron.
    socket.on("session:timerUpdate", (data: { remaining: number; questionIndex: number }) => {
      // Hanya sync jika soal yang relevan masih aktif
      if (data.questionIndex === questionIndex) {
        timer.syncFromServer(data.remaining);
      }
    });

    // Hasil jawaban personal (dikirim setelah endQuestion)
    socket.on("session:myResult", (data: {
      isCorrect: boolean;
      pointsEarned: number;
      myAnswer: string | null;
      correctAnswer: string;
      responseTime: number;
      leaderboard?: any[];
    }) => {
      timer.stop();

      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }

      setResult({
        correctAnswer: data.correctAnswer,
        leaderboard: data.leaderboard || [],
        myAnswer: data.myAnswer,
        myIsCorrect: data.isCorrect,
        myPointsEarned: data.pointsEarned,
        myResponseTime: data.responseTime,
      });

      setStatus("showing_result");
      // Gunakan window.location untuk navigasi yang pasti (tidak bisa di-block oleh React state)
      window.location.href = "/result";
    });

    // Soal berikutnya akan segera mulai
    socket.on("session:nextQuestion", () => {
      setStatus("between");
    });

    // ─── QUIZ SELESAI ──────────────────────────────────────────
    // CRITICAL FIX: Ini yang sebelumnya bisa terblokir oleh hasNavigatedRef.
    // Sekarang kita gunakan ref terpisah HANYA untuk cek duplikat navigate,
    // dan pakai window.location.href agar navigasi pasti terjadi.
    socket.on("session:finished", (data: any) => {
      if (finishedNavigatedRef.current) return;
      finishedNavigatedRef.current = true;

      timer.stop();
      setFinalLeaderboard(data.finalLeaderboard);
      setStatus("finished");

      // window.location.href memastikan navigasi terjadi bahkan jika
      // React router sedang dalam state yang tidak stabil
      window.location.href = "/winner";
    });

    socket.on("session:countdown", (data: { count: number | string }) => {
      setCountdown(data.count);
      setShowCountdown(true);
      if (data.count === "GO" || data.count === "GO!") {
        setTimeout(() => setShowCountdown(false), 1200);
      }
    });

    // Session dibatalkan admin
    socket.on("session:canceled", (data: any) => {
      timer.stop();
      alert(data.message || "Sesi dibatalkan oleh admin.");
      window.location.href = "/";
    });

    return () => {
      socket.off("session:playerAnswered");
      socket.off("session:questionStart");
      socket.off("session:timerUpdate");
      socket.off("session:myResult");
      socket.off("session:nextQuestion");
      socket.off("session:finished");
      socket.off("session:countdown");
      socket.off("session:canceled");
    };
  }, [questionIndex]); // re-bind saat questionIndex berubah agar questionIndex tidak stale di handler

  const handleSelectAnswer = useCallback((label: string) => {
    if (isAnswered || isWaiting || submittedRef.current) return;
    setSelectedAnswer(label);
    setCurrentAnswer(label);
    soundManager.play("whoosh");
    setTimeout(() => setShowConfirm(true), 150);
  }, [isAnswered, isWaiting]);

  const handleConfirm = useCallback(() => {
    if (!selectedAnswer || submittedRef.current) return;
    submittedRef.current = true;
    setShowConfirm(false);

    const socket = getPlayerSocket();
    const responseTime = Date.now() - answerTimeRef.current;

    socket.emit("player:answer", {
      questionIndex,
      answer: selectedAnswer,
      responseTime,
    });

    setIsAnswered(true);
    setIsWaiting(true);
    soundManager.play("whoosh");
  }, [selectedAnswer, questionIndex]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(false);
    setSelectedAnswer(null);
    setCurrentAnswer(null);
  }, []);

  // Handle text answer submit
  const handleSubmitTextAnswer = useCallback(() => {
    if (isAnswered || isWaiting || !textAnswer.trim() || submittedRef.current) return;
    submittedRef.current = true;

    const socket = getPlayerSocket();
    const responseTime = Date.now() - answerTimeRef.current;

    socket.emit("player:answer", {
      questionIndex,
      answer: textAnswer.trim(),
      responseTime,
    });

    setIsAnswered(true);
    setIsWaiting(true);
    soundManager.play("whoosh");
  }, [isAnswered, isWaiting, textAnswer, questionIndex]);

  // Handle matching answer submit
  const handleSubmitMatchingAnswer = useCallback((matchingResult: string) => {
    if (isAnswered || isWaiting || submittedRef.current) return;
    submittedRef.current = true;

    const socket = getPlayerSocket();
    const responseTime = Date.now() - answerTimeRef.current;

    socket.emit("player:answer", {
      questionIndex,
      answer: `MATCHING:${matchingResult}`,
      responseTime,
    });

    setIsAnswered(true);
    setIsWaiting(true);
    soundManager.play("whoosh");
  }, [isAnswered, isWaiting, questionIndex]);

  // Tampilkan waiting screen jika sudah jawab
  if (isWaiting) {
    return (
      <WaitingAnswerScreen
        answeredCount={answeredCount}
        totalCount={participantCount}
        remaining={timer.remaining}
        total={duration}
      />
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col">
      <ParticleBackground />

      {/* Countdown Overlay */}
      <CountdownOverlay count={countdown} visible={showCountdown} />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        selectedAnswer={selectedAnswer || ""}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />

      <div className="flex-1 flex flex-col px-5 py-5 relative z-10 max-w-md mx-auto w-full">

        {/* ── Top Bar ── */}
        <div
          className="flex items-center justify-between mb-4 animate-slide-down bg-black/20 p-3 rounded-2xl backdrop-blur-md border border-white/5 shadow-lg"
        >
          {/* Progress soal */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">🎯</span>
              <p
                className="text-sm font-black uppercase tracking-widest text-white/90"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Soal {currentQuestion.order} <span className="text-white/40">/ {currentQuestion.totalQuestions}</span>
              </p>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: currentQuestion.totalQuestions }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-500 ease-out"
                    style={{
                      flex: i < currentQuestion.order ? "2" : "1",
                      height: 6,
                      background:
                        i < currentQuestion.order
                          ? "linear-gradient(90deg, #a29bfe, #6c5ce7)"
                          : "rgba(255,255,255,0.1)",
                      boxShadow: i < currentQuestion.order ? "0 0 8px rgba(108,92,231,0.5)" : "none"
                    }}
                  />
                )
              )}
            </div>
          </div>

          <div className="ml-4 pl-4 border-l border-white/10">
            {/* Timer (sinkron dari server) */}
            <TimerCircle
              remaining={timer.remaining}
              total={duration}
              size={60}
            />
          </div>
        </div>

        {/* ── Answered count ── */}
        <div
          className="flex items-center gap-3 mb-5 px-4 py-3 rounded-2xl backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(108,92,231,0.1), rgba(0,184,148,0.05))",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2) inset"
          }}
        >
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
            <span style={{ fontSize: 14 }}>✅</span>
          </div>
          <div>
            <p
              className="text-xs font-bold tracking-wide uppercase text-white/50"
            >
              Status Jawaban
            </p>
            <p className="text-sm font-black text-white">
              {answeredCount} <span className="text-white/40">/ {participantCount} selesai</span>
            </p>
          </div>

          <div className="flex-1" />

          {/* Mini progress */}
          <div
            className="rounded-full overflow-hidden w-16 shadow-inner"
            style={{ height: 6, background: "rgba(0,0,0,0.4)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${participantCount > 0
                  ? (answeredCount / participantCount) * 100
                  : 0}%`,
                background: "linear-gradient(90deg, var(--accent-green), #55efc4)",
                boxShadow: "0 0 10px var(--accent-green)"
              }}
            />
          </div>
        </div>

        {/* ── Question Card ── */}
        <div className="mb-4">
          <QuestionCard
            questionNumber={currentQuestion.order}
            totalQuestions={currentQuestion.totalQuestions}
            text={currentQuestion.text}
            imageUrl={currentQuestion.imageUrl}
          />
        </div>

        {/* ── Answer Options ── */}
        {currentQuestion.answerType === "text" ? (
          /* Text Answer Mode */
          <div className="animate-slide-up">
            <div
              className="rounded-2xl p-4"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
            >
              <label
                className="block text-xs font-bold mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                ✏️ Ketik Jawabanmu
              </label>
              <input
                type="text"
                className="input-field mb-3"
                placeholder="Ketik jawaban di sini..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitTextAnswer()}
                disabled={isAnswered}
                autoFocus
                style={{
                  fontSize: 16,
                  fontFamily: "var(--font-heading)",
                }}
              />
              <button
                onClick={handleSubmitTextAnswer}
                disabled={isAnswered || !textAnswer.trim()}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: textAnswer.trim() && !isAnswered
                    ? "var(--accent-green)"
                    : "var(--bg-elevated)",
                  color: textAnswer.trim() && !isAnswered
                    ? "white"
                    : "var(--text-muted)",
                  border: `2px solid ${textAnswer.trim() && !isAnswered
                    ? "var(--accent-green)"
                    : "var(--border)"
                  }`,
                  opacity: isAnswered ? 0.5 : 1,
                }}
              >
                {isAnswered ? "✅ Jawaban Terkirim" : "🚀 Kirim Jawaban"}
              </button>
            </div>
          </div>
        ) : currentQuestion.answerType === "matching" ? (
          /* Matching Mode */
          <div className="animate-slide-up">
            <MatchingQuestion
              pairs={currentQuestion.matchPairs || []}
              onAnswer={handleSubmitMatchingAnswer}
              disabled={isAnswered}
            />
          </div>
        ) : (
          /* Multiple Choice Mode */
          <div className="space-y-3 animate-slide-up">
            {currentQuestion.options.map((opt, i) => {
              const state =
                isAnswered && selectedAnswer === opt.label
                  ? "selected"
                  : isAnswered
                  ? "disabled"
                  : selectedAnswer === opt.label
                  ? "selected"
                  : "default";

              return (
                <div
                  key={opt.label}
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 0.07}s`, opacity: 0,
                    animation: `slideUp 0.3s ease ${i * 0.07}s forwards` }}
                >
                  <AnswerOption
                    option={opt}
                    state={state}
                    onClick={() => handleSelectAnswer(opt.label)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Hint ── */}
        {!selectedAnswer && !isAnswered && currentQuestion.answerType === "multiple_choice" && (
          <p
            className="text-center text-xs mt-4 animate-fade-in"
            style={{ color: "var(--text-muted)" }}
          >
            👆 Ketuk jawaban yang menurutmu benar
          </p>
        )}
      </div>
    </div>
  );
}