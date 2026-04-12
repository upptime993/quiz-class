"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { useDuelStore } from "@/store";
import { getDuelSocket, api } from "@/lib/utils";
import { REACTION_EMOJIS } from "@/types";
import { FloatingReactionItem } from "@/components/Avatar";
import { useFloatingReactions } from "@/hooks/useQuiz";
import MatchingQuestion from "@/components/MatchingQuestion";

/**
 * /duel/[token]/quiz — Halaman game duel yang URL-based.
 * Mendukung reconnect saat refresh: cek token dari URL,
 * ambil state dari API, lalu re-join via socket.
 */
export default function DuelTokenQuizPage() {
  const router = useRouter();
  const params = useParams();
  const tokenFromUrl = (params?.token as string || "").toUpperCase().trim();

  const {
    role: storedRole, username, token: storedToken,
    creator, opponent, quizTitle, totalQuestions,
    currentQuestion, questionIndex, result,
    setStatus, setCurrentQuestion, setQuestionIndex, setResult,
    setCreator, setOpponent, setToken, setUsername, setRole,
    setFinished,
  } = useDuelStore();

  const { reactions, addReaction } = useFloatingReactions();

  const [reconnecting, setReconnecting] = useState(true);
  const [reconnectMsg, setReconnectMsg] = useState("Menghubungkan ke duel...");
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(currentQuestion?.duration || 20);
  const [showResult, setShowResult] = useState(false);
  const [creatorScore, setCreatorScore] = useState(creator?.score || 0);
  const [opponentScore, setOpponentScore] = useState(opponent?.score || 0);
  const [interrupted, setInterrupted] = useState(false);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answeredRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // Resolve role: dari store atau dari URL query
  const effectiveToken = tokenFromUrl || storedToken;
  const effectiveUsername = username;

  // ─── Init: ambil state dari API lalu join socket ─────────────
  useEffect(() => {
    if (!effectiveToken) {
      router.replace("/duel");
      return;
    }
    if (!effectiveUsername) {
      router.replace(`/duel/join?token=${effectiveToken}`);
      return;
    }
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    const initDuel = async () => {
      try {
        setReconnectMsg("Memulihkan sesi duel...");
        const res = await api.get(`/duel/${effectiveToken}/state?username=${encodeURIComponent(effectiveUsername)}`);
        const { data } = res.data;

        if (data.status === "finished" || data.status === "canceled") {
          router.replace("/duel");
          return;
        }

        // Restore state dari API
        if (data.creator) setCreator(data.creator);
        if (data.opponent) setOpponent(data.opponent);
        if (data.myRole) setRole(data.myRole);
        if (data.currentQuestionData && data.status === "active") {
          setCurrentQuestion(data.currentQuestionData);
          setQuestionIndex(data.currentQuestion);
          setTimeLeft(data.currentQuestionData.duration || 20);
        }

        setCreatorScore(data.creator?.score || 0);
        setOpponentScore(data.opponent?.score || 0);

        // Join socket
        const socket = getDuelSocket();

        const doJoin = () => {
          const role = data.myRole || storedRole;
          if (!role) {
            router.replace(`/duel/join?token=${effectiveToken}`);
            return;
          }
          socket.emit("duel:join", { token: effectiveToken, username: effectiveUsername, role });
          setReconnecting(false);
        };

        if (socket.connected) {
          doJoin();
        } else {
          socket.once("connect", doJoin);
        }

      } catch {
        // API error — coba langsung join dengan state dari store
        if (!storedRole) {
          router.replace(`/duel/join?token=${effectiveToken}`);
          return;
        }
        const socket = getDuelSocket();
        const doJoin = () => {
          socket.emit("duel:join", { token: effectiveToken, username: effectiveUsername, role: storedRole });
          setReconnecting(false);
        };
        if (socket.connected) doJoin();
        else socket.once("connect", doJoin);
      }
    };

    initDuel();
  }, [effectiveToken, effectiveUsername]);

  // ─── Socket reconnect indicator ───────────────────────────────
  useEffect(() => {
    const socket = getDuelSocket();
    const onConnect = () => setIsSocketReconnecting(false);
    const onDisconnect = () => setIsSocketReconnecting(true);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // ─── Socket listeners per soal ────────────────────────────────
  useEffect(() => {
    if (reconnecting) return;
    if (!currentQuestion) return;

    const socket = getDuelSocket();
    answeredRef.current = false;
    setAnswered(false);
    setSelectedAnswer(null);
    setShowResult(false);

    // Timer lokal
    const duration = currentQuestion.duration;
    setTimeLeft(duration);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          if (!answeredRef.current) {
            answeredRef.current = true;
            setAnswered(true);
            socket.emit("duel:answer", { questionIndex, answer: "", responseTime: duration * 1000 });
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

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
      setTimeLeft(data.question.duration);
    };

    const onReaction = (data: { username: string; emoji: string; id: string }) => {
      addReaction(data.emoji, data.username);
    };

    const onFinished = (data: any) => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setFinished({ winner: data.winner, finalCreator: data.creator, finalOpponent: data.opponent });
      const isInterrupted = questionIndex + 1 < (totalQuestions || 1);
      if (isInterrupted) {
        setInterrupted(true);
        setTimeout(() => router.push("/duel/winner"), 2500);
      } else {
        setTimeout(() => router.push("/duel/winner"), 300);
      }
    };

    const onOpponentLeft = () => {
      alert("Lawan keluar dari battle!");
      router.replace("/duel");
    };

    socket.on("duel:scoreUpdate", onScoreUpdate);
    socket.on("duel:myResult", onMyResult);
    socket.on("duel:questionStart", onQuestionStart);
    socket.on("duel:reaction", onReaction);
    socket.on("duel:finished", onFinished);
    socket.on("duel:opponentLeft", onOpponentLeft);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off("duel:scoreUpdate", onScoreUpdate);
      socket.off("duel:myResult", onMyResult);
      socket.off("duel:questionStart", onQuestionStart);
      socket.off("duel:reaction", onReaction);
      socket.off("duel:finished", onFinished);
      socket.off("duel:opponentLeft", onOpponentLeft);
    };
  }, [questionIndex, reconnecting]);

  const submitAnswer = useCallback((answer: string) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    setSelectedAnswer(answer);
    if (timerRef.current) clearInterval(timerRef.current);
    const socket = getDuelSocket();
    const responseTime = currentQuestion ? (currentQuestion.duration - timeLeft) * 1000 : 0;
    socket.emit("duel:answer", { questionIndex, answer, responseTime });
  }, [questionIndex, currentQuestion, timeLeft]);

  const sendReaction = useCallback((emoji: string) => {
    getDuelSocket().emit("duel:reaction", { emoji });
    addReaction(emoji, username || "");
  }, [username]);

  // ─── Loading Screen ───────────────────────────────────────────
  if (reconnecting) {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center">
        <ParticleBackground />
        <div className="relative z-10 text-center px-6">
          <div className="text-5xl mb-6 animate-bounce">⚔️</div>
          <h2 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            Memulihkan Duel
          </h2>
          <p className="text-white/60 text-sm mb-6">{reconnectMsg}</p>
          <div
            className="inline-block px-6 py-3 rounded-2xl text-xs font-bold tracking-widest mb-4"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            🎮 {effectiveToken}
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

  if (!currentQuestion) return null;

  const me = storedRole === "creator" ? creator : opponent;
  const them = storedRole === "creator" ? opponent : creator;
  const myScore = storedRole === "creator" ? creatorScore : opponentScore;
  const theirScore = storedRole === "creator" ? opponentScore : creatorScore;
  const timerRatio = timeLeft / (currentQuestion.duration || 1);
  const timerColor = timerRatio > 0.5 ? "#00B894" : timerRatio > 0.25 ? "#FDCB6E" : "#FF4444";

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />

      {reactions.map((r) => (
        <FloatingReactionItem key={r.id} id={r.id} emoji={r.emoji} username={r.username} x={r.x} />
      ))}

      <div className="flex-1 flex flex-col px-4 py-4 relative z-10 max-w-md mx-auto w-full">
        {/* ── Mini Scoreboard ── */}
        <div className="p-3 rounded-2xl mb-4 animate-slide-down"
          style={{ background: "rgba(19,19,26,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: "rgba(255,100,0,0.15)", border: "1px solid rgba(255,100,50,0.3)" }}>
                <span>{me?.avatar?.emoji || "🦊"}</span>
              </div>
              <div>
                <p className="text-[10px] opacity-40 font-bold uppercase text-white">You</p>
                <p className="text-base font-black" style={{ color: "#FF8C42", fontFamily: "var(--font-score)" }}>
                  {myScore.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                VS
              </span>
              <p className="text-[9px] opacity-40 text-white">{questionIndex + 1}/{totalQuestions}</p>
            </div>
            <div className="flex-1 flex items-center gap-2 justify-end">
              <div className="text-right">
                <p className="text-[10px] opacity-40 font-bold uppercase text-white">Lawan</p>
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
            <span className="text-xs font-bold uppercase tracking-wide opacity-50 text-white">Waktu</span>
            <span className="text-xl font-black" style={{ color: timerColor, fontFamily: "var(--font-score)" }}>{timeLeft}s</span>
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
            {answered && <span className="text-xs font-bold" style={{ color: "rgba(0,184,148,0.8)" }}>✅ Dijawab</span>}
          </div>
          {currentQuestion.imageUrl && (
            <img src={currentQuestion.imageUrl} alt="Soal" className="w-full rounded-xl mb-3 object-cover max-h-36" />
          )}
          <p className="text-base font-bold leading-relaxed text-white">{currentQuestion.text}</p>
        </div>

        {/* ── Answers ── */}
        {currentQuestion.answerType === "matching" ? (
          <MatchingQuestion pairs={currentQuestion.matchPairs || []} onAnswer={(ans) => submitAnswer(`MATCHING:${ans}`)} disabled={answered} />
        ) : currentQuestion.answerType === "text" ? (
          <div className="mb-4 animate-slide-up">
            <input
              className="w-full h-12 rounded-xl px-4 text-sm font-bold text-white outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              placeholder="Ketik jawabanmu..."
              disabled={answered}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                  submitAnswer((e.target as HTMLInputElement).value.trim());
                }
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3 animate-slide-up">
            {(currentQuestion.options || []).map((opt: any) => {
              const isSelected = selectedAnswer === opt.label;
              const isCorrectReveal = showResult && result?.correctAnswer === opt.label;
              const isWrongSelected = showResult && isSelected && !result?.isCorrect;
              return (
                <button key={opt.label} onClick={() => submitAnswer(opt.label)} disabled={answered}
                  className="p-3 rounded-xl text-left transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    background: isCorrectReveal ? "rgba(0,184,148,0.25)" : isWrongSelected ? "rgba(255,68,68,0.25)" : isSelected ? "rgba(255,140,66,0.2)" : "rgba(255,255,255,0.04)",
                    border: isCorrectReveal ? "2px solid rgba(0,184,148,0.6)" : isWrongSelected ? "2px solid rgba(255,68,68,0.6)" : isSelected ? "2px solid rgba(255,140,66,0.5)" : "1px solid rgba(255,255,255,0.07)",
                  }}>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{ background: isSelected || isCorrectReveal ? (isCorrectReveal ? "rgba(0,184,148,0.3)" : isWrongSelected ? "rgba(255,68,68,0.3)" : "rgba(255,140,66,0.3)") : "rgba(255,255,255,0.08)", color: isCorrectReveal ? "#00B894" : isWrongSelected ? "#FF4444" : isSelected ? "#FF8C42" : "rgba(255,255,255,0.6)" }}>
                      {opt.label}
                    </span>
                    <p className="text-sm font-semibold leading-tight text-white">{opt.text}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Result Feedback */}
        {showResult && result && (
          <div className="p-3 rounded-xl mb-3 animate-slide-up"
            style={{ background: result.isCorrect ? "rgba(0,184,148,0.1)" : "rgba(255,68,68,0.1)", border: `1px solid ${result.isCorrect ? "rgba(0,184,148,0.3)" : "rgba(255,68,68,0.3)"}` }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{result.isCorrect ? "✅" : "❌"}</span>
              <div>
                <p className="text-sm font-black" style={{ color: result.isCorrect ? "#00B894" : "#FF4444" }}>
                  {result.isCorrect ? `+${result.pointsEarned.toLocaleString()} poin!` : "Salah!"}
                </p>
                {!result.isCorrect && <p className="text-xs opacity-60 text-white">Jawaban: {result.correctAnswer}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Reaction bar */}
        <div className="mt-auto">
          <div className="flex justify-between gap-1 px-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                className="flex-1 aspect-square max-w-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 22 }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sudden Death overlay */}
      {interrupted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "rgba(10,10,15,0.85)" }}>
          <div className="w-full max-w-xs p-6 rounded-3xl text-center" style={{ background: "rgba(255,102,102,0.15)", border: "1px solid rgba(255,102,102,0.3)" }}>
            <div className="text-4xl mb-4 animate-bounce">🚨</div>
            <h3 className="text-xl font-black text-white mb-2" style={{ fontFamily: "var(--font-heading)" }}>Sudden Death!</h3>
            <p className="text-sm opacity-80 text-white font-medium">Lawan telah menyelesaikan kuis lebih dulu.<br /><br />Permainan berakhir.</p>
          </div>
        </div>
      )}

      {/* Socket reconnecting overlay */}
      {isSocketReconnecting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.9)" }}>
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
