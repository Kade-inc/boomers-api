import mongoose, { Schema, model } from "mongoose";

interface ITeamMemberRequest {
  owner_id: any;
  team_id: any;
  user_id: any;
  status: string;
  comment: string;
}

const teamMemberRequestSchema = new Schema<ITeamMemberRequest>(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    status: {
      type: String,
      default: "PENDING",
    },
    comment: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const TeamMemberRequest = model<ITeamMemberRequest>(
  "TeamMemberRequest",
  teamMemberRequestSchema
);

export default TeamMemberRequest;
