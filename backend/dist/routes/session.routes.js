"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Session_model_1 = __importDefault(require("../models/Session.model"));
const Quiz_model_1 = __importDefault(require("../models/Quiz.model"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const token_service_1 = require("../services/token.service");
const game_service_1 = require("../services/game.service");
const router = (0, express_1.Router)();
// ─── GET /api/session ─────────────────────────────────────────
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const sessions = await Session_model_1.default.find({ adminId: req.adminId })
            .populate("quizId", "title totalQuestions")
            .sort({ createdAt: -1 })
            .limit(20);
        res.json({ success: true, data: { sessions } });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── POST /api/session/create ─────────────────────────────────
router.post("/create", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { quizId, name } = req.body;
        if (!quizId) {
            res.status(400).json({ success: false, message: "Quiz ID wajib diisi" });
            return;
        }
        const quiz = await Quiz_model_1.default.findOne({
            _id: quizId,
            adminId: req.adminId,
        });
        if (!quiz) {
            res.status(404).json({ success: false, message: "Quiz tidak ditemukan" });
            return;
        }
        if (quiz.questions.length === 0) {
            res.status(400).json({
                success: false,
                message: "Quiz harus memiliki minimal 1 soal",
            });
            return;
        }
        // Cek apakah sudah ada sesi aktif untuk quiz ini
        const activeSession = await Session_model_1.default.findOne({
            quizId,
            adminId: req.adminId,
            status: { $in: ["waiting", "countdown", "active", "between"] },
        });
        if (activeSession) {
            res.json({
                success: true,
                message: "Sesi aktif ditemukan!",
                data: { session: activeSession },
            });
            return;
        }
        const token = await (0, token_service_1.generateToken)();
        const session = await Session_model_1.default.create({
            quizId,
            adminId: req.adminId,
            name: name || "Sesi Tanpa Nama",
            token,
            status: "waiting",
            currentQuestion: 0,
            participants: [],
        });
        res.status(201).json({
            success: true,
            message: `Sesi berhasil dibuat! Token: ${token}`,
            data: { session },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Server error",
        });
    }
});
// ─── GET /api/session/:token/info ─────────────────────────────
router.get("/:token/info", async (req, res) => {
    try {
        const session = await Session_model_1.default.findOne({
            token: req.params.token.toUpperCase(),
        }).populate("quizId", "title description totalQuestions");
        if (!session) {
            res.status(404).json({
                success: false,
                message: "Token tidak valid",
            });
            return;
        }
        if (session.status === "finished") {
            res.status(400).json({
                success: false,
                message: "Quiz sudah selesai",
            });
            return;
        }
        res.json({
            success: true,
            data: {
                sessionId: session._id,
                token: session.token,
                status: session.status,
                participantCount: session.participants.length,
                quiz: session.quizId,
            },
        });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── GET /api/session/:id/leaderboard ────────────────────────
router.get("/:id/leaderboard", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const session = await Session_model_1.default.findOne({
            _id: req.params.id,
            adminId: req.adminId,
        });
        if (!session) {
            res.status(404).json({ success: false, message: "Sesi tidak ditemukan" });
            return;
        }
        const leaderboard = (0, game_service_1.getLeaderboard)(session);
        res.json({ success: true, data: { leaderboard } });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── DELETE /api/session/:id ──────────────────────────────────
router.delete("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        await Session_model_1.default.findOneAndDelete({
            _id: req.params.id,
            adminId: req.adminId,
        });
        res.json({ success: true, message: "Sesi berhasil dihapus!" });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── POST /api/session/bulk-delete ────────────────────────────
router.post("/bulk-delete", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, message: "ID Sesi tidak valid" });
            return;
        }
        await Session_model_1.default.deleteMany({
            _id: { $in: ids },
            adminId: req.adminId,
        });
        res.json({ success: true, message: `${ids.length} Sesi berhasil dihapus!` });
    }
    catch {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
//# sourceMappingURL=session.routes.js.map