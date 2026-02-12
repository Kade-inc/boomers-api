import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import Chat from "../models/chatModel";
import Message from "../models/messageModel";
import { Team, TeamMember } from "../models";
import logger from "../services/logger";

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

      logger.info(`Chat created: ${response._id}`);
      res.status(201).json(response);
    } catch (error: any) {
      logger.error("Error creating chat", { error });
      res.status(500)
      throw new (error)
    }
  }
);

export const findUserChats = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const userId = req.params.userId;
    logger.info(`Finding chats for user: ${userId}`);

    if (req.user.id !== userId) {
      logger.warn(`User ${req.user.id} unauthorized to view chats for ${userId}`);
      res.status(403).json({ message: "User unauthorized to view chats" });
      return
    }

    try {
      const chats = await Chat.find({
        members: { $in: [userId] },
        deletedBy: { $nin: [userId] },
      }).lean();

      // Get the last message and unread count for each chat
      const chatsWithLastMessage = await Promise.all(
        chats.map(async (chat: any) => {
          const lastMessage = await Message.findOne({ chatId: chat._id })
            .sort({ createdAt: -1 })
            .lean();

          // Determine the cutoff for counting unread messages
          const lastReadEntry = chat.lastReadAt?.find(
            (entry: any) => entry.userId === userId
          );
          const deletionEntry = chat.messagesDeletedFor?.find(
            (entry: any) => entry.userId === userId
          );

          // Use the most recent of lastReadAt and messagesDeletedFor as the cutoff
          let cutoff: Date | null = null;
          if (lastReadEntry?.readAt && deletionEntry?.deletedAt) {
            cutoff = new Date(Math.max(
              new Date(lastReadEntry.readAt).getTime(),
              new Date(deletionEntry.deletedAt).getTime()
            ));
          } else {
            cutoff = lastReadEntry?.readAt
              ? new Date(lastReadEntry.readAt)
              : deletionEntry?.deletedAt
                ? new Date(deletionEntry.deletedAt)
                : null;
          }

          // Count messages after the cutoff that were NOT sent by this user
          const unreadQuery: any = {
            chatId: chat._id,
            senderId: { $ne: userId },
          };
          if (cutoff) {
            unreadQuery.createdAt = { $gt: cutoff };
          }
          const unreadCount = await Message.countDocuments(unreadQuery);

          return {
            ...chat,
            lastMessage: lastMessage || null,
            unreadCount,
          };
        })
      );

      // Sort chats by last message time (most recent first)
      chatsWithLastMessage.sort((a: any, b: any) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      logger.info(`Found ${chatsWithLastMessage.length} chats for user ${userId}`);
      res.status(200).json({ message: "Chats retrieved successfully.", data: chatsWithLastMessage });
    } catch (error) {
      logger.error("Error finding user chats", { error });
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
      // Find a one-to-one chat that includes all the specified members and has exactly that many members
      // Exclude group chats and chats soft-deleted by the requesting user
      const chat = await Chat.findOne({
        members: { $all: members },
        $expr: { $eq: [{ $size: "$members" }, (members as string[]).length] },
        isGroup: { $ne: true },
        deletedBy: { $nin: [req.user.id] },
      });

      res.status(200).json(chat);
    } catch (error: any) {
      logger.error("Error finding chat", { error });
      res.status(500)
      throw new (error)
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
    logger.info(`Updating chat: ${chatId}`);

    try {
      // Find the chat by its ID
      const chat = await Chat.findById(chatId);
      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return
      }

      if (chat.members[0] !== ownerId) {
        logger.warn(`User ${ownerId} unauthorized to update chat ${chatId}`);
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
      logger.info(`Chat updated: ${chatId}`);
      res.status(200).json(updatedChat);
    } catch (error: any) {
      logger.error("Error updating chat", { error });
      res.status(500)
      throw new (error)
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
    } catch (error: any) {
      logger.error("Error finding chat by id", { error });
      res.status(500)
      throw new (error)
    }
  }
);

