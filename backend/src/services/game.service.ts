import Session, { ISession, IParticipant } from "../models/Session.model";
import Quiz, { IQuestion } from "../models/Quiz.model";
import { Server } from "socket.io";

// Helper: emit to both root namespace AND /admin namespace
const emitToAll = (io: Server, room: string, event: string, data: any) => {
  io.to(room).emit(event, data);
  io.of("/admin").to(room).emit(event, data);
};

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
      answers: p.answers, // Includes detailed answers for post-quiz stats
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
      // Text-type answer
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

  // Cek sudah jawab belum
  const alreadyAnswered = participant.answers.some(
    (a) => a.questionIndex === questionIndex
  );
  if (alreadyAnswered)
    return { isCorrect: false, pointsEarned: 0, participant };

  // Determine correctness based on answer type
  let isCorrect = false;
  if (question.answerType === "text") {
    // Case-insensitive text matching against accepted answers
    const normalizedAnswer = answer.trim().toLowerCase();
    const accepted = question.acceptedAnswers || [];
    isCorrect = accepted.some(
      (a) => a.trim().toLowerCase() === normalizedAnswer
    );
  } else if (question.answerType === "matching") {
    // Matching: answer is "MATCHING:leftIdx:rightOrigIdx,leftIdx:rightOrigIdx,..."
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
        
        // Correct if leftIdx matches rightOrigIdx (same index in matchPairs)
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

  // Kirim soal ke semua peserta (TANPA jawaban benar!)
  emitToAll(io, room, "session:questionStart", {
    question: {
      order: questionIndex + 1,
      text: question.text,
      imageUrl: question.imageUrl || null,
      answerType: question.answerType || "multiple_choice",
      options: (question.answerType === "text" || question.answerType === "matching") ? [] : question.options,
      // Send matchPairs for matching type (shuffling happens on client)
      matchPairs: question.answerType === "matching" ? (question.matchPairs || []) : [],
      duration: question.duration,
      totalQuestions: quiz.questions.length,
    },
    questionIndex,
  });

  // Timer soal
  await delay(question.duration * 1000);

  // Setelah timer habis, validasi kembali session untuk mencegah race condition (misal admin Force Next atau Stop)
  const currentSession = await Session.findOne({ token: sessionToken });
  if (!currentSession || currentSession.status !== "active" || currentSession.currentQuestion !== questionIndex) {
    return; // Timed out tapi status sudah diubah oleh aksi lain, abort!
  }

  // Lanjutkan end question
  await endQuestion(sessionToken, questionIndex, io);
};

// ─── End Question ─────────────────────────────────────────────
export const endQuestion = async (
  sessionToken: string,
  questionIndex: number,
  io: Server
): Promise<void> => {
  const session = await Session.findOne({ token: sessionToken });
  
  // Guard: Jangan eksekusi jika sudah selesai, batal, atau BUKAN active (mencegah multiple trigger)
  if (!session || session.status === "finished" || session.status === "canceled") return;
  if (session.status !== "active") return; // Hanya bisa endQuestion jika sedang active

  const quiz = await Quiz.findById(session.quizId);
  if (!quiz) return;

  const question = quiz.questions[questionIndex];
  if (!question) return;

  // Update status (Lock ke showing_result)
  session.status = "showing_result";
  await session.save();

  const room = `session:${sessionToken}`;
  const leaderboard = getLeaderboard(session);
  const stats = getQuestionStats(session, questionIndex);

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

  // Tunggu sebentar lalu cek soal berikutnya
  await delay(5000);

  // Guard pengecekan jika admin Stop Quiz saat delay
  const postResultSession = await Session.findOne({ token: sessionToken });
  if (!postResultSession || postResultSession.status === "finished" || postResultSession.status === "canceled") return;

  const nextIndex = questionIndex + 1;
  const isLastQuestion = nextIndex >= quiz.questions.length;

  if (isLastQuestion) {
    // Quiz selesai!
    await finishQuiz(sessionToken, io);
  } else {
    // Lanjut soal berikutnya
    postResultSession.status = "between";
    await postResultSession.save();

    emitToAll(io, room, "session:nextQuestion", {
      countdown: 5,
      nextQuestionIndex: nextIndex,
    });

    await delay(5000);
    
    // Guard terakhir sebelum pindah ke sendQuestion
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
  const session = await Session.findOne({ token: sessionToken });
  if (!session) return;

  session.status = "finished";
  session.finishedAt = new Date();
  await session.save();

  const room = `session:${sessionToken}`;
  const finalLeaderboard = getLeaderboard(session);

  emitToAll(io, room, "session:finished", {
    finalLeaderboard,
  });
};

// ─── Helper ───────────────────────────────────────────────────
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));