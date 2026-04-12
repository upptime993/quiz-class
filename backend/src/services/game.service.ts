import Session, { ISession, IParticipant } from "../models/Session.model";
import Quiz, { IQuestion } from "../models/Quiz.model";
import { Server } from "socket.io";
import { acquireLock, setJSON, getJSON, keys, TTL } from "./redis.service";

// Helper: emit to both root namespace AND /admin namespace
const emitToAll = (io: Server, room: string, event: string, data: any) => {
  io.to(room).emit(event, data);
  io.of("/admin").to(room).emit(event, data);
};

// ─── Helper Delay ─────────────────────────────────────────────
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Kalkulasi Score ──────────────────────────────────────────
export const calculateScore = (
  basePoints: number,
  responseTime: number,
  duration: number
): number => {
  const durationMs = duration * 1000;
  const ratio = 1 - responseTime / durationMs;

  let speedBonus = 0;
  if (ratio >= 0.75) speedBonus = 500;
  else if (ratio >= 0.50) speedBonus = 300;
  else if (ratio >= 0.25) speedBonus = 150;
  else speedBonus = 50;

  return basePoints + speedBonus;
};

// ─── Get Leaderboard ──────────────────────────────────────────
export const getLeaderboard = (session: ISession) => {
  return session.participants
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      username: p.username,
      avatar: p.avatar,
      score: p.score,
      rank: index + 1,
      isConnected: p.isConnected,
      answers: p.answers,
    }));
};

// ─── Get Question Stats ───────────────────────────────────────
export const getQuestionStats = (
  session: ISession,
  questionIndex: number
) => {
  const stats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, text: 0, unanswered: 0, timeout: 0 };

  session.participants.forEach((p) => {
    const answer = p.answers.find((a) => a.questionIndex === questionIndex);
    if (!answer) {
      stats.unanswered++;
    } else if (answer.answer === "TIMEOUT") {
      stats.timeout++;
    } else if (["A", "B", "C", "D"].includes(answer.answer)) {
      stats[answer.answer]++;
    } else {
      stats.text++;
    }
  });

  return stats;
};

// ─── Process Answer ───────────────────────────────────────────
export const processAnswer = async (
  sessionToken: string,
  socketId: string,
  questionIndex: number,
  answer: string,
  responseTime: number
): Promise<{
  isCorrect: boolean;
  pointsEarned: number;
  participant: IParticipant | null;
}> => {
  const session = await Session.findOne({ token: sessionToken }).populate(
    "quizId"
  );

  if (!session) return { isCorrect: false, pointsEarned: 0, participant: null };

  // GUARD: Jangan proses jawaban jika quiz sudah selesai
  if (session.status === "finished" || session.status === "canceled") {
    return { isCorrect: false, pointsEarned: 0, participant: null };
  }

  const quiz = await Quiz.findById(session.quizId);
  if (!quiz) return { isCorrect: false, pointsEarned: 0, participant: null };

  const question = quiz.questions[questionIndex];
  if (!question) return { isCorrect: false, pointsEarned: 0, participant: null };

  const participantIndex = session.participants.findIndex(
    (p) => p.socketId === socketId
  );
  if (participantIndex === -1)
    return { isCorrect: false, pointsEarned: 0, participant: null };

  const participant = session.participants[participantIndex];

  // Anti-cheat: cek sudah jawab belum untuk soal ini
  const alreadyAnswered = participant.answers.some(
    (a) => a.questionIndex === questionIndex
  );
  if (alreadyAnswered)
    return { isCorrect: false, pointsEarned: 0, participant };

  // Tentukan kebenaran berdasarkan answer type
  let isCorrect = false;
  if (question.answerType === "text") {
    const normalizedAnswer = answer.trim().toLowerCase();
    const accepted = question.acceptedAnswers || [];
    isCorrect = accepted.some(
      (a) => a.trim().toLowerCase() === normalizedAnswer
    );
  } else if (question.answerType === "matching") {
    if (answer.startsWith("MATCHING:")) {
      const matchStr = answer.replace("MATCHING:", "");
      const pairs = matchStr.split(",");
      const matchPairs = question.matchPairs || [];
      let allCorrect = true;
      let validPairs = 0;

      for (const pair of pairs) {
        const [leftIdxStr, rightOrigIdxStr] = pair.split(":");
        const leftIdx = parseInt(leftIdxStr);
        const rightOrigIdx = parseInt(rightOrigIdxStr);

        if (isNaN(leftIdx) || isNaN(rightOrigIdx)) continue;
        validPairs++;

        if (leftIdx !== rightOrigIdx) {
          allCorrect = false;
          break;
        }
      }

      isCorrect = allCorrect && validPairs === matchPairs.length;
    }
  } else {
    isCorrect = answer === question.correctAnswer;
  }

  const pointsEarned = isCorrect
    ? calculateScore(question.points, responseTime, question.duration)
    : 0;

  // Update participant
  session.participants[participantIndex].answers.push({
    questionIndex,
    answer,
    isCorrect,
    responseTime,
    pointsEarned,
  });

  if (isCorrect) {
    session.participants[participantIndex].score += pointsEarned;
  }

  await session.save();

  return { isCorrect, pointsEarned, participant: session.participants[participantIndex] };
};

