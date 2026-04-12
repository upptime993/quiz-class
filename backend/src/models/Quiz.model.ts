import mongoose, { Document, Schema } from "mongoose";

export interface IMatchPair {
  left: string;
  right: string;
}

export interface IOption {
  label: string;
  text: string;
}

export interface IQuestion {
  _id?: mongoose.Types.ObjectId;
  order: number;
  text: string;
  imageUrl?: string;
  duration: number;
  answerType: "multiple_choice" | "text" | "matching";
  options: IOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  matchPairs?: IMatchPair[];
  points: number;
}

export interface IQuiz extends Document {
  adminId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  defaultDuration: number;
  questions: IQuestion[];
  totalQuestions: number;
  allow1v1: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<IOption>(
  {
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
  },
  { _id: false }
);

const MatchPairSchema = new Schema<IMatchPair>(
  {
    left: { type: String, required: true, trim: true },
    right: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>({
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
      validator: function (this: IQuestion, opts: IOption[]) {
        // Only require exactly 4 options for multiple choice
        if (this.answerType === "text" || this.answerType === "matching") return true;
        return opts.length === 4 && opts.every((o) => o.text && o.text.trim().length > 0);
      },
      message: "Soal pilihan ganda harus memiliki tepat 4 pilihan jawaban yang terisi",
    },
  },
  correctAnswer: {
    type: String,
    required: [true, "Jawaban benar wajib ditentukan"],
    validate: {
      validator: function (this: IQuestion, val: string) {
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

const QuizSchema = new Schema<IQuiz>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Auto update totalQuestions
QuizSchema.pre("save", function (next) {
  this.totalQuestions = this.questions.length;
  next();
});

export default mongoose.model<IQuiz>("Quiz", QuizSchema);