"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ParticleBackground, InputField, useToast } from "@/components/UI";
import { useDuelStore } from "@/store";
import { api, isValidTokenFormat } from "@/lib/utils";

export default function DuelJoinPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { setToken, setRole, setQuizInfo, resetDuel, setUsername: setStoreUsername } = useDuelStore();

  const [username, setUsername] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: "", token: "" });

  useEffect(() => {
    resetDuel();
    // Pre-fill token jika ada di URL (?token=XXXXXX dari link undangan)
    const params = new URLSearchParams(window.location.search);
    const preToken = params.get("token");
    if (preToken) setTokenInput(preToken.toUpperCase().slice(0, 6));
  }, []);

  const validate = () => {
    const newErrors = { username: "", token: "" };
    let valid = true;

    if (!username.trim()) {
      newErrors.username = "Username wajib diisi";
      valid = false;
    } else if (username.trim().length < 2) {
      newErrors.username = "Username minimal 2 karakter";
      valid = false;
    }

    const upperToken = tokenInput.toUpperCase().trim();
    if (!upperToken) {
      newErrors.token = "Kode token wajib diisi";
      valid = false;
    } else if (!isValidTokenFormat(upperToken)) {
      newErrors.token = "Token harus 6 karakter (huruf & angka)";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleJoin = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const upperToken = tokenInput.toUpperCase().trim();
      const res = await api.get(`/duel/${upperToken}/info`);

      if (res.data.success) {
        const { quizTitle, totalQuestions } = res.data.data;
        setToken(upperToken);
        setRole("opponent");
        setStoreUsername(username.trim());
        setQuizInfo(quizTitle, totalQuestions);
        router.push(`/duel/lobby?token=${upperToken}&username=${encodeURIComponent(username.trim())}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Room tidak ditemukan atau sudah penuh", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />
      <ToastComponent />

      <div className="absolute top-[20%] right-[20%] w-[200px] h-[200px] rounded-full blur-[100px] opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #6C5CE7, #4ECDC4)" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 relative z-10">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8 animate-slide-down">
            <button onClick={() => router.push("/duel")}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              ←
            </button>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: "var(--font-heading)", color: "var(--accent-purple-light)" }}>
                Gabung Room 🎫
              </h1>
              <p className="text-xs opacity-50" style={{ color: "white" }}>Masukkan kode yang dibagi temanmu</p>
            </div>
          </div>

          {/* Form */}
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="p-6 rounded-2xl mb-4" style={{
              background: "rgba(19,19,26,0.7)",
              border: "1px solid rgba(255,255,255,0.06)"
            }}>
              {/* Illustration */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-2">🗡️⚔️🛡️</div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40" style={{ color: "var(--accent-purple-light)" }}>
                  Siap Bertarung?
                </p>
              </div>

              <div className="space-y-5">
                <InputField
                  label="Username Kamu"
                  placeholder="Masukkan namamu"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.slice(0, 20));
                    setErrors((prev) => ({ ...prev, username: "" }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  error={errors.username}
                  icon={<span style={{ fontSize: 18 }}>👤</span>}
                  maxLength={20}
                  autoComplete="off"
                  style={{ height: "52px" }}
                />

                <InputField
                  label="Kode Token Room"
                  placeholder="Masukkan 6 digit kode"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value.toUpperCase().slice(0, 6));
                    setErrors((prev) => ({ ...prev, token: "" }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  error={errors.token}
                  icon={<span style={{ fontSize: 18 }}>🔑</span>}
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  style={{
                    letterSpacing: tokenInput ? "0.3em" : "normal",
                    fontFamily: tokenInput ? "var(--font-score)" : "var(--font-body)",
                    fontWeight: tokenInput ? "bold" : "normal",
                    fontSize: tokenInput ? 22 : 15,
                    height: "52px",
                  }}
                />
                {tokenInput.length === 6 && (
                  <p className="text-xs mt-1 font-bold" style={{ color: "#00B894" }}>
                    🔗 Token dari link undangan terisi otomatis!
                  </p>
                )}
              </div>
            </div>

            <button
              id="btn-join-room-submit"
              onClick={handleJoin}
              disabled={loading || !username || !tokenInput}
              className="w-full h-14 rounded-xl font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: loading || !username || !tokenInput
                  ? "rgba(108,92,231,0.2)"
                  : "linear-gradient(135deg, #6C5CE7, #4ECDC4)",
                color: "white",
                boxShadow: loading || !username || !tokenInput
                  ? "none"
                  : "0 4px 20px rgba(108,92,231,0.4)",
              }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Mencari Room...</span>
                </>
              ) : (
                <>
                  <span>⚔️</span>
                  <span>Masuk ke Battle!</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
