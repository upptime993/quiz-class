"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAdminSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Session_model_1 = __importDefault(require("../models/Session.model"));
const game_service_1 = require("../services/game.service");
const initAdminSocket = (io) => {
    // Namespace khusus admin
    const adminNamespace = io.of("/admin");
    adminNamespace.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Token admin tidak ditemukan"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.adminId = decoded.adminId;
            socket.adminUsername = decoded.username;
            next();
        }
        catch {
            next(new Error("Token admin tidak valid"));
        }
    });
    adminNamespace.on("connection", (socket) => {
        console.log(`👑 Admin terhubung: ${socket.adminUsername}`);
        // ─── JOIN SESSION MONITOR ────────────────────────────────
        socket.on("admin:joinSession", async (data) => {
            try {
                const { sessionToken } = data;
                const session = await Session_model_1.default.findOne({
                    token: sessionToken.toUpperCase(),
                    adminId: socket.adminId,
                });
                if (!session) {
                    socket.emit("admin:error", { message: "Sesi tidak ditemukan" });
                    return;
                }
                // Join both rooms: admin-specific and shared session room
                socket.join(`admin:${sessionToken}`);
                socket.join(`session:${sessionToken}`);
                socket.sessionToken = sessionToken.toUpperCase();
                socket.emit("admin:sessionInfo", {
                    session: {
                        _id: session._id,
                        token: session.token,
                        status: session.status,
                        currentQuestion: session.currentQuestion,
                        participantCount: session.participants.filter((p) => p.isConnected).length,
                        participants: session.participants,
                    },
                    leaderboard: (0, game_service_1.getLeaderboard)(session),
                });
            }
            catch (error) {
                console.error("admin:joinSession error:", error);
            }
        });
        // ─── START QUIZ ──────────────────────────────────────────
        socket.on("admin:startQuiz", async (data) => {
            try {
                const { sessionToken } = data;
                const session = await Session_model_1.default.findOne({
                    token: sessionToken.toUpperCase(),
                    adminId: socket.adminId,
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
                (0, game_service_1.startQuiz)(sessionToken.toUpperCase(), io);
            }
            catch (error) {
                console.error("admin:startQuiz error:", error);
            }
        });
        // ─── FORCE NEXT QUESTION ──────────────────────────────────
        socket.on("admin:forceNext", async (data) => {
            try {
                const { sessionToken, questionIndex } = data;
                const session = await Session_model_1.default.findOne({
                    token: sessionToken.toUpperCase(),
                    adminId: socket.adminId,
                });
                if (!session || session.status === "finished")
                    return;
                // Force end current question
                await (0, game_service_1.endQuestion)(sessionToken.toUpperCase(), questionIndex, io);
            }
            catch (error) {
                console.error("admin:forceNext error:", error);
            }
        });
        // ─── STOP QUIZ ───────────────────────────────────────────
        socket.on("admin:stopQuiz", async (data) => {
            try {
                const { sessionToken } = data;
                const session = await Session_model_1.default.findOne({
                    token: sessionToken.toUpperCase(),
                    adminId: socket.adminId,
                });
                if (!session)
                    return;
                await (0, game_service_1.finishQuiz)(sessionToken.toUpperCase(), io);
            }
            catch (error) {
                console.error("admin:stopQuiz error:", error);
            }
        });
        // ─── CANCEL QUIZ ─────────────────────────────────────────
        socket.on("admin:cancelSession", async (data) => {
            try {
                const { sessionToken } = data;
                const session = await Session_model_1.default.findOne({
                    token: sessionToken.toUpperCase(),
                    adminId: socket.adminId,
                });
                if (!session)
                    return;
                session.status = "canceled";
                await session.save();
                // Emit to all players and admin looking at this room
                const room = `session:${sessionToken.toUpperCase()}`;
                io.to(room).emit("session:canceled", { message: "Sesi telah dibatalkan oleh admin." });
                io.of("/admin").to(room).emit("session:canceled", { message: "Sesi telah dibatalkan oleh admin." });
            }
            catch (error) {
                console.error("admin:cancelSession error:", error);
            }
        });
        // ─── GET LIVE STATS ──────────────────────────────────────
        socket.on("admin:getStats", async (data) => {
            try {
                const session = await Session_model_1.default.findOne({
                    token: data.sessionToken.toUpperCase(),
                });
                if (!session)
                    return;
                const stats = (0, game_service_1.getQuestionStats)(session, data.questionIndex);
                const leaderboard = (0, game_service_1.getLeaderboard)(session);
                socket.emit("admin:statsUpdate", { stats, leaderboard });
            }
            catch (error) {
                console.error("admin:getStats error:", error);
            }
        });
        socket.on("disconnect", () => {
            console.log(`👑 Admin terputus: ${socket.adminUsername}`);
        });
    });
};
exports.initAdminSocket = initAdminSocket;
//# sourceMappingURL=admin.socket.js.map