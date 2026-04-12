"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ParticleBackground,
  GlassCard,
  Button,
  InputField,
  Badge,
  SectionHeader,
  EmptyState,
  useToast,
  LoadingScreen,
} from "@/components/UI";
import { useAdminStore } from "@/store";
import { api } from "@/lib/utils";
import { Quiz, Question, Option, MatchPair } from "@/types";

type PageView = "list" | "create" | "edit";

const EMPTY_QUESTION: Question = {
  order: 1,
  text: "",
  imageUrl: null,
  duration: 20,
  answerType: "multiple_choice",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
  correctAnswer: "A",
  acceptedAnswers: [""],
  matchPairs: [
    { left: "", right: "" },
    { left: "", right: "" },
    { left: "", right: "" },
  ],
  points: 1000,
};

// ─── AI Loading Modal ──────────────────────────────────────────
interface AILoadingModalProps {
  visible: boolean;
}

const AILoadingModal = ({ visible }: AILoadingModalProps) => {
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      setElapsedSeconds(0);
      return;
    }

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // Asymptotic approach: goes fast at start, slows near 95%
        if (prev < 40) return prev + 2.5;
        if (prev < 70) return prev + 1;
        if (prev < 90) return prev + 0.3;
        if (prev < 95) return prev + 0.1;
        return prev;
      });
    }, 300);

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(timerInterval);
    };
  }, [visible]);

  if (!visible) return null;

  const displayProgress = Math.min(Math.round(progress), 95);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-5"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 animate-pop-in text-center"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(108,92,231,0.3)",
        }}
      >
        {/* Animated AI icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce-idle"
          style={{
            background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(0,206,201,0.2))",
            border: "2px solid rgba(108,92,231,0.4)",
          }}
        >
          🤖
        </div>

        <h3
          className="text-lg font-black mb-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
        >
          Oke, mulai men-generate soal...
        </h3>

        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
          ⏱️ Estimasi waktu: 7–15 detik
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Atau mungkin lebih lama tergantung bobot soal
        </p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div
            className="w-full rounded-full overflow-hidden mb-2"
            style={{ height: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${displayProgress}%`,
                background: "linear-gradient(90deg, var(--accent-purple), var(--accent-teal, #00cec9))",
                boxShadow: "0 0 8px rgba(108,92,231,0.6)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>⚡ {displayProgress}%</span>
            <span>⏳ {elapsedSeconds}s</span>
          </div>
        </div>

        {/* Bouncing dots */}
        <div className="flex items-center justify-center gap-1 mt-4">
          <p className="text-xs mr-2" style={{ color: "var(--text-muted)" }}>
            Mohon bersabar
          </p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                background: "var(--accent-purple)",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        <p className="text-xs mt-3" style={{ color: "rgba(108,92,231,0.6)", fontStyle: "italic" }}>
          AI sedang memikirkan soal-soal terbaik untukmu ✨
        </p>
      </div>
    </div>
  );
};

