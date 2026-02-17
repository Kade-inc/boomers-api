import { Schema, model } from "mongoose";

interface IMessage {
  chatId: string;
  senderId: string;
  text: string;
}

const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: String,
    },
    senderId: {
      type: String,
    },
    text: {
      type: String,
      maxLength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

const Message = model<IMessage>("Message", messageSchema);

export default Message;
