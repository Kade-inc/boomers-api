import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import Team from "../../models/teamModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamMember from "../../models/teamMemberModel";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import TeamDomain from "../../models/teamDomainModel";
import TeamSubDomain from "../../models/teamSubdomainModel";
import DomainTopic from "../../models/domainTopicModel";
import UserProfile from "../../models/userProfileModel";
import User from "../../models/userModel";
import redisClient from "../../config/redisClient";
import logger from "../../services/logger";
import ShortUrl from "../../models/shortUrlModel";
import TeamMemberRequest from "../../models/teamMemberRequestModel";
import Notification from "../../models/notificationModel";
import sseNotificationService from "../../services/sseService";
import Chat from "../../models/chatModel";
import Message from "../../models/messageModel";

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const generateTeamUsername = (teamName: string): string => {
  // Clean the team name: remove special characters, convert to lowercase, replace spaces with hyphens
  const cleanName = teamName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();

  // Generate random number between 1 and 999999
  const randomNumber = Math.floor(Math.random() * 999999) + 1;

  return `${cleanName}-${randomNumber}`;
};
const bucketName: any = process.env.BUCKET_NAME;
const bucketRegion: any = process.env.BUCKET_REGION;
const accessKey: any = process.env.ACCESS_KEY;
const secretAccessKey: any = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

// Define cache key and TTL (24 hours in seconds)
const CACHE_KEY = "dailyRandomTeam";
const TTL_SECONDS = 86400; // 24 hours

//@desc Create team
//@route POST /api/teams
//access private
export const createTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name, domain, subdomain, subdomainTopics, teamColor } =
        req.body;
      let team: any;
      logger.info(`Creating team: ${name}`);
      if (!name.trim() || !domain.trim()) {
        res.status(400);
        throw new Error("Please put name and domain");
      }

      // Generate teamUsername from team name
      let teamUsername = generateTeamUsername(name);

      // Check if the generated username already exists, if so, generate a new one
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const teamExists = await Team.findOne({ teamUsername });
        if (!teamExists) {
          break; // Username is unique, proceed
        }
        teamUsername = generateTeamUsername(name); // Generate new username
        attempts++;
      }

      if (attempts >= maxAttempts) {
        res.status(409);
        throw new Error("Unable to generate unique team username. Please try again.");
      }

      const domainExists = await TeamDomain.findOne({ name: domain });

      if (!domainExists) {
        res.status(409).json({ error: "Domain doesn't exist" });
        return;
      }

      const subDomainExists: any = await TeamSubDomain.findOne({
        name: subdomain,
      });

      if (
        subDomainExists?.parentDomain.toString() !== domainExists._id.toString()
      ) {
        res.status(400).json({ error: "Subdomain does not belong to domain" });
        return;
      }

      const domainTopics = await DomainTopic.find({});
      const missingTopics: any = [];
      subdomainTopics.map((topic: any) => {
        const foundTopic = domainTopics.some((el) => el.name === topic);
        if (!foundTopic) {
          missingTopics.push(topic);
        }
      });

      if (missingTopics.length > 0) {
        res.status(404).json({
          error: "The following topics are not created",
          data: missingTopics,
        });
        return;
      }

      if (req.file) {
        //resize image
        const buffer = await sharp(req.file.buffer)
          .resize({ height: 400, width: 400, fit: "contain" })
          .toBuffer();
        const params = {
          Bucket: bucketName,
          Key: randomImageName(),
          Body: buffer,
          ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(params);

        await s3.send(command);

        const team = await Team.create({
          name,
          teamUsername,
          owner_id: req.user.id,
          domain: domainExists.name,
          subdomain: subdomain,
          subdomainTopics: subdomainTopics,
          displayImage: randomImageName(),
          teamColor: teamColor,
        });
      } else {
        team = await Team.create({
          name,
          teamUsername,
          domain: domainExists.name,
          subdomain: subdomain,
          subdomainTopics: subdomainTopics,
          owner_id: req.user.id,
          teamColor: teamColor,
        });
      }

      await TeamMember.create({
        owner_id: req.user.id,
        team_id: team._id,
        user_id: req.user.id,
      });
      logger.info(`Team created: ${team._id}`);
      res.status(201).json({ message: "successful", data: team });
    } catch (error: any) {
      logger.error("Error creating team", { error });
      throw new Error(error);
    }
  }
);

