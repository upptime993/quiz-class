"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const stream_1 = require("stream");
const Quiz_model_1 = __importDefault(require("../models/Quiz.model"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ─── Cloudinary Config ────────────────────────────────────────
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ─── Multer (pakai memory storage, bukan disk) ────────────────
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880") },
    fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const isValid = allowed.test(file.mimetype);
        if (isValid)
            cb(null, true);
        else
            cb(new Error("Hanya file gambar yang diizinkan!"));
    },
});
// Helper: upload buffer ke Cloudinary
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({ folder: "quizclass" }, (error, result) => {
            if (error || !result)
                return reject(error);
            resolve(result.secure_url);
        });
        stream_1.Readable.from(buffer).pipe(stream);
    });
};
// ─── Gemini API Fallback Helper ───────────────────────────────
const getGeminiApiKeys = () => {
    const keys = [];
    if (process.env.GEMINI_API_KEY)
        keys.push(process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY_2)
        keys.push(process.env.GEMINI_API_KEY_2);
    if (process.env.GEMINI_API_KEY_3)
        keys.push(process.env.GEMINI_API_KEY_3);
    return keys;
};
const callGeminiWithFallback = async (systemInstruction) => {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
        throw new Error("Tidak ada GEMINI_API_KEY yang dikonfigurasi di server. Tambahkan GEMINI_API_KEY ke environment variables.");
    }
    let lastError = new Error("Unknown error");
    for (let i = 0; i < apiKeys.length; i++) {
        const key = apiKeys[i];
        const keyLabel = i === 0 ? "utama" : `ke-${i + 1}`;
        try {
            console.log(`🤖 Mencoba Gemini API key ${keyLabel}...`);
            const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemInstruction }] }],
                    generationConfig: {
                        response_mime_type: "application/json",
                        temperature: 0.7,
                    }
                }),
            });
            if (!fetchRes.ok) {
                let errText = "Unknown error";
                try {
                    const errData = await fetchRes.json();
                    errText = JSON.stringify(errData);
                }
                catch {
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
            const data = await fetchRes.json();
            const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textOut) {
                lastError = new Error(`Respon AI key ${keyLabel} kosong`);
                continue;
            }
            console.log(`✅ Gemini API key ${keyLabel} berhasil!`);
            return textOut;
        }
        catch (error) {
            // Network error or other — try next key
            console.warn(`⚠️ Gemini API key ${keyLabel} error:`, error.message);
            lastError = error;
            // If it's not a retriable error, rethrow immediately
            if (!error.message.includes("gagal") && !error.message.includes("limit") && !error.message.includes("quota")) {
                // Only continue if it's a rate limit scenario
                if (i < apiKeys.length - 1)
                    continue;
            }
        }
    }
    throw new Error(`Semua API key Gemini gagal. Error terakhir: ${lastError.message}`);
};
// ─── GET /api/quiz ────────────────────────────────────────────
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const quizzes = await Quiz_model_1.default.find({ adminId: req.adminId })
            .select("-questions")
            .sort({ createdAt: -1 });
        res.json({ success: true, data: { quizzes } });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── POST /api/quiz/upload-image ─────────────────────────────
// IMPORTANT: Must be declared BEFORE /:id to avoid route conflicts
router.post("/upload-image", auth_middleware_1.authMiddleware, upload.single("image"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
        return;
    }
    // Check Cloudinary environment config
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
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
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({
            success: false,
            message: error?.message || "Gagal upload ke Cloudinary. Periksa konfigurasi Cloudinary.",
        });
    }
});
// ─── POST /api/quiz/generate ──────────────────────────────────
router.post("/generate", auth_middleware_1.authMiddleware, async (req, res) => {
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
    }
    catch (error) {
        console.error("Gemini AI error:", error);
        res.status(500).json({ success: false, message: error.message || "Gagal meng-generate soal" });
    }
});
// ─── GET /api/quiz/api-keys-status ───────────────────────────
router.get("/api-keys-status", auth_middleware_1.authMiddleware, async (req, res) => {
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
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── GET /api/quiz/:id ────────────────────────────────────────
router.get("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz_model_1.default.findOne({
            _id: req.params.id,
            adminId: req.adminId,
        });
        if (!quiz) {
            res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
            return;
        }
        res.json({ success: true, data: { quiz } });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── POST /api/quiz ───────────────────────────────────────────
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { title, description, defaultDuration, questions } = req.body;
        if (!title) {
            res.status(400).json({ success: false, message: "Judul quiz wajib diisi" });
            return;
        }
        const quiz = await Quiz_model_1.default.create({
            adminId: req.adminId,
            title,
            description: description || "",
            defaultDuration: defaultDuration || 20,
            questions: questions || [],
        });
        res.status(201).json({
            success: true,
            message: "Quiz berhasil dibuat!",
            data: { quiz },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Gagal membuat quiz",
        });
    }
});
// ─── PUT /api/quiz/:id ────────────────────────────────────────
router.put("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz_model_1.default.findOne({
            _id: req.params.id,
            adminId: req.adminId,
        });
        if (!quiz) {
            res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
            return;
        }
        // Update fields manually so pre('save') middleware runs (updates totalQuestions)
        if (req.body.title !== undefined)
            quiz.title = req.body.title;
        if (req.body.description !== undefined)
            quiz.description = req.body.description;
        if (req.body.defaultDuration !== undefined)
            quiz.defaultDuration = req.body.defaultDuration;
        if (req.body.questions !== undefined)
            quiz.questions = req.body.questions;
        if (req.body.allow1v1 !== undefined)
            quiz.allow1v1 = req.body.allow1v1;
        await quiz.save();
        res.json({
            success: true,
            message: "Quiz berhasil diperbarui!",
            data: { quiz },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Gagal memperbarui quiz",
        });
    }
});
// ─── PATCH /api/quiz/:id/toggle-1v1 ──────────────────────────
router.patch("/:id/toggle-1v1", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz_model_1.default.findOne({
            _id: req.params.id,
            adminId: req.adminId,
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
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── DELETE /api/quiz/:id ─────────────────────────────────────
router.delete("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz_model_1.default.findOneAndDelete({
            _id: req.params.id,
            adminId: req.adminId,
        });
        if (!quiz) {
            res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
            return;
        }
        res.json({ success: true, message: "Quiz berhasil dihapus!" });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
//# sourceMappingURL=quiz.routes.js.map