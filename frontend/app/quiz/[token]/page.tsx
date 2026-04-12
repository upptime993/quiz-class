"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { getPlayerSocket, soundManager, api } from "@/lib/utils";
import { useTimer } from "@/hooks/useQuiz";

export default function TokenQuizPage() {
  const router = useRouter();
  const params = useParams();
  const tokenFromUrl = (params?.token as string || "").toUpperCase().trim();

  const { username, token: storedToken, currentAnswer, isAnswered,
    setCurrentAnswer, setIsAnswered, setToken: setPlayerToken } = usePlayerStore();
  
  const {
    status, countdown, currentQuestion,
    questionIndex, answeredCount, participantCount,
    setStatus, setCurrentQuestion, setQuestionIndex,
    setAnsweredCount, setResult, setLeaderboard,
    setCountdown, setFinalLeaderboard, setParticipantCount,
  } = useQuizStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [textAnswer, setTextAnswer] = useState("");
  const [reconnecting, setReconnecting] = useState(true);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);

  const answerTimeRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);
  const finishedNavigatedRef = useRef(false);
  const hasJoinedRef = useRef(false);

  const duration = currentQuestion?.duration || 20;
  const isAnsweredRef = useRef(false);

  useEffect(() => {
    isAnsweredRef.current = isAnswered;
  }, [isAnswered]);

  const effectiveToken = tokenFromUrl || storedToken;
  const effectiveUsername = username;

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

  // ─── Init: ambil state dari API lalu join socket ─────────────
  useEffect(() => {
    if (!effectiveToken) {
      router.replace("/");
      return;
    }
    if (!effectiveUsername) {
      router.replace(`/join/${effectiveToken}`);
      return;
    }
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    const initQuiz = async () => {
      try {
        const res = await api.get(`/session/${effectiveToken}/state?username=${encodeURIComponent(effectiveUsername)}`);
        const { data } = res.data;

        if (data.status === "finished" || data.status === "canceled") {
          router.replace("/");
          return;
        }

        // Restore state dari API
        if (data.currentQuestionData && data.status === "active") {
          setCurrentQuestion(data.currentQuestionData);
          setQuestionIndex(data.currentQuestion);
          setParticipantCount(data.totalParticipants);
          
          if (data.participantInfo) {
            setIsAnswered(data.participantInfo.answeredCurrentQuestion);
            setIsWaiting(data.participantInfo.answeredCurrentQuestion);
          }
        }

        // Update token in store to maintain consistency
        if (tokenFromUrl && tokenFromUrl !== storedToken) {
          setPlayerToken(tokenFromUrl);
        }

        // Join socket
        const socket = getPlayerSocket();

        const doJoin = () => {
          socket.emit("player:join", { token: effectiveToken, username: effectiveUsername });
          setReconnecting(false);
          // Restart timer if needed
          if (data.status === "active" && !data.participantInfo?.answeredCurrentQuestion) {
             answerTimeRef.current = Date.now();
             timer.start();
          }
        };

        if (socket.connected) {
          doJoin();
        } else {
          socket.once("connect", doJoin);
        }

      } catch {
        // API error — coba langsung join dengan state dari store
        const socket = getPlayerSocket();
        const doJoin = () => {
          socket.emit("player:join", { token: effectiveToken, username: effectiveUsername });
          setReconnecting(false);
        };
        if (socket.connected) doJoin();
        else socket.once("connect", doJoin);
      }
    };

    initQuiz();
  }, [effectiveToken, effectiveUsername]);
  
  // ─── Socket reconnect indicator ───────────────────────────────
  useEffect(() => {
    const socket = getPlayerSocket();
    const onConnect = () => setIsSocketReconnecting(false);
    const onDisconnect = () => setIsSocketReconnecting(true);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // ─── Reset state & mulai timer setiap soal baru ──────────────
  useEffect(() => {
    if (!currentQuestion || reconnecting) return;
    
    // Jangan overwrite the state kalau baru direstore as 'answered'
    if (isAnswered) return;

    setSelectedAnswer(null);
    setIsWaiting(false);
    setShowConfirm(false);
    setIsAnswered(false);
    setTextAnswer("");
    submittedRef.current = false;
    answerTimeRef.current = Date.now();
    timer.start();
  }, [currentQuestion, questionIndex, reconnecting]);

  // ─── Socket listeners ─────────────────────────────────────────
  useEffect(() => {
    if (reconnecting) return;
    
    const socket = getPlayerSocket();

    socket.on("session:playerAnswered", (data: {
      username: string;
      answeredCount: number;
      totalParticipants: number;
    }) => {
      setAnsweredCount(data.answeredCount);
    });

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
      timer.start();
    });

    socket.on("session:timerUpdate", (data: { remaining: number; questionIndex: number }) => {
      if (data.questionIndex === questionIndex && !isWaiting) {
        timer.syncFromServer(data.remaining);
      }
    });

    socket.on("session:myResult", (data: {
      isCorrect: boolean;
      pointsEarned: number;
      myAnswer: string | null;
      correctAnswer: string;
      responseTime: number;
      leaderboard?: any[];
    }) => {
      timer.stop();
      if (data.leaderboard) setLeaderboard(data.leaderboard);

      setResult({
        correctAnswer: data.correctAnswer,
        leaderboard: data.leaderboard || [],
        myAnswer: data.myAnswer,
        myIsCorrect: data.isCorrect,
        myPointsEarned: data.pointsEarned,
        myResponseTime: data.responseTime,
      });

      setStatus("showing_result");
      window.location.href = `/result?token=${effectiveToken}`;
    });

    socket.on("session:nextQuestion", () => {
      setStatus("between");
    });

    socket.on("session:finished", (data: any) => {
      if (finishedNavigatedRef.current) return;
      finishedNavigatedRef.current = true;

      timer.stop();
      setFinalLeaderboard(data.finalLeaderboard);
      setStatus("finished");
      window.location.href = `/winner?token=${effectiveToken}`;
    });

    socket.on("session:countdown", (data: { count: number | string }) => {
      setCountdown(data.count);
      setShowCountdown(true);
      if (data.count === "GO" || data.count === "GO!") {
        setTimeout(() => setShowCountdown(false), 1200);
      }
    });

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
  }, [questionIndex, reconnecting, effectiveToken]);

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

  // Loading Screen
  if (reconnecting) {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center">
        <ParticleBackground />
        <div className="relative z-10 text-center px-6">
          <div className="text-5xl mb-6 animate-bounce">🎮</div>
          <h2 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            Memulihkan Sesi
          </h2>
          <p className="text-white/60 text-sm mb-6">Menghubungkan Anda kembali ke kuis...</p>
          <div
            className="inline-block px-6 py-3 rounded-2xl text-xs font-bold tracking-widest mb-4"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            🔑 {effectiveToken}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-orange-400"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tampilkan waiting screen jika sudah jawab
  if (isWaiting) {
    return (
      <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
        {/* Socket reconnecting overlay (for waiting screen) */}
        {isSocketReconnecting && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.9)" }}>
             <div className="flex flex-col items-center">
               <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
               <h3 className="text-xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>Mengembalikan Jaringan...</h3>
             </div>
          </div>
        )}
        <WaitingAnswerScreen
          answeredCount={answeredCount}
          totalCount={participantCount}
          remaining={timer.remaining}
          total={duration}
        />
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
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
                 width: `${participantCount > 0 ? (answeredCount / participantCount) * 100 : 0}%`,
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

      {/* Socket reconnecting overlay */}
      {isSocketReconnecting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.9)" }}>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <h3 className="text-xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>Mengembalikan Jaringan...</h3>
            <p className="text-sm opacity-50 text-white mt-1">Sinyal terputus. Menyambung kembali ke quiz.</p>
          </div>
        </div>
      )}
    </div>
  );
}
