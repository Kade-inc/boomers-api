import mongoose, { Schema, model } from "mongoose";

interface IRating {
  rating: number;
  solution_id: Schema.Types.ObjectId;
  challenge_id: Schema.Types.ObjectId;
  user_id: Schema.Types.ObjectId;
  feedback: string;
}

const solutionRatingSchema = new Schema<IRating>(
  {
    solution_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    challenge_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    rating: {
      type: Number,
      required: true,
    },
    feedback: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const SolutionRating = model<IRating>("SolutionRating", solutionRatingSchema);

export default SolutionRating;
