"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ParticleBackground,
  Button,
  InputField,
  CreditFooter,
  useToast,
} from "@/components/UI";
import { usePlayerStore } from "@/store";
import { api, isValidTokenFormat } from "@/lib/utils";

export default function LandingPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { setToken, setUsername, resetPlayer } = usePlayerStore();

  const [token, setTokenInput] = useState("");
  const [username, setUsernameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ token: "", username: "" });

  // Reset player state saat landing
  useEffect(() => {
    resetPlayer();
  }, []);

  const validate = (): boolean => {
    const newErrors = { token: "", username: "" };
    let valid = true;

    const upperToken = token.toUpperCase().trim();
    if (!upperToken) {
      newErrors.token = "Kode token wajib diisi";
      valid = false;
    } else if (!isValidTokenFormat(upperToken)) {
      newErrors.token = "Token harus 6 karakter (huruf & angka)";
      valid = false;
    }

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
      const upperToken = token.toUpperCase().trim();
      const res = await api.get(`/session/${upperToken}/info`);

      if (res.data.success) {
        setToken(upperToken);
        setUsername(username.trim());
        router.push("/avatar");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Token tidak valid, coba cek lagi!";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />
      <ToastComponent />

      {/* Decorative ambient glowing orbs */}
      <div className="absolute top-[10%] left-[50%] -translate-x-[50%] w-[300px] h-[300px] bg-[var(--accent-purple)] opacity-20 blur-[100px] mix-blend-screen pointer-events-none rounded-full" />
      <div className="absolute top-[40%] right-[-10%] w-[250px] h-[250px] bg-[var(--accent-blue)] opacity-10 blur-[80px] mix-blend-screen pointer-events-none rounded-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">
        
        <div className="w-full max-w-md flex flex-col items-center">
          {/* ── Header ── */}
          <div className="text-center w-full animate-slide-down">
            {/* Pulsing Logo */}
            <div className="relative inline-block mb-3">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-purple-light)] to-[var(--accent-blue)] rounded-2xl blur-xl opacity-40 animate-pulse-glow" />
              <div
                className="relative flex items-center justify-center w-24 h-24 rounded-3xl animate-bounce-idle border border-[rgba(255,255,255,0.15)] shadow-2xl backdrop-blur-md"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(108,92,231,0.8), rgba(90,75,209,0.9))",
                  fontSize: 48,
                }}
              >
                🎮
              </div>
            </div>

            <h1
              className="text-5xl font-black mb-1 tracking-tight"
              style={{
                fontFamily: "var(--font-heading)",
                background:
                  "linear-gradient(to right, #FFF 20%, #A594FD 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              QuizClass
            </h1>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="w-6 h-[1px] bg-gradient-to-r from-transparent to-[var(--accent-purple-light)] opacity-50"></span>
              <p
                className="text-xs font-bold tracking-widest uppercase opacity-80"
                style={{ color: "var(--accent-purple-light)" }}
              >
                by Ikbal x RPL
              </p>
              <span className="w-6 h-[1px] bg-gradient-to-l from-transparent to-[var(--accent-purple-light)] opacity-50"></span>
            </div>
            
            <p
              className="text-[15px] mt-1 font-medium px-4 opacity-80 mb-5"
              style={{ color: "white" }}
            >
              Platform quiz interaktif yang seru! 🚀
            </p>
          </div>

          {/* ── Form Card ── */}
          <div
            className="w-full animate-slide-up mb-6 mt-2 relative group"
            style={{ animationDelay: "0.15s" }}
          >
            {/* Card neon border behind */}
            <div className="absolute -inset-[1px] bg-gradient-to-b from-[rgba(108,92,231,0.5)] to-transparent rounded-[24px] opacity-70 group-hover:opacity-100 transition-opacity blur-[2px]" />
            
            <div className="relative px-6 py-8 rounded-[24px] shadow-2xl backdrop-blur-xl border border-[rgba(255,255,255,0.06)]"
                 style={{ background: "rgba(19,19,26,0.65)" }}
            >
              <h2
                className="text-xl font-extrabold mb-5 text-center flex items-center justify-center gap-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                Gabung Quiz Sekarang!
              </h2>

              <div className="space-y-5">
                {/* Token Input */}
                <InputField
                  label="Kode Token"
                  placeholder="Masukkan 6 digit token"
                  value={token}
                  onChange={(e) =>
                    setTokenInput(e.target.value.toUpperCase().slice(0, 6))
                  }
                  onKeyDown={handleKeyDown}
                  error={errors.token}
                  icon={<span style={{ fontSize: 18 }}>🎫</span>}
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  style={{
                    letterSpacing: token ? "0.3em" : "normal",
                    fontFamily: token ? "var(--font-score)" : "var(--font-body)",
                    fontWeight: token ? "bold" : "normal",
                    fontSize: token ? 22 : 15,
                    height: "56px",
                  }}
                />

                {/* Username Input */}
                <div>
                  <InputField
                    label="Username Kamu"
                    placeholder="Masukkan namamu"
                    value={username}
                    onChange={(e) => setUsernameInput(e.target.value.slice(0, 20))}
                    onKeyDown={handleKeyDown}
                    error={errors.username}
                    icon={<span style={{ fontSize: 18 }}>👤</span>}
                    maxLength={20}
                    autoComplete="off"
                    style={{ height: "56px" }}
                  />
                  {username && (
                    <p
                      className="text-right text-[10px] uppercase font-bold mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {username.length}/20 Karakter
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  onClick={handleJoin}
                  loading={loading}
                  disabled={!token || !username}
                  className="w-full text-lg h-14 rounded-xl shadow-[0_0_20px_rgba(108,92,231,0.3)] hover:shadow-[0_0_35px_rgba(108,92,231,0.6)] group/btn transition-all duration-300"
                >
                  <span className="group-hover/btn:-translate-y-1 group-active/btn:translate-y-0 transition-transform text-xl">🚀</span>
                  <span className="tracking-wide">Gas Masuk!</span>
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>atau</span>
                  <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.07)" }} />
                </div>

                {/* 1v1 Button */}
                <button
                  id="btn-duel-mode"
                  onClick={() => router.push("/duel")}
                  className="w-full h-12 rounded-xl font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all duration-300 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,60,60,0.15), rgba(255,140,0,0.15))",
                    border: "1px solid rgba(255,100,50,0.4)",
                    color: "#FF8C42",
                    boxShadow: "0 0 15px rgba(255,100,0,0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,60,60,0.25), rgba(255,140,0,0.25))";
                    e.currentTarget.style.boxShadow = "0 0 25px rgba(255,100,0,0.3)";
                    e.currentTarget.style.borderColor = "rgba(255,100,50,0.7)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,60,60,0.15), rgba(255,140,0,0.15))";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(255,100,0,0.1)";
                    e.currentTarget.style.borderColor = "rgba(255,100,50,0.4)";
                  }}
                >
                  <span style={{ fontSize: 20 }}>⚔️</span>
                  <span>Mode 1v1 Battle</span>
                  <span className="text-xs opacity-60 ml-1">BETA</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Features ── */}
          <div
            className="grid grid-cols-3 gap-3 w-full animate-fade-in mb-8"
            style={{ animationDelay: "0.3s" }}
          >
            {[
              { emoji: "⚡", label: "Real-time" },
              { emoji: "🏆", label: "Ranking" },
              { emoji: "🎭", label: "Avatar" },
            ].map((f) => (
              <div
                key={f.label}
                className="p-3 text-center transition-transform hover:-translate-y-1 border border-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.1)] "
                style={{ 
                  borderRadius: 16, 
                  background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 4, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}>{f.emoji}</div>
                <p
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {f.label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Admin Link ── */}
          <div className="w-full text-center">
            <button
              onClick={() => router.push("/admin")}
              className="text-sm font-semibold transition-all px-4 py-2 rounded-full border border-transparent hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.03)] active:scale-95"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent-purple-light)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.4)")
              }
            >
              🔐 Login ke Ruang Admin
            </button>
            <div className="mt-2 opacity-50">
               <CreditFooter />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}