import { Schema, model } from "mongoose";

// id
// Challenge id
// User id
// Status: IN PROGRESS(1), COMPLETED (2), UNSTARTED (0)
// updatedAt
// createdAt
// Steps: Either include array of steps here or reference steps table
// valid: False if no steps have been provided, Valid if all steps have been provided
// Feedback
// percentageCompleted
// completedDate
// Rating
// Out of 10
// Feedback

interface IChallengeSolution {
  challenge_id: Schema.Types.ObjectId;
  user_id: Schema.Types.ObjectId;
  status: Number;
  steps: any;
  valid: boolean;
  comments: any;
  percentageCompleted: Number;
  completedDate: Date;
  demo_url: string;
  solution: string;
  owner_rating: Rating;
  overall_rating: number;
}

interface Rating {
  rating: number;
  feedback: string;
}

const challengeSolutionSchema = new Schema<IChallengeSolution>(
  {
    challenge_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "TeamChallenge",
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    status: {
      type: Number,
      required: true,
      default: 0,
    },
    steps: {
      type: [],
      default: null,
    },
    valid: {
      type: Boolean,
      default: false,
    },
    comments: {
      type: [],
      default: [],
    },
    percentageCompleted: {
      type: Number,
      required: true,
      default: 0,
    },
    completedDate: {
      type: Date,
      default: null,
    },
    demo_url: {
      type: String,
      default: null,
    },
    solution: {
      type: String,
      default: null,
    },
    owner_rating: {
      type: {},
      default: null,
    },
    overall_rating: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const ChallengeSolution = model<IChallengeSolution>(
  "ChallengeSolution",
  challengeSolutionSchema
);

export default ChallengeSolution;
