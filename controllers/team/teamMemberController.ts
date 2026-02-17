import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import queueEmail from "../../services/emailQueue";
import { createEmailTemplate } from "../../helpers/emailTemplates";
import Team from "../../models/teamModel";
import User from "../../models/userModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamMember from "../../models/teamMemberModel";
import TeamMemberRequest from "../../models/teamMemberRequestModel";
import UserProfile from "../../models/userProfileModel";
import { Types, Document } from "mongoose";
import Notification from "../../models/notificationModel";
import sseNotificationService from "../../services/sseService";
import logger from "../../services/logger";

interface PopulatedUser extends Document {
  _id: Types.ObjectId;
  profile: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

//@desc Create team
//@route POST /api/team-member/create
//access private
export const addTeamMember = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { team_id, username, email } = req.body;
      logger.info(`Adding team member: ${username || email} to team: ${team_id}`);
      if (!username.trim() && !email.trim()) {
        res.status(400);
        throw new Error("Please put username or email");
      }

      if (!team_id.trim()) {
        res.status(400);
        throw new Error("Kindly specify a team");
      }

      const teamExists = await Team.findById({ _id: team_id });

      let userExists: any = {};
      if (email && username) {
        userExists = await User.findOne({ email: { $in: [email] } });
      } else if (email && !username) {
        userExists = await User.findOne({ email: { $in: [email] } });
      } else if (!email && username) {
        userExists = await User.findOne({ username: { $in: [username] } });
      }

      if (!teamExists) {
        res.status(400);
        throw new Error("Team does not exist");
      }

      if (!userExists) {
        res.status(400);
        throw new Error("User does not exist");
      }

      if (req.user.id === userExists._id.toString()) {
        res.status(400);
        throw new Error("You cannot add yourself to the team");
      }

      if (req.user.id !== teamExists.owner_id.toString()) {
        res.status(400);
        throw new Error("User is not the owner of the team.");
      }

      if (!userExists.isVerified) {
        res.status(400);
        throw new Error("User is not verified.");
      }

      const team = await TeamMember.find({ team_id });

      const teamMemberExists = team.some(
        (el: any) => el.user_id.toString() === userExists._id.toString()
      );

      if (teamMemberExists) {
        res.status(409);
        throw new Error("User already belongs to the team");
      }

      const teamMember = await TeamMember.create({
        owner_id: req.user.id,
        team_id,
        user_id: userExists._id,
      });

      // Create notification for added user
      const notification = await Notification.create({
        user: userExists._id,
        message: `You have been added to "${teamExists.name}".`,
        reference: teamExists._id,
        referenceModel: "Team",
      });

      // Send notification via SSE
      sseNotificationService.sendNotification(userExists._id.toString(), notification);
      logger.debug("Notification sent via SSE to user " + userExists._id.toString(), { notification });

      logger.info(`Team member added: ${teamMember._id}`);
      res.status(201).json({ message: "successful", data: teamMember });
    } catch (error: any) {
      logger.error("Error adding team member", { error });
      throw new Error(error);
    }
  }
);

