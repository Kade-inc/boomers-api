import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import Team from "../models/teamModel";
import UserProfile from "../models/userProfileModel";
import SearchHistory from "../models/searchHistoryModel";
import mongoose from "mongoose";
import TeamChallenge from "../models/teamChallengeModel";

export const search = asyncHandler(
    async (req: CustomRequest, res: Response) => {
        const { q } = req.query
        const userId = req.user.id

        if (!q) {
            res.status(400).json({ message: "Missing search query." });
            return
        }

        const query = String(q).trim();

        try {
                // Search Teams by name or username
                const teams = await Team.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { teamUsername: { $regex: query, $options: "i" } }
                ]
                }).select("_id name").limit(10);
            
                // Search Profiles by name or job
                const profiles = await UserProfile.find({
                $or: [
                    { firstName: { $regex: query, $options: "i" } },
                    { lastName: { $regex: query, $options: "i" } },
                    { username: { $regex: query, $options: "i" } },
                ]
                }).select("_id firstName lastName username profile_picture").limit(10);

                const challenges = await TeamChallenge.find({
                    $or: [
                      { challenge_name: { $regex: query, $options: "i" } },
                    ],
                    valid: true, // only show valid challenges
                  }).select("_id challenge_name").limit(10);

                  const teamCount = await Team.countDocuments({
                    $or: [
                      { name: { $regex: query, $options: "i" } },
                      { teamUsername: { $regex: query, $options: "i" } }
                    ]
                  });
                  
                  const profileCount = await UserProfile.countDocuments({
                    $or: [
                      { firstName: { $regex: query, $options: "i" } },
                      { lastName: { $regex: query, $options: "i" } },
                      { username: { $regex: query, $options: "i" } },
                    ]
                  });
                  
                  const challengeCount = await TeamChallenge.countDocuments({
                    $or: [{ challenge_name: { $regex: query, $options: "i" } }],
                    valid: true
                  });
                  
            
            // When using indexes revisit this
            // Check if query.length < 3 to do the one above. If > 3, use indexes
            // Indexes are good for performance
            // const teams = await Team.find(
            //     { $text: { $search: query } },
            //     { score: { $meta: "textScore" } }
            // ).sort({ score: { $meta: "textScore" } });
            
            // const profiles = await UserProfile.find(
            //     { $text: { $search: query } },
            //     { score: { $meta: "textScore" } }
            // ).sort({ score: { $meta: "textScore" } });

            // const challenges = await TeamChallenge.find(
            //     { $text: { $search: query }, valid: true },
            //     { score: { $meta: "textScore" } }
            //   ).sort({ score: { $meta: "textScore" } });
  
        
            // Save search to history
            if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
              await SearchHistory.findOneAndUpdate(
                { userId, term: query },
                { $set: { timestamp: new Date() } },
                { upsert: true }
              );
            }
        
            res.status(200).json({data: {
                teams: {
                    results: teams,
                    hasMore: teamCount > 10
                  },
                  profiles: {
                    results: profiles,
                    hasMore: profileCount > 10
                  },
                  challenges: {
                    results: challenges,
                    hasMore: challengeCount > 10
                  }
            }
                
            });
          } catch (err) {
            res.status(500)
            throw new Error(`Search failed with error: ${err}`);
          }
    }
)

export const searchHistory = asyncHandler(
    async (req: CustomRequest, res: Response) => {
        const userId = req.user.id

        if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
            res.status(400).json({ message: "Invalid user ID" });
            return 
        }

        try {
            const history = await SearchHistory.find({ userId })
              .sort({ timestamp: -1 })
              .limit(10); // return latest 10
            res.json(history);
          } catch (err) {
            res.status(500).json({ message: "Failed to get search history", error: err });
          }
    }
)

export const allSearchTeams = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      const searchQuery = String(req.query.q || "").trim();
      const page = Number(req.query.page || 1);
      const pageSize = 20;
  
      const teams = await Team.find({
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { teamUsername: { $regex: searchQuery, $options: "i" } }
        ]
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  
      const total = await Team.countDocuments({
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { teamUsername: { $regex: searchQuery, $options: "i" } }
        ]
      });
  
      res.json({
        results: teams,
        page,
        totalPages: Math.ceil(total / pageSize),
        total
      });
    }
  );

  export const allSearchChallenges = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      const searchQuery = String(req.query.q || "").trim();
      const page = Number(req.query.page || 1);
      const pageSize = 20;
  
      const challenges = await TeamChallenge.find({
        $or: [
          { challenge_name: { $regex: searchQuery, $options: "i" } },
        ]
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  
      const total = await TeamChallenge.countDocuments({
        $or: [
          { challenge_name: { $regex: searchQuery, $options: "i" } },
        ]
      });
  
      res.json({
        results: challenges,
        page,
        totalPages: Math.ceil(total / pageSize),
        total
      });
    }
  );
  
  export const allSearchProfiles = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      const searchQuery = String(req.query.q || "").trim();
      const page = Number(req.query.page || 1);
      const pageSize = 20;
  
      const profiles = await UserProfile.find({
        $or: [
            { firstName: { $regex: searchQuery, $options: "i" } },
            { lastName: { $regex: searchQuery, $options: "i" } },
            { username: { $regex: searchQuery, $options: "i" } },
        ]
      })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  
      const total = await UserProfile.countDocuments({
        $or: [
            { firstName: { $regex: searchQuery, $options: "i" } },
            { lastName: { $regex: searchQuery, $options: "i" } },
            { username: { $regex: searchQuery, $options: "i" } },
          ]
      });
  
      res.json({
        results: profiles,
        page,
        totalPages: Math.ceil(total / pageSize),
        total
      });
    }
  );
  