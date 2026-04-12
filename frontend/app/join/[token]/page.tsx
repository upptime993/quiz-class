"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ParticleBackground,
  Button,
  InputField,
  CreditFooter,
  useToast,
} from "@/components/UI";
import { usePlayerStore } from "@/store";
import { api, isValidTokenFormat } from "@/lib/utils";

export default function JoinTokenPage() {
  const router = useRouter();
  const params = useParams();
  const { showToast, ToastComponent } = useToast();
  const { setToken, setUsername, resetPlayer } = usePlayerStore();

  const [username, setUsernameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: "" });

  const urlToken = (params.token as string)?.toUpperCase().trim() || "";

  // Reset player state saat landing
  useEffect(() => {
    resetPlayer();
  }, []);

  const validate = (): boolean => {
    const newErrors = { username: "" };
    let valid = true;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      newErrors.username = "Username wajib diisi";
      valid = false;
    } else if (trimmedUsername.length < 2) {
      newErrors.username = "Username minimal 2 karakter";
      valid = false;
    } else if (trimmedUsername.length > 20) {
      newErrors.username = "Username maksimal 20 karakter";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleJoin = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await api.get(`/session/${urlToken}/info`);

      if (res.data.success) {
        setToken(urlToken);
        setUsername(username.trim());
        router.push("/avatar");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Token kelas ini tidak valid / sesi telah berakhir!";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="page-container gradient-bg flex flex-col min-h-screen">
      <ParticleBackground />
      <ToastComponent />

      <div className="flex-1 flex flex-col justify-between px-6 py-8 relative z-10">
        {/* ── Header ── */}
        <div className="text-center pt-8 animate-slide-down">
          {/* Logo */}
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 animate-bounce-idle"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))",
              boxShadow: "var(--shadow-button)",
              fontSize: 40,
            }}
          >
            🎮
          </div>

          <h1
            className="text-4xl font-black mb-2"
            style={{
              fontFamily: "var(--font-heading)",
              background:
                "linear-gradient(135deg, #fff 30%, var(--accent-purple-light))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            QuizClass
          </h1>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--accent-purple-light)" }}
          >
            Sesi Kelas: {urlToken}
          </p>
        </div>

        {/* ── Form Card ── */}
        <div
          className="glass-card p-6 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <h2
            className="text-xl font-extrabold mb-6 text-center"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            Bergabung ke Sesi!
          </h2>

          <div className="space-y-4">
            {/* Username Input ONLY */}
            <InputField
              label="Username Kamu"
              placeholder="Masukkan nama panggilanmu"
              value={username}
              onChange={(e) => setUsernameInput(e.target.value.slice(0, 20))}
              onKeyDown={handleKeyDown}
              error={errors.username}
              icon={<span style={{ fontSize: 18 }}>👤</span>}
              maxLength={20}
              autoComplete="off"
            />

            {/* Character count */}
            {username && (
              <p
                className="text-right text-xs"
                style={{ color: "var(--text-muted)", marginTop: -8 }}
              >
                {username.length}/20
              </p>
            )}
          </div>

          <div className="mt-6">
            <Button
              onClick={handleJoin}
              loading={loading}
              disabled={!username}
            >
              <span>🚀</span>
              <span>Masuk Kelas!</span>
            </Button>
          </div>
          <div className="mt-4 text-center">
             <button
                onClick={() => router.push("/")}
                className="text-xs transition-colors hover:text-white"
                style={{ color: "var(--text-muted)" }}
             >
                Ganti kode Token 🎫
             </button>
          </div>
        </div>

        {/* ── Features ── */}
        <div
          className="grid grid-cols-3 gap-3 animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          {[
            { emoji: "⚡", label: "Real-time" },
            { emoji: "🏆", label: "Leaderboard" },
            { emoji: "🎭", label: "Avatar Lucu" },
          ].map((f) => (
            <div
              key={f.label}
              className="glass-card-light p-3 text-center"
              style={{ borderRadius: 14 }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{f.emoji}</div>
              <p
                className="text-xs font-bold"
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {f.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Admin Link ── */}
        <div className="text-center">
          <CreditFooter />
        </div>
      </div>
    </div>
  );
}
