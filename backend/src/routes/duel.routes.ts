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
    const { quizId, username, customDuration } = req.body;

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

    const roomData: any = {
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
    };
    if (customDuration && customDuration >= 5) {
      roomData.customDuration = customDuration;
    }

    const room = await DuelRoom.create(roomData);

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

// ─── GET /api/duel/:token/state ─────────────────────────────────
// Endpoint publik untuk cek state duel — dipakai frontend saat reconnect/refresh
router.get("/:token/state", async (req: Request, res: Response) => {
  try {
    const upperToken = req.params.token.toUpperCase();
    const room = await DuelRoom.findOne({ token: upperToken }).populate("quizId", "title totalQuestions");

    if (!room) {
      res.status(404).json({ success: false, message: "Room tidak ditemukan" });
      return;
    }

    const usernameQuery = (req.query.username as string || "").trim().toLowerCase();

    // Tentukan role dari username
    let role: "creator" | "opponent" | null = null;
    if (usernameQuery) {
      if (room.creator.username.toLowerCase() === usernameQuery) role = "creator";
      else if (room.opponent && room.opponent.username.toLowerCase() === usernameQuery) role = "opponent";
    }

    // Ambil soal aktif jika game sedang berjalan
    let currentQuestionData = null;
    if (room.status === "active") {
      const quiz = await Quiz.findById(room.quizId);
      if (quiz) {
        const q = quiz.questions[room.currentQuestion];
        if (q) {
          currentQuestionData = {
            order: room.currentQuestion + 1,
            text: q.text,
            imageUrl: q.imageUrl || null,
            answerType: q.answerType || "multiple_choice",
            options: (q.answerType === "text" || q.answerType === "matching") ? [] : q.options,
            matchPairs: q.answerType === "matching" ? (q.matchPairs || []) : [],
            duration: room.customDuration ?? q.duration,
            totalQuestions: quiz.questions.length,
          };
        }
      }
    }

    const quiz = room.quizId as any;
    res.json({
      success: true,
      data: {
        token: room.token,
        status: room.status,
        currentQuestion: room.currentQuestion,
        currentQuestionData,
        quizTitle: quiz?.title || "Quiz",
        totalQuestions: quiz?.totalQuestions || 0,
        creator: {
          username: room.creator.username,
          avatar: room.creator.avatar,
          score: room.creator.score,
          isConnected: room.creator.isConnected,
        },
        opponent: room.opponent ? {
          username: room.opponent.username,
          avatar: room.opponent.avatar,
          score: room.opponent.score,
          isConnected: room.opponent.isConnected,
        } : null,
        // Info untuk user yang sedang reconnect
        myRole: role,
        isRegistered: !!role,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
