import { model, Schema } from "mongoose";

interface ISearchHistory {
    userId: Schema.Types.ObjectId;
    term: string;
    timestamp: Date;
  }
  
  const searchHistorySchema = new Schema<ISearchHistory>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    term: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  });

  export default model<ISearchHistory>("SearchHistory", searchHistorySchema);