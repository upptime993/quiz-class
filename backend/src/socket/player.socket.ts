import { Server, Socket } from "socket.io";
import Session from "../models/Session.model";
import { validateToken } from "../services/token.service";
import { processAnswer, getLeaderboard } from "../services/game.service";

export const initPlayerSocket = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Player terhubung: ${socket.id}`);

    // ─── JOIN SESSION ───────────────────────────────────────
    socket.on(
      "player:join",
      async (data: { token: string; username: string }) => {
        try {
          const { token, username } = data;

          if (!token || !username) {
            socket.emit("session:error", {
              message: "Token dan username wajib diisi",
            });
            return;
          }

          const validation = await validateToken(token);
          if (!validation.valid) {
            socket.emit("session:error", { message: validation.message });
            return;
          }

          const upperToken = token.toUpperCase().trim();
          const session = await Session.findOne({ token: upperToken });
          if (!session) {
            socket.emit("session:error", { message: "Sesi tidak ditemukan" });
            return;
          }

          // Cek username sudah dipakai belum
          const usernameExists = session.participants.some(
            (p) => p.username.toLowerCase() === username.toLowerCase() && p.isConnected
          );

          if (usernameExists) {
            socket.emit("session:error", {
              message: "Username sudah dipakai, coba yang lain!",
            });
            return;
          }

          // Tambah participant
          session.participants.push({
            socketId: socket.id,
            username: username.trim(),
            avatar: {
              emoji: "🦊",
              mixEmoji: null,
              mixImageUrl: null,
            },
            score: 0,
            answers: [],
            joinedAt: new Date(),
            isConnected: true,
          });

          await session.save();

          // Join room
          const room = `session:${upperToken}`;
          socket.join(room);
          (socket as any).sessionToken = upperToken;
          (socket as any).username = username;

          const connectedCount = session.participants.filter((p) => p.isConnected).length;

          // Konfirmasi ke player
          socket.emit("session:joined", {
            sessionId: session._id,
            token: upperToken,
            participants: session.participants.map((p) => ({
              username: p.username,
              avatar: p.avatar,
              isConnected: p.isConnected,
            })),
          });

          // Broadcast ke semua player di room (root namespace)
          io.to(room).emit("session:playerJoined", {
            username: username.trim(),
            avatar: {
              emoji: "🦊",
              mixEmoji: null,
              mixImageUrl: null,
            },
            participantCount: connectedCount,
            participants: session.participants.map((p) => ({
              username: p.username,
              avatar: p.avatar,
              score: p.score || 0,
              answers: p.answers || [],
              joinedAt: p.joinedAt,
              isConnected: p.isConnected,
            })),
          });

          // CRITICAL FIX: Also notify admin namespace ───────
          // Admin sockets are in /admin namespace and cannot receive
          // events from root namespace even if they joined the same room name.
          io.of("/admin").to(room).emit("session:playerJoined", {
            username: username.trim(),
            avatar: {
              emoji: "🦊",
              mixEmoji: null,
              mixImageUrl: null,
            },
            participantCount: connectedCount,
            participants: session.participants.map((p) => ({
              username: p.username,
              avatar: p.avatar,
              score: p.score || 0,
              answers: p.answers || [],
              joinedAt: p.joinedAt,
              isConnected: p.isConnected,
            })),
          });

          console.log(`✅ ${username} bergabung ke sesi ${upperToken} (total: ${connectedCount})`);
        } catch (error) {
          console.error("player:join error:", error);
          socket.emit("session:error", { message: "Gagal bergabung ke sesi" });
        }
      }
    );

    // ─── SET AVATAR ─────────────────────────────────────────
    socket.on(
      "player:setAvatar",
      async (data: {
        emoji: string;
        mixEmoji: string | null;
        mixImageUrl: string | null;
      }) => {
        try {
          const sessionToken = (socket as any).sessionToken;
          if (!sessionToken) return;

          const session = await Session.findOne({ token: sessionToken });
          if (!session) return;

          const participant = session.participants.find(
            (p) => p.socketId === socket.id
          );
          if (!participant) return;

          participant.avatar = {
            emoji: data.emoji,
            mixEmoji: data.mixEmoji,
            mixImageUrl: data.mixImageUrl,
          };

          await session.save();

          const room = `session:${sessionToken}`;

          // Notify players
          io.to(room).emit("session:avatarUpdated", {
            username: participant.username,
            avatar: participant.avatar,
          });

          // Notify admin namespace too
          io.of("/admin").to(room).emit("session:avatarUpdated", {
            username: participant.username,
            avatar: participant.avatar,
          });
        } catch (error) {
          console.error("player:setAvatar error:", error);
        }
      }
    );

    // ─── SEND REACTION ───────────────────────────────────────
    socket.on("player:reaction", (data: { emoji: string }) => {
      const sessionToken = (socket as any).sessionToken;
      const username = (socket as any).username;
      if (!sessionToken || !username) return;

      const room = `session:${sessionToken}`;
      io.to(room).emit("session:reaction", {
        username,
        emoji: data.emoji,
        id: `${socket.id}-${Date.now()}`,
      });
      // Also to admin
      io.of("/admin").to(room).emit("session:reaction", {
        username,
        emoji: data.emoji,
        id: `${socket.id}-${Date.now()}`,
      });
    });

    // ─── SUBMIT ANSWER ───────────────────────────────────────
    socket.on(
      "player:answer",
      async (data: {
        questionIndex: number;
        answer: string;
        responseTime: number;
      }) => {
        try {
          const sessionToken = (socket as any).sessionToken;
          const username = (socket as any).username;
          if (!sessionToken) return;

          const { isCorrect, pointsEarned } = await processAnswer(
            sessionToken,
            socket.id,
            data.questionIndex,
            data.answer,
            data.responseTime
          );

          // Konfirmasi ke player
          socket.emit("player:answerReceived", {
            questionIndex: data.questionIndex,
            answer: data.answer,
            isCorrect: null, // Belum reveal dulu
            pointsEarned: null,
          });

          // Update count ke semua
          const session = await Session.findOne({ token: sessionToken });
          if (!session) return;

          const answeredCount = session.participants.filter((p) =>
            p.answers.some((a) => a.questionIndex === data.questionIndex)
          ).length;

          const room = `session:${sessionToken}`;
          const payload = {
            username,
            answeredCount,
            totalParticipants: session.participants.filter((p) => p.isConnected).length,
          };

          io.to(room).emit("session:playerAnswered", payload);
          // Also notify admin namespace
          io.of("/admin").to(room).emit("session:playerAnswered", payload);

          console.log(`📝 ${username} menjawab soal ${data.questionIndex}: ${data.answer} (${isCorrect ? "✅" : "❌"} +${pointsEarned})`);
        } catch (error) {
          console.error("player:answer error:", error);
        }
      }
    );

    // ─── DISCONNECT ──────────────────────────────────────────
    socket.on("disconnect", async () => {
      try {
        const sessionToken = (socket as any).sessionToken;
        const username = (socket as any).username;
        if (!sessionToken) return;

        const session = await Session.findOne({ token: sessionToken });
        if (!session) return;

        const participant = session.participants.find(
          (p) => p.socketId === socket.id
        );

        if (participant) {
          participant.isConnected = false;
          await session.save();

          const room = `session:${sessionToken}`;
          const connectedCount = session.participants.filter((p) => p.isConnected).length;

          const payload = {
            username,
            participantCount: connectedCount,
            participants: session.participants.map((p) => ({
              username: p.username,
              avatar: p.avatar,
              score: p.score || 0,
              answers: p.answers || [],
              joinedAt: p.joinedAt,
              isConnected: p.isConnected,
            })),
          };

          io.to(room).emit("session:playerLeft", payload);
          // Also notify admin namespace
          io.of("/admin").to(room).emit("session:playerLeft", payload);
        }

        console.log(`🔌 ${username || socket.id} terputus`);
      } catch (error) {
        console.error("disconnect error:", error);
      }
    });
  });
};