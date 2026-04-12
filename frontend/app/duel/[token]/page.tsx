"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticleBackground } from "@/components/UI";
import { useDuelStore } from "@/store";
import { api } from "@/lib/utils";

/**
 * /duel/[token] — Halaman invite duel.
 * Jika user sudah punya username di store (dari store duel) → auto masuk sebagai creator/opponent.
 * Jika belum → redirect ke /duel/join?token=XXX
 */
export default function DuelTokenPage() {
  const router = useRouter();
  const params = useParams();
  const tokenFromUrl = (params?.token as string || "").toUpperCase().trim();

  const { username, token: storedToken } = useDuelStore();
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [message, setMessage] = useState("Memeriksa room...");

  useEffect(() => {
    if (!tokenFromUrl) {
      router.replace("/duel");
      return;
    }

    const check = async () => {
      try {
        // Periksa state room via API
        const usernameParam = username ? `?username=${encodeURIComponent(username)}` : "";
        const res = await api.get(`/duel/${tokenFromUrl}/state${usernameParam}`);
        const { data } = res.data;

        if (data.status === "finished" || data.status === "canceled") {
          setStatus("error");
          setMessage("Room ini sudah tidak aktif.");
          setTimeout(() => router.push("/duel"), 2500);
          return;
        }

        // Jika user sudah terdaftar di room ini → masuk ke quiz/lobby
        if (data.isRegistered && username) {
          if (data.status === "active" || data.status === "countdown") {
            router.replace(`/duel/${tokenFromUrl}/quiz`);
          } else {
            // Status waiting → ke lobby
            router.replace(`/duel/lobby?token=${tokenFromUrl}`);
          }
          return;
        }

        // Tidak terdaftar → ke join page
        router.replace(`/duel/join?token=${tokenFromUrl}`);
      } catch {
        // Room tidak ditemukan atau API error
        router.replace(`/duel/join?token=${tokenFromUrl}`);
      }
    };

    check();
  }, [tokenFromUrl, username]);

  return (
    <div className="page-container gradient-bg min-h-screen flex flex-col items-center justify-center">
      <ParticleBackground />
      <div className="relative z-10 text-center px-6">
        <div className="text-5xl mb-6 animate-bounce">⚔️</div>
        <h2 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          Duel Room
        </h2>
        <p className="text-white/60 text-sm mb-6">{message}</p>
        <div
          className="inline-block px-6 py-3 rounded-2xl text-xs font-bold tracking-widest"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          🔑 Token: <span className="text-yellow-300">{tokenFromUrl}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-purple-400"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