//@desc Get teams
//@route GET /api/teams
//access private
export const getAllTeams = asyncHandler(async (req: Request, res: Response) => {
  try {
    let teams: any = [];
    const { name, domain, subdomain, subdomainTopics, page, limit, userId } =
      req.query;
    logger.info("Fetching teams");

    // Convert page and limit to numbers, or use defaults
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;
    let totalCount: number = 0;

    // Build a topics filter that supports multiple topics
    let topicsFilter: RegExp[] | undefined;
    if (subdomainTopics) {
      if (Array.isArray(subdomainTopics)) {
        topicsFilter = (subdomainTopics as string[]).map(
          (topic: string) => new RegExp(topic, "i")
        );
      } else if (typeof subdomainTopics === "string") {
        topicsFilter = subdomainTopics.includes(",")
          ? subdomainTopics
            .split(",")
            .map((topic: string) => new RegExp(topic.trim(), "i"))
          : [new RegExp(subdomainTopics, "i")];
      }
    }

    // When filtering by userId, first get the teams that the user belongs to
    if (userId) {
      // Find team memberships for the given user
      const teamMembers = await TeamMember.find({ user_id: userId });
      const teamIds = teamMembers.map((member: any) => member.team_id);

      // Build query for teams that the user is a member of
      const query: any = { _id: { $in: teamIds } };
      if (domain) {
        query.domain = { $regex: new RegExp(domain as string, "i") };
      }
      if (name) {
        query.name = { $regex: new RegExp(name as string, "i") };
      }
      if (subdomain) {
        query.subdomain = { $regex: new RegExp(subdomain as string, "i") };
      }

      if (topicsFilter) {
        query.subdomainTopics = { $in: topicsFilter };
      }

      teams = await Team.find(query);
      totalCount = teams.length;
    } else {
      // Build a dynamic query based on the available filters
      const query: any = {};
      if (name) {
        query.name = { $regex: new RegExp(name as string, "i") };
      }
      if (domain) {
        query.domain = { $regex: new RegExp(domain as string, "i") };
      }
      if (subdomain) {
        query.subdomain = { $regex: new RegExp(subdomain as string, "i") };
      }

      if (topicsFilter) {
        query.subdomainTopics = { $in: topicsFilter };
      }

      teams = await Team.find(query).skip(skip).limit(limitNum);
      totalCount = await Team.countDocuments(query);
    }

    const totalPages = userId ? 1 : Math.ceil(totalCount / limitNum);
    res.status(200).json({
      message: "successful",
      currentPage: userId ? 1 : pageNum,
      perPage: userId ? totalCount : limitNum,
      totalPages,
      totalCount,
      data: teams,
    });
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Get Team
//@route GET /api/teams/:id
//access private
export const getTeam = asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info(`Fetching team: ${req.params.id}`);
    const team: any = await Team.findOne({ _id: req.params.id });

    if (!team) {
      res.status(404).json({ message: "Team does not exist" });
      return;
    }

    const teamMembers = await TeamMember.find({ team_id: req.params.id });
    const userIds: any = [];
    teamMembers.map((member: any) => {
      userIds.push(member.user_id);
    });
    const users: any = await User.find({ _id: { $in: userIds } });
    const userProfiles = await UserProfile.find({ user_id: { $in: userIds } });

    if (!users) {
      res.status(400).json({ message: "No users in the system!" });
      return;
    }

    // Map over the teamMembers array and match the user_id to users array
    const teamMembersWithDetails = teamMembers.map((member: any) => {
      // Find the corresponding user based on user_id
      const user = users.find(
        (user: any) => user._id.toString() === member.user_id.toString()
      );

      // Return the team member with user details
      if (user) {
        return {
          _id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
          profile_picture: null,
        };
      } else {
        return null;
      }
    });

    teamMembersWithDetails.map((member: any) => {
      const userProfile = userProfiles.find(
        (profile: any) => profile._id.toString() === member.profile.toString()
      );

      if (userProfile) {
        member.profile_picture = userProfile.profile_picture
          ? `${process.env.S3_BUCKET_PREFIX}${userProfile.profile_picture}`
          : null;
        (member.firstName = userProfile.firstName),
          (member.lastName = userProfile.lastName);
        member.interests = userProfile.interests;
      }
    });

    const teamWithMembers = {
      ...team._doc,
      members: teamMembersWithDetails,
    };
    res.status(200).json({ message: "successful", data: teamWithMembers });
  } catch (error: any) {
    logger.error("Error fetching team", { error });
    throw new Error(error);
  }
});

