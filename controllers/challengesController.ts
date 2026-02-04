import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import TeamChallenge from "../models/teamChallengeModel";
import TeamMember from "../models/teamMemberModel";
import Team from "../models/teamModel";
import logger from "../services/logger";

//@desc Get Challenges
//@route GET /api/challenges
//access private
export const getAllChallenges = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      let challenges: any = [];

      if (req.query.userId) {
        // Find all teams for the user
        const teamMembers = await TeamMember.find({ user_id: req.query.userId });
        const teamIds = teamMembers.map((member: any) => member.team_id);

        // Fetch all teams for the user's team IDs
        const teams = await Team.find({ _id: { $in: teamIds } });

        // Create a map of team IDs to team names
        const teamNamesMap = teams.reduce((acc: Record<string, string>, team) => {
          acc[team._id.toString()] = team.name;
          return acc;
        }, {});

        // Filter challenges based on the `valid` query parameter
        const valid = req.query.valid;
        if (valid) {
          challenges = await TeamChallenge.find({ team_id: { $in: teamIds }, valid });
          challenges = challenges.map((challenge: any) => {
            const hasTeamId = !!challenge.team_id;
            const hasChallengeName = !!challenge.challenge_name;
            const hasDifficulty = !!challenge.difficulty;
            const hasDueDate = !!challenge.due_date;
            const hasDescription = !!challenge.description;
            const hasResources = !!challenge.resources;

            let currentStep;

            if (hasTeamId && (!hasChallengeName || !hasDifficulty || !hasDueDate)) {
              currentStep = 2;
            } else if (hasTeamId && hasChallengeName && hasDifficulty && hasDueDate && !hasDescription) {
              currentStep = 3;
            } else if (hasDescription && !hasResources) {
              currentStep = 4;
            } else if (hasResources && (!hasChallengeName || !hasDifficulty || !hasDueDate)) {
              currentStep = 5;
            } else if (hasTeamId && hasChallengeName && hasDifficulty && hasDueDate && hasDescription && hasResources) {
              currentStep = 6;
            }
            // return Object.assign({}, challenge.toObject(), {
            //   currentStep,
            //   teamName: teamNamesMap[challenge.team_id.toString()]
            // });
            return {
              ...challenge.toObject(),
              currentStep,
              teamName: teamNamesMap[challenge.team_id.toString()]
            };
          });
        } else {
          challenges = await TeamChallenge.find({ team_id: { $in: teamIds }, valid: true });
        }
      } else {
        // If no userId, find all valid challenges
        challenges = await TeamChallenge.find({ valid: true });
      }

      res.status(200).json({ message: "successful", data: challenges });
    } catch (error: any) {
      res.status(400);
      throw new Error(error.message);
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
        res.status(404)
        throw new Error("Challenge not found")
        // res.status(404).json({ message: "Challenge not found" });
      } else {
        res.status(200).json({ message: "successful", data: challenge });
      }
    } catch (error: any) {
      res.status(400)
      throw new Error(error)
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
      const ownedChallenges: any = [];

      for (const challenge of challenges) {
        const team = await Team.findById({ _id: challenge.team_id.toString() });
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
      logger.error("Error deleting multiple challenges", { error });
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);
