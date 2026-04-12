import Session from "../models/Session.model";

// Generate token 6 karakter unik (huruf + angka)
export const generateToken = async (): Promise<string> => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  let isUnique = false;

  while (!isUnique) {
    token = "";
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Cek keunikan token
    const existing = await Session.findOne({
      token,
      status: { $ne: "finished" },
    });

    if (!existing) isUnique = true;
  }

  return token;
};

// Validasi token
export const validateToken = async (
  token: string
): Promise<{
  valid: boolean;
  sessionId?: string;
  message?: string;
}> => {
  const upperToken = token.toUpperCase().trim();

  if (upperToken.length !== 6) {
    return { valid: false, message: "Token harus 6 karakter" };
  }

  const session = await Session.findOne({ token: upperToken });

  if (!session) {
    return { valid: false, message: "Token tidak valid atau tidak ditemukan" };
  }

  if (session.status === "finished") {
    return { valid: false, message: "Quiz sudah selesai" };
  }

  if (session.status === "active" || session.status === "between") {
    return { valid: false, message: "Quiz sedang berlangsung, tidak bisa bergabung" };
  }

  return { valid: true, sessionId: session._id.toString() };
};