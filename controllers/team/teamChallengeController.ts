import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import Team from "../../models/teamModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamChallenge from "../../models/teamChallengeModel";
import TeamMember from "../../models/teamMemberModel";
import UserProfile from "../../models/userProfileModel";
import Notification from "../../models/notificationModel";
import ChallengeComment from "../../models/challengeCommentModel";
import crypto from "crypto";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}


import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey!,
    secretAccessKey: secretAccessKey!,
  },
  region: bucketRegion!,
});

//@desc Post Challenge
//@route POST /api/teams/challenge
//access private
export const createTeamChallenge = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const {
        challenge_name,
        due_date,
        difficulty,
        description,
        resources,
        image_url,
        reward,
      } = req.body;

      const teamExists = await Team.findById({ _id: req.params.id });

      if (!teamExists) {
        res.status(404);
        throw new Error("Team does not exist");
      }

      if (req.user.id !== teamExists.owner_id.toString()) {
        res.status(403);
        throw new Error("User does not own the team");
      }

      const currentDate = new Date();

      if (currentDate > new Date(due_date.trim())) {
        res.status(400);
        throw new Error("Due date can't be in the past");
      }

      if (difficulty < 1 || difficulty > 5) {
        res.status(400);
        throw new Error("Put a valid difficulty");
      }

      const challenge = await TeamChallenge.create({
        challenge_name: challenge_name.trim(),
        owner_id: req.user.id,
        team_id: req.params.id,
        due_date: new Date(due_date),
        difficulty,
        description: description.trim(),
        resources,
        image_url: image_url.trim(),
        reward,
        valid: true,
      });

      res.status(201).json({ message: "success", data: challenge });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Get Challenges
//@route GET /api/teams/:id/challenges
//access private
export const getAllTeamChallenges = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.id });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
      } else {
        const challenges = await TeamChallenge.find({
          team_id: req.params.id,
        });

        if (!challenges.length) {
          res.status(404).json({ message: "No challenges for team" });
        } else {
          res.status(200).json({ message: "successful", data: challenges });
        }
      }
    } catch (error: any) {
      console.log(error);
    }
  }
);

//@desc Get Individual Team Challenge
//@route GET /api/teams/:id/challenges/:challengeId
//access private
export const getIndividualTeamChallenge = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.teamId });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
      } else {
        const challenge = await TeamChallenge.findById({
          _id: req.params.challengeId,
        });

        if (!challenge) {
          res.status(404).json({ message: "Challenge not found" });
        } else {
          res.status(200).json({ message: "successful", data: challenge });
        }
      }
    } catch (error: any) {
      console.log(error);
    }
  }
);

//@desc Update Individual Team Challenge
//@route PUT /api/teams/:id/challenges/:challengeId
//access private
export const updateIndividualTeamChallenge = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.teamId });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
      } else {
        if (req.user.id !== team.owner_id.toString()) {
          res.status(403).json({ message: "User does not own the team" });
        } else {
          const challenge = await TeamChallenge.findById({
            _id: req.params.challengeId,
          });
          if (!challenge) {
            res.status(404).json({ message: "Challenge not found" });
          } else {
            const updatedChallenge = await TeamChallenge.findByIdAndUpdate(
              req.params.challengeId,
              req.body,
              {
                new: true,
              }
            );

            res
              .status(200)
              .json({ message: "Update successful", data: updatedChallenge });
          }
        }
      }
    } catch (error: any) {
      console.log(error);
    }
  }
);

//@desc Delete Individual Team Challenge
//@route DELETE /api/teams/:id/challenges/:challengeId
//access private
export const deleteIndividualTeamChallenge = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.teamId });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
      } else {
        if (req.user.id !== team.owner_id.toString()) {
          res.status(403).json({ message: "User does not own the team" });
        } else {
          const challenge = await TeamChallenge.findById({
            _id: req.params.challengeId,
          });
          if (!challenge) {
            res.status(404).json({ message: "Challenge not found" });
          } else {
            // Delete the authentication code from the database
            const challenge = await TeamChallenge.deleteOne({
              _id: req.params.challengeId,
            });
            res.status(204).json({
              message: "Challenge deleted successfully",
              data: challenge,
            });
          }
        }
      }
    } catch (error: any) {
      console.log(error);
    }
  }
);