// ─── Check & Auto-Finish jika semua sudah jawab ───────────────
export const checkAndAutoFinish = async (
  sessionToken: string,
  questionIndex: number,
  io: Server
): Promise<boolean> => {
  const session = await Session.findOne({ token: sessionToken });
  if (!session || session.status !== "active") return false;

  const connectedParticipants = session.participants.filter((p) => p.isConnected);
  if (connectedParticipants.length === 0) return false;

  // Cek apakah SEMUA player yang terhubung sudah jawab soal ini
  const allAnswered = connectedParticipants.every((p) =>
    p.answers.some((a) => a.questionIndex === questionIndex)
  );

  if (allAnswered) {
    console.log(`✅ Semua player sudah jawab soal ${questionIndex}, langsung lanjut!`);
    await endQuestion(sessionToken, questionIndex, io);
    return true;
  }

  return false;
};

// ─── Start Quiz ───────────────────────────────────────────────
export const startQuiz = async (
  sessionToken: string,
  io: Server
): Promise<void> => {
  const session = await Session.findOne({ token: sessionToken });
  if (!session) return;

  // Update status jadi countdown
  session.status = "countdown";
  await session.save();

  const room = `session:${sessionToken}`;

  // Countdown 3-2-1
  for (let i = 3; i >= 1; i--) {
    emitToAll(io, room, "session:countdown", { count: i });
    await delay(1000);
  }

  // LET'S GO!
  emitToAll(io, room, "session:countdown", { count: "GO" });
  await delay(1000);

  // Kirim soal pertama
  await sendQuestion(sessionToken, 0, io);
};

// ─── Send Question ────────────────────────────────────────────
export const sendQuestion = async (
  sessionToken: string,
  questionIndex: number,
  io: Server
): Promise<void> => {
  const session = await Session.findOne({ token: sessionToken });
  if (!session || session.status === "finished" || session.status === "canceled") return;

  const quiz = await Quiz.findById(session.quizId);
  if (!quiz) return;

  const question = quiz.questions[questionIndex];
  if (!question) return;

  // Update session status
  session.status = "active";
  session.currentQuestion = questionIndex;
  session.startedAt = session.startedAt || new Date();
  await session.save();

  const room = `session:${sessionToken}`;
  const questionDuration = question.duration;

  // Simpan state soal aktif di Redis untuk reconnect
  await setJSON(
    keys.sessionState(sessionToken),
    {
      status: "active",
      currentQuestion: questionIndex,
      questionDuration,
      questionText: question.text,
      questionImageUrl: question.imageUrl || null,
      answerType: question.answerType || "multiple_choice",
      options: (question.answerType === "text" || question.answerType === "matching") ? [] : question.options,
      matchPairs: question.answerType === "matching" ? (question.matchPairs || []) : [],
      totalQuestions: quiz.questions.length,
      questionStartedAt: Date.now(),
    },
    TTL.SESSION_STATE
  );

  // Kirim soal ke semua peserta (TANPA jawaban benar!)
  emitToAll(io, room, "session:questionStart", {
    question: {
      order: questionIndex + 1,
      text: question.text,
      imageUrl: question.imageUrl || null,
      answerType: question.answerType || "multiple_choice",
      options: (question.answerType === "text" || question.answerType === "matching") ? [] : question.options,
      matchPairs: question.answerType === "matching" ? (question.matchPairs || []) : [],
      duration: questionDuration,
      totalQuestions: quiz.questions.length,
    },
    questionIndex,
  });

  // ─── Server-Side Timer ────────────────────────────────────────
  let timeLeft = questionDuration;
  const timerInterval = setInterval(async () => {
    timeLeft--;

    // Re-check apakah session masih active (bisa di-stop admin)
    const currentSession = await Session.findOne({ token: sessionToken });
    if (!currentSession || currentSession.status !== "active" || currentSession.currentQuestion !== questionIndex) {
      clearInterval(timerInterval);
      return;
    }

    if (timeLeft > 0) {
      emitToAll(io, room, "session:timerUpdate", {
        remaining: timeLeft,
        questionIndex,
      });
    } else {
      clearInterval(timerInterval);

      // Cek lagi setelah timer habis (guard race condition)
      const postTimerSession = await Session.findOne({ token: sessionToken });
      if (!postTimerSession || postTimerSession.status !== "active" || postTimerSession.currentQuestion !== questionIndex) {
        return;
      }

      console.log(`⏰ Timer soal ${questionIndex} habis — force end question`);
      await endQuestion(sessionToken, questionIndex, io);
    }
  }, 1000);
};

