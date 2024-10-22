import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import TeamChallenge from "../models/teamChallengeModel";
import TeamMember from "../models/teamMemberModel";

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
        challenges = await TeamChallenge.find({team_id: { $in: teamIds }})
      } else {
        challenges = await TeamChallenge.find({});
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
