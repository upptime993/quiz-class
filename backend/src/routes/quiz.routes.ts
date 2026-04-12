import { Router, Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { Readable } from "stream";
import Quiz from "../models/Quiz.model";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// ─── Cloudinary Config ────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer (pakai memory storage, bukan disk) ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880") },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const isValid = allowed.test(file.mimetype);
    if (isValid) cb(null, true);
    else cb(new Error("Hanya file gambar yang diizinkan!"));
  },
});

// Helper: upload buffer ke Cloudinary
const uploadToCloudinary = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "quizclass" },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
};

// ─── Gemini API Fallback Helper ───────────────────────────────
const getGeminiApiKeys = (): string[] => {
  const keys: string[] = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
  return keys;
};

const callGeminiWithFallback = async (
  systemInstruction: string
): Promise<string> => {
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("Tidak ada GEMINI_API_KEY yang dikonfigurasi di server. Tambahkan GEMINI_API_KEY ke environment variables.");
  }

  let lastError: Error = new Error("Unknown error");

  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[i];
    const keyLabel = i === 0 ? "utama" : `ke-${i + 1}`;

    try {
      console.log(`🤖 Mencoba Gemini API key ${keyLabel}...`);

      const fetchRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemInstruction }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.7,
            }
          }),
        }
      );

      if (!fetchRes.ok) {
        let errText = "Unknown error";
        try {
          const errData = await fetchRes.json();
          errText = JSON.stringify(errData);
        } catch {
          errText = await fetchRes.text().catch(() => "");
        }

        // If rate limited or quota error, try next key
        if (fetchRes.status === 429 || fetchRes.status === 503 || fetchRes.status === 400) {
          console.warn(`⚠️ Gemini API key ${keyLabel} gagal (${fetchRes.status}), mencoba key berikutnya...`);
          lastError = new Error(`Gemini API key ${keyLabel} gagal (${fetchRes.status}): ${errText}`);
          continue;
        }

        throw new Error(`Gagal menghubungi Google Gemini API (${fetchRes.status}): ${errText}`);
      }

      const data: any = await fetchRes.json();
      const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOut) {
        lastError = new Error(`Respon AI key ${keyLabel} kosong`);
        continue;
      }

      console.log(`✅ Gemini API key ${keyLabel} berhasil!`);
      return textOut;

    } catch (error: any) {
      // Network error or other — try next key
      console.warn(`⚠️ Gemini API key ${keyLabel} error:`, error.message);
      lastError = error;

      // If it's not a retriable error, rethrow immediately
      if (!error.message.includes("gagal") && !error.message.includes("limit") && !error.message.includes("quota")) {
        // Only continue if it's a rate limit scenario
        if (i < apiKeys.length - 1) continue;
      }
    }
  }

  throw new Error(`Semua API key Gemini gagal. Error terakhir: ${lastError.message}`);
};

// ─── GET /api/quiz ────────────────────────────────────────────
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const quizzes = await Quiz.find({ adminId: (req as any).adminId })
      .select("-questions")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { quizzes } });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/quiz/upload-image ─────────────────────────────
// IMPORTANT: Must be declared BEFORE /:id to avoid route conflicts
router.post(
  "/upload-image",
  authMiddleware,
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    // Check Cloudinary environment config
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      res.status(500).json({
        success: false,
        message: "Konfigurasi Cloudinary belum diatur di server. Tambahkan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ke environment variables.",
      });
      return;
    }

    try {
      const imageUrl = await uploadToCloudinary(req.file.buffer);
      res.json({
        success: true,
        message: "Gambar berhasil diupload!",
        data: { imageUrl },
      });
    } catch (error: any) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Gagal upload ke Cloudinary. Periksa konfigurasi Cloudinary.",
      });
    }
  }
);

