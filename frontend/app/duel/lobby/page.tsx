"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ParticleBackground, useToast } from "@/components/UI";
import { useDuelStore } from "@/store";
import { getDuelSocket, disconnectDuelSocket } from "@/lib/utils";
import { AvatarRenderer, EmojiKitchenPicker } from "@/components/Avatar";
import { Avatar } from "@/types";

function DuelLobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, ToastComponent } = useToast();

  const tokenParam = searchParams.get("token") || "";
  const usernameParam = searchParams.get("username") || "";

  const {
    token, role, quizTitle, totalQuestions,
    creator, opponent, status,
    setToken, setCreator, setOpponent, setStatus, setQuizInfo,
    setUsername: setStoreUsername,
  } = useDuelStore();

  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [avatarSelected, setAvatarSelected] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [myAvatar, setMyAvatar] = useState({ emoji: role === "creator" ? "🦊" : "🐨", mixEmoji: null as null | string, mixImageUrl: null as null | string });
  const joinedRef = useRef(false);

  // Ambil token & username: gunakan URL param atau fallback ke store (untuk reconnect)
  const activeToken = tokenParam || token;
  const activeUsername = usernameParam || useDuelStore.getState().username;
  const activeRole = role || "opponent";

  // Guard
  useEffect(() => {
    if (!activeToken || !activeUsername) {
      router.replace("/duel");
      return;
    }

    // Simpan username ke store untuk session recovery
    if (usernameParam) setStoreUsername(usernameParam);
    if (tokenParam) setToken(tokenParam);

    const socket = getDuelSocket();

    const doJoin = () => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      setIsConnected(true);
      socket.emit("duel:join", {
        token: activeToken,
        username: activeUsername,
        role: activeRole,
      });
    };

    socket.on("connect", () => {
      joinedRef.current = false; // Reset agar bisa join ulang
      doJoin();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      joinedRef.current = false;
    });

    socket.on("duel:joined", (data: any) => {
      setToken(data.token);
      if (data.creator) setCreator(data.creator);
      if (data.opponent !== undefined) setOpponent(data.opponent);
      if (data.status) setStatus(data.status);

      // Jika reconnect saat mid-game (status active), redirect ke quiz
      if (data.status === "active" && data.currentQuestion) {
        useDuelStore.getState().setCurrentQuestion(data.currentQuestion);
        useDuelStore.getState().setQuestionIndex(data.questionIndex);
        useDuelStore.getState().setResult(null);
        router.replace("/duel/quiz");
      }
    });

    socket.on("duel:roomUpdate", (data: any) => {
      if (data.creator) setCreator(data.creator);
      if (data.opponent !== undefined) setOpponent(data.opponent);
      if (data.status) setStatus(data.status);
    });

    socket.on("duel:countdown", () => {
      setStatus("countdown");
    });

    socket.on("duel:questionStart", (data: any) => {
      useDuelStore.getState().setCurrentQuestion(data.question);
      useDuelStore.getState().setQuestionIndex(data.questionIndex);
      useDuelStore.getState().setResult(null);
      router.push("/duel/quiz");
    });

    socket.on("duel:finished", (data: any) => {
      useDuelStore.getState().setFinished({
        winner: data.winner,
        finalCreator: data.creator,
        finalOpponent: data.opponent,
      });
      router.push("/duel/winner");
    });

    socket.on("duel:error", (data: { message: string }) => {
      showToast(data.message, "error");
      setTimeout(() => router.replace("/duel"), 1500);
    });

    socket.on("duel:playerDisconnected", (data: any) => {
      showToast(`${data.username || "Lawan"} terputus dari room`, "error");
    });

    // Legacy support
    socket.on("duel:opponentLeft", (data: any) => {
      showToast("Lawan terputus dari room", "error");
    });

    // If already connected, manually trigger join
    if (socket.connected) {
      doJoin();
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("duel:joined");
      socket.off("duel:roomUpdate");
      socket.off("duel:countdown");
      socket.off("duel:questionStart");
      socket.off("duel:finished");
      socket.off("duel:error");
      socket.off("duel:playerDisconnected");
      socket.off("duel:opponentLeft");
    };
  }, [activeToken, activeUsername]);

  // ─── Copy Token ────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(activeToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeToken]);

  // ─── Copy Link URL (Bug Fix #3) ────────────────────────────────
  const handleCopyLink = useCallback(() => {
    const joinUrl = `${window.location.origin}/duel/join?token=${activeToken}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [activeToken]);

  const handleSetAvatar = useCallback((emoji: string, mixEmoji: string | null, mixImageUrl: string | null) => {
    const socket = getDuelSocket();
    const avatar = { emoji, mixEmoji, mixImageUrl };
    setMyAvatar(avatar);
    socket.emit("duel:setAvatar", avatar);
    setAvatarSelected(true);
    setShowAvatarPicker(false);
  }, []);

  const handleStartBattle = useCallback(() => {
    if (!opponent) {
      showToast("Tunggu lawan bergabung dulu!", "error");
      return;
    }
    setStartLoading(true);
    const socket = getDuelSocket();
    socket.emit("duel:startBattle");
  }, [opponent]);

  const isCreator = role === "creator";
  const canStart = isCreator && !!opponent && opponent.isConnected;

  const PlayerCard = ({ player, side, isMe }: {
    player: { username: string; avatar: { emoji: string }; score: number; isConnected: boolean } | null;
    side: "left" | "right";
    isMe: boolean;
  }) => (
    <div className="flex-1 flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all duration-300"
          style={{
            background: player
              ? side === "left"
                ? "linear-gradient(135deg, rgba(255,60,0,0.2), rgba(255,140,0,0.1))"
                : "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(78,205,196,0.1))"
              : "rgba(255,255,255,0.03)",
            border: player
              ? `2px solid ${side === "left" ? "rgba(255,100,50,0.5)" : "rgba(108,92,231,0.5)"}`
              : "2px dashed rgba(255,255,255,0.1)",
            boxShadow: player
              ? `0 0 20px ${side === "left" ? "rgba(255,100,0,0.2)" : "rgba(108,92,231,0.2)"}`
              : "none",
          }}
        >
          {player ? (
            player.avatar?.mixImageUrl ? (
              <img src={player.avatar.mixImageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <span>{player.avatar?.emoji || (side === "left" ? "🦊" : "🐨")}</span>
            )
          ) : (
            <span className="animate-pulse">❓</span>
          )}
        </div>
        {isMe && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
            style={{ background: side === "left" ? "#FF8C42" : "#6C5CE7", color: "white" }}>
            ME
          </div>
        )}
        {player && !player.isConnected && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500" />
        )}
      </div>

      {player ? (
        <div className="text-center">
          <p className="text-sm font-black" style={{
            color: side === "left" ? "#FF8C42" : "var(--accent-purple-light)",
            fontFamily: "var(--font-heading)",
          }}>
            {player.username}
          </p>
          <div className="flex items-center gap-1 justify-center mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: player.isConnected ? "#00B894" : "#FF4444" }} />
            <span className="text-[10px] opacity-50" style={{ color: "white" }}>
              {player.isConnected ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs opacity-30" style={{ color: "white" }}>
            {side === "left" ? "Host" : "Menunggu lawan..."}
          </p>
          {side === "right" && (
            <div className="flex gap-0.5 justify-center mt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full animate-bounce"
                  style={{ background: "rgba(255,255,255,0.3)", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />
      <ToastComponent />

      <div className="absolute top-[10%] left-[10%] w-[200px] h-[200px] rounded-full blur-[100px] opacity-10 pointer-events-none"
        style={{ background: "#FF4444" }} />
      <div className="absolute bottom-[10%] right-[10%] w-[180px] h-[180px] rounded-full blur-[100px] opacity-10 pointer-events-none"
        style={{ background: "#6C5CE7" }} />

      <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 animate-slide-down">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FF4444, #FF8C00)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <span className="text-xl">⚔️</span>
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ fontFamily: "var(--font-heading)", color: "white" }}>
                Duel Lobby
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: isConnected ? "var(--accent-green)" : "var(--accent-red)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {isConnected ? "Terhubung" : "Mencoba reconnect..."}
                </p>
              </div>
            </div>
          </div>

          {/* Connection status badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(0,184,148,0.15)", border: "1px solid rgba(0,184,148,0.3)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400">LIVE</span>
          </div>
        </div>

        {/* Quiz info */}
        <div className="p-3.5 rounded-xl mb-4 flex items-center gap-3 animate-slide-down"
          style={{ background: "rgba(255,140,66,0.08)", border: "1px solid rgba(255,140,66,0.2)" }}>
          <span className="text-xl">📚</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-50 uppercase font-bold tracking-wider" style={{ color: "white" }}>Quiz</p>
            <p className="text-sm font-black truncate" style={{ color: "#FF8C42" }}>{quizTitle || "Memuat..."}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold px-2 py-1 rounded-full"
              style={{ background: "rgba(255,140,66,0.15)", color: "#FF8C42", border: "1px solid rgba(255,140,66,0.3)" }}>
              {totalQuestions} soal
            </p>
          </div>
        </div>

        {/* Battle Card - Split Screen */}
        <div className="p-5 rounded-2xl mb-4 animate-slide-up"
          style={{ background: "rgba(19,19,26,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-4">
            <PlayerCard
              player={creator}
              side="left"
              isMe={role === "creator"}
            />

            {/* VS */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm relative"
                style={{
                  background: "linear-gradient(135deg, rgba(255,60,0,0.3), rgba(108,92,231,0.3))",
                  border: "2px solid rgba(255,255,255,0.1)",
                  color: "white",
                  fontFamily: "var(--font-score)",
                  boxShadow: "0 0 20px rgba(255,100,0,0.2), 0 0 20px rgba(108,92,231,0.2)",
                }}>
                VS
              </div>
            </div>

            <PlayerCard
              player={opponent}
              side="right"
              isMe={role === "opponent"}
            />
          </div>
        </div>

        {/* ─── Token Share + Salin Link (Bug Fix #3) ─── */}
        {isCreator && (
          <div className="p-4 rounded-xl mb-4 animate-slide-up" style={{ animationDelay: "0.1s",
            background: "rgba(19,19,26,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 opacity-50" style={{ color: "white" }}>
              Bagikan ke Temanmu
            </p>

            {/* Token Row */}
            <div className="flex gap-2 items-center mb-2">
              <div className="flex-1 py-3 rounded-xl text-center font-black tracking-[0.4em] text-2xl"
                style={{
                  background: "rgba(255,140,66,0.1)",
                  border: "2px solid rgba(255,140,66,0.4)",
                  color: "#FF8C42",
                  fontFamily: "var(--font-score)",
                  textShadow: "0 0 20px rgba(255,140,0,0.5)"
                }}>
                {activeToken}
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-90"
                style={{
                  background: copied ? "rgba(0,184,148,0.2)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${copied ? "rgba(0,184,148,0.4)" : "rgba(255,255,255,0.1)"}`,
                  color: copied ? "#00B894" : "white",
                  minWidth: 70,
                }}>
                {copied ? "✅ Copied" : "📋 Copy"}
              </button>
            </div>

            {/* Salin Link Row */}
            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: copiedLink ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${copiedLink ? "rgba(108,92,231,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: copiedLink ? "#A29BFE" : "rgba(255,255,255,0.5)",
              }}>
              {copiedLink ? (
                <>✅ <span>Link tersalin!</span></>
              ) : (
                <>🔗 <span>Salin Link Undangan</span></>
              )}
            </button>
            <p className="text-[10px] mt-2 text-center opacity-30" style={{ color: "white" }}>
              Lawan bisa langsung klik link tanpa ketik token manual
            </p>
          </div>
        )}

        {/* Avatar picker button */}
        <div className="mb-3 animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: avatarSelected ? "rgba(0,184,148,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${avatarSelected ? "rgba(0,184,148,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: avatarSelected ? "#00B894" : "rgba(255,255,255,0.6)"
            }}>
            <span style={{ fontSize: 20 }}>{myAvatar.emoji}</span>
            <span>{avatarSelected ? "Avatar Terpilih ✅" : "Pilih Avatar"}</span>
          </button>
        </div>

        {/* Start / Wait info */}
        <div className="mt-auto animate-slide-up" style={{ animationDelay: "0.2s" }}>
          {isCreator ? (
            <button
              id="btn-start-battle"
              onClick={handleStartBattle}
              disabled={!canStart || startLoading}
              className="w-full h-14 rounded-xl font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:cursor-not-allowed"
              style={{
                background: canStart && !startLoading
                  ? "linear-gradient(135deg, #FF4444, #FF8C00)"
                  : "rgba(255,100,0,0.15)",
                color: canStart ? "white" : "rgba(255,255,255,0.3)",
                boxShadow: canStart ? "0 4px 20px rgba(255,100,0,0.4)" : "none",
                border: "1px solid rgba(255,100,50,0.3)",
              }}>
              {startLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memulai Battle...</span>
                </>
              ) : !opponent ? (
                <>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: "rgba(255,255,255,0.3)", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span>Menunggu Lawan Bergabung...</span>
                </>
              ) : (
                <>
                  <span>⚔️</span>
                  <span>Mulai Battle!</span>
                  <span>⚔️</span>
                </>
              )}
            </button>
          ) : (
            <div className="py-4 rounded-xl text-center"
              style={{ background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)" }}>
              <div className="flex gap-1.5 justify-center mb-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "var(--accent-purple-light)", animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--accent-purple-light)" }}>
                Siap! Menunggu host memulai battle...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowAvatarPicker(false)}>
          <div className="w-full max-w-md rounded-2xl p-4 max-h-[80vh] overflow-y-auto"
            style={{ background: "rgba(20,20,30,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>Pilih Avatar</h3>
              <button onClick={() => setShowAvatarPicker(false)} className="text-white opacity-50 text-xl">✕</button>
            </div>
            <AvatarRenderer avatar={myAvatar} size={56} />
            <p className="text-sm font-black mt-2 text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Pilih Avatar
            </p>
            <EmojiKitchenPicker
              avatar={myAvatar as Avatar}
              onChange={(av) => handleSetAvatar(av.emoji, av.mixEmoji || null, av.mixImageUrl || null)}
            />
            <button
              onClick={() => {
                setAvatarSelected(true);
                setShowAvatarPicker(false);
              }}
              className="w-full mt-4 py-3 rounded-xl font-black text-sm"
              style={{ background: "linear-gradient(135deg, #FF4444, #FF8C00)", color: "white" }}>
              ✅ Konfirmasi Avatar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DuelLobbyPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0A0A0F] text-white">Loading Lobby...</div>}>
      <DuelLobbyContent />
    </Suspense>
  );
}
