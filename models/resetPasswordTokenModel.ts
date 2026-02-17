import { Schema, model } from "mongoose";

interface IToken {
  userId: Schema.Types.ObjectId;
  token: string;
  createdAt: Date;
}

const resetPasswordTokenSchema = new Schema<IToken>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ResetPasswordToken = model<IToken>(
  "ResetPasswordToken",
  resetPasswordTokenSchema
);

export default ResetPasswordToken;