// ─── POST /api/quiz/generate ──────────────────────────────────
router.post("/generate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prompt, defaultDuration } = req.body;
    if (!prompt) {
      res.status(400).json({ success: false, message: "Prompt tidak boleh kosong" });
      return;
    }

    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      res.status(500).json({ success: false, message: "GEMINI_API_KEY belum dikonfigurasi di server. Tambahkan minimal 1 API key." });
      return;
    }

    const systemInstruction = `Anda adalah generator kuis edukasi. Hasilkan murni array JSON tanpa teks pengantar, tanpa markdown block.
Kunci objek HARUS:
- "text": (string) teks pertanyaan
- "answerType": (string) "multiple_choice", "text", atau "matching"
- "duration": (number) durasi soal dalam detik (selalu set ${defaultDuration || 20})
- "options": (array of objects) HARUS jika "multiple_choice", format: [{"label":"A","text":"..."}, {"label":"B","text":"..."}, {"label":"C","text":"..."}, {"label":"D","text":"..."}]. Kosongkan array jika answerType "text" atau "matching".
- "correctAnswer": (string) "A", "B", "C", atau "D" untuk multiple_choice. "TEXT" jika answerType "text". "MATCHING" jika answerType "matching".
- "acceptedAnswers": (array of strings) Untuk answerType "text", daftar variasi string jawaban benar huruf kecil. Kosongkan array jika "multiple_choice" atau "matching".
- "matchPairs": (array of objects) HARUS jika answerType "matching", format: [{"left":"...", "right":"..."}]. Minimal 3 pasang. Kosongkan array jika bukan matching.

Generate soal kuis berdasarkan: ${prompt}`;

    const textOut = await callGeminiWithFallback(systemInstruction);

    let cleanedText = textOut.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    if (!Array.isArray(parsed)) {
      throw new Error("Respon bukan array");
    }

    res.json({ success: true, data: { questions: parsed } });
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    res.status(500).json({ success: false, message: error.message || "Gagal meng-generate soal" });
  }
});

