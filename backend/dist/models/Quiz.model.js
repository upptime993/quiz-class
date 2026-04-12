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
const OptionSchema = new mongoose_1.Schema({
    label: {
        type: String,
        required: true,
        enum: ["A", "B", "C", "D"],
    },
    text: {
        type: String,
        trim: true,
        default: "",
    },
}, { _id: false });
const MatchPairSchema = new mongoose_1.Schema({
    left: { type: String, required: true, trim: true },
    right: { type: String, required: true, trim: true },
}, { _id: false });
const QuestionSchema = new mongoose_1.Schema({
    order: {
        type: Number,
        required: true,
    },
    text: {
        type: String,
        required: [true, "Teks soal wajib diisi"],
        trim: true,
    },
    imageUrl: {
        type: String,
        default: null,
    },
    duration: {
        type: Number,
        default: 20,
        min: [5, "Durasi minimal 5 detik"],
        max: [120, "Durasi maksimal 120 detik"],
    },
    answerType: {
        type: String,
        enum: ["multiple_choice", "text", "matching"],
        default: "multiple_choice",
    },
    options: {
        type: [OptionSchema],
        validate: {
            validator: function (opts) {
                // Only require exactly 4 options for multiple choice
                if (this.answerType === "text" || this.answerType === "matching")
                    return true;
                return opts.length === 4 && opts.every((o) => o.text && o.text.trim().length > 0);
            },
            message: "Soal pilihan ganda harus memiliki tepat 4 pilihan jawaban yang terisi",
        },
    },
    correctAnswer: {
        type: String,
        required: [true, "Jawaban benar wajib ditentukan"],
        validate: {
            validator: function (val) {
                if (this.answerType === "text") {
                    return val === "TEXT";
                }
                if (this.answerType === "matching") {
                    return val === "MATCHING";
                }
                // For multiple choice, must be A, B, C, or D
                return ["A", "B", "C", "D"].includes(val);
            },
            message: "Jawaban benar tidak valid",
        },
    },
    acceptedAnswers: {
        type: [String],
        default: [],
    },
    matchPairs: {
        type: [MatchPairSchema],
        default: [],
    },
    points: {
        type: Number,
        default: 1000,
    },
});
const QuizSchema = new mongoose_1.Schema({
    adminId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
    },
    title: {
        type: String,
        required: [true, "Judul quiz wajib diisi"],
        trim: true,
        maxlength: [100, "Judul maksimal 100 karakter"],
    },
    description: {
        type: String,
        default: "",
        trim: true,
    },
    defaultDuration: {
        type: Number,
        default: 20,
    },
    questions: [QuestionSchema],
    totalQuestions: {
        type: Number,
        default: 0,
    },
    allow1v1: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
// Auto update totalQuestions
QuizSchema.pre("save", function (next) {
    this.totalQuestions = this.questions.length;
    next();
});
exports.default = mongoose_1.default.model("Quiz", QuizSchema);
//# sourceMappingURL=Quiz.model.js.map