"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ParticleBackground,
  GlassCard,
  Button,
  StatCard,
  Badge,
  SectionHeader,
  EmptyState,
  useToast,
} from "@/components/UI";
import { LeaderboardRow } from "@/components/QuizComponents";
import { AvatarRenderer } from "@/components/Avatar";
import { useAdminStore } from "@/store";
import { api, getAdminSocket, disconnectAdminSocket } from "@/lib/utils";
import { Session, Quiz, LeaderboardEntry } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { token: adminToken, username, className } = useAdminStore();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const activeSessionStatus = activeSession?.status;
  const participantCount =
    activeSession?.participants?.filter((p) => p.isConnected).length ?? 0;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [qRes, sRes] = await Promise.all([
        api.get("/quiz"),
        api.get("/session"),
      ]);

      const allQuizzes: Quiz[] = qRes.data.data?.quizzes || [];
      const allSessions: Session[] = sRes.data.data?.sessions || [];

      setQuizzes(allQuizzes);
      setSessions(allSessions);

      // Cari active session
      const active = allSessions.find((s) =>
        ["waiting", "countdown", "active", "between", "showing_result"].includes(
          s.status
        )
      );
      setActiveSession(active || null);

      if (active) {
        // Fetch leaderboard
        const lbRes = await api.get(`/session/${active._id}/leaderboard`);
        setLiveLeaderboard(lbRes.data.data?.leaderboard || []);
      }
    } catch (err) {
      showToast("Gagal memuat data!", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Admin socket untuk live updates
  useEffect(() => {
    if (!adminToken) return;
    const socket = getAdminSocket(adminToken);

    socket.on("connect", () => {
      if (activeSession) {
        socket.emit("admin:joinSession", {
          sessionToken: activeSession.token,
        });
      }
    });

    socket.on("admin:sessionInfo", (data: any) => {
      setActiveSession((prev) =>
        prev ? { ...prev, ...data.session } : null
      );
      setLiveLeaderboard(data.leaderboard || []);
    });

    socket.on("admin:statsUpdate", (data: any) => {
      setLiveLeaderboard(data.leaderboard || []);
    });

    return () => {
      socket.off("connect");
      socket.off("admin:sessionInfo");
      socket.off("admin:statsUpdate");
    };
  }, [adminToken, activeSession?.token]);

  // Start Quiz
  const handleStartQuiz = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:startQuiz", {
        sessionToken: activeSession.token,
      });
      showToast("Quiz dimulai! 🚀", "success");
      await fetchData();
    } catch {
      showToast("Gagal memulai quiz!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Force next
  const handleForceNext = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:forceNext", {
        sessionToken: activeSession.token,
        questionIndex: activeSession.currentQuestion,
      });
      showToast("Lanjut ke soal berikutnya!", "success");
    } catch {
      showToast("Gagal!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Stop quiz
  const handleStopQuiz = async () => {
    if (!activeSession) return;
    if (!confirm("Yakin mau menghentikan quiz?")) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:stopQuiz", {
        sessionToken: activeSession.token,
      });
      showToast("Quiz dihentikan!", "info");
      await fetchData();
    } catch {
      showToast("Gagal!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel: Record<string, { text: string; variant: "green" | "yellow" | "purple" | "red" }> = {
    waiting: { text: "Menunggu Peserta", variant: "yellow" },
    countdown: { text: "Countdown", variant: "purple" },
    active: { text: "Berlangsung", variant: "green" },
    between: { text: "Antar Soal", variant: "purple" },
    showing_result: { text: "Menampilkan Hasil", variant: "purple" },
    finished: { text: "Selesai", variant: "red" },
  };

  return (
    <div className="min-h-screen px-5 py-6 relative z-10 max-w-md mx-auto">
      <ParticleBackground />
      <ToastComponent />

      {/* ── Header ── */}
      <div className="mb-8 mt-2 animate-slide-down relative">
        {/* Glow effect behind header */}
        <div 
          className="absolute -top-10 -left-10 w-40 h-40 rounded-full blur-[80px] pointer-events-none opacity-50"
          style={{ background: "var(--accent-purple)" }}
        />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌟</span>
              <p
                className="text-sm font-bold tracking-wide uppercase"
                style={{ color: "var(--accent-purple-light)" }}
              >
                Selamat datang,
              </p>
            </div>
            <h1
              className="text-3xl font-black tracking-tight"
              style={{
                fontFamily: "var(--font-heading)",
                background: "linear-gradient(to right, #fff, var(--accent-purple-light))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {username}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: "rgba(108,92,231,0.2)", color: "var(--accent-purple-light)", border: "1px solid rgba(108,92,231,0.3)" }}>
                👑 Admin
              </span>
              <p
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {className}
              </p>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border border-white/10 animate-pulse-slow" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.8), rgba(30,30,45,0.8))", backdropFilter: "blur(10px)" }}>
            🌙
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-4 mb-8 animate-slide-up">
        <div 
          className="relative p-5 rounded-2xl overflow-hidden group"
          style={{ 
            background: "linear-gradient(145deg, rgba(30,30,45,0.9) 0%, rgba(20,20,30,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}
        >
          <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-110 transition-transform duration-300">📋</div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(108,92,231,0.2)", color: "var(--accent-purple-light)" }}>📋</div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Total Quiz</p>
          </div>
          <p className="text-4xl font-black" style={{ fontFamily: "var(--font-score)", color: "var(--text-primary)" }}>
            {quizzes.length}
          </p>
        </div>
        
        <div 
          className="relative p-5 rounded-2xl overflow-hidden group"
          style={{ 
            background: "linear-gradient(145deg, rgba(30,30,45,0.9) 0%, rgba(20,20,30,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}
        >
          <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-110 transition-transform duration-300">🎮</div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(0,184,148,0.2)", color: "var(--accent-green)" }}>🎮</div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Total Sesi</p>
          </div>
          <p className="text-4xl font-black" style={{ fontFamily: "var(--font-score)", color: "var(--text-primary)" }}>
            {sessions.length}
          </p>
        </div>
      </div>

      {/* ── Active Session Control ── */}
      {activeSession ? (
        <div
          className="p-1 rounded-3xl mb-8 animate-slide-up relative"
          style={{ 
            background: "linear-gradient(135deg, rgba(108,92,231,0.5), rgba(0,184,148,0.3))",
            boxShadow: "0 10px 40px rgba(108,92,231,0.2)"
          }}
        >
          <div className="rounded-[1.4rem] p-6" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-[50px] rounded-full pointer-events-none" />
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <p className="text-lg font-black" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Sesi Aktif</p>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-mono font-bold px-2.5 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                    Token: <span className="text-white">{activeSession.token}</span>
                  </p>
                  <Badge variant={statusLabel[activeSessionStatus || "waiting"]?.variant || "purple"}>
                    {statusLabel[activeSessionStatus || "waiting"]?.text || activeSessionStatus}
                  </Badge>
                </div>
              </div>
              <div className="text-right bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                <p
                  className="text-3xl font-black leading-none"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--accent-purple-light)",
                  }}
                >
                  {participantCount}
                </p>
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  peserta
                </p>
              </div>
            </div>

          {/* Participant avatars preview */}
          {activeSession.participants && activeSession.participants.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-4">
              {activeSession.participants
                .filter((p) => p.isConnected)
                .slice(0, 10)
                .map((p) => (
                  <div
                    key={p.username}
                    title={p.username}
                    className="animate-pop-in"
                  >
                    <AvatarRenderer
                      avatar={p.avatar}
                      size={36}
                      animate="none"
                      showAccessories
                    />
                  </div>
                ))}
              {participantCount > 10 && (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "2px solid var(--border)",
                  }}
                >
                  +{participantCount - 10}
                </div>
              )}
            </div>
          )}

          {/* Control buttons */}
          <div className="space-y-2">
            {activeSessionStatus === "waiting" && (
              <Button
                onClick={handleStartQuiz}
                loading={actionLoading}
                variant="green"
              >
                <span>🚀</span>
                <span>Mulai Quiz!</span>
              </Button>
            )}

            {(activeSessionStatus === "active" ||
              activeSessionStatus === "between" ||
              activeSessionStatus === "showing_result") && (
              <>
                <Button
                  onClick={handleForceNext}
                  loading={actionLoading}
                  variant="primary"
                >
                  <span>⏭️</span>
                  <span>Soal Berikutnya</span>
                </Button>
                <Button
                  onClick={() => router.push("/admin/session")}
                  variant="secondary"
                >
                  <span>👁️</span>
                  <span>Monitor Live</span>
                </Button>
              </>
            )}

            {activeSessionStatus !== "finished" && (
              <button
                onClick={handleStopQuiz}
                className="w-full text-sm font-bold py-3.5 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden group mt-4 hover:shadow-[0_0_20px_rgba(255,107,107,0.3)]"
                style={{
                  background: "rgba(255,107,107,0.1)",
                  color: "var(--accent-red)",
                  border: "1px solid rgba(255,107,107,0.2)",
                }}
              >
                <div className="absolute inset-0 w-0 bg-red-500/10 transition-all duration-300 ease-out group-hover:w-full" />
                <span className="relative z-10">🛑 Hentikan Quiz Secara Paksa</span>
              </button>
            )}
          </div>
        </div>
        </div>
      ) : (
        <div className="mb-8 animate-slide-up">
          <div 
            className="p-8 rounded-[2rem] text-center relative overflow-hidden"
            style={{ 
              background: "linear-gradient(180deg, rgba(30,30,45,0.6) 0%, rgba(20,20,30,0.8) 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1)"
            }}
          >
            <div className="text-6xl mb-4 animate-bounce-idle opacity-80">🎮</div>
            <h3 className="text-xl font-black mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Belum Ada Sesi Aktif</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Buat sesi baru dari menu Quiz untuk mengundang peserta bermain!</p>
            
            <button 
              onClick={() => router.push("/admin/quiz")}
              className="px-6 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))",
                boxShadow: "0 8px 25px rgba(108,92,231,0.4), inset 0 2px 4px rgba(255,255,255,0.2)",
              }}
            >
              <span>✨</span>
              <span>Buat Sesi Baru Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Live Leaderboard ── */}
      {liveLeaderboard.length > 0 && (
        <div className="mb-5 animate-fade-in">
          <SectionHeader
            title="🏆 Leaderboard"
            subtitle="Update otomatis"
            right={<Badge variant="green">LIVE</Badge>}
          />
          <div className="space-y-2">
            {liveLeaderboard.slice(0, 5).map((entry, i) => (
              <LeaderboardRow
                key={entry.username}
                entry={entry}
                animated
                delay={i * 50}
              />
            ))}
          </div>
          {liveLeaderboard.length > 5 && (
            <button
              onClick={() => router.push("/admin/session")}
              className="w-full text-center text-sm font-semibold mt-2 py-2"
              style={{ color: "var(--accent-purple-light)" }}
            >
              Lihat semua ({liveLeaderboard.length} peserta) →
            </button>
          )}
        </div>
      )}

      {/* ── Recent Quiz ── */}
      <div className="animate-slide-up mb-24">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Quiz Kamu</h2>
          </div>
          <button
            onClick={() => router.push("/admin/quiz")}
            className="text-xs font-bold transition-opacity hover:opacity-70 flex items-center gap-1"
            style={{ color: "var(--accent-purple-light)" }}
          >
            Lihat Semua <span>→</span>
          </button>
        </div>

        {quizzes.length === 0 ? (
          <div className="p-6 rounded-2xl text-center border-dashed border-2" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
            <div className="text-3xl mb-2 opacity-50">📝</div>
            <p className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>Belum Ada Quiz</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Yuk buat quiz pertamamu!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.slice(0, 3).map((quiz, i) => (
              <div
                key={quiz._id}
                className="group relative p-4 rounded-xl flex items-center justify-between cursor-pointer animate-slide-up overflow-hidden transition-all hover:-translate-y-1"
                style={{ 
                  background: "var(--bg-elevated)", 
                  border: "1px solid rgba(255,255,255,0.05)",
                  animationDelay: `${i * 0.08}s` 
                }}
                onClick={() => router.push("/admin/quiz")}
              >
                <div className="absolute inset-0 w-0 bg-gradient-to-r from-purple-500/10 to-transparent transition-all duration-500 ease-out group-hover:w-1/2 pointer-events-none" />
                <div className="flex-1 min-w-0 flex items-center gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    💡
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold truncate"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                        fontSize: 15,
                      }}
                    >
                      {quiz.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded uppercase font-bold tracking-wider" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                        {quiz.totalQuestions} soal
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded uppercase font-bold tracking-wider" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                        {quiz.defaultDuration}s / soal
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:bg-purple-500/20 group-hover:text-purple-300 relative z-10"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="text-lg">›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}