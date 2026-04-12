"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ParticleBackground, InputField, useToast } from "@/components/UI";
import { useDuelStore } from "@/store";
import { api } from "@/lib/utils";
import { DuelQuiz } from "@/types";

export default function DuelCreatePage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { setToken, setRole, setQuizInfo, resetDuel, setUsername: setStoreUsername } = useDuelStore();

  const [username, setUsername] = useState("");
  const [quizzes, setQuizzes] = useState<DuelQuiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<DuelQuiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [usernameError, setUsernameError] = useState("");

  useEffect(() => {
    resetDuel();
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await api.get("/duel/quizzes");
      setQuizzes(res.data.data.quizzes || []);
    } catch {
      showToast("Gagal memuat daftar quiz", "error");
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const validate = () => {
    if (!username.trim()) {
      setUsernameError("Username wajib diisi");
      return false;
    }
    if (username.trim().length < 2) {
      setUsernameError("Username minimal 2 karakter");
      return false;
    }
    if (!selectedQuiz) {
      showToast("Pilih quiz terlebih dahulu!", "error");
      return false;
    }
    setUsernameError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post("/duel/create", {
        quizId: selectedQuiz!._id,
        username: username.trim(),
      });

      if (res.data.success) {
        const { token, quizTitle, totalQuestions } = res.data.data;
        setToken(token);
        setRole("creator");
        setStoreUsername(username.trim());
        setQuizInfo(quizTitle, totalQuestions);
        router.push(`/duel/lobby?token=${token}&username=${encodeURIComponent(username.trim())}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal membuat room", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex flex-col min-h-screen relative overflow-hidden bg-[#0A0A0F]">
      <ParticleBackground />
      <ToastComponent />

      <div className="absolute top-[10%] left-[30%] w-[250px] h-[250px] rounded-full blur-[120px] opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #FF4444, #FF8C00)" }} />

      <div className="flex-1 flex flex-col items-center justify-start px-5 py-8 relative z-10">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6 animate-slide-down">
            <button onClick={() => router.push("/duel")}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span className="text-base">←</span>
            </button>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: "var(--font-heading)", color: "#FF8C42" }}>
                Buat Room ⚔️
              </h1>
              <p className="text-xs opacity-50" style={{ color: "white" }}>Pilih quiz dan invite temanmu</p>
            </div>
          </div>

          {/* Username */}
          <div className="mb-5 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="p-5 rounded-2xl" style={{
              background: "rgba(19,19,26,0.7)",
              border: "1px solid rgba(255,255,255,0.06)"
            }}>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4 opacity-60" style={{ color: "white" }}>
                Username Kamu
              </h2>
              <InputField
                label=""
                placeholder="Masukkan namamu"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.slice(0, 20));
                  setUsernameError("");
                }}
                error={usernameError}
                icon={<span style={{ fontSize: 18 }}>👤</span>}
                maxLength={20}
                autoComplete="off"
                style={{ height: "52px" }}
              />
              {username && (
                <p className="text-right text-[10px] uppercase font-bold mt-1 opacity-40" style={{ color: "white" }}>
                  {username.length}/20
                </p>
              )}
            </div>
          </div>

          {/* Quiz Selection */}
          <div className="mb-6 animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <div className="p-5 rounded-2xl" style={{
              background: "rgba(19,19,26,0.7)",
              border: "1px solid rgba(255,255,255,0.06)"
            }}>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4 opacity-60" style={{ color: "white" }}>
                Pilih Quiz 📚
              </h2>

              {loadingQuizzes ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "#FF8C42", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : quizzes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-sm opacity-50" style={{ color: "white" }}>
                    Belum ada quiz yang tersedia untuk 1v1
                  </p>
                  <p className="text-xs opacity-30 mt-1" style={{ color: "white" }}>
                    Minta admin untuk mengaktifkan quiz
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                  {quizzes.map((q) => (
                    <button
                      key={q._id}
                      onClick={() => setSelectedQuiz(q)}
                      className="w-full p-3.5 rounded-xl text-left transition-all duration-200 active:scale-98"
                      style={{
                        background: selectedQuiz?._id === q._id
                          ? "rgba(255,100,50,0.2)"
                          : "rgba(255,255,255,0.03)",
                        border: selectedQuiz?._id === q._id
                          ? "1.5px solid rgba(255,100,50,0.6)"
                          : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: selectedQuiz?._id === q._id
                          ? "0 0 15px rgba(255,100,0,0.15) inset"
                          : "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {selectedQuiz?._id === q._id ? "✅" : "📝"}
                          </span>
                          <div>
                            <p className="text-sm font-bold" style={{ color: "white" }}>{q.title}</p>
                            {q.description && (
                              <p className="text-xs opacity-40 mt-0.5 line-clamp-1" style={{ color: "white" }}>
                                {q.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-bold px-2 py-1 rounded-full"
                            style={{
                              background: "rgba(255,140,66,0.15)",
                              color: "#FF8C42",
                              border: "1px solid rgba(255,140,66,0.3)"
                            }}>
                            {q.totalQuestions} soal
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create Button */}
          <button
            id="btn-create-room-submit"
            onClick={handleCreate}
            disabled={loading || !username || !selectedQuiz}
            className="w-full h-14 rounded-xl font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: loading || !username || !selectedQuiz
                ? "rgba(255,100,50,0.2)"
                : "linear-gradient(135deg, #FF4444, #FF8C00)",
              color: "white",
              boxShadow: loading || !username || !selectedQuiz
                ? "none"
                : "0 4px 20px rgba(255,100,0,0.4)",
            }}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Membuat Room...</span>
              </>
            ) : (
              <>
                <span>🏰</span>
                <span>Buat Room & Generate Kode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
