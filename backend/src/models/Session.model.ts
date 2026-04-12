import mongoose, { Document, Schema } from "mongoose";

export interface IAccessories {
  hat: string | null;
  glasses: string | null;
  other: string | null;
}

export interface IAvatar {
  emoji: string;
  mixEmoji?: string | null;
  mixImageUrl?: string | null;
  accessories?: IAccessories; // legacy
}

export interface IAnswer {
  questionIndex: number;
  answer: string;
  isCorrect: boolean;
  responseTime: number;
  pointsEarned: number;
}

export interface IParticipant {
  socketId: string;
  username: string;
  avatar: IAvatar;
  score: number;
  answers: IAnswer[];
  joinedAt: Date;
  isConnected: boolean;
}

export type SessionStatus =
  | "waiting"
  | "countdown"
  | "active"
  | "between"
  | "showing_result"
  | "finished"
  | "canceled";

export interface ISession extends Document {
  quizId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  name?: string;
  token: string;
  status: SessionStatus;
  currentQuestion: number;
  participants: IParticipant[];
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccessoriesSchema = new Schema<IAccessories>(
  {
    hat: { type: String, default: null },
    glasses: { type: String, default: null },
    other: { type: String, default: null },
  },
  { _id: false }
);

const AvatarSchema = new Schema<IAvatar>(
  {
    emoji: { type: String, default: "🦊" },
    mixEmoji: { type: String, default: null },
    mixImageUrl: { type: String, default: null },
    accessories: { type: AccessoriesSchema, default: null },
  },
  { _id: false }
);

const AnswerSchema = new Schema<IAnswer>(
  {
    questionIndex: { type: Number, required: true },
    answer: { type: String, default: "" },
    isCorrect: { type: Boolean, required: true },
    responseTime: { type: Number, required: true },
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const ParticipantSchema = new Schema<IParticipant>(
  {
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
  },
  { _id: false }
);

const SessionSchema = new Schema<ISession>(
  {
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Index untuk pencarian cepat
SessionSchema.index({ status: 1 });

export default mongoose.model<ISession>("Session", SessionSchema);