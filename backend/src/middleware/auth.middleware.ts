import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Token tidak ditemukan, akses ditolak",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      adminId: string;
      username: string;
    };

    (req as any).adminId = decoded.adminId;
    (req as any).adminUsername = decoded.username;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah expired",
    });
  }
};