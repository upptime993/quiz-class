import { Router, Request, Response } from "express";
import DuelRoom from "../models/DuelRoom.model";
import Quiz from "../models/Quiz.model";
import { authMiddleware } from "../middleware/auth.middleware";
import { generateToken } from "../services/token.service";

const router = Router();

// ─── GET /api/duel/quizzes — Daftar quiz yang allow1v1 ────────
router.get("/quizzes", async (_req: Request, res: Response) => {
  try {
    const quizzes = await Quiz.find({ allow1v1: true })
      .select("title description totalQuestions defaultDuration adminId")
      .sort({ title: 1 });

    res.json({ success: true, data: { quizzes } });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/duel/create — Buat room baru (tanpa auth) ──────
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { quizId, username } = req.body;

    if (!quizId || !username) {
      res.status(400).json({ success: false, message: "Quiz dan username wajib diisi" });
      return;
    }

    const quiz = await Quiz.findOne({ _id: quizId, allow1v1: true });
    if (!quiz) {
      res.status(404).json({ success: false, message: "Quiz tidak ditemukan atau belum diizinkan untuk 1v1" });
      return;
    }

    if (quiz.questions.length === 0) {
      res.status(400).json({ success: false, message: "Quiz tidak memiliki soal" });
      return;
    }

    const token = await generateToken();

    const room = await DuelRoom.create({
      token,
      quizId: quiz._id,
      status: "waiting",
      creator: {
        socketId: "pending",
        username: username.trim(),
        avatar: { emoji: "🦊", mixEmoji: null, mixImageUrl: null },
        score: 0,
        answers: [],
        isConnected: false,
      },
      opponent: null,
    });

    res.status(201).json({
      success: true,
      message: `Room berhasil dibuat! Token: ${token}`,
      data: {
        token: room.token,
        roomId: room._id,
        quizTitle: quiz.title,
        totalQuestions: quiz.totalQuestions,
        expiresAt: room.expiresAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

// ─── GET /api/duel/:token/info — Info room ────────────────────
router.get("/:token/info", async (req: Request, res: Response) => {
  try {
    const room = await DuelRoom.findOne({
      token: req.params.token.toUpperCase(),
    }).populate("quizId", "title totalQuestions");

    if (!room) {
      res.status(404).json({ success: false, message: "Room tidak ditemukan" });
      return;
    }

    if (room.status === "finished" || room.status === "canceled") {
      res.status(400).json({ success: false, message: "Room sudah tidak aktif" });
      return;
    }

    if (room.opponent) {
      res.status(400).json({ success: false, message: "Room sudah penuh! Sudah ada 2 pemain." });
      return;
    }

    const quiz = room.quizId as any;
    res.json({
      success: true,
      data: {
        token: room.token,
        status: room.status,
        quizTitle: quiz?.title || "Quiz",
        totalQuestions: quiz?.totalQuestions || 0,
        creatorUsername: room.creator.username,
        hasOpponent: !!room.opponent,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
