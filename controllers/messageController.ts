import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import Message from "../models/messageModel";
import Chat from "../models/chatModel";
import logger from "../services/logger";

// createMessage
// getMessages

export const createMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { chatId, text } = req.body;

    if (text.length > 2000) {
      res.status(400).json({ message: "Message cannot exceed 2000 characters" });
      return;
    }
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

      // Clear deletedBy so the chat reappears for users who soft-deleted it
      if (chat.deletedBy && chat.deletedBy.length > 0) {
        chat.deletedBy = [];
        await chat.save();
      }

      // Emit new message to all users in the chat room
      req.app.locals.io.to(`chat_${chatId}`).emit("newMessage", response);

      logger.info(`Message created in chat: ${chatId} by user: ${senderId}`);
      res.status(201).json(response);
    } catch (error) {
      logger.error("Error creating message", { error });
      res.status(500).json(error);
    }
  }
);

export const getMessages = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.params;
    logger.info(`Fetching messages for chat: ${chatId}`);
    try {
      const messages = await Message.find({
        chatId,
      });
      logger.info(`Fetched ${messages.length} messages for chat: ${chatId}`);
      res.status(200).json(messages);
    } catch (error) {
      logger.error("Error getting messages", { error });
      res.status(500).json(error);
    }
  }
);


export const updateMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { messageId } = req.params;
    const { text } = req.body;
    logger.info(`Updating message: ${messageId}`);

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
      logger.info(`Message updated: ${messageId}`);
      res.status(200).json(updatedMessage);
    } catch (error) {
      logger.error("Error updating message", { error });
      res.status(500).json(error);
    }
  }
);

export const deleteMessage = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id
    const { messageId } = req.params;
    logger.info(`Deleting message: ${messageId}`);

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
      logger.info(`Message deleted: ${messageId}`);
      res.status(200).json({ message: "Message deleted successfully." });
    } catch (error) {
      logger.error("Error deleting message", { error });
      res.status(500).json(error);
    }
  }
);

// Create a chat and send the first message atomically
// This enables lazy chat creation where chats are only created when a message is sent
export const createMessageWithChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const senderId = req.user.id;
    const { recipientId, text } = req.body;

    if (!recipientId || !text) {
      res.status(400).json({ message: "Recipient ID and message text are required." });
      return;
    }

    if (text.length > 2000) {
      res.status(400).json({ message: "Message cannot exceed 2000 characters" });
      return;
    }

    try {
      const members = [senderId, recipientId];

      // Check if a chat already exists between these members
      let chat = await Chat.findOne({
        members: { $all: members },
        $expr: { $eq: [{ $size: "$members" }, 2] },
        isGroup: false,
      });

      let isNewChat = false;

      // If no chat exists, create one
      if (!chat) {
        chat = new Chat({
          members,
          isGroup: false,
        });
        await chat.save();
        isNewChat = true;
      }

      // Create the message
      const message = await Message.create({
        chatId: chat._id,
        senderId,
        text,
      });

      // Clear deletedBy so the chat reappears for users who soft-deleted it
      if (chat.deletedBy && chat.deletedBy.length > 0) {
        chat.deletedBy = [];
        await chat.save();
      }

      // Emit new message to all users in the chat room
      req.app.locals.io.to(`chat_${chat._id}`).emit("newMessage", message);

      // If this is a new chat, also emit a newChat event so the recipient's chat list updates
      if (isNewChat) {
        // Emit to both users so they can update their chat lists
        members.forEach((memberId) => {
          req.app.locals.io.to(`user_${memberId}`).emit("newChat", chat);
        });
      }

      logger.info(`Message created with chat (new=${isNewChat}): ${message._id}`);
      res.status(201).json({
        chat,
        message,
        isNewChat,
      });
    } catch (error) {
      logger.error("Error creating message with chat", { error });
      res.status(500).json(error);
    }
  }
);
