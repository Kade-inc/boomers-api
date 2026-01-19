import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import Message from "../models/messageModel";
import Chat from "../models/chatModel";

// createMessage
// getMessages

export const createMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { chatId, text } = req.body;
    try {

      // Retrieve the chat document by its ID.
      const chat = await Chat.findById(chatId);
      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return
      }

      // Check if senderId is part of the chat's members.
      if (!chat.members.includes(senderId)) {
        res
          .status(403)
          .json({ message: "Sender is not a member of this chat." });
        return
      }

      const response = await Message.create({
        chatId,
        senderId,
        text,
      });

      // Emit new message to all users in the chat room
      req.app.locals.io.to(`chat_${chatId}`).emit("newMessage", response);

      res.status(201).json(response);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);

export const getMessages = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.params;
    try {
      const messages = await Message.find({
        chatId,
      });
      res.status(200).json(messages);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);


export const updateMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { messageId } = req.params;
    const { text } = req.body;

    try {
      // Find the message by ID
      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found." });
        return
      }

      // Check if the sender is the author of the message
      if (message.senderId !== senderId) {
        res
          .status(403)
          .json({ message: "Unauthorized to update this message." });
        return
      }

      // Update the message text
      message.text = text;
      const updatedMessage = await message.save();
      res.status(200).json(updatedMessage);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);

export const deleteMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { messageId } = req.params;

    try {
      // Find the message by ID
      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found." });
        return
      }

      // Check if the sender is the author of the message
      if (message.senderId !== senderId) {
        res
          .status(403)
          .json({ message: "Unauthorized to delete this message." });
        return
      }

      // Delete the message
      await message.deleteOne()
      res.status(200).json({ message: "Message deleted successfully." });
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);

