import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import Session from "../models/Session.model";
import { validateToken } from "../services/token.service";
import { processAnswer, getLeaderboard, checkAndAutoFinish } from "../services/game.service";
import { setJSON, getJSON, delKey, keys, TTL } from "../services/redis.service";

// ─── Tipe data reconnect ──────────────────────────────────────
interface ReconnectData {
  token: string;
  username: string;
  avatarEmoji: string;
}

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

          // Guard: jangan izinkan join jika session sudah selesai
          if (session.status === "finished" || session.status === "canceled") {
            socket.emit("session:error", {
              message: "Sesi sudah selesai atau dibatalkan",
            });
            return;
          }

          // ── RECONNECT: cek apakah username ini sudah pernah join ──
          // Ini menangani kasus: user sudah join sebelumnya (berbeda socketId karena refresh)
          const existingByUsername = session.participants.find(
            (p) => p.username.toLowerCase() === username.toLowerCase()
          );

          if (existingByUsername) {
            // Atomic update: update socketId sekaligus isConnected dalam satu operasi
            // Ini mencegah race condition antara reconnect dan answer submission
            const updatedSession = await Session.findOneAndUpdate(
              { token: upperToken, "participants.username": existingByUsername.username },
              {
                $set: {
                  "participants.$.socketId": socket.id,
                  "participants.$.isConnected": true,
                }
              },
              { new: true }
            );

            const room = `session:${upperToken}`;
            socket.join(room);
            (socket as any).sessionToken = upperToken;
            (socket as any).username = existingByUsername.username;

            // Cek atau buat UUID untuk player ini (untuk reconnect via URL)
            let sessionUUID: string;
            const existingUUIDData = await getJSON<{ uuid: string }>(
              keys.playerReconnect(upperToken, existingByUsername.username)
            );
            // Coba cari UUID yang sudah ada dari Redis key berbeda
            const oldReconnectData = existingUUIDData as any;
            if (oldReconnectData?.sessionUUID) {
              sessionUUID = oldReconnectData.sessionUUID;
            } else {
              sessionUUID = randomUUID();
            }

            // Simpan UUID mapping ke Redis (7 hari)
            await setJSON(
              keys.playerUUID(sessionUUID),
              { token: upperToken, username: existingByUsername.username },
              TTL.PLAYER_UUID
            );

            // Simpan data reconnect di Redis (untuk future reconnects)
            await setJSON(
              keys.playerReconnect(upperToken, existingByUsername.username),
              {
                token: upperToken,
                username: existingByUsername.username,
                avatarEmoji: existingByUsername.avatar?.emoji || "🦊",
                sessionUUID,
              },
              TTL.RECONNECT_DATA
            );

            const sessionForResponse = updatedSession || session;

            // Kirim state session ke player (untuk render UI yang benar saat reconnect)
            socket.emit("session:joined", {
              sessionId: sessionForResponse._id,
              token: upperToken,
              reconnected: true,
              status: sessionForResponse.status,
              currentQuestion: sessionForResponse.currentQuestion,
              sessionUUID,  // ← UUID untuk URL reconnect
              participants: sessionForResponse.participants.map((p) => ({
                username: p.username,
                avatar: p.avatar,
                isConnected: p.isConnected,
                score: p.score,
              })),
            });

            // Beritahu peserta lain bahwa player ini reconnect
            const connectedCount = sessionForResponse.participants.filter((p) => p.isConnected).length;
            io.to(room).emit("session:playerJoined", {
              username: existingByUsername.username,
              avatar: existingByUsername.avatar,
              participantCount: connectedCount,
              participants: sessionForResponse.participants.map((p) => ({
                username: p.username,
                avatar: p.avatar,
                score: p.score || 0,
                answers: p.answers || [],
                joinedAt: p.joinedAt,
                isConnected: p.isConnected,
              })),
              reconnected: true,
            });
            io.of("/admin").to(room).emit("session:playerJoined", {
              username: existingByUsername.username,
              participantCount: connectedCount,
              reconnected: true,
            });

            console.log(`🔄 ${existingByUsername.username} reconnect ke sesi ${upperToken} (UUID: ${sessionUUID.slice(0,8)}...)`);
            return;
          }

          // Cek apakah socket sudah pernah join dengan socket ID ini (duplikat)
          const existingBySocket = session.participants.find(
            (p) => p.socketId === socket.id
          );
          if (existingBySocket) {
            const room = `session:${upperToken}`;
            socket.join(room);
            (socket as any).sessionToken = upperToken;
            (socket as any).username = existingBySocket.username;
            socket.emit("session:joined", {
              sessionId: session._id,
              token: upperToken,
              participants: session.participants.map((p) => ({
                username: p.username,
                avatar: p.avatar,
                isConnected: p.isConnected,
              })),
            });
            return;
          }

          // Cek username sudah dipakai oleh yang sedang terhubung
          const usernameExists = session.participants.some(
            (p) => p.username.toLowerCase() === username.toLowerCase() && p.isConnected
          );

          if (usernameExists) {
            socket.emit("session:error", {
              message: "Username sudah dipakai, coba yang lain!",
            });
            return;
          }

          // Tambah participant baru
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

          // Generate UUID unik untuk player ini (dipakai untuk URL reconnect)
          const sessionUUID = randomUUID();

          // Simpan UUID mapping ke Redis (7 hari) — key: player-uuid:{uuid}
          await setJSON(
            keys.playerUUID(sessionUUID),
            { token: upperToken, username: username.trim() },
            TTL.PLAYER_UUID
          );

          // Simpan reconnect data di Redis (termasuk UUID)
          await setJSON(
            keys.playerReconnect(upperToken, username.trim()),
            { token: upperToken, username: username.trim(), avatarEmoji: "🦊", sessionUUID },
            TTL.RECONNECT_DATA
          );

          // Join room
          const room = `session:${upperToken}`;
          socket.join(room);
          (socket as any).sessionToken = upperToken;
          (socket as any).username = username;

          const connectedCount = session.participants.filter((p) => p.isConnected).length;

          // Konfirmasi ke player (sertakan UUID untuk update URL di frontend)
          socket.emit("session:joined", {
            sessionId: session._id,
            token: upperToken,
            reconnected: false,
            status: session.status,
            currentQuestion: session.currentQuestion,
            sessionUUID,  // ← UUID untuk URL reconnect
            participants: session.participants.map((p) => ({
              username: p.username,
              avatar: p.avatar,
              isConnected: p.isConnected,
            })),
          });

          const joinPayload = {
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
          };

          // Broadcast ke semua player di room
          io.to(room).emit("session:playerJoined", joinPayload);
          io.of("/admin").to(room).emit("session:playerJoined", joinPayload);

          console.log(`✅ ${username} bergabung ke sesi ${upperToken} (UUID: ${sessionUUID.slice(0,8)}..., total: ${connectedCount})`);
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

          // Update data reconnect di Redis dengan avatar baru
          await setJSON(
            keys.playerReconnect(sessionToken, participant.username),
            { token: sessionToken, username: participant.username, avatarEmoji: data.emoji },
            TTL.RECONNECT_DATA
          );

          const room = `session:${sessionToken}`;

          io.to(room).emit("session:avatarUpdated", {
            username: participant.username,
            avatar: participant.avatar,
          });

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
      const reactionPayload = {
        username,
        emoji: data.emoji,
        id: `${socket.id}-${Date.now()}`,
      };
      io.to(room).emit("session:reaction", reactionPayload);
      io.of("/admin").to(room).emit("session:reaction", reactionPayload);
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
          let username = (socket as any).username;
          if (!sessionToken) return;

          // FIX: Jika username tidak ada di socket (misal socket reconnect baru),
          // coba fallback ke DB menggunakan socketId
          if (!username) {
            const fallbackSession = await Session.findOne({ token: sessionToken });
            const fallbackParticipant = fallbackSession?.participants.find(
              (p) => p.socketId === socket.id
            );
            if (fallbackParticipant) {
              username = fallbackParticipant.username;
              (socket as any).username = username; // restore agar tidak perlu fallback lagi
            } else {
              console.warn(`⚠️  player:answer: username tidak ditemukan untuk socket ${socket.id}`);
              return;
            }
          }

          // Cek status session sebelum proses
          const preCheck = await Session.findOne({ token: sessionToken });
          if (!preCheck || preCheck.status === "finished" || preCheck.status === "canceled") {
            return;
          }

          // FIX: Pass username (bukan socket.id) ke processAnswer
          // Ini kunci utama perbaikan bug jawaban benar dianggap salah
          const { isCorrect, pointsEarned } = await processAnswer(
            sessionToken,
            username,
            data.questionIndex,
            data.answer,
            data.responseTime
          );

          // Konfirmasi ke player (jawaban diterima)
          socket.emit("player:answerReceived", {
            questionIndex: data.questionIndex,
            answer: data.answer,
            isCorrect: null,
            pointsEarned: null,
          });

          // Fetch session terbaru untuk update count
          const session = await Session.findOne({ token: sessionToken });
          if (!session) return;

          const connectedParticipants = session.participants.filter((p) => p.isConnected);
          const answeredCount = connectedParticipants.filter((p) =>
            p.answers.some((a) => a.questionIndex === data.questionIndex)
          ).length;

          const room = `session:${sessionToken}`;
          const payload = {
            username,
            answeredCount,
            totalParticipants: connectedParticipants.length,
          };

          io.to(room).emit("session:playerAnswered", payload);
          io.of("/admin").to(room).emit("session:playerAnswered", payload);

          console.log(`📝 ${username} menjawab soal ${data.questionIndex}: ${data.answer} (${isCorrect ? "✅" : "❌"} +${pointsEarned})`);

          // Cek apakah semua sudah menjawab (auto-finish)
          await checkAndAutoFinish(sessionToken, data.questionIndex, io);

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

          // Refresh reconnect data di Redis (perpanjang TTL saat disconnect)
          // Ini memberi ~90 detik untuk user reconnect sebelum data dihapus
          await setJSON(
            keys.playerReconnect(sessionToken, participant.username),
            {
              token: sessionToken,
              username: participant.username,
              avatarEmoji: participant.avatar?.emoji || "🦊",
            },
            TTL.RECONNECT_DATA
          );

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
          io.of("/admin").to(room).emit("session:playerLeft", payload);
        }

        console.log(`🔌 ${username || socket.id} terputus`);
      } catch (error) {
        console.error("disconnect error:", error);
      }
    });
  });
};