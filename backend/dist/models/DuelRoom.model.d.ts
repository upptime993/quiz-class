import mongoose, { Document } from "mongoose";
import { IAvatar, IAnswer } from "./Session.model";
export type DuelStatus = "waiting" | "countdown" | "active" | "showing_result" | "between" | "finished" | "canceled";
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
    startedAt?: Date;
    finishedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IDuelRoom, {}, {}, {}, mongoose.Document<unknown, {}, IDuelRoom, {}, {}> & IDuelRoom & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=DuelRoom.model.d.ts.map