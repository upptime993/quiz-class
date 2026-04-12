import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Routes
import authRoutes from "./routes/auth.routes";
import quizRoutes from "./routes/quiz.routes";
import sessionRoutes from "./routes/session.routes";
import duelRoutes from "./routes/duel.routes";

// Socket handlers
import { initPlayerSocket } from "./socket/player.socket";
import { initAdminSocket } from "./socket/admin.socket";
import { initDuelSocket } from "./socket/duel.socket";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO Setup ───────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Middleware ─────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files untuk upload gambar
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ─── Routes ─────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/duel", duelRoutes);

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
initPlayerSocket(io);
initAdminSocket(io);
initDuelSocket(io);

// ─── Database Connection ─────────────────────────────────────
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI tidak ditemukan di environment variables");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Atlas terhubung!");

    // Seed admin default jika belum ada
    await seedDefaultAdmin();
  } catch (error) {
    console.error("❌ Gagal koneksi MongoDB:", error);
    process.exit(1);
  }
};

// Buat admin default saat pertama kali
const seedDefaultAdmin = async () => {
  const Admin = (await import("./models/Admin.model")).default;
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
  await mongoose.connection.close();
  process.exit(0);
});

export { io };