//@desc Update team
//@route PUT /api/teams/:id
//access private
export const updateTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Updating team: ${req.params.id}`);
      const team = await Team.findOne({ _id: req.params.id });

      if (!team) {
        res.status(404);
        throw new Error("Team not found");
      }

      if (team.owner_id.toString() !== req.user.id) {
        res.status(409).json({ error: "You do not own this team!" });
        return;
      }

      const {
        name,
        teamUsername,
        domain,
        subdomain,
        subdomainTopics,
        teamColor,
      } = req.body;

      // Initialize update object with current team values
      const updateData: any = {
        name: team.name,
        teamUsername: team.teamUsername,
        domain: team.domain,
        subdomain: team.subdomain,
        subdomainTopics: team.subdomainTopics,
        teamColor: team.teamColor,
      };

      // Update only if new values are provided
      if (name && name.trim().length > 0) {
        updateData.name = name.trim();
      }

      if (teamUsername && teamUsername.trim().length > 0) {
        updateData.teamUsername = teamUsername.trim();
      }

      if (teamColor && teamColor.trim().length > 0) {
        updateData.teamColor = teamColor.trim();
      }

      let domainExists: any;
      if (domain && domain.trim().length > 0) {
        domainExists = await TeamDomain.findOne({ name: domain });
        if (!domainExists) {
          res.status(409).json({ error: "Domain doesn't exist" });
          return;
        }
        updateData.domain = domain.trim();
      }

      let subdomainExists: any;
      if (subdomain && subdomain.trim().length > 0) {
        // If domain is not provided in the update, use the current team's domain
        const domainToCheck = domain ? domain : team.domain;
        domainExists = await TeamDomain.findOne({ name: domainToCheck });

        if (!domainExists) {
          res.status(409).json({ error: "Domain doesn't exist" });
          return;
        }

        subdomainExists = await TeamSubDomain.findOne({
          name: subdomain,
        });

        if (!subdomainExists) {
          res.status(409).json({ error: "Sub Domain doesn't exist" });
          return;
        }

        if (
          subdomainExists.parentDomain.toString() !==
          domainExists._id.toString()
        ) {
          res
            .status(409)
            .json({ error: "Sub Domain does not belong to domain" });
          return;
        }

        updateData.subdomain = subdomain.trim();
      }

      if (
        subdomainTopics &&
        Array.isArray(subdomainTopics) &&
        subdomainTopics.length > 0
      ) {
        const domainTopics = await DomainTopic.find({});
        const missingTopics: any = [];
        subdomainTopics.map((topic: any) => {
          const foundTopic = domainTopics.some((el) => el.name === topic);
          if (!foundTopic) {
            missingTopics.push(topic);
          }
        });

        if (missingTopics.length > 0) {
          res.status(404).json({
            error:
              "The following topics were not updated because they do not exist",
            data: missingTopics,
          });
          return;
        }
        updateData.subdomainTopics = subdomainTopics;
      }

      if (req.file) {
        //resize image
        const buffer = await sharp(req.file.buffer)
          .resize({ height: 400, width: 400, fit: "contain" })
          .toBuffer();
        const params = {
          Bucket: bucketName,
          Key: randomImageName(),
          Body: buffer,
          ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(params);
        await s3.send(command);
        updateData.displayImage = randomImageName();
      }

      const updatedTeam = await Team.findByIdAndUpdate(team._id, updateData, {
        new: true,
      });

      res.status(200).json({ message: "successful", data: updatedTeam });
    } catch (error: any) {
      logger.error("Error updating team", { error });
      throw new Error(error);
    }
  }
);

//@desc Delete team
//@route DELETE /api/teams/:id
//access private
export const deleteTeam = asyncHandler(async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting team: ${id}`);

    const team = await Team.findById(id);

    if (!team) {
      res.status(404);
      throw new Error("Team not found");
    }

    // Permission Verification
    // Check if user is owner OR superadmin
    const user = await User.findById(req.user.id).populate("role");
    const userRole = user?.role ? (user.role as any).name : "";

    // Normalize role name check (handle 'Super Admin', 'superadmin', 'super_admin' etc if unsure, but strict check is better if consistent)
    // Based on validateSuperAdmin.ts, it expects 'superadmin'
    const isSuperAdmin = userRole === "superadmin";
    const isOwner = team.owner_id.toString() === req.user.id;

    if (!isOwner && !isSuperAdmin) {
      res.status(403);
      throw new Error("You do not have permission to delete this team");
    }

    // 1. Notify pending join requests
    const pendingRequests = await TeamMemberRequest.find({
      team_id: id,
      status: "PENDING" // Assuming we only care about pending ones
    });

    if (pendingRequests.length > 0) {
      logger.info(`Notifying ${pendingRequests.length} pending users about team deletion`);

      const notificationPromises = pendingRequests.map(async (request: any) => {
        try {
          // Create DB Notification
          const notification = await Notification.create({
            user: request.user_id,
            message: `The team "${team.name}" you requested to join has been deleted.`,
            referenceModel: "Team", // Required field, even if reference is null
            reference: null,       // Team is gone, so no reference
            isRead: false
          });

          // Send SSE Notification
          sseNotificationService.sendNotification(request.user_id.toString(), notification);
        } catch (ctxError) {
          logger.error(`Failed to notify user ${request.user_id} during team deletion`, { error: ctxError });
        }
      });

      await Promise.all(notificationPromises);
    }

    // 2. Clean up Team Member Requests
    await TeamMemberRequest.deleteMany({ team_id: id });

    // 3. Clean up Team Members (The users themselves are not deleted, just the membership)
    await TeamMember.deleteMany({ team_id: id });

    // 4. Clean up Short URLs
    await ShortUrl.deleteMany({ resourceType: "team", resourceId: id });

    // 5. Clean up Chats and Messages
    const teamChats = await Chat.find({ teamId: id });
    const chatIds = teamChats.map(chat => chat._id);

    if (chatIds.length > 0) {
      await Message.deleteMany({ chatId: { $in: chatIds } });
      await Chat.deleteMany({ _id: { $in: chatIds } });
      logger.info(`Deleted ${chatIds.length} chats and associated messages for team ${id}`);
    }

    // 6. Delete the Team
    // NOTE: Challenges, TeamChallenges, Solutions, Comments are PRESERVED as per requirements.
    await Team.deleteOne({ _id: id });

    logger.info(`Team deleted successfully: ${id} by user ${req.user.id}`);
    res.status(200).json({ message: "Team deleted successfully", id });

  } catch (error: any) {
    logger.error("Error deleting team", { error });
    // If it's a known error status, preserve it, otherwise 500
    if (res.statusCode === 200) res.status(500);
    throw new Error(error.message || error);
  }
});

//@desc Get Random Team
//@route GET /api/teams/spotlight
//access private
export const getRandomTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info("Fetching random team spotlight");
      // Try to fetch the daily random team from Redis
      const cachedTeam = await redisClient.get(CACHE_KEY);
      if (cachedTeam) {
        // If found, parse it and return
        res.status(200).json(JSON.parse(cachedTeam));
        return;
      }

      // If not found in cache, get a random team from MongoDB
      const randomTeam = await Team.aggregate([{ $sample: { size: 1 } }]);
      if (!randomTeam || randomTeam.length === 0) {
        res.status(404).json({ message: "No team found" });
        return;
      }

      const teamToCache = randomTeam[0];

      // Cache the selected team with a TTL of 24 hours
      await redisClient.set(CACHE_KEY, JSON.stringify(teamToCache), {
        EX: TTL_SECONDS,
      });

      // Return the newly selected team
      res.status(200).json(teamToCache);
    } catch (error: any) {
      logger.error("Error fetching random team", { error });
      res.status(400).json({ error: error });
    }
  }
);
