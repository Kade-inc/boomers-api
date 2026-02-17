import { Schema, model } from "mongoose";

interface IUserVerificationCode {
  userId: string;
  email?: string;
  code: string;
  phoneNumber: string;
}

const userVerificationCodeSchema = new Schema<IUserVerificationCode>(
  {
    userId: {
      type: String,
    },
    email: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    code: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const UserVerificationCode = model<IUserVerificationCode>(
  "UserVerificationCode",
  userVerificationCodeSchema
);

export default UserVerificationCode;
