import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import Session from "../models/Session.model";
import {
  startQuiz,
  endQuestion,
  finishQuiz,
  getLeaderboard,
  getQuestionStats,
} from "../services/game.service";

export const initAdminSocket = (io: Server): void => {
  // Namespace khusus admin
  const adminNamespace = io.of("/admin");

  adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Token admin tidak ditemukan"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        adminId: string;
        username: string;
      };
      (socket as any).adminId = decoded.adminId;
      (socket as any).adminUsername = decoded.username;
      next();
    } catch {
      next(new Error("Token admin tidak valid"));
    }
  });

  adminNamespace.on("connection", (socket: Socket) => {
    console.log(`👑 Admin terhubung: ${(socket as any).adminUsername}`);

    // ─── JOIN SESSION MONITOR ────────────────────────────────
    socket.on("admin:joinSession", async (data: { sessionToken: string }) => {
      try {
        const { sessionToken } = data;
        const session = await Session.findOne({
          token: sessionToken.toUpperCase(),
          adminId: (socket as any).adminId,
        });

        if (!session) {
          socket.emit("admin:error", { message: "Sesi tidak ditemukan" });
          return;
        }

        // Join both rooms: admin-specific and shared session room
        socket.join(`admin:${sessionToken}`);
        socket.join(`session:${sessionToken}`);
        (socket as any).sessionToken = sessionToken.toUpperCase();

        socket.emit("admin:sessionInfo", {
          session: {
            _id: session._id,
            token: session.token,
            status: session.status,
            currentQuestion: session.currentQuestion,
            participantCount: session.participants.filter((p) => p.isConnected).length,
            participants: session.participants,
          },
          leaderboard: getLeaderboard(session),
        });
      } catch (error) {
        console.error("admin:joinSession error:", error);
      }
    });

    // ─── START QUIZ ──────────────────────────────────────────
    socket.on("admin:startQuiz", async (data: { sessionToken: string }) => {
      try {
        const { sessionToken } = data;
        const session = await Session.findOne({
          token: sessionToken.toUpperCase(),
          adminId: (socket as any).adminId,
        });

        if (!session) {
          socket.emit("admin:error", { message: "Sesi tidak ditemukan" });
          return;
        }

        if (session.status !== "waiting") {
          socket.emit("admin:error", {
            message: "Quiz sudah dimulai atau sudah selesai",
          });
          return;
        }

        if (session.participants.length === 0) {
          socket.emit("admin:error", {
            message: "Tidak ada peserta yang bergabung",
          });
          return;
        }

        console.log(`🚀 Admin memulai quiz: ${sessionToken}`);

        // Start quiz (ini async - countdown + soal)
        startQuiz(sessionToken.toUpperCase(), io);
      } catch (error) {
        console.error("admin:startQuiz error:", error);
      }
    });

    // ─── FORCE NEXT QUESTION ──────────────────────────────────
    socket.on(
      "admin:forceNext",
      async (data: { sessionToken: string; questionIndex: number }) => {
        try {
          const { sessionToken, questionIndex } = data;
          const session = await Session.findOne({
            token: sessionToken.toUpperCase(),
            adminId: (socket as any).adminId,
          });

          if (!session || session.status === "finished") return;

          // Force end current question
          await endQuestion(sessionToken.toUpperCase(), questionIndex, io);
        } catch (error) {
          console.error("admin:forceNext error:", error);
        }
      }
    );

    // ─── STOP QUIZ ───────────────────────────────────────────
    socket.on("admin:stopQuiz", async (data: { sessionToken: string }) => {
      try {
        const { sessionToken } = data;
        const session = await Session.findOne({
          token: sessionToken.toUpperCase(),
          adminId: (socket as any).adminId,
        });

        if (!session) return;

        await finishQuiz(sessionToken.toUpperCase(), io);
      } catch (error) {
        console.error("admin:stopQuiz error:", error);
      }
    });

    // ─── CANCEL QUIZ ─────────────────────────────────────────
    socket.on("admin:cancelSession", async (data: { sessionToken: string }) => {
      try {
        const { sessionToken } = data;
        const session = await Session.findOne({
          token: sessionToken.toUpperCase(),
          adminId: (socket as any).adminId,
        });

        if (!session) return;

        session.status = "canceled";
        await session.save();

        // Emit to all players and admin looking at this room
        const room = `session:${sessionToken.toUpperCase()}`;
        io.to(room).emit("session:canceled", { message: "Sesi telah dibatalkan oleh admin." });
        io.of("/admin").to(room).emit("session:canceled", { message: "Sesi telah dibatalkan oleh admin." });
      } catch (error) {
        console.error("admin:cancelSession error:", error);
      }
    });

    // ─── GET LIVE STATS ──────────────────────────────────────
    socket.on(
      "admin:getStats",
      async (data: { sessionToken: string; questionIndex: number }) => {
        try {
          const session = await Session.findOne({
            token: data.sessionToken.toUpperCase(),
          });

          if (!session) return;

          const stats = getQuestionStats(session, data.questionIndex);
          const leaderboard = getLeaderboard(session);

          socket.emit("admin:statsUpdate", { stats, leaderboard });
        } catch (error) {
          console.error("admin:getStats error:", error);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`👑 Admin terputus: ${(socket as any).adminUsername}`);
    });
  });
};