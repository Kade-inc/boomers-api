import { Schema, model } from "mongoose";

interface IBlacklist {
  token: string;
}
const blacklistSchema = new Schema<IBlacklist>(
    {
        token: {
            type: String,
            required: true,
            ref: "User",
        },
    },
    { timestamps: true }
);

const Blacklist = model<IBlacklist>(
    "Blacklist",
    blacklistSchema
  );
  
export default Blacklist;