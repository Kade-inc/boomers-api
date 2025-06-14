import { Schema, model } from "mongoose";

interface INotification {
  user: Schema.Types.ObjectId;
  message: string;
  isRead: boolean;
  reference: Schema.Types.ObjectId;
  referenceModel: string; // This field stores the model name for the reference
  subreference: Schema.Types.ObjectId;
  subreferenceModel: string;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // 'reference' can point to any document; the model is defined by 'referenceModel'
    reference: {
      type: Schema.Types.ObjectId,
      refPath: "referenceModel",
    },
    referenceModel: {
      type: String,
      required: true,
      // Optionally enforce a list of allowed models:
      // enum: ["TeamChallenge", "AnotherModel", "YetAnotherModel"]
    },
    subreference: {
      type: Schema.Types.ObjectId,
      refPath: "subreferenceModel",
      required: false,
    },
    subreferenceModel: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export default model<INotification>("Notification", notificationSchema);