//@desc Join team
//@route POST /api/team-member/join
//access private
export const joinTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { team_id, user_id } = req.body;
      logger.info(`Joining team: ${team_id}, user: ${user_id}`);

      const userId = user_id;

      if (!team_id.trim()) {
        res.status(400);
        throw new Error("Kindly specify a team");
      }

      const teamExists = await Team.findById({ _id: team_id });

      if (!teamExists) {
        res.status(400);
        throw new Error("Team does not exist");
      }

      const memberRequest = await TeamMemberRequest.findOne({
        user_id: userId,
        team_id: team_id,
      });

      if (memberRequest && memberRequest.status === "PENDING") {
        res.status(409);
        throw new Error("Member request already exists for that user.");
      }

      if (userId === teamExists.owner_id.toString()) {
        res.status(400);
        throw new Error("You cannot add yourself to the team");
      }
      const owner = await User.findById({ _id: teamExists.owner_id });

      if (!owner) {
        res.status(400);
        throw new Error("Team doesn't have an owner");
      }

      const userExists = await User.findOne({ _id: { $in: [userId] } });

      if (!userExists) {
        res.status(400);
        throw new Error("User does not exist.");
      }

      if (!userExists.isVerified) {
        res.status(400);
        throw new Error("User is not verified.");
      }

      const team = await TeamMember.find({ team_id });

      const teamMemberExists = team.some(
        (el: any) => el.user_id.toString() === userExists._id.toString()
      );
      if (teamMemberExists) {
        res.status(409);
        throw new Error("User already belongs to the team");
      }

      const teamMemberRequest = await TeamMemberRequest.create({
        owner_id: teamExists.owner_id,
        user_id: userId,
        team_id: teamExists._id,
      });

      const populatedUser = (await User.findById({ _id: userId }).populate({
        path: "profile",
        select: "firstName lastName username",
      })) as PopulatedUser | null;

      if (!populatedUser) {
        res.status(404);
        throw new Error("User not found");
      }

      const username =
        populatedUser.profile.firstName && populatedUser.profile.lastName
          ? `${populatedUser.profile.firstName} ${populatedUser.profile.lastName}`
          : populatedUser.profile.username;
      // Create notification for team owner
      const notification = await Notification.create({
        user: teamExists.owner_id,
        message: `${username} has requested to join "${teamExists.name}".`,
        reference: teamExists._id,
        referenceModel: "Team",
        subreference: teamMemberRequest._id,
        subreferenceModel: "TeamMemberRequest",
      });

      // Send notification via SSE
      sseNotificationService.sendNotification(teamExists.owner_id.toString(), notification);
      logger.debug("Notification sent via SSE to team owner " + teamExists.owner_id.toString(), { notification });

      const emailTemplate = createEmailTemplate({
        greeting: `Hi ${owner?.username},`,
        content: `<p style="margin: 0 0 16px;">You have a request from <strong>${userExists?.username}</strong> to join your team.</p><p style="margin: 0;">Kindly log in to the application to review their request.</p>`,
      });
      queueEmail(owner.email, emailTemplate, "Team Member Request");

      logger.info("Join request sent successfully");
      res.status(201).json({ message: "successful", data: teamMemberRequest });
    } catch (error: any) {
      logger.error("Error joining team", { error });
      throw new Error(error);
    }
  }
);

