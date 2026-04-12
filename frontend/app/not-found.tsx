"use client";

import { useRouter } from "next/navigation";
import { ParticleBackground, Button, CreditFooter } from "@/components/UI";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center px-6">
      <ParticleBackground />

      <div className="text-center relative z-10 animate-pop-in">
        <div
          className="text-8xl mb-6 animate-bounce-idle"
          style={{
            filter: "drop-shadow(0 0 20px rgba(108,92,231,0.4))",
          }}
        >
          🎮
        </div>

        <h1
          className="text-6xl font-black mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            background:
              "linear-gradient(135deg, var(--accent-purple-light), var(--accent-blue))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </h1>

        <h2
          className="text-2xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
          }}
        >
          Halaman Tidak Ditemukan!
        </h2>

        <p
          className="text-base mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          Kayaknya kamu nyasar deh 😅
        </p>

        <Button onClick={() => router.push("/")}>
          <span>🏠</span>
          <span>Kembali ke Beranda</span>
        </Button>

        <CreditFooter />
      </div>
    </div>
  );
}