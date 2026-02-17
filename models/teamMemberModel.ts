import mongoose, { Schema, model } from "mongoose";

interface ITeamMember {
  owner_id: any;
  team_id: any;
  user_id: any;
}

const teamMemberSchema = new Schema<ITeamMember>(
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
  },
  {
    timestamps: true,
  }
);

const TeamMember = model<ITeamMember>("TeamMember", teamMemberSchema);

export default TeamMember;