// ─── GET /api/quiz/api-keys-status ───────────────────────────
router.get("/api-keys-status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const keys = getGeminiApiKeys();
    res.json({
      success: true,
      data: {
        totalKeys: keys.length,
        keys: keys.map((_, i) => ({
          index: i + 1,
          label: i === 0 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i + 1}`,
          configured: true,
        }))
      }
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/quiz/:id ────────────────────────────────────────
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      adminId: (req as any).adminId,
    });

    if (!quiz) {
      res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
      return;
    }

    res.json({ success: true, data: { quiz } });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Helper: Normalisasi format soal dari format lama ────────
// Format lama (dari input manual): { A: "...", B: "...", C: "...", D: "...", correct: "A" }
// Format baru (schema): { options: [{label: "A", text: "..."}], correctAnswer: "A" }
const normalizeQuestions = (questions: any[]): any[] => {
  if (!Array.isArray(questions)) return [];

  // Helper: bersihkan matchPairs dari entry yang tidak valid
  const sanitizeMatchPairs = (pairs: any[], answerType: string): any[] => {
    // Jika bukan matching type, SELALU kosongkan matchPairs
    if (answerType !== "matching") return [];
    if (!Array.isArray(pairs)) return [];
    // Filter hanya pasangan yang punya left AND right yang valid
    return pairs.filter(
      (p: any) => p && typeof p.left === "string" && p.left.trim() !== "" &&
                   typeof p.right === "string" && p.right.trim() !== ""
    );
  };

  return questions.map((q: any, index: number) => {
    // Jika sudah format baru (ada options array), return dengan sanitasi
    if (Array.isArray(q.options) && q.options.length > 0 && q.correctAnswer !== undefined) {
      const answerType = q.answerType || "multiple_choice";
      return {
        order: q.order || index + 1,
        text: q.text || "",
        imageUrl: q.imageUrl || null,
        duration: q.duration || 20,
        answerType,
        options: answerType === "text" || answerType === "matching" ? [] : q.options,
        correctAnswer: q.correctAnswer,
        acceptedAnswers: q.acceptedAnswers || [],
        matchPairs: sanitizeMatchPairs(q.matchPairs || [], answerType),
        points: q.points || 1000,
      };
    }

    // Deteksi format lama: ada key A, B, C, D dan correct
    if ((q.A !== undefined || q.B !== undefined) && (q.correct !== undefined || q.correctAnswer !== undefined)) {
      const correctLabel = (q.correct || q.correctAnswer || "A").toUpperCase();
      const options = [
        { label: "A", text: q.A || q.a || "" },
        { label: "B", text: q.B || q.b || "" },
        { label: "C", text: q.C || q.c || "" },
        { label: "D", text: q.D || q.d || "" },
      ].filter((opt) => opt.text.trim() !== "");

      // Pastikan ada minimal 4 opsi — isi yang kosong jika kurang
      while (options.length < 4) {
        const labels = ["A", "B", "C", "D"];
        const existingLabels = options.map((o) => o.label);
        const missing = labels.find((l) => !existingLabels.includes(l));
        if (missing) options.push({ label: missing, text: "(kosong)" });
        else break;
      }

      return {
        order: q.order || index + 1,
        text: q.text || q.question || "",
        imageUrl: q.imageUrl || null,
        duration: q.duration || 20,
        answerType: "multiple_choice",
        options,
        correctAnswer: correctLabel,
        acceptedAnswers: [],
        matchPairs: [],
        points: q.points || 1000,
      };
    }

    // Fallback: return dengan sanitasi
    const answerType = q.answerType || "multiple_choice";
    return {
      order: q.order || index + 1,
      text: q.text || "",
      imageUrl: q.imageUrl || null,
      duration: q.duration || 20,
      answerType,
      options: answerType === "text" || answerType === "matching" ? [] : (q.options || []),
      correctAnswer: q.correctAnswer || "A",
      acceptedAnswers: q.acceptedAnswers || [],
      matchPairs: sanitizeMatchPairs(q.matchPairs || [], answerType),
      points: q.points || 1000,
    };
  });
};

// ─── POST /api/quiz ───────────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, description, defaultDuration, questions } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: "Judul quiz wajib diisi" });
      return;
    }

    // Normalisasi format soal (support format lama A/B/C/D maupun format baru)
    const normalizedQuestions = normalizeQuestions(questions || []);

    const quiz = await Quiz.create({
      adminId: (req as any).adminId,
      title,
      description: description || "",
      defaultDuration: defaultDuration || 20,
      questions: normalizedQuestions,
    });

    res.status(201).json({
      success: true,
      message: "Quiz berhasil dibuat!",
      data: { quiz },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Gagal membuat quiz",
    });
  }
});

// ─── PUT /api/quiz/:id ────────────────────────────────────────
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      adminId: (req as any).adminId,
    });

    if (!quiz) {
      res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
      return;
    }

    // Update fields manually so pre('save') middleware runs (updates totalQuestions)
    if (req.body.title !== undefined) quiz.title = req.body.title;
    if (req.body.description !== undefined) quiz.description = req.body.description;
    if (req.body.defaultDuration !== undefined) quiz.defaultDuration = req.body.defaultDuration;
    if (req.body.questions !== undefined) quiz.questions = normalizeQuestions(req.body.questions);
    if (req.body.allow1v1 !== undefined) quiz.allow1v1 = req.body.allow1v1;

    await quiz.save();

    res.json({
      success: true,
      message: "Quiz berhasil diperbarui!",
      data: { quiz },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Gagal memperbarui quiz",
    });
  }
});

// ─── PATCH /api/quiz/:id/toggle-1v1 ──────────────────────────
router.patch("/:id/toggle-1v1", authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      adminId: (req as any).adminId,
    });

    if (!quiz) {
      res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
      return;
    }

    quiz.allow1v1 = !quiz.allow1v1;
    await quiz.save();

    res.json({
      success: true,
      message: quiz.allow1v1 ? "Quiz diaktifkan untuk mode 1v1!" : "Quiz dinonaktifkan dari mode 1v1",
      data: { allow1v1: quiz.allow1v1 },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE /api/quiz/:id ─────────────────────────────────────
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.id,
      adminId: (req as any).adminId,
    });

    if (!quiz) {
      res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
      return;
    }

    res.json({ success: true, message: "Quiz berhasil dihapus!" });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