//@desc Update user joining request
//@route POST /api/team-member/join/:id
//access private
export const updateJoinRequest = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Updating join request: ${req.params.id}`);
      const memberRequest = await TeamMemberRequest.findById({
        _id: req.params.id,
      });

      if (!memberRequest) {
        res.status(404);
        throw new Error("Request not found");
      }

      if (req.user.id !== memberRequest.owner_id.toString()) {
        res.status(403);
        throw new Error("You do not have permission to approve this request");
      }

      const userExists = await User.findOne({
        _id: { $in: [memberRequest.user_id] },
      });

      if (!userExists) {
        res.status(400);
        throw new Error("User does not exist.");
      }

      if (!userExists.isVerified) {
        res.status(400);
        throw new Error("User is not verified.");
      }

      const { status, comment } = req.body;

      if (!status.trim()) {
        res.status(400);
        throw new Error("Kindly give a request decision.");
      }

      if (
        status.trim().toLowerCase() !== "approved" &&
        status.trim().toLowerCase() !== "declined"
      ) {
        res.status(400);
        throw new Error("Kindly give a status of approved or declined");
      }

      if (status.trim().toLowerCase() === "declined" && !comment.trim()) {
        res.status(400);
        throw new Error("Kindly give a reason for declining the request.");
      }

      if (memberRequest.status !== "PENDING") {
        res.status(400);
        throw new Error("The request was already processed.");
      }
      const updatedRequest = await TeamMemberRequest.findByIdAndUpdate(
        memberRequest._id,
        {
          status: status,
          comment: comment.trim(),
        },
        {
          new: true,
        }
      );

      if (status.trim().toLowerCase() === "approved") {
        await TeamMember.create({
          owner_id: req.user.id,
          team_id: memberRequest.team_id,
          user_id: memberRequest.user_id,
        });
      }

      const teamName = await Team.findById({ _id: memberRequest.team_id });

      const notification = await Notification.create({
        user: memberRequest.user_id,
        message: `Your request to join ${teamName?.name
          } has been ${status.toLowerCase()}.`,
        reference: memberRequest.team_id,
        referenceModel: "Team",
        subreference: memberRequest._id,
        subreferenceModel: "TeamMemberRequest",
      });

      // Send notification via SSE
      sseNotificationService.sendNotification(memberRequest.user_id.toString(), notification);
      logger.debug("Notification sent via SSE to user " + memberRequest.user_id.toString(), { notification });

      const emailTemplate = createEmailTemplate({
        greeting: `Hi,`,
        content: `<p style="margin: 0;">Your request to join team <strong>${teamName?.name}</strong> has been <strong>${status}</strong>.</p>`,
      });
      queueEmail(userExists.email, emailTemplate, "Team Member Request");

      logger.info(`Join request updated: ${req.params.id}`);
      res.status(200).json({ message: "successful", data: updatedRequest });
    } catch (error: any) {
      logger.error("Error updating join request", { error });
      throw new Error(error);
    }
  }
);

//@desc Delete team
//@route DELETE /api/team-member?teamId=teamId&userId=userId
//access private
export const deleteTeamMember = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { teamId, userId } = req.query;

      const teamMember = await TeamMember.findOne({
        user_id: userId,
        team_id: teamId,
      });
      if (!teamMember) {
        res.status(404).json({ message: "Team member not found" });
        return;
      }
      if (req.user.id !== teamMember.owner_id.toString()) {
        res.status(403).json({
          message:
            "You do not have permission to remove the team member from the team.",
        });
        return;
      }
      await TeamMember.findByIdAndDelete(teamMember?._id);

      const teamName = await Team.findById({ _id: teamMember.team_id });

      const notification = await Notification.create({
        user: teamMember.user_id,
        message: `You have been removed from "${teamName?.name}".`,
        reference: teamMember.team_id,
        referenceModel: "Team",
        subreference: teamMember._id,
        subreferenceModel: "RemoveTeamMember",
      });

      // Send notification via SSE
      sseNotificationService.sendNotification(teamMember.user_id.toString(), notification);
      logger.debug("Notification sent via SSE to user " + teamMember.user_id.toString(), { notification });

      logger.info(`Team member removed: ${teamMember._id}`);
      res.status(204).json({
        message: "Team member removed successfully",
      });
    } catch (error: any) {
      logger.error("Error removing team member", { error });
      res.status(500);
      throw new Error(error);
    }
  }
);

//@desc Leave team
//@route DELETE /api/team-member/leave/:id
//access private
export const leaveTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`User leaving team: ${req.user.id}, Team: ${req.params.teamId}`);
      const teamMember = await TeamMember.findOne({
        user_id: req.user.id,
        team_id: req.params.teamId,
      });

      if (!teamMember) {
        res.status(400).json({ message: "You do not belong to this team!" });
        return;
      }

      if (teamMember.owner_id.toString() === req.user.id) {
        res.status(400).json({ message: "You cannot leave your own team!" });
        return;
      }

      await TeamMember.findByIdAndDelete(teamMember?._id);
      logger.info(`User left team: ${req.user.id}`);
      res.status(204).json({
        message: "You left the team successfully",
      });
    } catch (error: any) {
      logger.error("Error leaving team", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Fetch team member requests of a team
//@route GET /api/team-member/requests/:id
//access private
export const fetchTeamMemberRequests = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Fetching team member requests for team: ${req.params.teamId}`);
      const teamMemberRequests = await TeamMemberRequest.find({
        team_id: req.params.teamId,
      });

      const userIds: any = [];
      teamMemberRequests.map((request: any) => {
        userIds.push(request.user_id);
      });

      const userProfiles = await UserProfile.find({
        user_id: { $in: userIds },
      });

      // Merging requests with profile data
      const mergedRequests = teamMemberRequests.map((request: any) => {
        const userProfile = userProfiles.find(
          (profile) => profile.user_id.toString() === request.user_id.toString()
        );
        // Only include specific fields from the profile
        const limitedProfile = userProfile
          ? {
            user_id: userProfile.user_id,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            username: userProfile.username,
            interests: userProfile.interests,
            profile_picture: userProfile.profile_picture
              ? `${process.env.S3_BUCKET_PREFIX}${userProfile.profile_picture}`
              : null,
          }
          : {};
        return {
          ...request._doc,
          userProfile: limitedProfile,
        };
      });

      res.status(200).json({ message: "successful", data: mergedRequests });
    } catch (error: any) {
      logger.error("Error fetching team member requests", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);


