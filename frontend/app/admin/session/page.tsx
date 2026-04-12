"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ParticleBackground,
  GlassCard,
  Button,
  Badge,
  SectionHeader,
  EmptyState,
  StatCard,
  useToast,
  LoadingScreen,
} from "@/components/UI";
import { LeaderboardRow } from "@/components/QuizComponents";
import { AvatarRenderer } from "@/components/Avatar";
import { useAdminStore } from "@/store";
import { api, getAdminSocket } from "@/lib/utils";
import { Session, LeaderboardEntry } from "@/types";

type MonitorTab = "participants" | "leaderboard" | "stats";

export default function SessionPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { token: adminToken } = useAdminStore();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MonitorTab>("participants");
  const [actionLoading, setActionLoading] = useState(false);
  const [answerStats, setAnswerStats] = useState<{
    A: number; B: number; C: number; D: number; unanswered: number;
  } | null>(null);
  const [selectedFinishedId, setSelectedFinishedId] = useState<string | null>(null);
  const [finishedLeaderboard, setFinishedLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [finishedLeaderboardLoading, setFinishedLeaderboardLoading] = useState(false);

  // New features for riwayat sesi
  const [searchTerm, setSearchTerm] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedParticipantStats, setSelectedParticipantStats] = useState<LeaderboardEntry | null>(null);
  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get("/session");
      const all: Session[] = res.data.data?.sessions || [];
      setSessions(all);

      const active = all.find((s) =>
        ["waiting", "countdown", "active", "between", "showing_result"].includes(s.status)
      );
      setActiveSession(active || null);

      if (active) {
        const lbRes = await api.get(`/session/${active._id}/leaderboard`);
        setLeaderboard(lbRes.data.data?.leaderboard || []);
      }
    } catch {
      showToast("Gagal memuat sesi!", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 8000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Admin socket live updates
  useEffect(() => {
    if (!adminToken || !activeSession) return;

    const socket = getAdminSocket(adminToken);

    socket.emit("admin:joinSession", {
      sessionToken: activeSession.token,
    });

    socket.on("admin:sessionInfo", (data: any) => {
      if (data.session) {
        setActiveSession((prev) =>
          prev ? { ...prev, ...data.session } : null
        );
      }
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    // ─── REAL-TIME LOBBY UPDATES ────────────────────────
    // Listen for player join/leave to update participant list instantly
    socket.on("session:playerJoined", (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        // If we have full participants list from server, merge it with existing data
        if (data.participants && Array.isArray(data.participants)) {
          const merged = data.participants.map((incoming: any) => {
            // Find existing participant to preserve any data fields the server might not send
            const existing = prev.participants.find(
              (p) => p.username === incoming.username
            );
            return {
              socketId: incoming.socketId || existing?.socketId || "",
              username: incoming.username,
              avatar: incoming.avatar || existing?.avatar || { emoji: "🦊", mixEmoji: null, mixImageUrl: null },
              score: incoming.score ?? existing?.score ?? 0,
              answers: incoming.answers || existing?.answers || [],
              joinedAt: incoming.joinedAt || existing?.joinedAt || new Date().toISOString(),
              isConnected: incoming.isConnected ?? true,
            };
          });
          return { ...prev, participants: merged };
        }
        const exists = prev.participants.some(
          (p) => p.username === data.username
        );
        if (exists) {
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.username === data.username ? { ...p, isConnected: true } : p
            ),
          };
        }
        return {
          ...prev,
          participants: [
            ...prev.participants,
            {
              socketId: "",
              username: data.username,
              avatar: data.avatar || { emoji: "🦊", mixEmoji: null, mixImageUrl: null },
              score: 0,
              answers: [],
              joinedAt: new Date().toISOString(),
              isConnected: true,
            },
          ],
        };
      });
    });

    socket.on("session:playerLeft", (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        if (data.participants && Array.isArray(data.participants)) {
          const merged = data.participants.map((incoming: any) => {
            const existing = prev.participants.find(
              (p) => p.username === incoming.username
            );
            return {
              socketId: incoming.socketId || existing?.socketId || "",
              username: incoming.username,
              avatar: incoming.avatar || existing?.avatar || { emoji: "🦊", mixEmoji: null, mixImageUrl: null },
              score: incoming.score ?? existing?.score ?? 0,
              answers: incoming.answers || existing?.answers || [],
              joinedAt: incoming.joinedAt || existing?.joinedAt || new Date().toISOString(),
              isConnected: incoming.isConnected ?? false,
            };
          });
          return { ...prev, participants: merged };
        }
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.username === data.username ? { ...p, isConnected: false } : p
          ),
        };
      });
    });

    socket.on("session:avatarUpdated", (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.username === data.username ? { ...p, avatar: data.avatar } : p
          ),
        };
      });
    });

    socket.on("admin:statsUpdate", (data: any) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.stats) setAnswerStats(data.stats);
    });

    // Request stats periodically
    const statsInterval = setInterval(() => {
      if (activeSession.status === "active") {
        socket.emit("admin:getStats", {
          sessionToken: activeSession.token,
          questionIndex: activeSession.currentQuestion,
        });
      }
    }, 3000);

    return () => {
      socket.off("admin:sessionInfo");
      socket.off("session:playerJoined");
      socket.off("session:playerLeft");
      socket.off("session:avatarUpdated");
      socket.off("admin:statsUpdate");
      clearInterval(statsInterval);
    };
  }, [adminToken, activeSession?.token, activeSession?.status, activeSession?.currentQuestion]);

  // Actions
  const handleStartQuiz = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:startQuiz", { sessionToken: activeSession.token });
      showToast("Quiz dimulai! 🚀", "success");
      setTimeout(fetchSessions, 1500);
    } catch {
      showToast("Gagal memulai!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!confirm("Batal dan hapus sesi ini? Semua peserta akan dikeluarkan.")) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:cancelSession", { sessionToken: activeSession.token });
      showToast("Sesi dibatalkan!", "info");
      setTimeout(fetchSessions, 1500);
    } catch {
      showToast("Gagal membatalkan!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!activeSession?.token) return;
    navigator.clipboard.writeText(activeSession.token);
    showToast("Token disalin ke clipboard! 📋", "success");
  };

  const handleCopyLink = () => {
    if (!activeSession?.token) return;
    const url = `${window.location.origin}/join/${activeSession.token}`;
    navigator.clipboard.writeText(url);
    showToast("Link join disalin! 🔗", "success");
  };

  const handleForceNext = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:forceNext", {
        sessionToken: activeSession.token,
        questionIndex: activeSession.currentQuestion,
      });
      showToast("Lanjut soal berikutnya!", "success");
    } catch {
      showToast("Gagal!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopQuiz = async () => {
    if (!activeSession) return;
    if (!confirm("Yakin mau menghentikan quiz?")) return;
    setActionLoading(true);
    try {
      const socket = getAdminSocket(adminToken);
      socket.emit("admin:stopQuiz", { sessionToken: activeSession.token });
      showToast("Quiz dihentikan!", "info");
      setTimeout(fetchSessions, 1500);
    } catch {
      showToast("Gagal!", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus riwayat sesi ini?")) return;
    try {
      await api.delete(`/session/${id}`);
      showToast("Sesi berhasil dihapus!", "success");
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (selectedFinishedId === id) setSelectedFinishedId(null);
    } catch {
      showToast("Gagal menghapus sesi!", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedIds.size} sesi terpilih?`)) return;
    try {
      await api.post("/session/bulk-delete", { ids: Array.from(selectedIds) });
      showToast(`${selectedIds.size} sesi dihapus!`, "success");
      setSessions((prev) => prev.filter((s) => !selectedIds.has(s._id)));
      setSelectedIds(new Set());
      setEditMode(false);
      setSelectedFinishedId(null);
    } catch {
      showToast("Gagal menghapus sesi masal!", "error");
    }
  };

  const toggleSelectSession = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // View leaderboard for finished session
  const handleViewFinishedLeaderboard = async (sessionId: string) => {
    // Toggle: if already selected, close it
    if (selectedFinishedId === sessionId) {
      setSelectedFinishedId(null);
      setFinishedLeaderboard([]);
      return;
    }

    setSelectedFinishedId(sessionId);
    setFinishedLeaderboard([]);
    setFinishedLeaderboardLoading(true);

    try {
      const res = await api.get(`/session/${sessionId}/leaderboard`);
      setFinishedLeaderboard(res.data.data?.leaderboard || []);
    } catch {
      showToast("Gagal memuat leaderboard!", "error");
    } finally {
      setFinishedLeaderboardLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Memuat sesi..." />;

  const connectedParticipants =
    activeSession?.participants?.filter((p) => p.isConnected) || [];
  const answeredCount = activeSession
    ? activeSession.participants?.filter((p) =>
        p.answers?.some(
          (a) => a.questionIndex === activeSession.currentQuestion
        )
      ).length
    : 0;

  const statusConfig: Record<string, {
    text: string;
    variant: "green" | "yellow" | "purple" | "red";
    icon: string;
  }> = {
    waiting: { text: "Menunggu", variant: "yellow", icon: "⏳" },
    countdown: { text: "Countdown", variant: "purple", icon: "🔢" },
    active: { text: "Berlangsung", variant: "green", icon: "🟢" },
    between: { text: "Antar Soal", variant: "purple", icon: "⏭️" },
    showing_result: { text: "Hasil", variant: "purple", icon: "📊" },
    finished: { text: "Selesai", variant: "red", icon: "🏁" },
  };

  return (
    <div className="min-h-screen px-5 py-6 relative z-10 max-w-md mx-auto">
      <ParticleBackground />
      <ToastComponent />

      {/* ── Header ── */}
      <div className="mb-5 animate-slide-down">
        <SectionHeader
          title="🎮 Monitor Sesi"
          subtitle="Pantau jalannya quiz secara live"
          right={
            activeSession && (
              <Badge
                variant={
                  statusConfig[activeSession.status]?.variant || "purple"
                }
              >
                {statusConfig[activeSession.status]?.icon}{" "}
                {statusConfig[activeSession.status]?.text}
              </Badge>
            )
          }
        />
      </div>

      {/* ── Active Session ── */}
      {activeSession ? (
        <>
          {/* Session info bar */}
          <GlassCard className="p-4 mb-4 animate-slide-up" animate={false}>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p
                  className="text-2xl font-black"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--accent-purple-light)",
                  }}
                >
                  {connectedParticipants.length}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Peserta
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-black"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--accent-blue)",
                  }}
                >
                  {activeSession.currentQuestion + 1}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Soal ke
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-black"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--accent-green)",
                  }}
                >
                  {answeredCount}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Menjawab
                </p>
              </div>
            </div>

            {/* Token */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl mb-4"
              style={{
                background: "rgba(108,92,231,0.1)",
                border: "1px solid rgba(108,92,231,0.2)",
              }}
            >
              <p
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                Token Aktif:
              </p>
              <div className="flex items-center gap-3">
                <p
                  className="text-xl font-black tracking-widest"
                  style={{
                    fontFamily: "var(--font-score)",
                    color: "var(--accent-purple-light)",
                  }}
                >
                  {activeSession.token}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyToken}
                    className="p-2 flex items-center justify-center rounded-lg transition-all active:scale-95"
                    style={{
                      background: "rgba(108,92,231,0.2)",
                      color: "var(--accent-purple)",
                    }}
                    title="Salin Token"
                  >
                    📋
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 px-3 flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 text-xs font-bold"
                    style={{
                      background: "var(--accent-purple)",
                      color: "#fff",
                    }}
                    title="Salin Link Join"
                  >
                    🔗 Share Link
                  </button>
                </div>
              </div>
            </div>

            {/* Control buttons */}
            <div className="space-y-2">
              {activeSession.status === "waiting" && (
                <div className="grid gap-2">
                  <Button
                    onClick={handleStartQuiz}
                    loading={actionLoading}
                    variant="green"
                  >
                    🚀 Mulai Quiz!
                  </Button>
                  <Button
                    onClick={handleCancelSession}
                    loading={actionLoading}
                    variant="red"
                    className="text-sm"
                  >
                    ❌ Batalkan Sesi
                  </Button>
                </div>
              )}
              {["active", "between", "showing_result"].includes(
                activeSession.status
              ) && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleForceNext}
                    loading={actionLoading}
                    variant="primary"
                    className="text-sm"
                  >
                    ⏭️ Next Soal
                  </Button>
                  <Button
                    onClick={handleStopQuiz}
                    variant="red"
                    className="text-sm"
                  >
                    🛑 Stop
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>

          {/* ── Tabs ── */}
          <div className="flex gap-2 mb-4">
            {(["participants", "leaderboard", "stats"] as MonitorTab[]).map(
              (t) => {
                const labels = {
                  participants: "👥 Peserta",
                  leaderboard: "🏆 Skor",
                  stats: "📊 Statistik",
                };
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background:
                        tab === t
                          ? "var(--accent-purple)"
                          : "var(--bg-elevated)",
                      color: tab === t ? "white" : "var(--text-secondary)",
                      border: `1px solid ${
                        tab === t
                          ? "var(--accent-purple)"
                          : "var(--border)"
                      }`,
                    }}
                  >
                    {labels[t]}
                  </button>
                );
              }
            )}
          </div>

          {/* ── Participants Tab ── */}
          {tab === "participants" && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-4 gap-3">
                {connectedParticipants.map((p, i) => {
                  const hasAnswered = p.answers?.some(
                    (a) => a.questionIndex === activeSession.currentQuestion
                  );
                  return (
                    <div
                      key={p.username}
                      className="flex flex-col items-center gap-1.5 animate-pop-in"
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      <div className="relative">
                        <AvatarRenderer
                          avatar={p.avatar}
                          size={48}
                          animate="none"
                          showAccessories
                        />
                        {/* Answer indicator */}
                        {activeSession.status === "active" && (
                          <div
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{
                              background: hasAnswered
                                ? "var(--accent-green)"
                                : "var(--bg-elevated)",
                              border: `2px solid ${
                                hasAnswered
                                  ? "var(--accent-green)"
                                  : "var(--border)"
                              }`,
                              fontSize: 8,
                            }}
                          >
                            {hasAnswered ? "✓" : ""}
                          </div>
                        )}
                      </div>
                      <p
                        className="text-center font-bold leading-tight"
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-heading)",
                          fontSize: 10,
                          maxWidth: 56,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.username}
                      </p>
                      <p
                        className="text-center font-bold"
                        style={{
                          fontFamily: "var(--font-score)",
                          color: "var(--accent-purple-light)",
                          fontSize: 10,
                        }}
                      >
                        {(p.score ?? 0).toLocaleString("id-ID")}
                      </p>
                    </div>
                  );
                })}
              </div>

              {connectedParticipants.length === 0 && (
                <EmptyState
                  emoji="👥"
                  title="Belum Ada Peserta"
                  subtitle="Bagikan token ke peserta"
                />
              )}
            </div>
          )}

          {/* ── Leaderboard Tab ── */}
          {tab === "leaderboard" && (
            <div className="space-y-2 animate-fade-in">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.username}
                    entry={entry}
                    animated
                    delay={i * 40}
                  />
                ))
              ) : (
                <EmptyState
                  emoji="🏆"
                  title="Belum Ada Skor"
                  subtitle="Quiz belum dimulai"
                />
              )}
            </div>
          )}

          {/* ── Stats Tab ── */}
          {tab === "stats" && (
            <div className="animate-fade-in">
              <GlassCard className="p-4 mb-4" animate={false}>
                <p
                  className="text-sm font-bold mb-4"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  📊 Distribusi Jawaban - Soal{" "}
                  {activeSession.currentQuestion + 1}
                </p>

                {answerStats ? (
                  <div className="space-y-3">
                    {(["A", "B", "C", "D"] as const).map((label) => {
                      const count = answerStats[label] || 0;
                      const total = connectedParticipants.length;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      const colors = {
                        A: "var(--accent-purple)",
                        B: "var(--accent-blue)",
                        C: "var(--accent-green)",
                        D: "var(--accent-yellow)",
                      };
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                                style={{
                                  background: colors[label] + "22",
                                  color: colors[label],
                                  border: `1px solid ${colors[label]}44`,
                                }}
                              >
                                {label}
                              </div>
                              <span
                                className="text-sm font-bold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {count} peserta
                              </span>
                            </div>
                            <span
                              className="text-sm font-black"
                              style={{
                                color: colors[label],
                                fontFamily: "var(--font-score)",
                              }}
                            >
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div
                            className="rounded-full overflow-hidden"
                            style={{
                              height: 10,
                              background: "var(--bg-elevated)",
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: colors[label],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Unanswered */}
                    <div
                      className="flex items-center justify-between mt-2 pt-3"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <span
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ⏰ Belum menjawab
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: "var(--accent-red)",
                          fontFamily: "var(--font-score)",
                        }}
                      >
                        {answerStats.unanswered} peserta
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    emoji="📊"
                    title="Belum Ada Data"
                    subtitle="Data statistik muncul saat quiz berlangsung"
                  />
                )}
              </GlassCard>

              {/* Progress answered */}
              <GlassCard className="p-4" animate={false}>
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Progress Menjawab
                  </p>
                  <p
                    className="text-sm font-black"
                    style={{
                      color: "var(--accent-green)",
                      fontFamily: "var(--font-score)",
                    }}
                  >
                    {answeredCount}/{connectedParticipants.length}
                  </p>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: 12, background: "var(--bg-elevated)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        connectedParticipants.length > 0
                          ? (answeredCount / connectedParticipants.length) * 100
                          : 0
                      }%`,
                      background:
                        "linear-gradient(90deg, var(--accent-green), var(--accent-blue))",
                    }}
                  />
                </div>
              </GlassCard>
            </div>
          )}
        </>
      ) : (
        /* ── No Active Session ── */
        <EmptyState
          emoji="🎮"
          title="Tidak Ada Sesi Aktif"
          subtitle="Buat sesi baru dari menu Quiz"
          action={
            <Button onClick={() => router.push("/admin/quiz")}>
              📋 Ke Menu Quiz
            </Button>
          }
        />
      )}

      {/* ── Session History ── */}
      {sessions.filter((s) => s.status === "finished").length > 0 && (
        <div className="mt-8 animate-slide-up bg-opacity-50 pb-10">
          <SectionHeader
            title="📜 Riwayat Sesi"
            subtitle="Cari dan kelola riwayat sesi yang telah selesai"
          />
          
          <div className="flex flex-col gap-3 mb-5">
            <div className="relative group w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-purple)] transition-colors">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari Token atau Nama Sesi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-purple)] focus:bg-[rgba(255,255,255,0.06)] text-white transition-all placeholder-[var(--text-muted)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <Button 
                variant={editMode ? "primary" : "secondary"}
                onClick={() => {
                  setEditMode(!editMode);
                  setSelectedIds(new Set());
                }}
                className="flex-1 whitespace-nowrap shadow-md text-sm py-2 px-3"
              >
                {editMode ? "✕ Batal" : "✏️ Pilih Masal"}
              </Button>
              {editMode && selectedIds.size > 0 && (
                <Button 
                  variant="red" 
                  onClick={handleBulkDelete}
                  className="flex-1 whitespace-nowrap shadow-md animate-pop-in text-sm py-2 px-3"
                >
                  🗑️ Hapus ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {sessions
              .filter((s) => s.status === "finished")
              .filter((s) => {
                if (!searchTerm) return true;
                const lowerTerm = searchTerm.toLowerCase();
                return s.token.toLowerCase().includes(lowerTerm) || (s.name && s.name.toLowerCase().includes(lowerTerm));
              })
              .map((s) => (
                <div key={s._id} className="animate-fade-in relative">
                  <div
                    className="glass-card p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.05)] shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    style={{
                      borderColor: selectedFinishedId === s._id || selectedIds.has(s._id)
                        ? "var(--accent-purple)"
                        : "var(--border)",
                      background: selectedIds.has(s._id) ? "rgba(108,92,231,0.08)" : undefined,
                    }}
                    onClick={() => {
                      if (editMode) toggleSelectSession(s._id);
                      else handleViewFinishedLeaderboard(s._id);
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                      {editMode && (
                        <div 
                          className="w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all flex-shrink-0"
                          style={{
                            borderColor: selectedIds.has(s._id) ? "var(--accent-purple)" : "var(--text-muted)",
                            background: selectedIds.has(s._id) ? "var(--accent-purple)" : "transparent"
                          }}
                        >
                          {selectedIds.has(s._id) && <span className="text-white text-xs font-bold leading-none mt-0.5">✓</span>}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className="text-base font-black tracking-widest truncate"
                            style={{
                              fontFamily: "var(--font-score)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {s.token}
                          </p>
                          <Badge variant="red" className="scale-90 origin-left">Selesai</Badge>
                        </div>
                        <p
                          className="text-xs font-semibold truncate"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {s.name || "Sesi Tanpa Nama"}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <span className="opacity-80">👥</span> {s.participants?.length || 0} peserta
                        </div>
                      </div>
                    </div>
                    {!editMode && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          className="text-xs py-1.5 px-2.5 rounded-xl font-bold transition-transform active:scale-95 whitespace-nowrap"
                          style={{
                            color: selectedFinishedId === s._id ? "white" : "var(--accent-purple-light)",
                            background: selectedFinishedId === s._id ? "var(--accent-purple)" : "rgba(108,92,231,0.15)",
                          }}
                        >
                          {selectedFinishedId === s._id ? "▲ Tutup" : "🏆 Shor"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s._id);
                          }}
                          className="text-xs p-2 rounded-xl transition-all hover:bg-[rgba(255,107,107,0.2)] active:scale-95"
                          style={{
                            color: "var(--accent-red)",
                            background: "rgba(255,107,107,0.1)",
                          }}
                          title="Hapus Sesi"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Leaderboard for this finished session */}
                  {selectedFinishedId === s._id && !editMode && (
                    <div className="mt-2 mb-4 px-1 animate-slide-down">
                      {finishedLeaderboard.length > 0 ? (
                        <div className="space-y-2">
                          <p
                            className="text-[11px] uppercase tracking-wider font-extrabold px-3 py-2 mb-2 text-center rounded-xl"
                            style={{ 
                              color: "var(--accent-purple-light)", 
                              background: "rgba(108,92,231,0.1)",
                              border: "1px dashed rgba(108,92,231,0.2)"
                            }}
                          >
                            Klik peserta untuk detail statistik 👇
                          </p>
                          {finishedLeaderboard.map((entry, i) => {
                             return (
                              <div 
                                key={entry.username} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedParticipantStats(entry);
                                }}
                                className="cursor-pointer hover:scale-[1.01] transition-transform mb-2 shadow-sm rounded-2xl"
                              >
                                <LeaderboardRow
                                  entry={entry}
                                  animated
                                  delay={i * 40}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : finishedLeaderboardLoading ? (
                        <div className="text-center py-6 glass-card mt-2">
                          <div className="w-5 h-5 border-2 border-t-transparent border-[var(--accent-purple)] rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs font-semibold" style={{ color: "var(--accent-purple-light)" }}>
                            Memuat statistik...
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-6 glass-card mt-2">
                          <span className="text-3xl mb-2 block opacity-40">📭</span>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Tidak ada data leaderboard
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Participant Answer Detail Modal */}
      {selectedParticipantStats && (
        <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-md transition-all" onClick={() => setSelectedParticipantStats(null)}>
          <div 
            className="modal-card max-h-[85vh] overflow-y-auto w-full max-w-md animate-pop-in relative rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: "linear-gradient(145deg, rgba(30,30,40,0.98), rgba(20,20,30,0.98))", 
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)"
            }}
          >
            <button 
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.15)] transition-all z-10"
              onClick={() => setSelectedParticipantStats(null)}
            >✕</button>
            
            <div className="flex items-center gap-4 px-6 pt-6 pb-5 relative overflow-hidden border-b border-[rgba(255,255,255,0.05)]">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-purple)] opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <AvatarRenderer avatar={selectedParticipantStats.avatar} size={56} showAccessories animate="none" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xl truncate" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
                  {selectedParticipantStats.username}
                </h3>
                <p className="text-sm font-black mt-0.5" style={{ color: "var(--accent-purple-light)", fontFamily: "var(--font-score)" }}>
                  Total: {(selectedParticipantStats.score ?? 0).toLocaleString("id-ID")} poin
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Riwayat Jawaban</p>
              {(!selectedParticipantStats.answers || selectedParticipantStats.answers.length === 0) ? (
                <p className="text-sm text-center text-[var(--text-muted)] py-4">Siswa ini tidak menjawab soal sama sekali.</p>
              ) : (
                selectedParticipantStats.answers.map((ans, idx) => (
                  <div key={idx} className="glass-card p-3" style={{ background: ans.isCorrect ? "rgba(0,184,148,0.1)" : "rgba(255,107,107,0.1)", borderColor: ans.isCorrect ? "rgba(0,184,148,0.2)" : "rgba(255,107,107,0.2)" }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>Soal {ans.questionIndex + 1}</span>
                      <span className="text-[10px] uppercase font-bold" style={{ color: ans.isCorrect ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {ans.isCorrect ? "+ " + ans.pointsEarned + " poin" : "Salah/Waktu Habis"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                      Jawaban Siswa: <span className="font-bold" style={{ color: ans.isCorrect ? "var(--accent-green)" : "var(--accent-red)"}}>{ans.answer === "TIMEOUT" ? "Waktu Habis!" : ans.answer}</span>
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Kecepatan respons: {(ans.responseTime / 1000).toFixed(1)} detik
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}