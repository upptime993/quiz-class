import mongoose, { Document, Schema } from "mongoose";
import { IAvatar, IAnswer } from "./Session.model";

export type DuelStatus =
  | "waiting"
  | "countdown"
  | "active"
  | "showing_result"
  | "between"
  | "finished"
  | "canceled";

export interface IDuelPlayer {
  socketId: string;
  username: string;
  avatar: IAvatar;
  score: number;
  answers: IAnswer[];
  isConnected: boolean;
}

export interface IDuelRoom extends Document {
  token: string;
  quizId: mongoose.Types.ObjectId;
  status: DuelStatus;
  creator: IDuelPlayer;
  opponent: IDuelPlayer | null;
  currentQuestion: number;
  customDuration?: number;
  startedAt?: Date;
  finishedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AvatarSchema = new Schema(
  {
    emoji: { type: String, default: "🦊" },
    mixEmoji: { type: String, default: null },
    mixImageUrl: { type: String, default: null },
  },
  { _id: false }
);

const AnswerSchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    answer: { type: String, default: "" },
    isCorrect: { type: Boolean, required: true },
    responseTime: { type: Number, required: true },
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const DuelPlayerSchema = new Schema<IDuelPlayer>(
  {
    socketId: { type: String, required: true },
    username: { type: String, required: true, trim: true },
    avatar: { type: AvatarSchema, default: () => ({}) },
    score: { type: Number, default: 0 },
    answers: [AnswerSchema],
    isConnected: { type: Boolean, default: true },
  },
  { _id: false }
);

const DuelRoomSchema = new Schema<IDuelRoom>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "countdown", "active", "showing_result", "between", "finished", "canceled"],
      default: "waiting",
    },
    creator: { type: DuelPlayerSchema, required: true },
    opponent: { type: DuelPlayerSchema, default: null },
    currentQuestion: { type: Number, default: 0 },
    customDuration: { type: Number, default: null },
    startedAt: Date,
    finishedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 menit
    },
  },
  { timestamps: true }
);

DuelRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export default mongoose.model<IDuelRoom>("DuelRoom", DuelRoomSchema);
