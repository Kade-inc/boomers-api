import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import TeamChallenge from "../models/teamChallengeModel";
import TeamMember from "../models/teamMemberModel";
import Team from "../models/teamModel";

//@desc Get Challenges
//@route GET /api/challenges
//access private
export const getAllChallenges = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      let challenges: any = [];

      if (req.query.userId) {
        const teamMembers = await TeamMember.find({ user_id: req.query.userId })
        const teamIds:string[] = []
        teamMembers.map((member:any) => {
          teamIds.push(member.team_id)
        })
        const valid = req.query.valid
        if (valid) {
          challenges = await TeamChallenge.find({team_id: { $in: teamIds }, valid })
          challenges = challenges.map((challenge: any) => {
            if (!challenge.challenge_name) {
              return Object.assign({}, challenge.toObject(), { currentStep: 2 });
            } else if (challenge.challenge_name && !challenge.description) {
              return Object.assign({}, challenge.toObject(), { currentStep: 3 });
            } else if (challenge.challenge_name && challenge.description) {
              return Object.assign({}, challenge.toObject(), { currentStep: 4 });
            }  else if (challenge.challenge_name && challenge.description && !challenge.resources) {
              return Object.assign({}, challenge.toObject(), { currentStep: 5 });
            } else if (challenge.challenge_name && challenge.description && challenge.resources) {
              return Object.assign({}, challenge.toObject(), { currentStep: 6 });
            } 
            return challenge;
          });
        } else {
          challenges = await TeamChallenge.find({team_id: { $in: teamIds }, valid: true})
         
        }
       
      } else {
        challenges = await TeamChallenge.find({ valid: true});
      }
      
      res.status(200).json({ message: "successful", data: challenges });
    } catch (error: any) {
      res.status(400)
      throw new Error(error)
    }
  }
);

//@desc Get Challenges
//@route GET /api/challenges/:id
//access private
export const getChallenge = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge = await TeamChallenge.findById({ _id: req.params.id });

      if (!challenge) {
        res.status(404).json({ message: "Challenge not found" });
      } else {
        res.status(200).json({ message: "successful", data: challenge });
      }
    } catch (error: any) {
      console.log(error);
    }
  }
);

// @desc Delete Multiple Specified Challenges Owned by User
// @route DELETE /api/challenges
// @access private
export const deleteMultipleChallengesByUser = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      // Check if challengeIds are provided in the request body
      const { challengeIds } = req.body;
      if (!challengeIds || !Array.isArray(challengeIds) || challengeIds.length === 0) {
        res.status(400).json({ message: "No challenge IDs provided or invalid format" });
        return 
      }

      // Fetch the challenges that match the provided IDs
      const challenges = await TeamChallenge.find({
        _id: { $in: challengeIds }
      });

      // Filter challenges to include only those owned by the user
      const ownedChallenges:any = [];
    
      for (const challenge of challenges) {
        const team = await Team.findById({_id: challenge.team_id.toString()});
        if (team && team.owner_id.toString() === req.user.id) {
          ownedChallenges.push(challenge._id);
        }
      }

      if (ownedChallenges.length === 0) {
        res.status(403).json({ message: "User does not own any of the specified challenges" });
        return 
      }

      // Delete the challenges that the user owns
      const result = await TeamChallenge.deleteMany({
        _id: { $in: ownedChallenges },
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
