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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const AccessoriesSchema = new mongoose_1.Schema({
    hat: { type: String, default: null },
    glasses: { type: String, default: null },
    other: { type: String, default: null },
}, { _id: false });
const AvatarSchema = new mongoose_1.Schema({
    emoji: { type: String, default: "🦊" },
    mixEmoji: { type: String, default: null },
    mixImageUrl: { type: String, default: null },
    accessories: { type: AccessoriesSchema, default: null },
}, { _id: false });
const AnswerSchema = new mongoose_1.Schema({
    questionIndex: { type: Number, required: true },
    answer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    responseTime: { type: Number, required: true },
    pointsEarned: { type: Number, default: 0 },
}, { _id: false });
const ParticipantSchema = new mongoose_1.Schema({
    socketId: { type: String, required: true },
    username: {
        type: String,
        required: true,
        trim: true,
    },
    avatar: { type: AvatarSchema, default: () => ({}) },
    score: { type: Number, default: 0 },
    answers: [AnswerSchema],
    joinedAt: { type: Date, default: Date.now },
    isConnected: { type: Boolean, default: true },
}, { _id: false });
const SessionSchema = new mongoose_1.Schema({
    quizId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Quiz",
        required: true,
    },
    adminId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
    },
    name: {
        type: String,
        default: "",
    },
    token: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
    },
    status: {
        type: String,
        enum: [
            "waiting",
            "countdown",
            "active",
            "between",
            "showing_result",
            "finished",
            "canceled",
        ],
        default: "waiting",
    },
    currentQuestion: {
        type: Number,
        default: 0,
    },
    participants: [ParticipantSchema],
    startedAt: Date,
    finishedAt: Date,
}, {
    timestamps: true,
});
// Index untuk pencarian cepat
SessionSchema.index({ token: 1 });
SessionSchema.index({ status: 1 });
exports.default = mongoose_1.default.model("Session", SessionSchema);
//# sourceMappingURL=Session.model.js.map