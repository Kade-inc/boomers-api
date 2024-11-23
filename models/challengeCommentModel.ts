import { Schema, model } from "mongoose";

interface IChallengeComment {
  challenge_id: Schema.Types.ObjectId;
  comment: string;
  user: Schema.Types.ObjectId;
}

const challengeCommentSchema = new Schema<IChallengeComment>(
  {
    challenge_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "TeamChallenge",
    },
    comment: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User", // Correctly reference the `User` model
    },
  },
  {
    timestamps: true,
  }
);

const ChallengeComment = model<IChallengeComment>(
  "ChallengeComment",
  challengeCommentSchema
);

export default ChallengeComment;