export const deleteChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user.id;
    logger.info(`Deleting chat: ${chatId} by user: ${userId}`);

    try {
      const chat = await Chat.findById(chatId);

      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return;
      }

      // Verify user is a member of this chat
      if (!chat.members.includes(userId)) {
        logger.warn(`User ${userId} is not a member of chat ${chatId}`);
        res.status(403).json({ message: "User is not a member of this chat." });
        return;
      }

      if (chat.isGroup) {
        // Group chats: only the admin (team owner) can delete
        if (chat.admin !== userId) {
          logger.warn(`User ${userId} unauthorized to delete group chat ${chatId}`);
          res.status(403).json({ message: "Only the team owner can delete this group chat." });
          return;
        }
        // Hard delete: remove chat and all its messages
        await Message.deleteMany({ chatId: chat._id });
        await chat.deleteOne();
        logger.info(`Group chat hard-deleted: ${chatId}`);
        res.status(200).json({ message: "Group chat deleted successfully." });
      } else {
        // Individual chats: soft-delete for the requesting user
        if (!chat.deletedBy?.includes(userId)) {
          chat.deletedBy = [...(chat.deletedBy || []), userId];
        }

        // Record when messages were deleted for this user
        // If an entry already exists, update the timestamp; otherwise add a new one
        const existingEntry = chat.messagesDeletedFor?.find(
          (entry) => entry.userId === userId
        );
        if (existingEntry) {
          existingEntry.deletedAt = new Date();
        } else {
          chat.messagesDeletedFor = [
            ...(chat.messagesDeletedFor || []),
            { userId, deletedAt: new Date() },
          ];
        }

        await chat.save();
        logger.info(`Chat soft-deleted for user ${userId}: ${chatId}`);
        res.status(200).json({ message: "Chat deleted successfully." });
      }
    } catch (error: any) {
      logger.error("Error deleting chat", { error });
      res.status(500);
      throw new (error);
    }
  }
);

export const createGroupChat = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { teamId, groupName, teamColor } = req.body;
    const adminId = req.user.id;

    if (!teamId || !groupName) {
      res.status(400).json({ message: "Team ID and group name are required." });
      return;
    }

    try {
      // Verify the user is the team owner
      const team = await Team.findById(teamId);
      if (!team) {
        res.status(404).json({ message: "Team not found." });
        return;
      }

      if (team.owner_id.toString() !== adminId) {
        res.status(403).json({ message: "Only the team owner can create a group chat." });
        return;
      }

      // Check if a group chat already exists for this team
      const existingChat = await Chat.findOne({ teamId, isGroup: true });
      if (existingChat) {
        res.status(200).json({ message: "Group chat already exists.", data: existingChat, isExisting: true });
        return;
      }

      // Get all team members
      const teamMembers = await TeamMember.find({ team_id: teamId });
      const memberUserIds = teamMembers.map((member: any) => member.user_id.toString());

      // Include the owner in the members list
      const allMembers = [adminId, ...memberUserIds];
      // Remove duplicates (in case owner is also in team members)
      const uniqueMembers = [...new Set(allMembers)];

      // Create the group chat
      const newChat = new Chat({
        members: uniqueMembers,
        isGroup: true,
        groupName,
        admin: adminId,
        teamId,
        teamColor: teamColor || team.teamColor,
      });

      const response = await newChat.save();
      res.status(201).json({ message: "Group chat created successfully.", data: response, isExisting: false });
    } catch (error: any) {
      logger.error("Error creating group chat:", { error });
      res.status(500).json({ message: "Error creating group chat." });
    }
  }
);

export const markChatRead = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user.id;

    try {
      const chat = await Chat.findById(chatId);

      if (!chat) {
        res.status(404).json({ message: "Chat not found." });
        return;
      }

      if (!chat.members.includes(userId)) {
        res.status(403).json({ message: "User is not a member of this chat." });
        return;
      }

      // Update or insert the lastReadAt entry for this user
      const existingEntry = chat.lastReadAt?.find(
        (entry) => entry.userId === userId
      );
      if (existingEntry) {
        existingEntry.readAt = new Date();
      } else {
        chat.lastReadAt = [
          ...(chat.lastReadAt || []),
          { userId, readAt: new Date() },
        ];
      }

      await chat.save();
      res.status(200).json({ message: "Chat marked as read." });
    } catch (error: any) {
      logger.error("Error marking chat as read", { error });
      res.status(500).json({ message: "Error marking chat as read." });
    }
  }
);