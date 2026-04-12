import { Server, Socket } from "socket.io";
import DuelRoom, { IDuelRoom } from "../models/DuelRoom.model";
import Quiz from "../models/Quiz.model";
import { calculateScore } from "../services/game.service";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Emit ke room duel (namespace /duel) ──────────────────────
const emitToRoom = (io: Server, token: string, event: string, data: any) => {
  io.of("/duel").to(`duel:${token}`).emit(event, data);
};

// ─── Serialize player info ────────────────────────────────────
const serializePlayer = (p: any) => ({
  username: p.username,
  avatar: p.avatar,
  score: p.score,
  isConnected: p.isConnected,
});

// ─── Duel Game Logic ──────────────────────────────────────────
const startDuel = async (
  token: string,
  io: Server
): Promise<void> => {
  const room = await DuelRoom.findOne({ token });
  if (!room || !room.opponent) return;

  const quiz = await Quiz.findById(room.quizId);
  if (!quiz) return;

  // Countdown 3-2-1
  room.status = "countdown";
  await room.save();

  for (let i = 3; i >= 1; i--) {
    emitToRoom(io, token, "duel:countdown", { count: i });
    await delay(1000);
  }
  emitToRoom(io, token, "duel:countdown", { count: "GO" });
  await delay(1000);

  await sendDuelQuestion(token, 0, io);
};

const sendDuelQuestion = async (
  token: string,
  questionIndex: number,
  io: Server
): Promise<void> => {
  const room = await DuelRoom.findOne({ token });
  if (!room || room.status === "finished" || room.status === "canceled") return;

  const quiz = await Quiz.findById(room.quizId);
  if (!quiz) return;

  const question = quiz.questions[questionIndex];
  if (!question) return;

  room.status = "active";
  room.currentQuestion = questionIndex;
  room.startedAt = room.startedAt || new Date();
  await room.save();

  emitToRoom(io, token, "duel:questionStart", {
    question: {
      order: questionIndex + 1,
      text: question.text,
      imageUrl: question.imageUrl || null,
      answerType: question.answerType || "multiple_choice",
      options:
        question.answerType === "text" || question.answerType === "matching"
          ? []
          : question.options,
      matchPairs:
        question.answerType === "matching" ? question.matchPairs || [] : [],
      duration: question.duration,
      totalQuestions: quiz.questions.length,
    },
    questionIndex,
  });

  // Race model: We DO NOT wait for global timers anymore.
  // The client auto-submits an empty answer when its local timer ends.
  // The server progresses the game individually upon receiving answers.
};

const finishDuel = async (token: string, io: Server): Promise<void> => {
  const room = await DuelRoom.findOneAndUpdate(
    { token, status: { $nin: ["finished", "canceled"] } },
    { $set: { status: "finished", finishedAt: new Date() } },
    { new: true }
  );
  
  if (!room) return;

  const creatorScore = room.creator.score;
  const opponentScore = room.opponent?.score || 0;
  const winner =
    creatorScore > opponentScore
      ? "creator"
      : opponentScore > creatorScore
      ? "opponent"
      : "draw";

  emitToRoom(io, token, "duel:finished", {
    winner,
    creator: serializePlayer(room.creator),
    opponent: room.opponent ? serializePlayer(room.opponent) : null,
    creatorScore,
    opponentScore,
  });
};

