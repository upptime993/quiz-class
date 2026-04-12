import mongoose, { Document } from "mongoose";
export interface IAccessories {
    hat: string | null;
    glasses: string | null;
    other: string | null;
}
export interface IAvatar {
    emoji: string;
    mixEmoji?: string | null;
    mixImageUrl?: string | null;
    accessories?: IAccessories;
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
export type SessionStatus = "waiting" | "countdown" | "active" | "between" | "showing_result" | "finished" | "canceled";
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
declare const _default: mongoose.Model<ISession, {}, {}, {}, mongoose.Document<unknown, {}, ISession, {}, {}> & ISession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Session.model.d.ts.map