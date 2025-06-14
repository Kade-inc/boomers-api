import { Schema, model } from "mongoose";

interface IChallengeStepComment {
  step_id: Schema.Types.ObjectId;
  comment: string;
  user: Schema.Types.ObjectId;
}

const challengeStepCommentSchema = new Schema<IChallengeStepComment>(
  {
    step_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ChallengeStep",
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

const ChallengeStepComment = model<IChallengeStepComment>(
  "ChallengeStepComment",
  challengeStepCommentSchema
);

export default ChallengeStepComment; 