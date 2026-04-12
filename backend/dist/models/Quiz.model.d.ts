import mongoose, { Document } from "mongoose";
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
declare const _default: mongoose.Model<IQuiz, {}, {}, {}, mongoose.Document<unknown, {}, IQuiz, {}, {}> & IQuiz & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Quiz.model.d.ts.map