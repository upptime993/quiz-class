"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const quiz_routes_1 = __importDefault(require("./routes/quiz.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const duel_routes_1 = __importDefault(require("./routes/duel.routes"));
// Socket handlers
const player_socket_1 = require("./socket/player.socket");
const admin_socket_1 = require("./socket/admin.socket");
const duel_socket_1 = require("./socket/duel.socket");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// ─── Socket.IO Setup ───────────────────────────────────────
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});
exports.io = io;
// ─── Middleware ─────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Static files untuk upload gambar
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
// ─── Routes ─────────────────────────────────────────────────
app.use("/api/auth", auth_routes_1.default);
app.use("/api/quiz", quiz_routes_1.default);
app.use("/api/session", session_routes_1.default);
app.use("/api/duel", duel_routes_1.default);
// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "OK",
        message: "QuizClass Backend - by Ikbal x RPL",
        timestamp: new Date().toISOString(),
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ message: "Route tidak ditemukan" });
});
// ─── Socket.IO Handlers ──────────────────────────────────────
(0, player_socket_1.initPlayerSocket)(io);
(0, admin_socket_1.initAdminSocket)(io);
(0, duel_socket_1.initDuelSocket)(io);
// ─── Database Connection ─────────────────────────────────────
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error("MONGODB_URI tidak ditemukan di environment variables");
        }
        await mongoose_1.default.connect(mongoUri);
        console.log("✅ MongoDB Atlas terhubung!");
        // Seed admin default jika belum ada
        await seedDefaultAdmin();
    }
    catch (error) {
        console.error("❌ Gagal koneksi MongoDB:", error);
        process.exit(1);
    }
};
// Buat admin default saat pertama kali
const seedDefaultAdmin = async () => {
    const Admin = (await Promise.resolve().then(() => __importStar(require("./models/Admin.model")))).default;
    const existingAdmin = await Admin.findOne({ username: "admin" });
    if (!existingAdmin) {
        await Admin.create({
            username: "admin",
            password: "admin123",
            className: "Kelas RPL - by Ikbal",
        });
        console.log("✅ Admin default dibuat! Username: admin | Password: admin123");
        console.log("⚠️  Segera ganti password di menu Settings!");
    }
};
// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════╗
║         🎮 QuizClass Backend           ║
║         by Ikbal x RPL                 ║
╠════════════════════════════════════════╣
║  Status  : Running                     ║
║  Port    : ${PORT}                         ║
║  Mode    : ${process.env.NODE_ENV || "development"}              ║
╚════════════════════════════════════════╝
    `);
    });
});
// Handle shutdown gracefully
process.on("SIGTERM", async () => {
    console.log("⏳ Server shutting down...");
    await mongoose_1.default.connection.close();
    process.exit(0);
});
//# sourceMappingURL=server.js.map