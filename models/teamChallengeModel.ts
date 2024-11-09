import mongoose, { Schema, model, Types } from "mongoose";

/**
 * 
 * Team
Owner_id
Challenge name
Due date
Difficulty
Description 
    Description
    Resources
Rating
Comments
Best answer
    User
    Project link
Completion
Reward
Image
is_valid

 */
interface ITeamChallenge {
  owner_id: any;
  team_id: Types.ObjectId;
  challenge_name: string;
  due_date: Date;
  difficulty: number;
  description: string;
  resources: string;
  rating: number;
  comments: any;
  best_answer: any;
  completion: string;
  reward: string;
  image_url: string;
  valid: boolean;
}

const teamChallengeSchema = new Schema<ITeamChallenge>(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    challenge_name: {
      type: String,
    },
    due_date: {
      type: Date,
    },
    difficulty: {
      type: Number,
    },
    description: {
      type: String,
    },
    resources: {
      type: String,
    },
    rating: {
      type: Number,
    },
    comments: {
      type: [],
    },
    best_answer: {
      user: {
        type: String,
      },
      project_link: {
        type: String,
      },
    },
    completion: {
      type: String,
    },
    reward: {
      reward_type: {
        type: String,
      },
      reward_value: {
        type: String,
      },
    },
    image_url: {
      type: String,
    },
    valid: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const TeamChallenge = model<ITeamChallenge>(
  "TeamChallenge",
  teamChallengeSchema
);

export default TeamChallenge;