//@desc Post Challenge comment
//@route POST /api/challenges/:id/comments
//access private
export const postChallengeComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challengeExists[0].team_id,
      });

      if (!teamMembers) {
        res.status(404);
        throw new Error("No team members");
      }

      const teamMemberExists: any = teamMembers.find((member) => {
        return member.user_id.toString() === req.user.id;
      });

      if (!teamMemberExists) {
        res.status(403).json({ message: "User does not belong to the team" });
      } else {
        const { comment } = req.body;

        if (!comment.trim()) {
          res.status(400).json({ message: "Put a comment will ya" });
          return;
        }

        const challengeComment = await ChallengeComment.create({
          challenge_id: req.params.id,
          comment,
          user: req.user.id,
        });

        res.status(201).json({ message: "successful", data: challengeComment });
      }
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error.message });
    }
  }
);

//@desc Update Solution comment
//@route PUT /api/challenges/:id/comments/:commentId
//access private
export const updateChallengeComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });

      if (!challengeExists) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challengeExists.team_id,
      });

      if (!teamMembers) {
        res.status(404);
        throw new Error("No team members");
      }

      const teamMemberExists: any = teamMembers.find((member) => {
        return member.user_id.toString() === req.user.id;
      });

      if (!teamMemberExists) {
        res.status(403).json({ message: "User does not belong to the team" });
      } else {
        const { comment } = req.body;

        if (!comment.trim()) {
          res.status(400).json({ message: "Put a comment will ya" });
          return;
        }

        const challengeComment = await ChallengeComment.findOne({
          _id: req.params.commentId,
        });

        if (challengeComment?.user.toString() !== req.user.id) {
          res.status(403).json({ error: "This is not your comment" });
          return;
        }

        const updatedComment = await ChallengeComment.findByIdAndUpdate(
          req.params.commentId,
          {
            comment: comment,
          },
          { new: true }
        );

        res.status(200).json({ message: "successful", data: updatedComment });
      }
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error.message });
    }
  }
);

//@desc Get Challenge comments
//@route GET /api/challenges/:id/comments
//access private
export const getChallengeComments = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const { sort = "desc" } = req.query; // Get sort query parameter (default: "desc")

      // Check if the challenge exists
      const challengeExists = await TeamChallenge.findOne({ _id: challenge_id });
      if (!challengeExists) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      // Determine sort order
      const sortOrder = sort === "asc" ? 1 : -1; // -1 for newest first, 1 for oldest first

      // Fetch challenge comments with nested population
      const challengeComments = await ChallengeComment.find({ challenge_id })
        .sort({ createdAt: sortOrder }) 
        .populate({
          path: "user", // Populate the `user` field in ChallengeComment
          model: "User", // Explicitly reference the `User` model
          select: "username email profile", // Include relevant fields from User
          populate: {
            path: "profile", // Populate the `profile` field within User
            model: "UserProfile", // Reference the UserProfile model
            select: "firstName lastName bio profile_picture", // Include relevant fields from UserProfile
          },
        });

      // Add S3 prefix to profile_picture
      const data = challengeComments.map((comment: any) => {
        const userProfile = comment.user?.profile;
      
        if (userProfile?.profile_picture) {
          // Only add the S3 prefix if it is not already included
          if (!userProfile.profile_picture.startsWith(process.env.S3_BUCKET_PREFIX)) {
            userProfile.profile_picture = `${process.env.S3_BUCKET_PREFIX}${userProfile.profile_picture}`;
          }
        } else {
          comment.user.profile = null; // Handle missing profiles
        }
      
        return comment;
      });      

      res.status(200).json({ message: "successful", data });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
);



//@desc Get Challenge comment
//@route GET /api/challenges/:id/comments/:commentId
//access private
export const getChallengeComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });

      if (!challengeExists) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const challengeComment = await ChallengeComment.findOne({
        _id: req.params.commentId,
      });

      res.status(200).json({ message: "successful", data: challengeComment });
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error.message });
    }
  }
);

//@desc Delete Challenge comment
//@route DELETE /api/challenges/:id/comments/:commentId
//access private
export const deleteChallengeComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });

      if (!challengeExists) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const challengeComment = await ChallengeComment.findOne({
        _id: req.params.commentId,
      });

      if (!challengeComment) {
        res.status(404).json({ message: "Comment does not exist" });
        return;
      }

      if (challengeComment.user.toString() !== req.user.id) {
        res.status(403).json({ error: "This is not your comment" });
        return;
      }

      await ChallengeComment.findByIdAndDelete(req.params.commentId);

      res.status(204).json({ message: "successful" });
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error.message });
    }
  }
);


