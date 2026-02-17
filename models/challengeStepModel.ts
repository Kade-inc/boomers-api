import { Schema, model } from "mongoose";

interface IChallengeStep {
  user_id: Schema.Types.ObjectId;
  solution_id: Schema.Types.ObjectId;
  challenge_id: Schema.Types.ObjectId;
  description: string;
  completed: boolean;
}

const challengeStepSchema = new Schema<IChallengeStep>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    solution_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ChallengeSolution",
    },
    challenge_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "TeamChallenge",
    },
    description: {
      type: String,
      required: true,
    },
    completed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field for comments
challengeStepSchema.virtual('comments', {
  ref: 'ChallengeStepComment',
  localField: '_id',
  foreignField: 'step_id'
});

const ChallengeStep = model<IChallengeStep>(
  "ChallengeStep",
  challengeStepSchema
);

export default ChallengeStep;
