import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// ─── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "Username dan password wajib diisi",
      });
      return;
    }

    const admin = await Admin.findOne({ username: username.trim() });
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

    const token = jwt.sign(
      { adminId: admin._id, username: admin.username },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
    );

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).adminId).select(
      "-password"
    );
    if (!admin) {
      res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
      return;
    }

    if (!admin.role || (admin.username === "admin" && admin.role !== "superadmin")) {
      admin.role = "superadmin";
      await admin.save();
    }

    res.json({ success: true, data: { admin } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUT /api/auth/update ─────────────────────────────────────
router.put("/update", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { username, className, currentPassword, newPassword } = req.body;
    const admin = await Admin.findById((req as any).adminId);

    if (!admin) {
      res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
      return;
    }

    if (username) admin.username = username;
    if (className) admin.className = className;

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
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── TEACHER MANAGEMENT ───────────────────────────────────────

// GET /api/auth/teacher
router.get("/teacher", authMiddleware, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).adminId);
    if (!admin || admin.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Akses ditolak" });
      return;
    }

    const teachers = await Admin.find({ role: "teacher" }).select("-password");
    res.json({ success: true, data: { teachers } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/teacher
router.post("/teacher", authMiddleware, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).adminId);
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

    const exist = await Admin.findOne({ username });
    if (exist) {
      res.status(400).json({ success: false, message: "Username sudah digunakan" });
      return;
    }

    const newTeacher = await Admin.create({
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
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/auth/teacher/:id
router.put("/teacher/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).adminId);
    if (!admin || admin.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Akses ditolak" });
      return;
    }

    const target = await Admin.findById(req.params.id);
    if (!target || target.role !== "teacher") {
      res.status(404).json({ success: false, message: "Guru tidak ditemukan" });
      return;
    }

    const { username, className, newPassword } = req.body;
    if (username) target.username = username;
    if (className) target.className = className;
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
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/auth/teacher/:id
router.delete("/teacher/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).adminId);
    if (!admin || admin.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Akses ditolak" });
      return;
    }

    const target = await Admin.findById(req.params.id);
    if (!target || target.role !== "teacher") {
      res.status(404).json({ success: false, message: "Guru tidak ditemukan" });
      return;
    }

    await target.deleteOne();
    res.json({ success: true, message: "Akun guru berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;