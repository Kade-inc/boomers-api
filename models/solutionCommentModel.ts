import { Schema, model } from "mongoose";

interface ISolutionComment {
  solution_id: Schema.Types.ObjectId;
  comment: string;
  user: Schema.Types.ObjectId;
}

const solutionCommentSchema = new Schema<ISolutionComment>(
  {
    solution_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ChallengeSolution",
    },
    comment: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const SolutionComment = model<ISolutionComment>(
  "SolutionComment",
  solutionCommentSchema
);

export default SolutionComment;
