import mongoose, { Schema, model } from "mongoose";

interface IUserProfile {
  userId: string;
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  bio: string;
  interests: any;
  user_id: Schema.Types.ObjectId;
  username: string;
  gender: string;
  profile_picture: string | null;
  job: string;
  location?: string;
  city?: string;
  country?: string;
  // Optional GeoJSON point for latitude/longitude:
  latitude?: number;
  longitude?: number;
  locationGeo?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  website?: string;
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
    job: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
      trim: true,
    },
    country: {
      type: String,
      default: null,
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    // locationGeo: {
    //   type: {
    //     type: String,
    //     enum: ["Point"],
    //     default: "Point",
    //   },
    //   // [longitude, latitude]
    //   coordinates: {
    //     type: [Number],
    //     default: null,
    //   },
    // },
    website: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userProfileSchema.index({
  firstName: "text",
  lastName: "text",
  username: "text",
});

userProfileSchema.index({ firstName: 1 });
userProfileSchema.index({ lastName: 1 });
userProfileSchema.index({ username: 1 });

// 2dsphere index on locationGeo for geospatial queries:
// userProfileSchema.index({ locationGeo: "2dsphere" });

const UserProfile = model<IUserProfile>("UserProfile", userProfileSchema);

export default UserProfile;
