import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import TeamMemberRequest from "../models/teamMemberRequestModel";
import logger from "../services/logger";

export const fetchRequests = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const userId = req.user.id
    logger.debug("Fetching requests for user", { userId });
    try {
      const s3Prefix = process.env.S3_BUCKET_PREFIX || "";

      let requests: any = await TeamMemberRequest.find({
        $or: [{ owner_id: userId }, { user_id: userId }],
      }).populate({
        path: "owner_id",
        model: "User",
        select: "profile",
        populate: {
          path: "profile",
          model: "UserProfile",
          select: "firstName lastName username"
        }
      }).populate({
        path: "user_id",
        model: "User",
        select: "profile",
        populate: {
          path: "profile",
          model: "UserProfile",
          select: "firstName lastName username profile_picture interests"
        }
      })
        .populate({
          path: "team_id",
          model: "Team",
          select: "name teamColor"
        })
        .lean() // This converts the Mongoose documents into plain JavaScript objects, which makes them easier to modify.

      // Map through each request and add the prefix to profile_picture if present
      requests = requests.map((request: any) => {
        if (
          request.user_id &&
          request.user_id.profile &&
          request.user_id.profile.profile_picture
        ) {
          request.user_id.profile.profile_picture =
            s3Prefix + request.user_id.profile.profile_picture;
        }
        return request;
      });
      res.status(200).json({ data: requests })
    } catch (error: any) {
      res.status(500)
      throw new Error(error);
    }
  }
);

