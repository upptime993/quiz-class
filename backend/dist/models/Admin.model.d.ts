import mongoose, { Document } from "mongoose";
export interface IAdmin extends Document {
    username: string;
    password: string;
    className: string;
    role: "superadmin" | "teacher";
    createdAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}
declare const _default: mongoose.Model<IAdmin, {}, {}, {}, mongoose.Document<unknown, {}, IAdmin, {}, {}> & IAdmin & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Admin.model.d.ts.map