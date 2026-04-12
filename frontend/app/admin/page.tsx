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
import { useAdminStore } from "@/store";
import { api } from "@/lib/utils";

export default function AdminLoginPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { isLoggedIn, setAdminAuth } = useAdminStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isLoggedIn) router.replace("/admin/dashboard");
  }, [isLoggedIn]);

  const handleLogin = async () => {
    if (!username || !password) {
      showToast("Username dan password wajib diisi!", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      if (res.data.success) {
        const { token, admin } = res.data.data;
        setAdminAuth({
          token,
          adminId: admin._id,
          username: admin.username,
          className: admin.className,
          role: admin.role,
        });
        showToast("Login berhasil! 🎉", "success");
        setTimeout(() => router.push("/admin/dashboard"), 500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Login gagal!";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col">
      <ParticleBackground />
      <ToastComponent />

      <div className="flex-1 flex flex-col justify-center px-6 py-8 relative z-10 max-w-md mx-auto w-full">

        {/* Back to home */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 mb-8 text-sm font-semibold transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ← Kembali ke Beranda
        </button>

        {/* Header */}
        <div className="text-center mb-8 animate-slide-down">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))",
              boxShadow: "var(--shadow-button)",
              fontSize: 40,
            }}
          >
            👑
          </div>
          <h1
            className="text-3xl font-black mb-1"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            Admin Panel
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            QuizClass — by Ikbal x RPL
          </p>
        </div>

        {/* Form */}
        <div
          className="glass-card p-6 animate-slide-up"
          style={{ animationDelay: "0.15s" }}
        >
          <h2
            className="text-lg font-extrabold mb-5"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            🔐 Masuk sebagai Admin
          </h2>

          <div className="space-y-4">
            <InputField
              label="Username Admin"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              icon={<span style={{ fontSize: 18 }}>👤</span>}
              autoComplete="username"
            />

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
              >
                Password
              </label>
              <div className="relative">
                <div
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-muted)", zIndex: 1 }}
                >
                  <span style={{ fontSize: 18 }}>🔑</span>
                </div>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoComplete="current-password"
                  className="input-field pl-14 pr-24"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                  style={{
                    color: "var(--text-muted)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                  }}
                  type="button"
                >
                  {showPass ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            loading={loading}
            className="mt-5"
          >
            <span>🚀</span>
            <span>Masuk ke Admin</span>
          </Button>
        </div>

        <CreditFooter />
      </div>
    </div>
  );
}