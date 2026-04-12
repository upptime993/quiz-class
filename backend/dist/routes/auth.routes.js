"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Admin_model_1 = __importDefault(require("../models/Admin.model"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ─── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({
                success: false,
                message: "Username dan password wajib diisi",
            });
            return;
        }
        const admin = await Admin_model_1.default.findOne({ username: username.trim() });
        if (!admin) {
            res.status(401).json({
                success: false,
                message: "Username atau password salah",
            });
            return;
        }
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: "Username atau password salah",
            });
            return;
        }
        // Auto-migration: user lama yang belum punya role, otomatis jadi superadmin
        // Auto-migration: user lama yang belum punya role, atau user "admin", otomatis jadi superadmin
        if (!admin.role || (admin.username === "admin" && admin.role !== "superadmin")) {
            admin.role = "superadmin";
            await admin.save();
        }
        const token = jsonwebtoken_1.default.sign({ adminId: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
        res.json({
            success: true,
            message: "Login berhasil!",
            data: {
                token,
                admin: {
                    _id: admin._id,
                    username: admin.username,
                    className: admin.className,
                    role: admin.role,
                },
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});
// ─── GET /api/auth/me ─────────────────────────────────────────
router.get("/me", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const admin = await Admin_model_1.default.findById(req.adminId).select("-password");
        if (!admin) {
            res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
            return;
        }
        if (!admin.role || (admin.username === "admin" && admin.role !== "superadmin")) {
            admin.role = "superadmin";
            await admin.save();
        }
        res.json({ success: true, data: { admin } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── PUT /api/auth/update ─────────────────────────────────────
router.put("/update", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { username, className, currentPassword, newPassword } = req.body;
        const admin = await Admin_model_1.default.findById(req.adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
            return;
        }
        if (username)
            admin.username = username;
        if (className)
            admin.className = className;
        if (newPassword) {
            if (!currentPassword) {
                res.status(400).json({
                    success: false,
                    message: "Password lama wajib diisi untuk mengubah password",
                });
                return;
            }
            const isMatch = await admin.comparePassword(currentPassword);
            if (!isMatch) {
                res.status(401).json({
                    success: false,
                    message: "Password lama tidak sesuai",
                });
                return;
            }
            admin.password = newPassword;
        }
        await admin.save();
        res.json({
            success: true,
            message: "Profil berhasil diperbarui",
            data: {
                admin: {
                    _id: admin._id,
                    username: admin.username,
                    className: admin.className,
                    role: admin.role,
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ─── TEACHER MANAGEMENT ───────────────────────────────────────
// GET /api/auth/teacher
router.get("/teacher", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const admin = await Admin_model_1.default.findById(req.adminId);
        if (!admin || admin.role !== "superadmin") {
            res.status(403).json({ success: false, message: "Akses ditolak" });
            return;
        }
        const teachers = await Admin_model_1.default.find({ role: "teacher" }).select("-password");
        res.json({ success: true, data: { teachers } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/auth/teacher
router.post("/teacher", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const admin = await Admin_model_1.default.findById(req.adminId);
        if (!admin || admin.role !== "superadmin") {
            res.status(403).json({ success: false, message: "Akses ditolak" });
            return;
        }
        const { username, password, className } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, message: "Username dan password wajib diisi" });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
            return;
        }
        const exist = await Admin_model_1.default.findOne({ username });
        if (exist) {
            res.status(400).json({ success: false, message: "Username sudah digunakan" });
            return;
        }
        const newTeacher = await Admin_model_1.default.create({
            username,
            password,
            className: className || "Kelas Guru",
            role: "teacher"
        });
        res.status(201).json({
            success: true,
            message: "Akun guru berhasil dibuat",
            data: {
                teacher: {
                    _id: newTeacher._id,
                    username: newTeacher.username,
                    className: newTeacher.className,
                    role: newTeacher.role,
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/auth/teacher/:id
router.put("/teacher/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const admin = await Admin_model_1.default.findById(req.adminId);
        if (!admin || admin.role !== "superadmin") {
            res.status(403).json({ success: false, message: "Akses ditolak" });
            return;
        }
        const target = await Admin_model_1.default.findById(req.params.id);
        if (!target || target.role !== "teacher") {
            res.status(404).json({ success: false, message: "Guru tidak ditemukan" });
            return;
        }
        const { username, className, newPassword } = req.body;
        if (username)
            target.username = username;
        if (className)
            target.className = className;
        if (newPassword) {
            if (newPassword.length < 6) {
                res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
                return;
            }
            target.password = newPassword;
        }
        await target.save();
        res.json({
            success: true,
            message: "Akun guru berhasil diperbarui",
            data: {
                teacher: {
                    _id: target._id,
                    username: target.username,
                    className: target.className,
                    role: target.role,
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/auth/teacher/:id
router.delete("/teacher/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const admin = await Admin_model_1.default.findById(req.adminId);
        if (!admin || admin.role !== "superadmin") {
            res.status(403).json({ success: false, message: "Akses ditolak" });
            return;
        }
        const target = await Admin_model_1.default.findById(req.params.id);
        if (!target || target.role !== "teacher") {
            res.status(404).json({ success: false, message: "Guru tidak ditemukan" });
            return;
        }
        await target.deleteOne();
        res.json({ success: true, message: "Akun guru berhasil dihapus" });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map