export default function QuizManagerPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { token: adminToken } = useAdminStore();

  const [view, setView] = useState<PageView>("list");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [uploadingImg, setUploadingImg] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [defaultDuration, setDefaultDuration] = useState(20);
  const [questions, setQuestions] = useState<Question[]>([
    { ...EMPTY_QUESTION },
  ]);
  const [activeQIdx, setActiveQIdx] = useState(0);

  // AI State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");

  // Session Modal State
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [pendingSessionQuizId, setPendingSessionQuizId] = useState<string | null>(null);
  const [sessionNameInput, setSessionNameInput] = useState("");

  const importRef = useRef<HTMLInputElement>(null);

  const handleDownloadCSVTemplate = () => {
    const csvContent = "Pertanyaan,Tipe Jawaban,Opsi A,Opsi B,Opsi C,Opsi D,Jawaban Benar,Durasi Waktu\nSiapa penemu lampu?,Pilihan Ganda,Tesla,Einstein,Edison,Newton,C,20\nIbukota negara Indonesia saat ini adalah?,Teks,,,,,Jakarta|DKI Jakarta,15\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "template_soal_quizclass.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (line: string, separator: string) => {
    const result: string[] = [];
    let currentVal = "";
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === separator && !insideQuotes) {
        result.push(currentVal);
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    result.push(currentVal);
    return result;
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(line => line.trim() !== "");
      
      if (rows.length < 2) {
        showToast("File CSV kosong atau tidak memiliki data!", "error");
        return;
      }

      const separator = rows[0].includes(";") ? ";" : ",";
      const importedQuestions: Question[] = [];
      const currentLen = questions.length;

      for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
        const cols = parseCSVLine(row, separator);
        if (cols.length < 7) continue;

        const p = cols[0]?.trim();
        const tipe = cols[1]?.trim().toLowerCase();
        const oA = cols[2]?.trim();
        const oB = cols[3]?.trim();
        const oC = cols[4]?.trim();
        const oD = cols[5]?.trim();
        const ans = cols[6]?.trim();
        const dur = cols[7]?.trim();

        const isText = tipe === "teks";
        
        importedQuestions.push({
            order: currentLen + importedQuestions.length + 1,
            text: p || "Pertanyaan tanpa teks",
            imageUrl: null,
            answerType: isText ? "text" : "multiple_choice",
            duration: parseInt(dur) || defaultDuration,
            points: 1000,
            options: [
                { label: "A", text: oA || "" },
                { label: "B", text: oB || "" },
                { label: "C", text: oC || "" },
                { label: "D", text: oD || "" },
            ],
            correctAnswer: isText ? "TEXT" : (ans.toUpperCase() || "A"),
            acceptedAnswers: isText ? ans.split("|").map((s: string) => s.trim()).filter((s: string) => s !== "") : [""],
            matchPairs: [],
        });
      }

      if (importedQuestions.length > 0) {
        setQuestions([...questions, ...importedQuestions]);
        showToast("Berhasil impor " + importedQuestions.length + " soal! 🎉", "success");
      } else {
        showToast("Tidak ada soal yang bisa diimpor. Cek format CSV.", "error");
      }
    } catch (error) {
      showToast("Gagal membaca file CSV", "error");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      showToast("Prompt tidak boleh kosong!", "error");
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      const res = await api.post("/quiz/generate", { 
        prompt: aiPrompt,
        defaultDuration: defaultDuration 
      });
      
      const newQuestions = res.data.data?.questions;
      if (!newQuestions || newQuestions.length === 0) {
        showToast("AI gagal menghasilkan soal", "error");
        return;
      }
      
      const currentLen = questions.length;
      const formattedQuestions: Question[] = newQuestions.map((q: any, i: number) => {
        if (q.answerType === "matching") {
          return {
            order: currentLen + i + 1,
            text: q.text || "Pertanyaan AI",
            imageUrl: null,
            duration: q.duration || defaultDuration,
            answerType: "matching",
            options: [],
            correctAnswer: "MATCHING",
            acceptedAnswers: [],
            matchPairs: q.matchPairs || [{ left: "", right: "" }],
            points: 1000,
          };
        }
        return {
          order: currentLen + i + 1,
          text: q.text || "Pertanyaan AI",
          imageUrl: null,
          duration: q.duration || defaultDuration,
          answerType: q.answerType === "text" ? "text" : "multiple_choice",
          options: q.answerType === "text" ? [] : (q.options || [
            { label: "A", text: "" },
            { label: "B", text: "" },
            { label: "C", text: "" },
            { label: "D", text: "" },
          ]),
          correctAnswer: q.answerType === "text" ? "TEXT" : (q.correctAnswer || "A"),
          acceptedAnswers: q.answerType === "text" ? (q.acceptedAnswers || []) : [],
          matchPairs: [],
          points: 1000,
        };
      });

      if (
        questions.length === 1 &&
        !questions[0].text.trim() &&
        questions[0].answerType === "multiple_choice" &&
        !questions[0].options.some((o) => o.text.trim())
      ) {
        setQuestions(formattedQuestions);
      } else {
        setQuestions([...questions, ...formattedQuestions]);
      }
      showToast(`Berhasil men-generate ${formattedQuestions.length} soal! ✨`, "success");
      setAIPrompt("");
      setShowAIPrompt(false);
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal generate dengan AI", "error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await api.get("/quiz");
      setQuizzes(res.data.data?.quizzes || []);
    } catch {
      showToast("Gagal memuat quiz!", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDefaultDuration(20);
    setQuestions([{ ...EMPTY_QUESTION }]);
    setActiveQIdx(0);
    setEditingQuiz(null);
  };

  // Open edit
  const openEdit = async (quiz: Quiz) => {
    setLoading(true);
    try {
      const res = await api.get(`/quiz/${quiz._id}`);
      const full: Quiz = res.data.data?.quiz;
      setEditingQuiz(full);
      setTitle(full.title);
      setDescription(full.description);
      setDefaultDuration(full.defaultDuration);
      setQuestions(
        full.questions.length > 0
          ? full.questions.map(q => ({
              ...q,
              matchPairs: q.matchPairs || [],
            }))
          : [{ ...EMPTY_QUESTION }]
      );
      setActiveQIdx(0);
      setView("edit");
    } catch {
      showToast("Gagal memuat detail quiz!", "error");
    } finally {
      setLoading(false);
    }
  };

  // Save quiz
  const handleSave = async () => {
    if (!title.trim()) {
      showToast("Judul quiz wajib diisi!", "error");
      return;
    }

    // Validasi soal
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        showToast(`Teks soal ${i + 1} wajib diisi!`, "error");
        setActiveQIdx(i);
        return;
      }
      if (q.answerType === "multiple_choice") {
        for (const opt of q.options) {
          if (!opt.text.trim()) {
            showToast(`Pilihan ${opt.label} soal ${i + 1} wajib diisi!`, "error");
            setActiveQIdx(i);
            return;
          }
        }
      } else if (q.answerType === "text") {
        const validAnswers = (q.acceptedAnswers || []).filter((a) => a.trim());
        if (validAnswers.length === 0) {
          showToast(`Soal ${i + 1}: minimal 1 jawaban teks harus diisi!`, "error");
          setActiveQIdx(i);
          return;
        }
      } else if (q.answerType === "matching") {
        const validPairs = (q.matchPairs || []).filter(p => p.left.trim() && p.right.trim());
        if (validPairs.length < 2) {
          showToast(`Soal penjodohan ${i + 1}: minimal 2 pasangan harus diisi!`, "error");
          setActiveQIdx(i);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        defaultDuration,
        questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
      };

      if (view === "edit" && editingQuiz) {
        await api.put(`/quiz/${editingQuiz._id}`, payload);
        showToast("Quiz berhasil diperbarui! ✅", "success");
      } else {
        await api.post("/quiz", payload);
        showToast("Quiz berhasil dibuat! 🎉", "success");
      }

      await fetchQuizzes();
      resetForm();
      setView("list");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal menyimpan quiz!", "error");
    } finally {
      setSaving(false);
    }
  };

  // Delete quiz
  const handleDelete = async (quizId: string) => {
    if (!confirm("Yakin mau menghapus quiz ini?")) return;
    try {
      await api.delete(`/quiz/${quizId}`);
      showToast("Quiz dihapus!", "success");
      await fetchQuizzes();
    } catch {
      showToast("Gagal menghapus quiz!", "error");
    }
  };

  // Create session
  // Create session
  const openSessionModal = (quizId: string) => {
    setPendingSessionQuizId(quizId);
    setSessionNameInput("");
    setShowSessionModal(true);
  };

  const handleCreateSessionSubmit = async () => {
    if (!pendingSessionQuizId) return;

    try {
      const res = await api.post("/session/create", { 
        quizId: pendingSessionQuizId, 
        name: sessionNameInput.trim() 
      });
      const session = res.data.data?.session;
      showToast(`Sesi dibuat! Token: ${session.token} 🎫`, "success");
      setShowSessionModal(false);
      router.push("/admin/session");
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Gagal membuat sesi!",
        "error"
      );
    }
  };

  // Add question
  const addQuestion = () => {
    const newQ: Question = {
      ...EMPTY_QUESTION,
      order: questions.length + 1,
    };
    setQuestions([...questions, newQ]);
    setActiveQIdx(questions.length);
  };

  // Remove question
  const removeQuestion = (idx: number) => {
    if (questions.length === 1) {
      showToast("Minimal harus ada 1 soal!", "error");
      return;
    }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveQIdx(Math.min(activeQIdx, updated.length - 1));
  };

  // Update question field
  const updateQuestion = (
    idx: number,
    field: keyof Question,
    value: any
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  // Update multiple question fields atomically
  const updateQuestionMulti = (idx: number, updates: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  };

  // Update option
  const updateOption = (qIdx: number, optLabel: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((opt) =>
                opt.label === optLabel ? { ...opt, text } : opt
              ),
            }
          : q
      )
    );
  };

  // Update match pair
  const updateMatchPair = (qIdx: number, pairIdx: number, side: "left" | "right", value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const pairs = [...(q.matchPairs || [])];
        pairs[pairIdx] = { ...pairs[pairIdx], [side]: value };
        return { ...q, matchPairs: pairs };
      })
    );
  };

  const addMatchPair = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, matchPairs: [...(q.matchPairs || []), { left: "", right: "" }] }
          : q
      )
    );
  };

  const removeMatchPair = (qIdx: number, pairIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, matchPairs: (q.matchPairs || []).filter((_, pi) => pi !== pairIdx) }
          : q
      )
    );
  };

  // Upload image
  const handleImageUpload = async (
    qIdx: number,
    file: File
  ) => {
    setUploadingImg(qIdx);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/quiz/upload-image", formData);
      const imageUrl = res.data.data?.imageUrl;
      if (!imageUrl) {
        showToast("Upload berhasil tapi URL gambar tidak diterima!", "error");
        return;
      }
      updateQuestion(qIdx, "imageUrl", imageUrl);
      showToast("Gambar berhasil diupload! 🖼️", "success");
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Gagal upload gambar!";
      showToast(errMsg, "error");
    } finally {
      setUploadingImg(null);
    }
  };

  if (loading && view === "list") return <LoadingScreen message="Memuat quiz..." />;

  const activeQuestion = questions[activeQIdx];

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className="min-h-screen px-5 py-6 relative z-10 max-w-md mx-auto">
        <ParticleBackground />
        <ToastComponent />

        <SectionHeader
          title="📋 Kelola Quiz"
          subtitle={`${quizzes.length} quiz tersedia`}
          right={
            <Button
              onClick={() => { resetForm(); setView("create"); }}
              className="!w-auto px-4 py-2 text-sm"
            >
              + Buat Quiz
            </Button>
          }
        />

        {quizzes.length === 0 ? (
          <EmptyState
            emoji="📝"
            title="Belum Ada Quiz"
            subtitle="Buat quiz pertamamu sekarang!"
            action={
              <Button onClick={() => { resetForm(); setView("create"); }}>
                + Buat Quiz Baru
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz, i) => (
              <GlassCard
                key={quiz._id}
                className="p-4 animate-slide-up"
                animate={false}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-extrabold truncate"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                        fontSize: 15,
                      }}
                    >
                      {quiz.title}
                    </p>
                    {quiz.description && (
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {quiz.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mb-3 flex-wrap">
                  <Badge variant="purple">
                    📝 {quiz.totalQuestions} soal
                  </Badge>
                  <Badge variant="yellow">
                    ⏱️ {quiz.defaultDuration}s
                  </Badge>
                  {(quiz as any).allow1v1 && (
                    <Badge variant="yellow">⚔️ 1v1</Badge>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => openSessionModal(quiz._id)}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: "rgba(0,184,148,0.12)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(0,184,148,0.25)",
                    }}
                  >
                    🚀 Mulai Sesi
                  </button>
                  <button
                    onClick={() => openEdit(quiz)}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: "rgba(108,92,231,0.12)",
                      color: "var(--accent-purple-light)",
                      border: "1px solid rgba(108,92,231,0.25)",
                    }}
                  >
                    ✏️ Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await api.patch(`/quiz/${quiz._id}/toggle-1v1`);
                        await fetchQuizzes();
                        showToast((quiz as any).allow1v1 ? "Mode 1v1 dinonaktifkan" : "Mode 1v1 diaktifkan! ⚔️", "success");
                      } catch {
                        showToast("Gagal toggle mode 1v1", "error");
                      }
                    }}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: (quiz as any).allow1v1 ? "rgba(255,140,66,0.15)" : "rgba(255,255,255,0.04)",
                      color: (quiz as any).allow1v1 ? "#FF8C42" : "rgba(255,255,255,0.3)",
                      border: `1px solid ${(quiz as any).allow1v1 ? "rgba(255,140,66,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {(quiz as any).allow1v1 ? "⚔️ 1v1: ON" : "⚔️ 1v1: OFF"}
                  </button>
                  <button
                    onClick={() => handleDelete(quiz._id)}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: "rgba(255,107,107,0.1)",
                      color: "var(--accent-red)",
                      border: "1px solid rgba(255,107,107,0.2)",
                    }}
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Modal Buka Sesi */}
        {showSessionModal && (
          <div 
            className="modal-overlay z-50 p-4 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm fixed inset-0"
            onClick={() => setShowSessionModal(false)}
          >
            <div 
              className="modal-card w-full max-w-sm animate-pop-in relative p-6 rounded-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex flex-col items-center mb-5 mt-2">
                <span className="text-4xl mb-3">🚀</span>
                <h3 className="font-bold text-xl text-center" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
                  Mulai Sesi Baru
                </h3>
                <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)", maxWidth: 250 }}>
                  Namai sesi ini agar mudah dikenali di riwayat nilai nantinya. (Opsional)
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold mb-2 ml-1" style={{ color: "var(--text-secondary)" }}>
                    Nama/Identitas Kelas
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kelas 10A RPL - Ujian Akhir"
                    value={sessionNameInput}
                    onChange={(e) => setSessionNameInput(e.target.value)}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-purple)] text-white transition-all placeholder-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowSessionModal(false)} className="flex-1">
                  Batal
                </Button>
                <Button variant="primary" onClick={handleCreateSessionSubmit} className="flex-1">
                  Luncurkan!
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── CREATE / EDIT VIEW ──
  return (
    <div className="min-h-screen px-4 md:px-6 py-8 relative z-10 w-full max-w-2xl mx-auto flex flex-col gap-6 font-sans">
      <ParticleBackground />
      <ToastComponent />

      {/* AI Loading Modal */}
      <AILoadingModal visible={isGeneratingAI} />

      {/* Header Sticky-ish */}
      <div className="flex flex-row items-center justify-between gap-3 animate-slide-down relative z-30 bg-[rgba(19,19,26,0.95)] backdrop-blur-3xl p-3 md:p-4 rounded-3xl border border-[rgba(255,255,255,0.08)] shadow-[0_15px_40px_rgba(0,0,0,0.6)] mb-2 md:sticky md:top-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => { resetForm(); setView("list"); }}
            className="w-10 h-10 flex-shrink-0 rounded-[14px] flex items-center justify-center transition-transform active:scale-95"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            ←
          </button>
          <div className="flex flex-col min-w-0">
            <h1
              className="text-lg md:text-xl font-black bg-gradient-to-r from-white to-[var(--accent-purple-light)] bg-clip-text text-transparent truncate leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {view === "create" ? "Buat Quiz" : "Edit Quiz"}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-[var(--accent-purple-light)] truncate mt-0.5">
              {questions.length} Soal
            </p>
          </div>
        </div>
        
        <button 
           onClick={handleSave} 
           disabled={saving}
           className="flex-shrink-0 px-4 py-2.5 rounded-[14px] text-xs font-black text-white shadow-[0_4px_15px_rgba(108,92,231,0.4)] hover:shadow-[0_6px_25px_rgba(108,92,231,0.6)] active:scale-95 transition-all flex items-center justify-center"
           style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
        >
          {saving ? "⏳..." : (view === "create" ? "Simpan" : "Update")}
        </button>
      </div>

      {/* Quick Action Pills */}
      <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <button
          onClick={() => setShowAIPrompt(!showAIPrompt)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
             showAIPrompt 
             ? "bg-[rgba(108,92,231,0.2)] text-[var(--accent-purple-light)] border-[var(--accent-purple)] shadow-[0_0_15px_rgba(108,92,231,0.4)]" 
             : "bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
          }`}
        >
          <span className={`${showAIPrompt ? "animate-pulse" : ""}`}>✨</span> AI Generator
        </button>
        
        <input type="file" accept=".csv" className="hidden" ref={importRef} onChange={handleImportCSV} />
        
        <button
          onClick={() => importRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
        >
          📥 Import CSV
        </button>
        
        <button
          onClick={handleDownloadCSVTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
        >
          🧾 Template
        </button>
      </div>

      {/* AI Panel Expansion */}
      {showAIPrompt && (
        <div className="relative animate-slide-down">
          {/* Neon Border Glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-blue)] rounded-3xl opacity-50 blur-[4px] animate-pulse-glow" />
          <div className="relative bg-[rgba(19,19,26,0.9)] backdrop-blur-2xl p-5 rounded-3xl border border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-blue)] flex items-center justify-center text-sm shadow-[0_0_15px_rgba(108,92,231,0.5)] animate-bounce-idle">🤖</div>
              <div>
                <p className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>Sihir AI Generator</p>
                <p className="text-[10px] text-[var(--text-muted)]">Ketik topik & biarkan AI membuat soal untukmu.</p>
              </div>
            </div>
            
            <textarea
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)] focus:bg-[rgba(108,92,231,0.05)] transition-all resize-none shadow-inner"
              rows={3}
              placeholder="Cth: Buatkan 5 soal IPA Kelas 8 tentang Tata Surya beserta opsi dan jawaban benar..."
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              style={{ fontFamily: "var(--font-body)" }}
            />
            
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAIPrompt(false)} className="flex-1 py-3 text-xs font-bold text-[var(--text-muted)] hover:text-white transition-colors bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.05)]">Batal</button>
              <button 
                onClick={handleGenerateAI} 
                disabled={isGeneratingAI} 
                className="flex-[2] py-3 text-xs font-extrabold text-white rounded-xl shadow-[0_4px_15px_rgba(0,184,148,0.4)] hover:shadow-[0_6px_25px_rgba(0,184,148,0.6)] transition-all overflow-hidden relative group"
                style={{ background: "linear-gradient(135deg, #00B894, #00cec9)" }}
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                ✨ Hasilkan Soal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Details Card */}
      <div className="bg-[rgba(19,19,26,0.5)] backdrop-blur-xl p-6 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden animate-slide-up" style={{ animationDelay: "0.2s" }}>
        {/* Subtle decorative glow inside card */}
        <div className="absolute -top-[50px] -right-[50px] w-32 h-32 bg-[var(--accent-purple)] opacity-20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-5">
          <span className="p-2 bg-[rgba(255,255,255,0.05)] rounded-xl text-lg">📝</span>
          <h2 className="text-base font-extrabold text-white tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>Informasi Utama</h2>
        </div>

        <div className="space-y-4 relative z-10">
          <InputField
            placeholder="Judul Quiz (Cth: Mid-Semester IPA)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "16px" }}
          />
          <InputField
            placeholder="Deskripsi singkat (Opsional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "16px" }}
          />
          
          <div className="bg-[rgba(0,0,0,0.2)] p-4 rounded-2xl border border-[rgba(255,255,255,0.02)] mt-2">
            <label className="flex items-center justify-between text-xs font-bold mb-3 text-[var(--text-secondary)]">
              <span>⏱️ Default Durasi Menjawab</span>
              <span className="bg-[var(--accent-purple)] px-3 py-1 rounded-full text-white shadow-[0_0_10px_rgba(108,92,231,0.4)]">{defaultDuration} Detik</span>
            </label>
            <div className="relative pt-1">
              <input
                type="range"
                min={5} max={120} step={5}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                style={{
                  background: `linear-gradient(90deg, var(--accent-purple) ${(defaultDuration - 5) / (120 - 5) * 100}%, rgba(255,255,255,0.1) ${(defaultDuration - 5) / (120 - 5) * 100}%)`
                }}
              />
              <style jsx>{`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: white;
                  box-shadow: 0 0 10px rgba(108,92,231,0.8);
                  cursor: pointer;
                }
              `}</style>
            </div>
          </div>
        </div>
      </div>

      {/* Ribbon Pills Navigation for Questions */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar -mx-4 md:mx-0 px-4 md:px-0 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        {questions.map((_, i) => {
          const isActive = activeQIdx === i;
          return (
            <button
              key={i}
              onClick={() => setActiveQIdx(i)}
              className={`relative flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 ${
                isActive 
                ? "text-white shadow-[0_8px_20px_rgba(108,92,231,0.4)] -translate-y-1" 
                : "bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white border border-[rgba(255,255,255,0.05)]"
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-purple-dark)] rounded-2xl border border-[rgba(255,255,255,0.2)] -z-10" />
              )}
              Soal {i + 1}
            </button>
          );
        })}
        <button
          onClick={addQuestion}
          className="flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-extrabold border border-dashed border-[var(--accent-green)] text-[var(--accent-green)] hover:bg-[rgba(0,184,148,0.1)] transition-all flex items-center justify-center gap-1 hover:-translate-y-1"
        >
          <span className="text-lg leading-none">+</span> Tambah
        </button>
      </div>

      {/* Editor Soal (Question Editor) */}
      {activeQuestion && (
        <div key={activeQIdx} className="bg-[rgba(19,19,26,0.6)] backdrop-blur-2xl p-6 rounded-[32px] border border-[rgba(255,255,255,0.08)] shadow-[0_15px_50px_rgba(0,0,0,0.5)] animate-fade-in relative">
          
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
            <h3 className="text-lg font-black text-white flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <span className="bg-[var(--accent-purple)] text-white w-8 h-8 flex items-center justify-center rounded-xl text-sm shadow-[0_4px_10px_rgba(108,92,231,0.5)]">{activeQIdx + 1}</span>
              Desain Soal
            </h3>
            {questions.length > 1 && (
              <button
                onClick={() => removeQuestion(activeQIdx)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-[var(--accent-red)] bg-[rgba(255,107,107,0.1)] hover:bg-[rgba(255,107,107,0.2)] transition-colors border border-[rgba(255,107,107,0.2)] flex items-center gap-1.5"
              >
                <span>🗑️</span> Hapus
              </button>
            )}
          </div>

          <div className="space-y-6">
            
            {/* Teks Soal */}
            <div>
              <label className="block text-xs font-bold mb-2 ml-1 text-[var(--text-secondary)] uppercase tracking-wider">
                Pertanyaan Utama
              </label>
              <textarea
                className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-[20px] p-5 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)] focus:bg-[rgba(108,92,231,0.05)] transition-all resize-none shadow-inner leading-relaxed"
                rows={4}
                placeholder="Menurut kamu, apa itu ruang angkasa?..."
                value={activeQuestion.text}
                onChange={(e) => updateQuestion(activeQIdx, "text", e.target.value)}
              />
            </div>

            {/* Durasi & Gambar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Durasi Individual */}
               <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-3xl border border-[rgba(255,255,255,0.03)] flex flex-col justify-center">
                  <label className="flex items-center justify-between text-xs font-bold mb-3 text-[var(--text-secondary)]">
                    <span>⏱️ Durasi Khusus</span>
                    <span className="text-[var(--accent-blue)]">{activeQuestion.duration}s</span>
                  </label>
                  <div className="relative pt-1">
                    <input
                      type="range" min={5} max={120} step={5}
                      value={activeQuestion.duration}
                      onChange={(e) => updateQuestion(activeQIdx, "duration", Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                      style={{
                        background: `linear-gradient(90deg, var(--accent-blue) ${(activeQuestion.duration - 5) / (120 - 5) * 100}%, rgba(255,255,255,0.1) ${(activeQuestion.duration - 5) / (120 - 5) * 100}%)`
                      }}
                    />
                  </div>
               </div>

               {/* Sisipkan Gambar */}
               <div className="bg-[rgba(255,255,255,0.02)] p-3 rounded-3xl border border-[rgba(255,255,255,0.03)] h-full min-h-[100px] flex items-center justify-center relative overflow-hidden group">
                  {activeQuestion.imageUrl ? (
                    <div className="relative w-full h-full min-h-[100px] rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeQuestion.imageUrl} alt="Lampiran" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => updateQuestion(activeQIdx, "imageUrl", null)}
                          className="bg-[var(--accent-red)] text-white w-10 h-10 rounded-full flex items-center justify-center text-sm shadow-xl transform scale-75 group-hover:scale-100 transition-transform"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer py-4 opacity-70 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-lg mb-2 border border-[rgba(255,255,255,0.1)]">📷</div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                        {uploadingImg === activeQIdx ? "Mengupload..." : "Tambah Gambar"}
                      </span>
                      <input
                        type="file" accept="image/*" className="hidden"
                        disabled={uploadingImg !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(activeQIdx, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
               </div>
            </div>

            {/* Segmented Control: Tipe Jawaban */}
            <div className="pt-2">
              <label className="block text-xs font-bold mb-3 ml-1 text-[var(--text-secondary)] uppercase tracking-wider">
                Mode Jawaban
              </label>
              <div className="bg-[rgba(0,0,0,0.4)] p-1.5 rounded-2xl flex relative overflow-hidden border border-[rgba(255,255,255,0.05)] shadow-inner">
                {[
                  { type: "multiple_choice", icon: "🔘", label: "Opsi" },
                  { type: "text", icon: "✏️", label: "Teks" },
                  { type: "matching", icon: "🔗", label: "Jodoh" },
                ].map(({ type, icon, label }) => {
                  const isActive = activeQuestion.answerType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (isActive) return;
                        if (type === "multiple_choice") {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "multiple_choice",
                            correctAnswer: "A",
                            options: [
                              { label: "A", text: "" }, { label: "B", text: "" },
                              { label: "C", text: "" }, { label: "D", text: "" },
                            ],
                            matchPairs: [],
                          });
                        } else if (type === "text") {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "text", correctAnswer: "TEXT", options: [],
                            acceptedAnswers: activeQuestion.acceptedAnswers?.length ? activeQuestion.acceptedAnswers : [""], matchPairs: [],
                          });
                        } else {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "matching", correctAnswer: "MATCHING", options: [],
                            matchPairs: activeQuestion.matchPairs?.length ? activeQuestion.matchPairs : [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
                          });
                        }
                      }}
                      className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-xl text-xs font-bold z-10 transition-colors duration-300 ${
                        isActive ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                      style={isActive ? { background: "linear-gradient(135deg, rgba(108,92,231,0.8), rgba(90,75,209,0.9))", boxShadow: "0 4px 15px rgba(108,92,231,0.3)" } : {}}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Answer Fields */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] rounded-[24px] p-5 shadow-inner mt-4">
              
              {/* Opsi Pilihan Ganda */}
              {activeQuestion.answerType === "multiple_choice" && (
                <div className="space-y-3 animate-fade-in">
                  <p className="text-[10px] font-bold text-[var(--accent-green)] mb-4 bg-[rgba(0,184,148,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Tap Huruf untuk set kunci jawaban</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeQuestion.options.map((opt) => {
                      const isCorrect = activeQuestion.correctAnswer === opt.label;
                      return (
                        <div key={opt.label} className={`flex items-stretch rounded-2xl overflow-hidden border transition-all duration-300 ${isCorrect ? "border-[var(--accent-green)] shadow-[0_0_15px_rgba(0,184,148,0.15)] ring-1 ring-[var(--accent-green)]" : "border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:border-[rgba(255,255,255,0.1)]"}`}>
                          <button
                            onClick={() => updateQuestion(activeQIdx, "correctAnswer", opt.label)}
                            className={`w-12 flex items-center justify-center font-black text-sm transition-colors ${
                              isCorrect 
                              ? "bg-[var(--accent-green)] text-white" 
                              : "bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"
                            }`}
                          >
                            {isCorrect ? "✓" : opt.label}
                          </button>
                          <input
                            className="w-full bg-transparent p-3 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none"
                            placeholder={`Ketikan Opsi ${opt.label}...`}
                            value={opt.text}
                            onChange={(e) => updateOption(activeQIdx, opt.label, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Teks Terbuka */}
              {activeQuestion.answerType === "text" && (
                <div className="space-y-3 animate-fade-in">
                   <p className="text-[10px] font-bold text-[var(--accent-purple-light)] mb-4 bg-[rgba(108,92,231,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Variasi Jawaban Benar</p>
                  {(activeQuestion.acceptedAnswers || [""]).map((ans, ansIdx) => (
                    <div key={ansIdx} className="flex items-center gap-2">
                      <div className="w-10 h-10 flex-shrink-0 bg-[rgba(255,255,255,0.05)] flex items-center justify-center rounded-xl text-xs font-black text-[var(--accent-purple-light)] border border-[rgba(255,255,255,0.05)]">{ansIdx + 1}</div>
                      <input
                        className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[var(--accent-purple)]"
                        placeholder={`Matahari / Bintang / Mata hari`}
                        value={ans}
                        onChange={(e) => {
                          const updated = [...(activeQuestion.acceptedAnswers || [])];
                          updated[ansIdx] = e.target.value;
                          updateQuestion(activeQIdx, "acceptedAnswers", updated);
                        }}
                      />
                      {(activeQuestion.acceptedAnswers || []).length > 1 && (
                        <button
                          onClick={() => {
                            const updated = (activeQuestion.acceptedAnswers || []).filter((_, i) => i !== ansIdx);
                            updateQuestion(activeQIdx, "acceptedAnswers", updated);
                          }}
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[rgba(255,107,107,0.1)] text-[var(--accent-red)] hover:bg-[rgba(255,107,107,0.2)] transition-colors"
                        >✕</button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const updated = [...(activeQuestion.acceptedAnswers || []), ""];
                      updateQuestion(activeQIdx, "acceptedAnswers", updated);
                    }}
                    className="w-full mt-3 py-3 rounded-xl border border-dashed border-[var(--accent-purple)] text-[var(--accent-purple-light)] hover:bg-[rgba(108,92,231,0.1)] text-xs font-bold transition-all"
                  >+ Tambah Variasi</button>
                </div>
              )}

              {/* Penjodohan */}
              {activeQuestion.answerType === "matching" && (
                <div className="space-y-3 animate-fade-in relative">
                  <p className="text-[10px] font-bold text-[var(--accent-teal, #00cec9)] mb-4 bg-[rgba(0,206,201,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Pasangkan Baris Kiri & Kanan</p>
                  
                  {/* Visual Connection Guide Background Line */}
                  <div className="absolute left-1/2 top-11 bottom-14 w-[1px] bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.1)] to-transparent pointer-events-none hidden md:block" />

                  {(activeQuestion.matchPairs || []).map((pair, pairIdx) => (
                    <div key={pairIdx} className="flex flex-col md:flex-row items-center gap-2 md:gap-4 relative z-10">
                      <div className="flex-1 w-full relative">
                        <input
                          className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[var(--accent-blue)]"
                          placeholder="Premis Kiri..."
                          value={pair.left}
                          onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "left", e.target.value)}
                        />
                      </div>
                      
                      {/* Connection node / Delete button */}
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] group transition-all hover:border-[var(--accent-red)] hover:bg-[rgba(255,107,107,0.1)] cursor-pointer" onClick={() => {(activeQuestion.matchPairs || []).length > 2 && removeMatchPair(activeQIdx, pairIdx)}}>
                         <span className="text-[10px] text-[var(--text-muted)] group-hover:hidden">{(activeQuestion.matchPairs || []).length > 2 ? "↔" : "🔗"}</span>
                         <span className="text-[10px] text-[var(--accent-red)] hidden group-hover:block w-full h-full flex items-center justify-center">✕</span>
                      </div>
                      
                      <div className="flex-1 w-full">
                        <input
                          className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[var(--accent-purple)]"
                          placeholder="Jawaban Kanan..."
                          value={pair.right}
                          onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "right", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addMatchPair(activeQIdx)}
                    className="w-full mt-4 py-3 rounded-xl border border-dashed border-[var(--text-muted)] text-[var(--text-secondary)] hover:border-white hover:text-white text-xs font-bold transition-all bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]"
                  >+ Tambah Pasangan</button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* spacer bottom untuk navigasi mobile */}
      <div className="h-10"></div>

    </div>
  );
}