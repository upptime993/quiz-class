"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToken = exports.generateToken = void 0;
const Session_model_1 = __importDefault(require("../models/Session.model"));
// Generate token 6 karakter unik (huruf + angka)
const generateToken = async () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "";
    let isUnique = false;
    while (!isUnique) {
        token = "";
        for (let i = 0; i < 6; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Cek keunikan token
        const existing = await Session_model_1.default.findOne({
            token,
            status: { $ne: "finished" },
        });
        if (!existing)
            isUnique = true;
    }
    return token;
};
exports.generateToken = generateToken;
// Validasi token
const validateToken = async (token) => {
    const upperToken = token.toUpperCase().trim();
    if (upperToken.length !== 6) {
        return { valid: false, message: "Token harus 6 karakter" };
    }
    const session = await Session_model_1.default.findOne({ token: upperToken });
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
exports.validateToken = validateToken;
//# sourceMappingURL=token.service.js.map