// ─── Socket Handler ───────────────────────────────────────────
export const initDuelSocket = (io: Server): void => {
  // Gunakan namespace /duel
  const duelNs = io.of("/duel");

  duelNs.on("connection", (socket: Socket) => {
    console.log(`⚔️ Duel socket terhubung: ${socket.id}`);

    // ─── CREATE & JOIN AS CREATOR ──────────────────────────
    socket.on(
      "duel:join",
      async (data: { token: string; username: string; role: "creator" | "opponent" }) => {
        try {
          const { token, username, role } = data;
          const upperToken = token.toUpperCase().trim();

          const room = await DuelRoom.findOne({ token: upperToken });
          if (!room) {
            socket.emit("duel:error", { message: "Room tidak ditemukan" });
            return;
          }

          if (room.status === "finished" || room.status === "canceled") {
            socket.emit("duel:error", { message: "Room sudah tidak aktif" });
            return;
          }

          if (role === "creator") {
            if (room.creator.username.toLowerCase() !== username.toLowerCase()) {
              socket.emit("duel:error", { message: "Username tidak cocok dengan creator" });
              return;
            }
            room.creator.socketId = socket.id;
            room.creator.isConnected = true;
          } else {
            // Opponent
            if (room.opponent && room.opponent.username.toLowerCase() !== username.toLowerCase()) {
              socket.emit("duel:error", { message: "Room sudah penuh!" });
              return;
            }
            if (room.creator.username.toLowerCase() === username.toLowerCase()) {
              socket.emit("duel:error", { message: "Username sudah dipakai oleh creator" });
              return;
            }
            
            if (room.opponent) {
              room.opponent.socketId = socket.id;
              room.opponent.isConnected = true;
            } else {
              room.opponent = {
                socketId: socket.id,
                username: username.trim(),
                avatar: { emoji: "🐨", mixEmoji: null, mixImageUrl: null },
                score: 0,
                answers: [],
                isConnected: true,
              };
            }
          }

          await room.save();

          const duelRoom = `duel:${upperToken}`;
          socket.join(duelRoom);
          (socket as any).duelToken = upperToken;
          (socket as any).duelRole = role;
          (socket as any).duelUsername = username;

          // Ambil soal saat ini untuk reconnect mid-game
          let currentQuestionData = null;
          let currentQIndex = room.currentQuestion;
          if (room.status === "active") {
            const quiz = await Quiz.findById(room.quizId);
            if (quiz) {
              const q = quiz.questions[currentQIndex];
              if (q) {
                currentQuestionData = {
                  order: currentQIndex + 1,
                  text: q.text,
                  imageUrl: q.imageUrl || null,
                  answerType: q.answerType || "multiple_choice",
                  options: q.answerType === "text" || q.answerType === "matching" ? [] : q.options,
                  matchPairs: q.answerType === "matching" ? q.matchPairs || [] : [],
                  duration: q.duration,
                  totalQuestions: quiz.questions.length,
                };
              }
            }
          }

          // Konfirmasi ke player – sertakan status & soal aktif (untuk reconnect)
          socket.emit("duel:joined", {
            token: upperToken,
            role,
            creator: serializePlayer(room.creator),
            opponent: room.opponent ? serializePlayer(room.opponent) : null,
            status: room.status,
            currentQuestion: currentQuestionData,
            questionIndex: currentQIndex,
          });

          // Notify semua di room
          emitToRoom(io, upperToken, "duel:roomUpdate", {
            creator: serializePlayer(room.creator),
            opponent: room.opponent ? serializePlayer(room.opponent) : null,
            status: room.status,
          });

          console.log(`⚔️ ${username} (${role}) bergabung ke duel room ${upperToken}`);
        } catch (error) {
          console.error("duel:join error:", error);
          socket.emit("duel:error", { message: "Gagal bergabung ke room" });
        }
      }
    );

    // ─── SET AVATAR ────────────────────────────────────────
    socket.on(
      "duel:setAvatar",
      async (data: { emoji: string; mixEmoji: string | null; mixImageUrl: string | null }) => {
        try {
          const token = (socket as any).duelToken;
          const role = (socket as any).duelRole;
          if (!token) return;

          const room = await DuelRoom.findOne({ token });
          if (!room) return;

          const avatar = {
            emoji: data.emoji,
            mixEmoji: data.mixEmoji,
            mixImageUrl: data.mixImageUrl,
          };

          if (role === "creator") {
            room.creator.avatar = avatar;
          } else if (room.opponent) {
            room.opponent.avatar = avatar;
          }

          await room.save();

          emitToRoom(io, token, "duel:roomUpdate", {
            creator: serializePlayer(room.creator),
            opponent: room.opponent ? serializePlayer(room.opponent) : null,
            status: room.status,
          });
        } catch (error) {
          console.error("duel:setAvatar error:", error);
        }
      }
    );

    // ─── START BATTLE (manual, by creator) ────────────────
    socket.on("duel:startBattle", async () => {
      try {
        const token = (socket as any).duelToken;
        const role = (socket as any).duelRole;
        if (!token || role !== "creator") {
          socket.emit("duel:error", { message: "Hanya creator yang bisa memulai battle" });
          return;
        }

        const room = await DuelRoom.findOne({ token });
        if (!room) {
          socket.emit("duel:error", { message: "Room tidak ditemukan" });
          return;
        }

        if (!room.opponent) {
          socket.emit("duel:error", { message: "Tunggu lawan bergabung dulu!" });
          return;
        }

        if (room.status !== "waiting") {
          socket.emit("duel:error", { message: "Battle sudah dimulai" });
          return;
        }

        console.log(`⚔️ Battle dimulai: ${token}`);
        startDuel(token, io); // fire & forget
      } catch (error) {
        console.error("duel:startBattle error:", error);
      }
    });

    // ─── SUBMIT ANSWER ─────────────────────────────────────
    socket.on(
      "duel:answer",
      async (data: { questionIndex: number; answer: string; responseTime: number }) => {
        try {
          const token = (socket as any).duelToken;
          const role = (socket as any).duelRole;
          if (!token) return;

          const room = await DuelRoom.findOne({ token });
          if (!room) return;

          const quiz = await Quiz.findById(room.quizId);
          if (!quiz) return;

          const question = quiz.questions[data.questionIndex];
          if (!question) return;

          const player = role === "creator" ? room.creator : room.opponent;
          if (!player) return;

          // Cek sudah jawab
          const alreadyAnswered = player.answers.some(
            (a: any) => a.questionIndex === data.questionIndex
          );
          if (alreadyAnswered) return;

          // Validate answer
          let isCorrect = false;
          if (question.answerType === "text") {
            const norm = data.answer.trim().toLowerCase();
            isCorrect = (question.acceptedAnswers || []).some(
              (a) => a.trim().toLowerCase() === norm
            );
          } else if (question.answerType === "matching") {
            if (data.answer.startsWith("MATCHING:")) {
              const matchStr = data.answer.replace("MATCHING:", "");
              const pairs = matchStr.split(",");
              const matchPairs = question.matchPairs || [];
              let allCorrect = true;
              let validPairs = 0;
              for (const pair of pairs) {
                const [l, r] = pair.split(":").map(Number);
                if (isNaN(l) || isNaN(r)) continue;
                validPairs++;
                if (l !== r) { allCorrect = false; break; }
              }
              isCorrect = allCorrect && validPairs === matchPairs.length;
            }
          } else {
            isCorrect = data.answer === question.correctAnswer;
          }

          const pointsEarned = isCorrect
            ? calculateScore(question.points, data.responseTime, question.duration)
            : 0;

          player.answers.push({
            questionIndex: data.questionIndex,
            answer: data.answer,
            isCorrect,
            responseTime: data.responseTime,
            pointsEarned,
          });

          if (isCorrect) player.score += pointsEarned;

          await room.save();

          // Hitung Correct Answer untuk result feedback
          const isText = question.answerType === "text";
          const isMatching = question.answerType === "matching";
          const correctAnswer = isText
            ? question.acceptedAnswers?.[0] || ""
            : isMatching
            ? "MATCHING"
            : question.correctAnswer;

          // Kirim Hasil Result langsung ke spesifik Player (Async Race)
          io.of("/duel").to(socket.id).emit("duel:myResult", {
            isCorrect,
            pointsEarned,
            myAnswer: data.answer,
            correctAnswer,
            answerType: question.answerType || "multiple_choice",
            matchPairs: isMatching ? question.matchPairs || [] : [],
            responseTime: data.responseTime,
            creatorScore: room.creator.score,
            opponentScore: room.opponent?.score || 0,
          });

          // Update score realtime ke room
          emitToRoom(io, token, "duel:scoreUpdate", {
            creatorScore: room.creator.score,
            opponentScore: room.opponent?.score || 0,
          });

          // Pengecekan Progress State (Race Finish Line)
          const isLast = (data.questionIndex + 1) >= quiz.questions.length;

          if (isLast) {
            // Player Finish! Force finish for ALL!
            await finishDuel(token, io);
          } else {
            // Delay kosmetik singkat (1 detik) sebelum melempar soal selanjutnya ke user ini
            setTimeout(async () => {
              const currentRoom = await DuelRoom.findOne({ token });
              if (!currentRoom || currentRoom.status === "finished" || currentRoom.status === "canceled") return;

              const nextQIndex = data.questionIndex + 1;
              const nextQ = quiz.questions[nextQIndex];
              if (nextQ) {
                io.of("/duel").to(socket.id).emit("duel:questionStart", {
                  question: {
                    order: nextQIndex + 1,
                    text: nextQ.text,
                    imageUrl: nextQ.imageUrl || null,
                    answerType: nextQ.answerType || "multiple_choice",
                    options: nextQ.answerType === "text" || nextQ.answerType === "matching" ? [] : nextQ.options,
                    matchPairs: nextQ.answerType === "matching" ? nextQ.matchPairs || [] : [],
                    duration: nextQ.duration,
                    totalQuestions: quiz.questions.length,
                  },
                  questionIndex: nextQIndex,
                });
              }
            }, 1000); // 1 detik jeda asinkron
          }
        } catch (error) {
          console.error("duel:answer error:", error);
        }
      }
    );

    // ─── REACTION ──────────────────────────────────────────
    socket.on("duel:reaction", (data: { emoji: string }) => {
      const token = (socket as any).duelToken;
      const username = (socket as any).duelUsername;
      if (!token || !username) return;

      emitToRoom(io, token, "duel:reaction", {
        username,
        emoji: data.emoji,
        id: `${socket.id}-${Date.now()}`,
      });
    });

    // ─── DISCONNECT ────────────────────────────────────────
    socket.on("disconnect", async () => {
      try {
        const token = (socket as any).duelToken;
        const role = (socket as any).duelRole;
        const username = (socket as any).duelUsername;
        if (!token) return;

        const room = await DuelRoom.findOne({ token });
        if (!room) return;

        if (role === "creator") {
          room.creator.isConnected = false;
        } else if (room.opponent) {
          room.opponent.isConnected = false;
        }

        await room.save();

        emitToRoom(io, token, "duel:opponentLeft", {
          username,
          role,
        });

        console.log(`⚔️ ${username} (${role}) terputus dari duel ${token}`);
      } catch (error) {
        console.error("duel disconnect error:", error);
      }
    });
  });
};