//@desc Post Challenge
//@route POST /api/teams/challenge
//access private
export const createTeamChallengeV2 = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const teamExists = await Team.findById({ _id: req.params.id });

      if (!teamExists) {
        res.status(404);
        throw new Error("Team does not exist");
      }

      if (req.user.id !== teamExists.owner_id.toString()) {
        res.status(403);
        throw new Error("User does not own the team");
      }

      const currentDraftChallenges = await TeamChallenge.find({ owner_id: req.user.id, valid:false })

      if (currentDraftChallenges.length > 4) {
        res.status(400)
        throw new Error("Maximum amount of drafts reached. Please delete some of your draft challenges before you proceed.")
      }

      const challenge = await TeamChallenge.create({
        owner_id: req.user.id,
        team_id: req.params.id,
        valid: false
      });
      res.status(201).json({ message: "success", data: challenge });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Update Individual Team Challenge
//@route PUT /api/teams/:id/challenges/:challengeId
//access private
export const updateIndividualTeamChallengeV2 = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.teamId });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
        return
      } 
      
      if (req.user.id !== team.owner_id.toString()) {
        res.status(403).json({ message: "User does not own this team" });
        return
      } 
      
     
      const challenge:any = await TeamChallenge.findById({
        _id: req.params.challengeId,
      }).populate({
        path: "team_id",
        model: "Team",
        select: "name",
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge not found" });
        return
      } 

      // Validation for due_date and difficulty
      const { due_date, difficulty, valid } = req.body;

      if (due_date && new Date(due_date) <= new Date()) {
        res.status(400).json({ message: "Due date can't be in the past" });
        return
      }

      if (difficulty !== undefined && (difficulty < 1 || difficulty > 5)) {
        res.status(400).json({ message: "Difficulty must be between 1 and 5" });
        return
      }

      const updatedChallenge = await TeamChallenge.findByIdAndUpdate(
        req.params.challengeId,
        req.body,
        {
          new: true,
        }
      );

      if (valid) {
        // Retrieve all team members for this team
        const teamMembers = await TeamMember.find({ team_id: req.params.teamId }).lean();

        const membersToNotify = teamMembers.filter(
          (member) => member.user_id.toString() !== req.user.id
        );
        
        for (const member of membersToNotify) {
          const notification = await Notification.create({
            user: member.user_id,
            message: `New challenge "${challenge.challenge_name}" has been created in "${challenge.team_id.name}".`,
            reference: challenge._id,
            referenceModel: "TeamChallenge",
          });
        
          // If using real-time notifications (e.g., with Socket.io), you might also emit an event here:
          // io.to(member.user_id.toString()).emit('newNotification', { ... });
          const io = req.app.locals.io;
          io.to(member.user_id.toString()).emit("newNotification", notification);
          console.log("EMITTED! ", notification)
        }
      }

      res
        .status(200)
        .json({ message: "Update successful", data: updatedChallenge });
      
        
    } catch (error: any) {
      console.log(error);
      res.status(500)
      throw new(error)
    }
  }
);            


// @desc Delete Multiple Specific Team Challenges
// @route DELETE /api/teams/:teamId/challenges
// @access private
export const deleteMultipleSpecificTeamChallenges = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findById({ _id: req.params.teamId });

      if (!team) {
        res.status(404).json({ message: "Team not found" });
        return
      }

      if (req.user.id !== team.owner_id.toString()) {
        res.status(403).json({ message: "User does not own the team" });
        return
      }

      // Check if challengeIds are provided in the request body
      const { challengeIds } = req.body;
      if (!challengeIds || !Array.isArray(challengeIds) || challengeIds.length === 0) {
        res.status(400).json({ message: "No challenge IDs provided or invalid format" });
        return
      }

      // Delete only the specified challenges associated with the team
      const result = await TeamChallenge.deleteMany({
        _id: { $in: challengeIds },
        team_id: req.params.teamId,
      });

      res.status(200).json({
        message: "Specified challenges deleted successfully",
        deletedCount: result.deletedCount,
      });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);


export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const multerReq = req as MulterRequest;
  const randomImageName = (bytes = 32) =>
    crypto.randomBytes(bytes).toString("hex");




  try {
    const imageKey = randomImageName();
    const params = {
      Bucket: bucketName,
      Key: imageKey,
      Body: multerReq.file.buffer,
      ContentType: multerReq.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    const imageUrl = `${process.env.S3_BUCKET_PREFIX}${imageKey}`;
    res.status(200).json({ url: imageUrl });
  } catch (error: any) {
    res.status(500).json({ message: "Image upload failed", error: error.message });
  }
});


// Route to delete an image
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.body; // The key of the image to delete

  if (!key) {
    res.status(400);
    throw new Error("No image key provided");
  }

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    await s3.send(new DeleteObjectCommand(params));
    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Image deletion failed", error: error.message });
  }
});