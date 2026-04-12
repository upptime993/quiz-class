"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AvatarRenderer, AvatarCustomizer } from "@/components/Avatar";
import { Button, GlassCard, useToast, LoadingScreen } from "@/components/UI";
import { ParticleBackground } from "@/components/UI";
import { usePlayerStore } from "@/store";
import { getPlayerSocket } from "@/lib/utils";
import { Avatar } from "@/types";

export default function AvatarPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { username, token, setAvatar, avatar, setLastSessionToken } = usePlayerStore();

  const [localAvatar, setLocalAvatar] = useState<Avatar>(avatar);
  const [isJoining, setIsJoining] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Guard: redirect jika tidak ada token/username
  useEffect(() => {
    if (!token || !username) {
      router.replace("/");
      return;
    }

    // Connect socket & join session
    const socket = getPlayerSocket();

    socket.on("connect", () => {
      setIsConnecting(false);
      socket.emit("player:join", { token, username });
    });

    socket.on("session:joined", (data: any) => {
      setIsReady(true);
      setIsConnecting(false);
      if (data && data.participants) {
        const { useQuizStore } = require("@/store");
        useQuizStore.getState().setParticipants(data.participants);
        useQuizStore.getState().setParticipantCount(data.participants.length);
      }
    });

    socket.on("session:playerJoined", (data: any) => {
      if (data && data.participants) {
        const { useQuizStore } = require("@/store");
        useQuizStore.getState().setParticipants(data.participants);
        useQuizStore.getState().setParticipantCount(data.participantCount);
      }
    });

    socket.on("session:playerLeft", (data: any) => {
      const { useQuizStore } = require("@/store");
      useQuizStore.getState().setParticipantCount(data.participantCount);
      useQuizStore.getState().updateParticipant(data.username, { isConnected: false });
    });

    socket.on("session:error", (data: { message: string }) => {
      showToast(data.message, "error");
      setTimeout(() => router.replace("/"), 2000);
    });

    // Jika socket sudah connect sebelumnya
    if (socket.connected) {
      setIsConnecting(false);
      socket.emit("player:join", { token, username });
    }

    return () => {
      socket.off("connect");
      socket.off("session:joined");
      socket.off("session:error");
    };
  }, [token, username]);

  const handleAvatarChange = useCallback((newAvatar: Avatar) => {
    setLocalAvatar(newAvatar);
  }, []);

  const handleConfirm = async () => {
    setIsJoining(true);

    try {
      const socket = getPlayerSocket();

      // Simpan avatar ke store
      setAvatar(localAvatar);

      // Kirim avatar ke server (format baru Emoji Kitchen)
      socket.emit("player:setAvatar", {
        emoji: localAvatar.emoji,
        mixEmoji: localAvatar.mixEmoji || null,
        mixImageUrl: localAvatar.mixImageUrl || null,
      });

      // Navigasi ke halaman quiz dengan URL session — untuk reconnect support
      setLastSessionToken(token);
      router.push(`/quiz/${token}`);
    } catch {
      showToast("Gagal menyimpan avatar, coba lagi!", "error");
      setIsJoining(false);
    }
  };

  if (isConnecting) {
    return <LoadingScreen message="Menghubungkan ke sesi..." />;
  }

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col">
      <ParticleBackground />
      <ToastComponent />

      <div className="flex-1 flex flex-col px-5 py-6 relative z-10 max-w-md mx-auto w-full">

        {/* ── Header ── */}
        <div className="text-center mb-4 animate-slide-down relative">
          <button
            onClick={() => router.back()}
            className="absolute left-0 top-0 p-2 rounded-xl transition-all"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            ←
          </button>

          <p
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--accent-purple-light)" }}
          >
            Hai, {username}! 👋
          </p>
          <h1
            className="text-2xl font-black"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            🍳 Pilih Avatarmu
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Pilih emoji & campur dengan Emoji Kitchen!
          </p>
        </div>

        {/* ── Avatar Preview ── */}
        <div className="flex justify-center mb-5">
          <div
            className="relative flex flex-col items-center gap-3 animate-pop-in"
          >
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(108,92,231,0.3) 0%, transparent 70%)",
                transform: "scale(1.5)",
                pointerEvents: "none",
              }}
            />

            <AvatarRenderer
              avatar={localAvatar}
              size={100}
              animate="idle"
            />

            {/* Name tag */}
            <div
              className="px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(108,92,231,0.2)",
                border: "1px solid rgba(108,92,231,0.4)",
              }}
            >
              <p
                className="text-sm font-bold"
                style={{
                  color: "var(--accent-purple-light)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {username}
              </p>
            </div>

            {/* Kitchen badge */}
            {localAvatar.mixImageUrl && (
              <div
                className="px-3 py-1 rounded-full text-xs font-bold animate-pop-in"
                style={{
                  background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(0,206,201,0.2))",
                  border: "1px solid rgba(108,92,231,0.3)",
                  color: "var(--accent-purple-light)",
                }}
              >
                🍳 Emoji Mix: {localAvatar.emoji} + {localAvatar.mixEmoji}
              </div>
            )}
          </div>
        </div>

        {/* ── Customizer ── */}
        <GlassCard
          className="p-5 mb-5 animate-slide-up"
          animate={false}
        >
          <AvatarCustomizer
            avatar={localAvatar}
            onChange={handleAvatarChange}
          />
        </GlassCard>

        {/* ── Confirm Button ── */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <Button
            onClick={handleConfirm}
            loading={isJoining}
            disabled={!isReady}
          >
            <span>🚀</span>
            <span>Siap Bermain!</span>
          </Button>

          {!isReady && (
            <p
              className="text-center text-xs mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              Menghubungkan ke server...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}