// ─── End Question ─────────────────────────────────────────────
export const endQuestion = async (
  sessionToken: string,
  questionIndex: number,
  io: Server
): Promise<void> => {
  // ── Redis SETNX lock: mencegah double-trigger endQuestion ───
  // Jauh lebih cepat dari MongoDB findOneAndUpdate untuk high-concurrency
  const lockKey = keys.questionLock(sessionToken, questionIndex);
  const locked = await acquireLock(lockKey, TTL.GAME_LOCK);

  if (!locked) {
    // Sudah ada proses lain yang handle soal ini
    console.log(`🔒 endQuestion lock: soal ${questionIndex} sudah di-handle`);
    return;
  }

  // Atomic update status ke showing_result
  const session = await Session.findOneAndUpdate(
    {
      token: sessionToken,
      status: "active",
      currentQuestion: questionIndex,
    },
    { $set: { status: "showing_result" } },
    { new: true }
  );

  // Guard: Jika tidak berhasil update, abandon (sudah ada process lain atau status berbeda)
  if (!session) {
    return;
  }

  const quiz = await Quiz.findById(session.quizId);
  if (!quiz) return;

  const question = quiz.questions[questionIndex];
  if (!question) return;

  const room = `session:${sessionToken}`;
  const leaderboard = getLeaderboard(session);
  const stats = getQuestionStats(session, questionIndex);

  // Simpan state leaderboard terbaru di Redis
  await setJSON(
    keys.sessionState(sessionToken),
    { status: "showing_result", currentQuestion: questionIndex },
    TTL.SESSION_STATE
  );

  // Kirim hasil ke semua peserta
  const isTextType = question.answerType === "text";
  const isMatchingType = question.answerType === "matching";

  emitToAll(io, room, "session:questionEnd", {
    correctAnswer: isTextType
      ? (question.acceptedAnswers?.[0] || "")
      : isMatchingType
        ? "MATCHING"
        : question.correctAnswer,
    answerType: question.answerType || "multiple_choice",
    acceptedAnswers: isTextType ? (question.acceptedAnswers || []) : [],
    matchPairs: isMatchingType ? (question.matchPairs || []) : [],
    leaderboard,
    stats,
    questionIndex,
  });

  // Kirim hasil personal ke tiap peserta
  session.participants.forEach((participant) => {
    const answer = participant.answers.find(
      (a) => a.questionIndex === questionIndex
    );

    io.to(participant.socketId).emit("session:myResult", {
      isCorrect: answer?.isCorrect ?? false,
      pointsEarned: answer?.pointsEarned ?? 0,
      myAnswer: answer?.answer ?? null,
      correctAnswer: isTextType
        ? (question.acceptedAnswers?.[0] || "")
        : isMatchingType
          ? "MATCHING"
          : question.correctAnswer,
      answerType: question.answerType || "multiple_choice",
      matchPairs: isMatchingType ? (question.matchPairs || []) : [],
      responseTime: answer?.responseTime ?? 0,
      leaderboard,
    });
  });

  // Tunggu 5 detik untuk show result screen
  await delay(5000);

  // Guard: cek session masih ada setelah delay
  const postResultSession = await Session.findOne({ token: sessionToken });
  if (!postResultSession || postResultSession.status === "finished" || postResultSession.status === "canceled") return;

  const nextIndex = questionIndex + 1;
  const isLastQuestion = nextIndex >= quiz.questions.length;

  if (isLastQuestion) {
    await finishQuiz(sessionToken, io);
  } else {
    postResultSession.status = "between";
    await postResultSession.save();

    emitToAll(io, room, "session:nextQuestion", {
      countdown: 5,
      nextQuestionIndex: nextIndex,
    });

    await delay(5000);

    // Guard sebelum pindah ke sendQuestion
    const preNextSession = await Session.findOne({ token: sessionToken });
    if (!preNextSession || preNextSession.status === "finished" || preNextSession.status === "canceled") return;

    await sendQuestion(sessionToken, nextIndex, io);
  }
};

// ─── Finish Quiz ──────────────────────────────────────────────
export const finishQuiz = async (
  sessionToken: string,
  io: Server
): Promise<void> => {
  // Atomic update — prevent double-finish race condition
  const session = await Session.findOneAndUpdate(
    { token: sessionToken, status: { $nin: ["finished", "canceled"] } },
    { $set: { status: "finished", finishedAt: new Date() } },
    { new: true }
  );

  if (!session) return; // Sudah finished sebelumnya

  // Update Redis state juga
  await setJSON(
    keys.sessionState(sessionToken),
    { status: "finished" },
    300 // Simpan 5 menit setelah selesai
  );

  const room = `session:${sessionToken}`;
  const finalLeaderboard = getLeaderboard(session);

  console.log(`🏆 Quiz ${sessionToken} selesai! Leaderboard: ${finalLeaderboard.length} player`);

  emitToAll(io, room, "session:finished", {
    finalLeaderboard,
  });
};