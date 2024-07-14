import { Schema, model } from "mongoose";

interface IUser {
  email: string;
  phoneNumber?: string;
  password: string;
  isVerified: boolean;
  profile: Schema.Types.ObjectId;
  username: string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: false,
    },
    phoneNumber: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profile: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    username: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = model<IUser>("User", userSchema);

export default User;
