import { Schema, model } from "mongoose";

interface IChat {
  members: string[];
  isGroup?: boolean;
  groupName?: string;
  admin?: string; // could be the ID of the user who created the group
  teamId?: string; // link to the team for team-based group chats
  teamColor?: string; // team's display color
  deletedBy?: string[]; // user IDs who have soft-deleted this chat
}

const chatSchema = new Schema<IChat>(
  {
    members: {
      type: [String],
      required: true
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String
    },
    admin: {
      type: String
    },
    teamId: {
      type: String
    },
    teamColor: {
      type: String
    },
    deletedBy: {
      type: [String],
      default: [],
    }
  },
  {
    timestamps: true,
  }
);

const Chat = model<IChat>("Chat", chatSchema);

export default Chat;
