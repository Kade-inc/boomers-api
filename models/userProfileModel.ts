import mongoose, { Schema, model } from "mongoose";

interface IUserProfile {
  userId: string;
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  bio: string;
  interests: any;
  user_id: any;
  username: string;
  gender: string;
  profile_picture: string;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    email: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    firstName: {
      type: String,
      default: null,
    },
    lastName: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    interests: {
      type: {},
      default: null,
    },
    username: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      default: null,
    },
    profile_picture: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const UserProfile = model<IUserProfile>("UserProfile", userProfileSchema);

export default UserProfile;
