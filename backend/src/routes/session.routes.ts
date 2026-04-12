import { Router, Request, Response } from "express";
import Session from "../models/Session.model";
import Quiz from "../models/Quiz.model";
import { authMiddleware } from "../middleware/auth.middleware";
import { generateToken } from "../services/token.service";
import { getLeaderboard } from "../services/game.service";

const router = Router();

// ─── GET /api/session ─────────────────────────────────────────
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessions = await Session.find({ adminId: (req as any).adminId })
      .populate("quizId", "title totalQuestions")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: { sessions } });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/session/create ─────────────────────────────────
router.post("/create", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { quizId, name } = req.body;

    if (!quizId) {
      res.status(400).json({ success: false, message: "Quiz ID wajib diisi" });
      return;
    }

    const quiz = await Quiz.findOne({
      _id: quizId,
      adminId: (req as any).adminId,
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
    const activeSession = await Session.findOne({
      quizId,
      adminId: (req as any).adminId,
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

    const token = await generateToken();

    const session = await Session.create({
      quizId,
      adminId: (req as any).adminId,
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

// ─── GET /api/session/:token/info ─────────────────────────────
router.get("/:token/info", async (req: Request, res: Response) => {
  try {
    const session = await Session.findOne({
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
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/session/:id/leaderboard ────────────────────────
router.get(
  "/:id/leaderboard",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const session = await Session.findOne({
        _id: req.params.id,
        adminId: (req as any).adminId,
      });

      if (!session) {
        res.status(404).json({ success: false, message: "Sesi tidak ditemukan" });
        return;
      }

      const leaderboard = getLeaderboard(session);
      res.json({ success: true, data: { leaderboard } });
    } catch {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── DELETE /api/session/:id ──────────────────────────────────
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    await Session.findOneAndDelete({
      _id: req.params.id,
      adminId: (req as any).adminId,
    });

    res.json({ success: true, message: "Sesi berhasil dihapus!" });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/session/bulk-delete ────────────────────────────
router.post("/bulk-delete", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: "ID Sesi tidak valid" });
      return;
    }

    await Session.deleteMany({
      _id: { $in: ids },
      adminId: (req as any).adminId,
    });

    res.json({ success: true, message: `${ids.length} Sesi berhasil dihapus!` });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;