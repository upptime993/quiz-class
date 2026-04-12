"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LobbyAvatarCard,
  FloatingReactionItem,
} from "@/components/Avatar";
import { CountdownOverlay } from "@/components/QuizComponents";
import {
  ParticleBackground,
  GlassCard,
  Badge,
  LoadingScreen,
} from "@/components/UI";
import { usePlayerStore, useQuizStore } from "@/store";
import { getPlayerSocket } from "@/lib/utils";
import { Participant, FloatingReaction, REACTION_EMOJIS } from "@/types";
import { useFloatingReactions } from "@/hooks/useQuiz";

export default function LobbyPage() {
  const router = useRouter();
  const { username, token, avatar, setLastSessionToken } = usePlayerStore();
  const {
    status,
    countdown,
    participants,
    setStatus,
    setCountdown,
    setParticipants,
    setParticipantCount,
    updateParticipant,
    setCurrentQuestion,
    setQuestionIndex,
    setAnsweredCount,
    setResult,
  } = useQuizStore();

  const { reactions, addReaction } = useFloatingReactions();
  const [showCountdown, setShowCountdown] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Guard
  useEffect(() => {
    if (!token || !username) {
      router.replace("/");
    }
  }, [token, username]);

  // Socket listeners
  useEffect(() => {
    const socket = getPlayerSocket();

    if (socket.connected) setIsConnected(true);

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    // Update participants list
    socket.on(
      "session:joined",
      (data: { participants: Participant[] }) => {
        setParticipants(data.participants);
        setParticipantCount(data.participants.length);
      }
    );

    socket.on(
      "session:playerJoined",
      (data: { username: string; avatar: any; participantCount: number; participants?: Participant[] }) => {
        setParticipantCount(data.participantCount);
        // Use full list from server if available
        if (data.participants) {
          setParticipants(data.participants);
          return;
        }
        // Fallback: tambah ke list jika belum ada
        useQuizStore.setState((prev) => {
          const exists = prev.participants.some(
            (p) => p.username === data.username
          );
          if (exists) return prev;
          return {
            participants: [
              ...prev.participants,
              {
                username: data.username,
                avatar: data.avatar,
                score: 0,
                answers: [],
                joinedAt: new Date().toISOString(),
                isConnected: true,
                socketId: "",
              },
            ],
          };
        });
      }
    );

    socket.on(
      "session:playerLeft",
      (data: { username: string; participantCount: number }) => {
        setParticipantCount(data.participantCount);
        updateParticipant(data.username, { isConnected: false });
      }
    );

    socket.on(
      "session:avatarUpdated",
      (data: { username: string; avatar: any }) => {
        updateParticipant(data.username, { avatar: data.avatar });
      }
    );

    // Reaction dari peserta lain
    socket.on(
      "session:reaction",
      (data: { username: string; emoji: string; id: string }) => {
        addReaction(data.emoji, data.username);
      }
    );

    // Countdown dimulai
    socket.on("session:countdown", (data: { count: number | string }) => {
      setCountdown(data.count);
      setShowCountdown(true);
      setStatus("countdown");

      if (data.count === "GO" || data.count === "GO!") {
        setTimeout(() => {
          setShowCountdown(false);
          setStatus("active");
        }, 1200);
      }
    });

    // Soal dimulai → ke halaman quiz dengan URL token
    socket.on("session:questionStart", (data: any) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setAnsweredCount(0);
      setResult(null);
      setLastSessionToken(token);
      router.push(`/quiz/${token}`);
    });

    socket.on("session:error", (data: { message: string }) => {
      alert(data.message);
      router.replace("/");
    });

    // Sesi dibatalkan
    socket.on("session:canceled", (data: { message: string }) => {
      alert(data.message || "Sesi dibatalkan oleh admin");
      usePlayerStore.getState().logout();
      window.location.href = "/";
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("session:joined");
      socket.off("session:playerJoined");
      socket.off("session:playerLeft");
      socket.off("session:avatarUpdated");
      socket.off("session:reaction");
      socket.off("session:countdown");
      socket.off("session:questionStart");
      socket.off("session:error");
      socket.off("session:canceled");
    };
  }, []);

  const sendReaction = useCallback(
    (emoji: string) => {
      const socket = getPlayerSocket();
      socket.emit("player:reaction", { emoji });
      // Juga tampilkan di layar sendiri
      addReaction(emoji, username);
    },
    [username, addReaction]
  );

  const connectedParticipants = participants.filter((p) => p.isConnected);

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col">
      <ParticleBackground />

      {/* Countdown Overlay */}
      <CountdownOverlay count={countdown} visible={showCountdown} />

      {/* Floating Reactions */}
      {reactions.map((r) => (
        <FloatingReactionItem
          key={r.id}
          id={r.id}
          emoji={r.emoji}
          username={r.username}
          x={r.x}
        />
      ))}

      <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

        {/* ── Header ── */}
        <div className="animate-slide-down mb-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                  border: "1px solid rgba(255,255,255,0.2)"
                }}
              >
                <span className="text-xl">🎮</span>
              </div>
              <div>
                <h1
                  className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Ruang Tunggu
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: isConnected ? "var(--accent-green)" : "var(--accent-red)",
                      boxShadow: isConnected ? "0 0 10px var(--accent-green)" : "none",
                    }}
                  />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {isConnected ? "Terhubung ke Siaran" : "Mencoba Reconnect..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Token badge */}
            <div 
              className="px-4 py-1.5 rounded-full font-bold text-sm tracking-widest shadow-lg backdrop-blur-md"
              style={{
                background: "rgba(108,92,231,0.15)",
                border: "1px solid rgba(108,92,231,0.5)",
                color: "var(--accent-purple-light)",
                boxShadow: "0 0 15px rgba(108,92,231,0.3) inset"
              }}
            >
              {token}
            </div>
          </div>

          {/* Participant count card */}
          <div 
            className="rounded-[1.5rem] p-5 relative overflow-hidden backdrop-blur-xl"
            style={{ 
              background: "linear-gradient(145deg, rgba(30,30,40,0.8), rgba(20,20,25,0.9))",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
            }}
          >
            {/* Background glowing orb */}
            <div 
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20"
              style={{ background: "var(--accent-purple)" }}
            />

            <div className="flex items-center justify-between relative z-10">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Peserta Bergabung
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-5xl font-black drop-shadow-md"
                    style={{
                      fontFamily: "var(--font-score)",
                      color: "white",
                    }}
                  >
                    {connectedParticipants.length}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    orang
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center animate-bounce-idle backdrop-blur-md"
                  style={{ 
                    background: "rgba(108,92,231,0.2)",
                    border: "1px solid rgba(108,92,231,0.3)",
                    boxShadow: "0 0 20px rgba(108,92,231,0.4)" 
                  }}
                >
                  <span className="text-3xl">👥</span>
                </div>
              </div>
            </div>

            {/* Waiting animation */}
            <div className="flex items-center gap-3 mt-4 pt-4 relative z-10"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.3)" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      background: "var(--accent-purple-light)",
                      animationDelay: `${i * 0.15}s`,
                      boxShadow: "0 0 8px var(--accent-purple)"
                    }}
                  />
                ))}
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Menunggu host memulai kuis...
              </p>
            </div>
          </div>
        </div>

        {/* ── Participants Grid ── */}
        <div className="flex-1 mb-4 flex flex-col min-h-[50vh] animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between mb-4 px-1">
            <p
              className="text-sm font-black tracking-wide uppercase"
              style={{
                color: "var(--text-secondary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Peserta ({connectedParticipants.length})
            </p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: "rgba(0,184,148,0.15)", border: "1px solid rgba(0,184,148,0.3)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-green-400">LIVE SYNC</span>
            </div>
          </div>

          {connectedParticipants.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="text-4xl mb-2 animate-bounce-idle">⏳</div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                Belum ada peserta
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Bagikan kode token ke teman-temanmu!
              </p>
            </GlassCard>
          ) : (
            <div
              className="scroll-container"
              style={{ maxHeight: "calc(100vh - 420px)" }}
            >
              <div className="grid grid-cols-4 gap-x-2 gap-y-4 p-1">
                {connectedParticipants.map((p, i) => (
                  <div
                    key={p.username}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <LobbyAvatarCard
                      username={p.username}
                      avatar={p.avatar}
                      isConnected={p.isConnected}
                      isMe={p.username === username}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Reaction Bar ── */}
        <div
          className="animate-slide-up mt-auto"
          style={{ animationDelay: "0.3s" }}
        >
          <div 
            className="rounded-[1.5rem] p-4 backdrop-blur-xl"
            style={{
              background: "rgba(20,20,30,0.6)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Kirim Reaksi
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Ketuk berkali-kali! ✨
              </p>
            </div>
            
            <div className="flex justify-between gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="flex flex-1 items-center justify-center aspect-square max-w-[3rem] rounded-xl transition-all duration-150 relative overflow-hidden group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    fontSize: 24,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1) translateY(-2px)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.borderColor = "var(--accent-purple)";
                    e.currentTarget.style.boxShadow = "0 5px 15px rgba(108,92,231,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1) translateY(0)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.9)";
                  }}
                  aria-label={`Kirim reaksi ${emoji}`}
                >
                  <span className="relative z-10 transform transition-transform group-active:scale-125">{emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {/* My Avatar Info */}
          <div className="flex items-center justify-center gap-3 mt-4 mb-2">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Bermain sebagai
            </p>
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg"
              style={{
                background: "linear-gradient(90deg, rgba(108,92,231,0.2), rgba(108,92,231,0.05))",
                border: "1px solid rgba(108,92,231,0.4)",
              }}
            >
              <span style={{ fontSize: 16 }}>{avatar.emoji}</span>
              <span
                className="text-sm font-black tracking-wide"
                style={{
                  color: "white",
                  fontFamily: "var(--font-heading)",
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                {username}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}