import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import Team from "../../models/teamModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamChallenge from "../../models/teamChallengeModel";
import TeamMember from "../../models/teamMemberModel";
import UserProfile from "../../models/userProfileModel";
import ChallengeComment from "../../models/challengeCommentModel";

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
      console.log("RPA: ", req.params.teamId);
      console.log("CHALLENGE: ", req.params.challengeId);
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

        const user = await UserProfile.findOne({ user_id: req.user.id });

        const challengeComment = await ChallengeComment.create({
          challenge_id: req.params.id,
          comment,
          user: user,
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

        console.log("CHJAL: ", challengeComment);
        if (challengeComment?.user.user_id.toString() !== req.user.id) {
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
      const challengeExists = await TeamChallenge.findOne({
        _id: challenge_id,
      });

      if (!challengeExists) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const challengeComments = await ChallengeComment.find({});

      res.status(200).json({ message: "successful", data: challengeComments });
    } catch (error: any) {
      console.log(error);
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

      if (challengeComment.user.user_id.toString() !== req.user.id) {
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

      const currentChallenges = await TeamChallenge.find({ owner_id: req.user.id, team_id: req.params.id})

      if (currentChallenges.length === 5) {
        res.status(400)
        throw new Error("Maximum amount of drafts reached. Please delete some drafts for this team before you proceed.")
      }

      const challenge = await TeamChallenge.create({
        owner_id: req.user.id,
        team_id: req.params.id,
        valid: true
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
      
     
      const challenge = await TeamChallenge.findById({
        _id: req.params.challengeId,
      });
      if (!challenge) {
        res.status(404).json({ message: "Challenge not found" });
        return
      } 

      // Validation for due_date and difficulty
      const { due_date, difficulty } = req.body;

      if (due_date && new Date(due_date) <= new Date()) {
        res.status(400).json({ message: "Due date can't be in the past" });
        return
      }

      if (difficulty && (difficulty < 1 || difficulty > 5)) {
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