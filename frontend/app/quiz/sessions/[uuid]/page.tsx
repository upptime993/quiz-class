"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { usePlayerStore, useQuizStore } from "@/store";
import { api } from "@/lib/utils";

export default function SessionReconnectPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = (params?.uuid as string) || "";

  const { setToken, setUsername, username: storedUsername, token: storedToken } = usePlayerStore();
  const { resetQuiz } = useQuizStore();

  const [phase, setPhase] = useState<"resolving" | "reconnecting" | "error">("resolving");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!uuid) {
      router.replace("/");
      return;
    }

    const resolveSession = async () => {
      try {
        // Step 1: Resolve UUID → { token, username, sessionStatus }
        const res = await api.get(`/session/uuid/${uuid}`);
        const { data } = res.data;

        if (!data?.token || !data?.username) {
          setPhase("error");
          setErrorMsg("Data sesi tidak lengkap. Silakan scan ulang kode QR atau masukkan token secara manual.");
          return;
        }

        // Step 2: Cek apakah sesi masih aktif
        if (!data.isSessionActive) {
          // Sesi sudah selesai — arahkan ke home
          router.replace("/");
          return;
        }

        // Step 3: Restore state ke store
        setToken(data.token);
        setUsername(data.username);
        setPhase("reconnecting");

        // Step 4: Redirect ke halaman quiz dengan token
        // Halaman quiz/[token] akan handle reconnect logic (join socket, fetch state, dll)
        setTimeout(() => {
          router.replace(`/quiz/${data.token}`);
        }, 800);

      } catch (err: any) {
        const msg = err.response?.data?.message;

        if (err.response?.status === 404) {
          // UUID kadaluwarsa atau tidak ditemukan
          setPhase("error");
          setErrorMsg(
            msg || "Link sesi sudah kedaluwarsa (7 hari). Minta kode token dari gurumu dan join ulang."
          );
        } else {
          // Jika username/token masih ada di store, coba langsung reconnect
          if (storedUsername && storedToken) {
            setPhase("reconnecting");
            setTimeout(() => {
              router.replace(`/quiz/${storedToken}`);
            }, 500);
          } else {
            setPhase("error");
            setErrorMsg("Gagal memulihkan sesi. Silakan join ulang dengan kode token.");
          }
        }
      }
    };

    resolveSession();
  }, [uuid]);

  // ─── Error State ──────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center px-6">
        <ParticleBackground />
        <div className="relative z-10 text-center max-w-sm w-full">
          <div className="text-6xl mb-6">😔</div>
          <div
            className="rounded-3xl p-6 mb-6"
            style={{
              background: "rgba(255,107,107,0.08)",
              border: "1px solid rgba(255,107,107,0.25)",
            }}
          >
            <h2
              className="text-xl font-black text-white mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Sesi Tidak Ditemukan
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">{errorMsg}</p>
          </div>

          <button
            onClick={() => router.replace("/")}
            className="w-full py-4 rounded-2xl font-black text-white text-sm tracking-wide transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))",
              boxShadow: "0 4px 20px rgba(108,92,231,0.4)",
            }}
          >
            🏠 Kembali ke Halaman Utama
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading / Reconnecting State ────────────────────────────
  const messages = {
    resolving: { icon: "🔍", title: "Mencari Sesi...", subtitle: "Mengecek data sesi kamu" },
    reconnecting: { icon: "🎮", title: "Memulihkan Sesi", subtitle: "Menghubungkan kembali ke kuis..." },
  };
  const msg = messages[phase];

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center">
      <ParticleBackground />
      <div className="relative z-10 text-center px-6">
        {/* Animated icon */}
        <div
          className="text-5xl mb-6"
          style={{ animation: "bounce 1s ease-in-out infinite" }}
        >
          {msg.icon}
        </div>

        <h2
          className="text-2xl font-black text-white mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {msg.title}
        </h2>
        <p className="text-white/60 text-sm mb-6">{msg.subtitle}</p>

        {/* UUID badge */}
        <div
          className="inline-block px-4 py-2 rounded-xl text-xs font-bold tracking-widest mb-6"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
          }}
        >
          🔑 {uuid.slice(0, 8)}...
        </div>

        {/* Animated dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: "var(--accent-purple)",
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
