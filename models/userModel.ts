import { Schema, model } from "mongoose";

interface IUser {
  email: string;
  phoneNumber?: string;
  password: string;
  isVerified: boolean;
  profile: Schema.Types.ObjectId;
  username: string;
  role: Schema.Types.ObjectId;
  pushTokens: string[];
  deletedAt: Date | null;
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
      ref: "UserProfile", // Correctly reference the `UserProfile` model
      default: null,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      default: null
    },
    pushTokens: {
      type: [String],
      required: false
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = model<IUser>("User", userSchema);

export default User;
