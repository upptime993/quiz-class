import { io, Socket } from "socket.io-client";
import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── Class merge helper ───────────────────────────────────────
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ─── API Client ───────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
});

// Interceptor untuk auth token admin dan Content-Type
api.interceptors.request.use((config) => {
  // Set Content-Type JSON untuk semua request kecuali FormData
  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }
  // Tambahkan auth token admin jika ada
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("quizclass-admin");
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      }
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("quizclass-admin");
        if (window.location.pathname.startsWith("/admin") &&
            window.location.pathname !== "/admin") {
          window.location.href = "/admin";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Socket.IO Client ─────────────────────────────────────────
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

let playerSocket: Socket | null = null;
let adminSocket: Socket | null = null;

export const getPlayerSocket = (): Socket => {
  if (!playerSocket || !playerSocket.connected) {
    playerSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return playerSocket;
};

export const getAdminSocket = (token: string): Socket => {
  if (adminSocket && (adminSocket.auth as any)?.token !== token) {
    adminSocket.disconnect();
    adminSocket = null;
  }
  
  if (!adminSocket || !adminSocket.connected) {
    adminSocket = io(`${SOCKET_URL}/admin`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }
  return adminSocket;
};

export const disconnectPlayerSocket = () => {
  if (playerSocket) {
    playerSocket.disconnect();
    playerSocket = null;
  }
};

export const disconnectAdminSocket = () => {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
};

// ─── Duel Socket ──────────────────────────────────────────────
let duelSocket: Socket | null = null;

export const getDuelSocket = (): Socket => {
  if (!duelSocket || !duelSocket.connected) {
    duelSocket = io(`${SOCKET_URL}/duel`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return duelSocket;
};

export const disconnectDuelSocket = () => {
  if (duelSocket) {
    duelSocket.disconnect();
    duelSocket = null;
  }
};


// ─── Sound Manager ────────────────────────────────────────────
class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private muted = false;

  private getOrCreate(name: string, src: string): HTMLAudioElement {
    if (!this.sounds.has(name)) {
      const audio = new Audio(src);
      audio.preload = "auto";
      this.sounds.set(name, audio);
    }
    return this.sounds.get(name)!;
  }

  play(name: "countdown" | "correct" | "wrong" | "tick" | "winner" | "whoosh") {
    if (this.muted || typeof window === "undefined") return;
    try {
      const paths: Record<string, string> = {
        countdown: "/sounds/countdown.mp3",
        correct: "/sounds/correct.mp3",
        wrong: "/sounds/wrong.mp3",
        tick: "/sounds/tick.mp3",
        winner: "/sounds/winner.mp3",
        whoosh: "/sounds/whoosh.mp3",
      };
      const audio = this.getOrCreate(name, paths[name]);
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }

  // Buat suara countdown pakai Web Audio API (tidak perlu file)
  playCountdownBeep(count: number) {
    if (this.muted || typeof window === "undefined") return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = count === 0 ? 880 : 440;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  // Beep tick saat timer hampir habis
  playTickBeep() {
    if (this.muted || typeof window === "undefined") return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }
}

export const soundManager = new SoundManager();

// ─── Format & Helper Functions ────────────────────────────────
export const formatScore = (score: number): string => {
  return (score ?? 0).toLocaleString("id-ID");
};

export const formatTime = (ms: number): string => {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

export const getRankEmoji = (rank: number): string => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

export const getInitials = (name: string): string => {
  return name.slice(0, 2).toUpperCase();
};

// ─── Generate Confetti ────────────────────────────────────────
export const triggerConfetti = async () => {
  if (typeof window === "undefined") return;
  try {
    const confetti = (await import("canvas-confetti")).default;
    const duration = 4000;
    const end = Date.now() + duration;

    const colors = ["#6C5CE7", "#4ECDC4", "#FDCB6E", "#FF6B6B", "#00B894"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  } catch {}
};

// ─── Validate Token Format ────────────────────────────────────
export const isValidTokenFormat = (token: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(token.toUpperCase());
};

// ─── Truncate Text ────────────────────────────────────────────
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};