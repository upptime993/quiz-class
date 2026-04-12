"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDuelSocket = void 0;
const DuelRoom_model_1 = __importDefault(require("../models/DuelRoom.model"));
const Quiz_model_1 = __importDefault(require("../models/Quiz.model"));
const game_service_1 = require("../services/game.service");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// ─── Emit ke room duel (namespace /duel) ──────────────────────
const emitToRoom = (io, token, event, data) => {
    io.of("/duel").to(`duel:${token}`).emit(event, data);
};
// ─── Serialize player info ────────────────────────────────────
const serializePlayer = (p) => ({
    username: p.username,
    avatar: p.avatar,
    score: p.score,
    isConnected: p.isConnected,
});
// ─── Duel Game Logic ──────────────────────────────────────────
const startDuel = async (token, io) => {
    const room = await DuelRoom_model_1.default.findOne({ token });
    if (!room || !room.opponent)
        return;
    const quiz = await Quiz_model_1.default.findById(room.quizId);
    if (!quiz)
        return;
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
const sendDuelQuestion = async (token, questionIndex, io) => {
    const room = await DuelRoom_model_1.default.findOne({ token });
    if (!room || room.status === "finished" || room.status === "canceled")
        return;
    const quiz = await Quiz_model_1.default.findById(room.quizId);
    if (!quiz)
        return;
    const question = quiz.questions[questionIndex];
    if (!question)
        return;
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
            options: question.answerType === "text" || question.answerType === "matching"
                ? []
                : question.options,
            matchPairs: question.answerType === "matching" ? question.matchPairs || [] : [],
            duration: question.duration,
            totalQuestions: quiz.questions.length,
        },
        questionIndex,
    });
    // Timer
    await delay(question.duration * 1000);
    // Race condition check
    const current = await DuelRoom_model_1.default.findOne({ token });
    if (!current ||
        current.status !== "active" ||
        current.currentQuestion !== questionIndex)
        return;
    await endDuelQuestion(token, questionIndex, io);
};
const endDuelQuestion = async (token, questionIndex, io) => {
    const room = await DuelRoom_model_1.default.findOne({ token });
    if (!room || room.status === "finished" || room.status === "canceled")
        return;
    if (room.status !== "active")
        return;
    const quiz = await Quiz_model_1.default.findById(room.quizId);
    if (!quiz)
        return;
    const question = quiz.questions[questionIndex];
    if (!question)
        return;
    room.status = "showing_result";
    await room.save();
    const isText = question.answerType === "text";
    const isMatching = question.answerType === "matching";
    const correctAnswer = isText
        ? question.acceptedAnswers?.[0] || ""
        : isMatching
            ? "MATCHING"
            : question.correctAnswer;
    // Emit hasil ke room
    emitToRoom(io, token, "duel:questionEnd", {
        correctAnswer,
        answerType: question.answerType || "multiple_choice",
        acceptedAnswers: isText ? question.acceptedAnswers || [] : [],
        matchPairs: isMatching ? question.matchPairs || [] : [],
        questionIndex,
        creatorScore: room.creator.score,
        opponentScore: room.opponent?.score || 0,
    });
    // Emit hasil personal ke masing-masing player
    const emitPersonal = (socketId, player) => {
        const answer = player.answers.find((a) => a.questionIndex === questionIndex);
        io.of("/duel").to(socketId).emit("duel:myResult", {
            isCorrect: answer?.isCorrect ?? false,
            pointsEarned: answer?.pointsEarned ?? 0,
            myAnswer: answer?.answer ?? null,
            correctAnswer,
            answerType: question.answerType || "multiple_choice",
            matchPairs: isMatching ? question.matchPairs || [] : [],
            responseTime: answer?.responseTime ?? 0,
            creatorScore: room.creator.score,
            opponentScore: room.opponent?.score || 0,
        });
    };
    emitPersonal(room.creator.socketId, room.creator);
    if (room.opponent)
        emitPersonal(room.opponent.socketId, room.opponent);
    await delay(5000);
    const postRoom = await DuelRoom_model_1.default.findOne({ token });
    if (!postRoom || postRoom.status === "finished" || postRoom.status === "canceled")
        return;
    const nextIndex = questionIndex + 1;
    const isLast = nextIndex >= quiz.questions.length;
    if (isLast) {
        await finishDuel(token, io);
    }
    else {
        postRoom.status = "between";
        await postRoom.save();
        emitToRoom(io, token, "duel:nextQuestion", {
            countdown: 5,
            nextQuestionIndex: nextIndex,
        });
        await delay(5000);
        const preNext = await DuelRoom_model_1.default.findOne({ token });
        if (!preNext || preNext.status === "finished" || preNext.status === "canceled")
            return;
        await sendDuelQuestion(token, nextIndex, io);
    }
};
const finishDuel = async (token, io) => {
    const room = await DuelRoom_model_1.default.findOne({ token });
    if (!room)
        return;
    room.status = "finished";
    room.finishedAt = new Date();
    await room.save();
    const creatorScore = room.creator.score;
    const opponentScore = room.opponent?.score || 0;
    const winner = creatorScore > opponentScore
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
const initDuelSocket = (io) => {
    // Gunakan namespace /duel
    const duelNs = io.of("/duel");
    duelNs.on("connection", (socket) => {
        console.log(`⚔️ Duel socket terhubung: ${socket.id}`);
        // ─── CREATE & JOIN AS CREATOR ──────────────────────────
        socket.on("duel:join", async (data) => {
            try {
                const { token, username, role } = data;
                const upperToken = token.toUpperCase().trim();
                const room = await DuelRoom_model_1.default.findOne({ token: upperToken });
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
                }
                else {
                    // Opponent
                    if (room.opponent) {
                        socket.emit("duel:error", { message: "Room sudah penuh!" });
                        return;
                    }
                    if (room.creator.username.toLowerCase() === username.toLowerCase()) {
                        socket.emit("duel:error", { message: "Username sudah dipakai oleh creator" });
                        return;
                    }
                    room.opponent = {
                        socketId: socket.id,
                        username: username.trim(),
                        avatar: { emoji: "🐨", mixEmoji: null, mixImageUrl: null },
                        score: 0,
                        answers: [],
                        isConnected: true,
                    };
                }
                await room.save();
                const duelRoom = `duel:${upperToken}`;
                socket.join(duelRoom);
                socket.duelToken = upperToken;
                socket.duelRole = role;
                socket.duelUsername = username;
                // Konfirmasi ke player
                socket.emit("duel:joined", {
                    token: upperToken,
                    role,
                    creator: serializePlayer(room.creator),
                    opponent: room.opponent ? serializePlayer(room.opponent) : null,
                });
                // Notify semua di room
                emitToRoom(io, upperToken, "duel:roomUpdate", {
                    creator: serializePlayer(room.creator),
                    opponent: room.opponent ? serializePlayer(room.opponent) : null,
                    status: room.status,
                });
                console.log(`⚔️ ${username} (${role}) bergabung ke duel room ${upperToken}`);
            }
            catch (error) {
                console.error("duel:join error:", error);
                socket.emit("duel:error", { message: "Gagal bergabung ke room" });
            }
        });
        // ─── SET AVATAR ────────────────────────────────────────
        socket.on("duel:setAvatar", async (data) => {
            try {
                const token = socket.duelToken;
                const role = socket.duelRole;
                if (!token)
                    return;
                const room = await DuelRoom_model_1.default.findOne({ token });
                if (!room)
                    return;
                const avatar = {
                    emoji: data.emoji,
                    mixEmoji: data.mixEmoji,
                    mixImageUrl: data.mixImageUrl,
                };
                if (role === "creator") {
                    room.creator.avatar = avatar;
                }
                else if (room.opponent) {
                    room.opponent.avatar = avatar;
                }
                await room.save();
                emitToRoom(io, token, "duel:roomUpdate", {
                    creator: serializePlayer(room.creator),
                    opponent: room.opponent ? serializePlayer(room.opponent) : null,
                    status: room.status,
                });
            }
            catch (error) {
                console.error("duel:setAvatar error:", error);
            }
        });
        // ─── START BATTLE (manual, by creator) ────────────────
        socket.on("duel:startBattle", async () => {
            try {
                const token = socket.duelToken;
                const role = socket.duelRole;
                if (!token || role !== "creator") {
                    socket.emit("duel:error", { message: "Hanya creator yang bisa memulai battle" });
                    return;
                }
                const room = await DuelRoom_model_1.default.findOne({ token });
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
            }
            catch (error) {
                console.error("duel:startBattle error:", error);
            }
        });
        // ─── SUBMIT ANSWER ─────────────────────────────────────
        socket.on("duel:answer", async (data) => {
            try {
                const token = socket.duelToken;
                const role = socket.duelRole;
                if (!token)
                    return;
                const room = await DuelRoom_model_1.default.findOne({ token });
                if (!room)
                    return;
                const quiz = await Quiz_model_1.default.findById(room.quizId);
                if (!quiz)
                    return;
                const question = quiz.questions[data.questionIndex];
                if (!question)
                    return;
                const player = role === "creator" ? room.creator : room.opponent;
                if (!player)
                    return;
                // Cek sudah jawab
                const alreadyAnswered = player.answers.some((a) => a.questionIndex === data.questionIndex);
                if (alreadyAnswered)
                    return;
                // Validate answer
                let isCorrect = false;
                if (question.answerType === "text") {
                    const norm = data.answer.trim().toLowerCase();
                    isCorrect = (question.acceptedAnswers || []).some((a) => a.trim().toLowerCase() === norm);
                }
                else if (question.answerType === "matching") {
                    if (data.answer.startsWith("MATCHING:")) {
                        const matchStr = data.answer.replace("MATCHING:", "");
                        const pairs = matchStr.split(",");
                        const matchPairs = question.matchPairs || [];
                        let allCorrect = true;
                        let validPairs = 0;
                        for (const pair of pairs) {
                            const [l, r] = pair.split(":").map(Number);
                            if (isNaN(l) || isNaN(r))
                                continue;
                            validPairs++;
                            if (l !== r) {
                                allCorrect = false;
                                break;
                            }
                        }
                        isCorrect = allCorrect && validPairs === matchPairs.length;
                    }
                }
                else {
                    isCorrect = data.answer === question.correctAnswer;
                }
                const pointsEarned = isCorrect
                    ? (0, game_service_1.calculateScore)(question.points, data.responseTime, question.duration)
                    : 0;
                player.answers.push({
                    questionIndex: data.questionIndex,
                    answer: data.answer,
                    isCorrect,
                    responseTime: data.responseTime,
                    pointsEarned,
                });
                if (isCorrect)
                    player.score += pointsEarned;
                await room.save();
                // Konfirmasi ke player
                socket.emit("duel:answerReceived", {
                    questionIndex: data.questionIndex,
                });
                // Update score realtime ke keduanya
                const updatedRoom = await DuelRoom_model_1.default.findOne({ token });
                if (updatedRoom) {
                    emitToRoom(io, token, "duel:scoreUpdate", {
                        creatorScore: updatedRoom.creator.score,
                        opponentScore: updatedRoom.opponent?.score || 0,
                    });
                }
                // Cek apakah keduanya sudah menjawab → force end soal
                const allAnswered = room.creator.answers.some((a) => a.questionIndex === data.questionIndex) &&
                    room.opponent?.answers.some((a) => a.questionIndex === data.questionIndex);
                if (allAnswered) {
                    await endDuelQuestion(token, data.questionIndex, io);
                }
            }
            catch (error) {
                console.error("duel:answer error:", error);
            }
        });
        // ─── REACTION ──────────────────────────────────────────
        socket.on("duel:reaction", (data) => {
            const token = socket.duelToken;
            const username = socket.duelUsername;
            if (!token || !username)
                return;
            emitToRoom(io, token, "duel:reaction", {
                username,
                emoji: data.emoji,
                id: `${socket.id}-${Date.now()}`,
            });
        });
        // ─── DISCONNECT ────────────────────────────────────────
        socket.on("disconnect", async () => {
            try {
                const token = socket.duelToken;
                const role = socket.duelRole;
                const username = socket.duelUsername;
                if (!token)
                    return;
                const room = await DuelRoom_model_1.default.findOne({ token });
                if (!room)
                    return;
                if (role === "creator") {
                    room.creator.isConnected = false;
                }
                else if (room.opponent) {
                    room.opponent.isConnected = false;
                }
                await room.save();
                emitToRoom(io, token, "duel:opponentLeft", {
                    username,
                    role,
                });
                console.log(`⚔️ ${username} (${role}) terputus dari duel ${token}`);
            }
            catch (error) {
                console.error("duel disconnect error:", error);
            }
        });
    });
};
exports.initDuelSocket = initDuelSocket;
//# sourceMappingURL=duel.socket.js.map