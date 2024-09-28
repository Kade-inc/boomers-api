import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import nodemailer from "nodemailer";
import Team from "../../models/teamModel";
import User from "../../models/userModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamMember from "../../models/teamMemberModel";
import TeamMemberRequest from "../../models/teamMemberRequestModel";
import UserProfile from "../../models/userProfileModel";

//@desc Create team
//@route POST /api/team-member/create
//access private
export const addTeamMember = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { team_id, username, email } = req.body;
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

      res.status(201).json({ message: "successful", data: teamMember });
    } catch (error: any) {
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
      const { team_id } = req.body;

      if (!team_id.trim()) {
        res.status(400);
        throw new Error("Kindly specify a team");
      }

      const teamExists = await Team.findById({ _id: team_id });

      if (!teamExists) {
        res.status(400);
        throw new Error("Team does not exist");
      }

      if (req.user.id === teamExists.owner_id.toString()) {
        res.status(400);
        throw new Error("You cannot add yourself to the team");
      }
      const owner = await User.findById({ _id: teamExists.owner_id });

      if (!owner) {
        res.status(400);
        throw new Error("Team doesn't have an owner");
      }

      const userExists = await User.findOne({ _id: { $in: [req.user.id] } });

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
        user_id: req.user.id,
        team_id: teamExists._id,
      });

      const emailTemplate = `<div>
        <p>Hi,</p>
        <p>You have a request from ${userExists.email}. Kindly log in to the application to review their request.</p>
        <p>Best,</p>
        <p>Boomers Support</p>
      </div>`;
      sendMail(transporter, owner.email, emailTemplate);

      res.status(201).json({ message: "successful", data: teamMemberRequest });
    } catch (error: any) {
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

      const teamMember = await TeamMember.create({
        owner_id: req.user.id,
        team_id: memberRequest.team_id,
        user_id: memberRequest.user_id,
      });
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

      const emailTemplate = `<div>
          <p>Hi,</p>
          <p>Your request to join team ${memberRequest.team_id} has been ${status}.</p>
          <p>Best,</p>
          <p>Boomers Support</p>
        </div>`;
      sendMail(transporter, userExists.email, emailTemplate);

      res.status(200).json({ message: "successful", data: updatedRequest });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Get teams
//@route GET /api/teams
//access private
export const getTeamMembers = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const teams = await Team.find({});

      res.status(200).json({ message: "successful", data: teams });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Get Team
//@route GET /api/teams/:id
//access public
export const getTeamMember = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const team = await Team.findOne({ _id: req.params.id });

      if (!team) {
        res.status(404).json({ message: "Team does not exist" });
        return;
      }
      res.status(200).json(team);
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Delete team
//@route DELETE /api/teams/:id
//access private
export const deleteTeamMember = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const team = await Team.findById(req.params.id);
      if (!team) {
        res.status(404);
        throw new Error("Team not found");
      }
      //   if(contact.user_id.toString() !== req.user.id) {
      //     res.status(403)
      //     throw new Error("User doesn't have permission to update other user contacts")
      // }

      // await Contact.remove()
      await Team.deleteOne({ _id: req.params.id });
      res.status(200).json(team);
    } catch (error) {}
  }
);

//@desc Fetch team member requests of a team
//@route GET /api/team-member/requests/:id
//access private
export const fetchTeamMemberRequests = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
     
      const teamMemberRequests = await TeamMemberRequest.find({
        team_id: req.params.teamId
      });

      const userIds:any = []
      teamMemberRequests.map((request:any) => {
        userIds.push(request.user_id)
      })

      const userProfiles = await UserProfile.find({user_id: { $in: userIds }})

      // Merging requests with profile data
      const mergedRequests = teamMemberRequests.map((request: any) => {
        const userProfile = userProfiles.find(profile => profile.user_id.toString() === request.user_id.toString());
        
        // Only include specific fields from the profile
        const limitedProfile = userProfile
        ? {
            user_id: userProfile.user_id,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            username: userProfile.username,
            profile_picture: userProfile.profile_picture
          }
        : {};
        return {
          ...request._doc,
          userProfile: limitedProfile
        };
      });

      res.status(200).json({ message: "successful", data: mergedRequests})
    } catch (error: any) {
      res.status(400)
      throw new Error(error);
    }
  }
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.MAIL_PASSWORD,
  },
});

// async..await is not allowed in global scope, must use a wrapper
const sendMail = async (transporter: any, user: any, template: any) => {
  const mailOptions = {
    from: {
      name: "Boomers",
      address: process.env.USER_EMAIL,
    }, // sender address
    to: [user], // list of receivers
    subject: "Team Member Request", // Subject line
    html: template,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    throw new Error(error);
  }
};
