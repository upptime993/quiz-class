"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { useDuelStore } from "@/store";
import { getDuelSocket } from "@/lib/utils";
import { REACTION_EMOJIS } from "@/types";
import { FloatingReactionItem } from "@/components/Avatar";
import { useFloatingReactions } from "@/hooks/useQuiz";
import MatchingQuestion from "@/components/MatchingQuestion";

export default function DuelQuizPage() {
  const router = useRouter();
  const {
    role, creator, opponent, quizTitle, totalQuestions,
    currentQuestion, questionIndex, result, token, username,
    setStatus, setCurrentQuestion, setQuestionIndex, setResult,
    setCreator, setOpponent, setCountdown, setFinished,
  } = useDuelStore();

  const { reactions, addReaction } = useFloatingReactions();

  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(currentQuestion?.duration || 0);
  const [showResult, setShowResult] = useState(false);
  const [creatorScore, setCreatorScore] = useState(creator?.score || 0);
  const [opponentScore, setOpponentScore] = useState(opponent?.score || 0);
  const [matchingAnswer, setMatchingAnswer] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answeredRef = useRef(false); // Ref untuk cek answered di dalam closure timer
  const sessionRestoredRef = useRef(false);

  const [interrupted, setInterrupted] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // ─── Auto-Reconnect Listeners ─────────────────────────────
  useEffect(() => {
    const socket = getDuelSocket();
    const handleConnect = () => setIsReconnecting(false);
    const handleDisconnect = () => setIsReconnecting(true);
    
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    setIsReconnecting(!socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  const me = role === "creator" ? creator : opponent;
  const them = role === "creator" ? opponent : creator;

  // ─── Session Recovery: reconnect socket jika browser di-refresh ──
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    if (!token || !username || !role) {
      router.replace("/duel");
      return;
    }
    if (!currentQuestion) {
      router.replace("/duel");
      return;
    }

    sessionRestoredRef.current = true;
    const socket = getDuelSocket();

    const doJoin = () => {
      socket.emit("duel:join", { token, username, role });
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once("connect", doJoin);
    }
  }, []); // Hanya sekali waktu mount

  // ─── Setup timer & socket listener per soal ───────────────────
  useEffect(() => {
    if (!currentQuestion) return;

    const socket = getDuelSocket();
    answeredRef.current = false;
    setAnswered(false);
    setSelectedAnswer(null);
    setShowResult(false);
    setMatchingAnswer("");

    // Start timer
    const duration = currentQuestion.duration;
    setTimeLeft(duration);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          // ─── BUG FIX #1: Auto-submit kosong saat timer habis ───
          if (!answeredRef.current) {
            answeredRef.current = true;
            setAnswered(true);
            const responseTime = duration * 1000;
            socket.emit("duel:answer", {
              questionIndex,
              answer: "",
              responseTime,
            });
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // ─── Socket Listeners ──────────────────────────────────────
    const onScoreUpdate = (data: { creatorScore: number; opponentScore: number }) => {
      setCreatorScore(data.creatorScore);
      setOpponentScore(data.opponentScore);
    };

    const onMyResult = (data: any) => {
      setResult({
        isCorrect: data.isCorrect,
        pointsEarned: data.pointsEarned,
        myAnswer: data.myAnswer,
        correctAnswer: data.correctAnswer,
        answerType: data.answerType,
        matchPairs: data.matchPairs,
        responseTime: data.responseTime,
        creatorScore: data.creatorScore,
        opponentScore: data.opponentScore,
      });
      setCreatorScore(data.creatorScore);
      setOpponentScore(data.opponentScore);
      setShowResult(true);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    const onQuestionStart = (data: any) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setResult(null);
      answeredRef.current = false;
      setAnswered(false);
      setSelectedAnswer(null);
      setShowResult(false);
      setInterrupted(false);
      setMatchingAnswer("");
      setTimeLeft(data.question.duration);
    };

    const onReaction = (data: { username: string; emoji: string; id: string }) => {
      addReaction(data.emoji, data.username);
    };

    // ─── Natural Delay pada Finish ─────────────
    const onFinished = (data: any) => {
      setFinished({
        winner: data.winner,
        finalCreator: data.creator,
        finalOpponent: data.opponent,
      });
      
      const isInterrupted = questionIndex + 1 < totalQuestions;
      
      if (isInterrupted) {
         setInterrupted(true);
         setTimeout(() => window.location.href = "/duel/winner", 2500);
      } else {
         setTimeout(() => window.location.href = "/duel/winner", 100);
      }
    };

    const onPlayerDisconnected = () => {
      alert("Lawan keluar dari battle!");
      router.replace("/duel");
    };

    socket.on("duel:scoreUpdate", onScoreUpdate);
    socket.on("duel:myResult", onMyResult);
    socket.on("duel:questionStart", onQuestionStart);
    socket.on("duel:reaction", onReaction);
    socket.on("duel:finished", onFinished);
    socket.on("duel:playerDisconnected", onPlayerDisconnected);
    // Legacy support
    socket.on("duel:opponentLeft", onPlayerDisconnected);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off("duel:scoreUpdate", onScoreUpdate);
      socket.off("duel:myResult", onMyResult);
      socket.off("duel:questionStart", onQuestionStart);
      socket.off("duel:reaction", onReaction);
      socket.off("duel:finished", onFinished);
      socket.off("duel:playerDisconnected", onPlayerDisconnected);
      socket.off("duel:opponentLeft", onPlayerDisconnected);
    };
  }, [questionIndex]);

  const submitAnswer = useCallback((answer: string) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    setSelectedAnswer(answer);
    if (timerRef.current) clearInterval(timerRef.current);

    const socket = getDuelSocket();
    const responseTime = currentQuestion
      ? (currentQuestion.duration - timeLeft) * 1000
      : 0;

    socket.emit("duel:answer", {
      questionIndex,
      answer,
      responseTime,
    });
  }, [questionIndex, currentQuestion, timeLeft]);

  const sendReaction = useCallback((emoji: string) => {
    const socket = getDuelSocket();
    socket.emit("duel:reaction", { emoji });
    addReaction(emoji, me?.username || "");
  }, [me]);

  if (!currentQuestion) return null;

  const timerRatio = timeLeft / (currentQuestion.duration || 1);
  const timerColor = timerRatio > 0.5 ? "#00B894" : timerRatio > 0.25 ? "#FDCB6E" : "#FF4444";

  const myScore = role === "creator" ? creatorScore : opponentScore;
  const theirScore = role === "creator" ? opponentScore : creatorScore;

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />

      {/* Floating reactions */}
      {reactions.map((r) => (
        <FloatingReactionItem key={r.id} id={r.id} emoji={r.emoji} username={r.username} x={r.x} />
      ))}

      <div className="flex-1 flex flex-col px-4 py-4 relative z-10 max-w-md mx-auto w-full">

        {/* ── Mini Scoreboard ── */}
        <div className="p-3 rounded-2xl mb-4 animate-slide-down"
          style={{ background: "rgba(19,19,26,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            {/* Me */}
            <div className="flex-1 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: "rgba(255,100,0,0.15)", border: "1px solid rgba(255,100,50,0.3)" }}>
                <span>{me?.avatar?.mixImageUrl ? "🖼️" : me?.avatar?.emoji || "🦊"}</span>
              </div>
              <div>
                <p className="text-[10px] opacity-40 font-bold uppercase" style={{ color: "white" }}>You</p>
                <p className="text-base font-black" style={{ color: "#FF8C42", fontFamily: "var(--font-score)" }}>
                  {myScore.toLocaleString()}
                </p>
              </div>
            </div>

            {/* VS center + progress */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                VS
              </span>
              <p className="text-[9px] opacity-40" style={{ color: "white" }}>
                {questionIndex + 1}/{totalQuestions}
              </p>
            </div>

            {/* Opponent */}
            <div className="flex-1 flex items-center gap-2 justify-end">
              <div className="text-right">
                <p className="text-[10px] opacity-40 font-bold uppercase" style={{ color: "white" }}>Lawan</p>
                <p className="text-base font-black" style={{ color: "var(--accent-purple-light)", fontFamily: "var(--font-score)" }}>
                  {theirScore.toLocaleString()}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.3)" }}>
                <span>{them?.avatar?.emoji || "🐨"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Timer ── */}
        <div className="mb-3 animate-slide-down" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wide opacity-50" style={{ color: "white" }}>Waktu</span>
            <span className="text-xl font-black" style={{ color: timerColor, fontFamily: "var(--font-score)" }}>
              {timeLeft}s
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${timerRatio * 100}%`, background: timerColor, boxShadow: `0 0 8px ${timerColor}` }} />
          </div>
        </div>

        {/* ── Question ── */}
        <div className="p-4 rounded-2xl mb-4 animate-slide-up"
          style={{ background: "rgba(19,19,26,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>

          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-black"
              style={{ background: "rgba(255,140,66,0.15)", color: "#FF8C42", border: "1px solid rgba(255,140,66,0.3)" }}>
              Soal {questionIndex + 1}
            </span>
            {answered && (
              <span className="text-xs font-bold" style={{ color: "rgba(0,184,148,0.8)" }}>
                ✅ Dijawab
              </span>
            )}
            {timeLeft === 0 && !answered && (
              <span className="text-xs font-bold" style={{ color: "rgba(255,68,68,0.8)" }}>
                ⏰ Waktu Habis
              </span>
            )}
          </div>

          {currentQuestion.imageUrl && (
            <img src={currentQuestion.imageUrl} alt="Soal" className="w-full rounded-xl mb-3 object-cover max-h-36" />
          )}

          <p className="text-base font-bold leading-relaxed" style={{ color: "white" }}>
            {currentQuestion.text}
          </p>
        </div>

        {/* ── Answers ── */}
        {currentQuestion.answerType === "matching" ? (
          <div className="animate-slide-up mb-3">
          <MatchingQuestion
              pairs={currentQuestion.matchPairs || []}
              onAnswer={(ans) => {
                submitAnswer(`MATCHING:${ans}`);
              }}
              disabled={answered}
            />
          </div>
        ) : currentQuestion.answerType === "text" ? (
          <div className="mb-4 animate-slide-up">
            <input
              className="w-full h-12 rounded-xl px-4 text-sm font-bold text-white outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              placeholder="Ketik jawabanmu di sini..."
              disabled={answered}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                  submitAnswer((e.target as HTMLInputElement).value.trim());
                }
              }}
            />
            {!answered && (
              <p className="text-xs mt-1 opacity-40 text-center" style={{ color: "white" }}>
                Tekan Enter untuk submit
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3 animate-slide-up">
            {(currentQuestion.options || []).map((opt) => {
              const isSelected = selectedAnswer === opt.label;
              const isCorrectReveal = showResult && result?.correctAnswer === opt.label;
              const isWrongSelected = showResult && isSelected && !result?.isCorrect;

              return (
                <button
                  key={opt.label}
                  onClick={() => submitAnswer(opt.label)}
                  disabled={answered}
                  className="p-3 rounded-xl text-left transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    background: isCorrectReveal
                      ? "rgba(0,184,148,0.25)"
                      : isWrongSelected
                        ? "rgba(255,68,68,0.25)"
                        : isSelected
                          ? "rgba(255,140,66,0.2)"
                          : "rgba(255,255,255,0.04)",
                    border: isCorrectReveal
                      ? "2px solid rgba(0,184,148,0.6)"
                      : isWrongSelected
                        ? "2px solid rgba(255,68,68,0.6)"
                        : isSelected
                          ? "2px solid rgba(255,140,66,0.5)"
                          : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: isCorrectReveal
                      ? "0 0 15px rgba(0,184,148,0.2)"
                      : isWrongSelected
                        ? "0 0 15px rgba(255,68,68,0.2)"
                        : "none",
                  }}>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{
                        background: isSelected || isCorrectReveal
                          ? (isCorrectReveal ? "rgba(0,184,148,0.3)" : isWrongSelected ? "rgba(255,68,68,0.3)" : "rgba(255,140,66,0.3)")
                          : "rgba(255,255,255,0.08)",
                        color: isCorrectReveal ? "#00B894" : isWrongSelected ? "#FF4444" : isSelected ? "#FF8C42" : "rgba(255,255,255,0.6)",
                      }}>
                      {opt.label}
                    </span>
                    <p className="text-sm font-semibold leading-tight" style={{ color: "white" }}>
                      {opt.text}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Result feedback */}
        {showResult && result && (
          <div className="p-3 rounded-xl mb-3 animate-slide-up"
            style={{
              background: result.isCorrect ? "rgba(0,184,148,0.1)" : "rgba(255,68,68,0.1)",
              border: `1px solid ${result.isCorrect ? "rgba(0,184,148,0.3)" : "rgba(255,68,68,0.3)"}`,
            }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{result.isCorrect ? "✅" : "❌"}</span>
              <div>
                <p className="text-sm font-black" style={{ color: result.isCorrect ? "#00B894" : "#FF4444" }}>
                  {result.isCorrect ? `+${result.pointsEarned.toLocaleString()} poin!` : "Salah!"}
                </p>
                {!result.isCorrect && (
                  <p className="text-xs opacity-60" style={{ color: "white" }}>
                    Jawaban: {result.correctAnswer}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reaction bar */}
        <div className="mt-auto">
          <div className="flex justify-between gap-1 px-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="flex-1 aspect-square max-w-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 22 }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {interrupted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(10,10,15,0.85)" }}>
          <div className="w-full max-w-xs p-6 rounded-3xl text-center"
            style={{ background: "rgba(255,102,102,0.15)", border: "1px solid rgba(255,102,102,0.3)", boxShadow: "0 0 30px rgba(255,102,102,0.2)" }}>
            <div className="text-4xl mb-4 animate-bounce">🚨</div>
            <h3 className="text-xl font-black text-white mb-2" style={{ fontFamily: "var(--font-heading)" }}>Sudden Death!</h3>
            <p className="text-sm opacity-80 text-white font-medium">Lawan telah menyelesaikan kuis lebih dulu.<br/><br/>Permainan berakhir.</p>
          </div>
        </div>
      )}

      {isReconnecting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.9)" }}>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <h3 className="text-xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>Mengembalikan Sesi...</h3>
            <p className="text-sm opacity-50 text-white mt-1">Sinyal terputus. Menyambung kembali ke duel.</p>
          </div>
        </div>
      )}
    </div>
  );
}
