import { Router, Request, Response } from "express";
import Session from "../models/Session.model";
import Quiz from "../models/Quiz.model";
import { authMiddleware } from "../middleware/auth.middleware";
import { generateToken } from "../services/token.service";
import { getLeaderboard } from "../services/game.service";
import { getJSON, keys, setJSON, TTL } from "../services/redis.service";

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
// ─── GET /api/session/uuid/:uuid ─────────────────────────────
// Endpoint publik untuk resolve UUID player ke { token, username }
// Dipakai frontend saat reconnect via URL /quiz/sessions/:uuid
router.get("/uuid/:uuid", async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    if (!uuid || uuid.length < 10) {
      res.status(400).json({ success: false, message: "UUID tidak valid" });
      return;
    }

    // Ambil dari Redis
    const data = await getJSON<{ token: string; username: string }>(
      keys.playerUUID(uuid)
    );

    if (!data) {
      res.status(404).json({
        success: false,
        message: "Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan join ulang.",
      });
      return;
    }

    // Verifikasi session masih ada di DB
    const session = await Session.findOne({ token: data.token });
    if (!session) {
      res.status(404).json({
        success: false,
        message: "Sesi tidak ditemukan di database.",
      });
      return;
    }

    // Refresh TTL UUID agar tidak expired selama quiz masih aktif
    if (session.status !== "finished" && session.status !== "canceled") {
      await setJSON(keys.playerUUID(uuid), data, TTL.PLAYER_UUID);
    }

    res.json({
      success: true,
      data: {
        token: data.token,
        username: data.username,
        sessionStatus: session.status,
        isSessionActive: !["finished", "canceled"].includes(session.status),
      },
    });
  } catch (error) {
    console.error("session/uuid error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/session/:token/state ────────────────────────────────
// Endpoint publik untuk cek state session — dipakai frontend saat reconnect/refresh
router.get("/:token/state", async (req: Request, res: Response) => {
  try {
    const upperToken = req.params.token.toUpperCase();
    const session = await Session.findOne({ token: upperToken });

    if (!session) {
      res.status(404).json({ success: false, message: "Sesi tidak ditemukan" });
      return;
    }

    // Cek username dari query param — untuk tahu apakah user ini sudah terdaftar
    const usernameQuery = (req.query.username as string || "").trim().toLowerCase();
    const participant = usernameQuery
      ? session.participants.find((p) => p.username.toLowerCase() === usernameQuery)
      : null;

    // Ambil data soal aktif dari Quiz jika sedang active
    let currentQuestionData = null;
    if (session.status === "active" || session.status === "between" || session.status === "showing_result") {
      const quiz = await Quiz.findById(session.quizId);
      if (quiz) {
        const q = quiz.questions[session.currentQuestion];
        if (q) {
          currentQuestionData = {
            order: session.currentQuestion + 1,
            text: q.text,
            imageUrl: q.imageUrl || null,
            answerType: q.answerType || "multiple_choice",
            options: (q.answerType === "text" || q.answerType === "matching") ? [] : q.options,
            matchPairs: q.answerType === "matching" ? (q.matchPairs || []) : [],
            duration: q.duration,
            totalQuestions: quiz.questions.length,
          };
        }
      }
    }

    res.json({
      success: true,
      data: {
        token: session.token,
        status: session.status,
        currentQuestion: session.currentQuestion,
        currentQuestionData,
        participantCount: session.participants.filter((p) => p.isConnected).length,
        totalParticipants: session.participants.length,
        // Info khusus untuk participant yang sedang reconnect
        participantInfo: participant ? {
          username: participant.username,
          avatar: participant.avatar,
          score: participant.score,
          answeredCurrentQuestion: participant.answers.some(
            (a) => a.questionIndex === session.currentQuestion
          ),
          isConnected: participant.isConnected,
        } : null,
        isRegistered: !!participant,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
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