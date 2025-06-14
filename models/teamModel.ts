import { Schema, model } from "mongoose";

interface ITeam {
  owner_id: Schema.Types.ObjectId;
  name: string;
  isActive: boolean;
  domain: any;
  subdomain: Schema.Types.ObjectId;
  subdomainTopics: any;
  teamUsername: string;
  displayImage: string;
  backgroundImage: string;
  teamColor: string;
}

const teamSchema = new Schema<ITeam>(
  {
    owner_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
    },
    teamUsername: {
      type: String,
      required: false,
      unique: true,
    },
    displayImage: {
      type: String,
    },
    backgroundImage: {
      type: String,
    },
    domain: {
      type: String,
      required: true,
    },
    subdomain: {
      type: String,
    },
    subdomainTopics: {
      type: Array,
    },
    teamColor: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ name: "text", teamUsername: "text" });

const Team = model<ITeam>("Team", teamSchema);

export default Team;
