import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import Chat from "../models/chatModel";

// createchat
// findUserChats
// findChat

export const createChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { members, groupName, admin } = req.body;

    // If members is not an array, make it one (for backward compatibility)
    const chatMembers = Array.isArray(members) ? members : [members];

    // If groupName is provided, it's a group chat.
    // A group chat must have at least 1 member.
    if (groupName) {
      if (chatMembers.length < 1) {
        res
          .status(400)
          .json({ message: "Group chat must have at least one member." });
        return
      }
    } else {
      // Otherwise, treat it as a one-to-one chat requiring exactly 2 members.
      if (chatMembers.length !== 2) {
        res
          .status(400)
          .json({ message: "One-to-one chat must have exactly 2 members." });
        return 
      }
    }

    try {
      // Only perform duplicate check for one-to-one chats.
      if (!groupName) {
        const query: any = {
          members: { $all: chatMembers },
          $expr: { $eq: [{ $size: "$members" }, chatMembers.length] },
          isGroup: false,
        };

        const chat = await Chat.findOne(query);

        if (chat) {
          res.status(409).json({ message: "Chat already exists", data: chat });
          return;
        }
      }

      const newChat = new Chat({
        members: chatMembers,
        isGroup: Boolean(groupName),
        groupName: groupName || undefined,
        admin: admin || undefined,
      });

      const response = await newChat.save();

      res.status(201).json(response);
    } catch (error:any) {
      res.status(500)
      throw new(error)
    }
  }
);

export const findUserChats = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const userId = req.params.userId;

    if (req.user.id !== userId) {
      res.status(403).json({ message: "User unauthorized to view chats" });
      return
    }

    try {
      const chats = await Chat.find({
        members: { $in: [userId] },
      });

      res.status(200).json({message: "Chats retrieved successfully.", data: chats});
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);

export const findChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    // Expect members to be provided as a comma-separated string in the query
    let { members } = req.query;
    if (!members) {
      res.status(400).json({ message: "Members parameter is required" });
      return
    }

    // Convert to an array if it's a comma-separated string
    if (typeof members === "string") {
      members = members.split(",");
    }

    // Optionally, enforce that we need at least two members
    if ((members as string[]).length < 2) {
      res.status(400).json({ message: "At least two members are required" });
      return
    }

    try {
      // Find a chat that includes all the specified members and has exactly that many members
      const chat = await Chat.findOne({
        members: { $all: members },
        $expr: { $eq: [{ $size: "$members" }, (members as string[]).length] },
      });

      res.status(200).json(chat);
    } catch (error:any) {
      res.status(500)
      throw new(error)
    }
  }
);


export const updateChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    // Expect chatId to be passed as a URL parameter
    const { chatId } = req.params;
    const ownerId = req.user.id;
    // Expect addMembers, removeMembers, and groupName in the request body
    const { addMembers, removeMembers, groupName } = req.body;

    try {
      // Find the chat by its ID
      const chat = await Chat.findById(chatId);
      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return
      }

      if (chat.members[0] !== ownerId) {
        res.status(403).json({ message: "User unauthorized to update chat" });
        return
      }

      // Update groupName if provided and the chat is a group chat
      if (groupName && chat.isGroup) {
        chat.groupName = groupName;
      }

      // If addMembers is provided, add only those members not already present.
      if (Array.isArray(addMembers) && addMembers.length) {
        // Use a Set to avoid duplicates.
        const updatedMembers = new Set([...chat.members, ...addMembers]);
        chat.members = Array.from(updatedMembers);
      }

      // If removeMembers is provided, filter out those members.
      if (Array.isArray(removeMembers) && removeMembers.length) {
        chat.members = chat.members.filter(
          (memberId: string) => !removeMembers.includes(memberId)
        );
      }

      // Save the updated chat
      const updatedChat = await chat.save();
      res.status(200).json(updatedChat);
    } catch (error:any) {
      res.status(500)
      throw new(error)
    }
  }
);

export const findChatByChatId = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.query;
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return
      }
      res.status(200).json({ message: "Chat details retrieved successfully.", data: chat });
    } catch (error:any) {
      res.status(500)
      throw new(error)
    }
  }
);

export const deleteChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.params;
    const ownerId = req.user.id
    
    
    try {
      const chat = await Chat.findById(chatId);

      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return
      }

      if (chat.members[0] !== ownerId) {
        res.status(403).json({ message: "User unauthorized to delete chat" });
        return
      }
      // Delete the chat
      await chat.deleteOne()
      res.status(200).json({ message: "Chat deleted successfully." });
    } catch (error:any) {
      res.status(500)
      throw new(error)
    }
  }
);