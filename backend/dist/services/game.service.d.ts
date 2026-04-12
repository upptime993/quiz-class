import { ISession, IParticipant } from "../models/Session.model";
import { Server } from "socket.io";
export declare const calculateScore: (basePoints: number, responseTime: number, duration: number) => number;
export declare const getLeaderboard: (session: ISession) => {
    username: string;
    avatar: import("../models/Session.model").IAvatar;
    score: number;
    rank: number;
    isConnected: boolean;
    answers: import("../models/Session.model").IAnswer[];
}[];
export declare const getQuestionStats: (session: ISession, questionIndex: number) => Record<string, number>;
export declare const processAnswer: (sessionToken: string, socketId: string, questionIndex: number, answer: string, responseTime: number) => Promise<{
    isCorrect: boolean;
    pointsEarned: number;
    participant: IParticipant | null;
}>;
export declare const startQuiz: (sessionToken: string, io: Server) => Promise<void>;
export declare const sendQuestion: (sessionToken: string, questionIndex: number, io: Server) => Promise<void>;
export declare const endQuestion: (sessionToken: string, questionIndex: number, io: Server) => Promise<void>;
export declare const finishQuiz: (sessionToken: string, io: Server) => Promise<void>;
//# sourceMappingURL=game.service.d.ts.map