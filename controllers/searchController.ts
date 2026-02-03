import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import { Team, UserProfile, SearchHistory, TeamChallenge, Role, User } from "../models";
import mongoose from "mongoose";

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
      // Get superadmin role ID to exclude superadmin users
      const superAdminRole = await Role.findOne({ name: 'superadmin' });
      const superAdminUserIds = superAdminRole
        ? await User.find({ role: superAdminRole._id }).select('_id').lean()
        : [];

      // Get deleted users to exclude from search
      const deletedUserIds = await User.find({ deletedAt: { $ne: null } }).select('_id').lean();

      // Combine both exclusion lists
      const excludedUserIds = [
        ...superAdminUserIds.map((user: any) => user._id),
        ...deletedUserIds.map((user: any) => user._id)
      ];

      // Search Teams by name or username
      const teams = await Team.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { teamUsername: { $regex: query, $options: "i" } }
        ]
      }).select("_id name teamColor domain subdomain subdomainTopics").limit(10);

      // Search Profiles by name or job (excluding superadmin users)
      let profiles = await UserProfile.find({
        $and: [
          {
            $or: [
              { firstName: { $regex: query, $options: "i" } },
              { lastName: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
            ]
          },
          { user_id: { $nin: excludedUserIds } }
        ]
      }).select("user_id firstName lastName username profile_picture").limit(10);

      profiles.map((profile: any) => {
        profile.profile_picture = profile.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${profile.profile_picture}` : null
      }
      )

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
        $and: [
          {
            $or: [
              { firstName: { $regex: query, $options: "i" } },
              { lastName: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
            ]
          },
          { user_id: { $nin: excludedUserIds } }
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

      res.status(200).json({
        data: {
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
      res.status(200).json({ data: history });
    } catch (err) {
      res.status(500).json({ message: "Failed to get search history", error: err });
    }
  }
)

export const allSearchTeams = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const searchQuery = String(req.query.q || "").trim();
    const page = Number(req.query.page || 1);
    const pageSize = 10;

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
    const pageSize = 10;

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
    const pageSize = 10;

    // Get deleted users to exclude from search
    const deletedUserIds = await User.find({ deletedAt: { $ne: null } }).select('_id').lean();
    const excludedUserIds = deletedUserIds.map((user: any) => user._id);

    const profiles = await UserProfile.find({
      $and: [
        {
          $or: [
            { firstName: { $regex: searchQuery, $options: "i" } },
            { lastName: { $regex: searchQuery, $options: "i" } },
            { username: { $regex: searchQuery, $options: "i" } },
          ]
        },
        { user_id: { $nin: excludedUserIds } }
      ]
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize);


    profiles.map((profile: any) => {
      profile.profile_picture = profile.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${profile.profile_picture}` : null
    }
    )

    const total = await UserProfile.countDocuments({
      $and: [
        {
          $or: [
            { firstName: { $regex: searchQuery, $options: "i" } },
            { lastName: { $regex: searchQuery, $options: "i" } },
            { username: { $regex: searchQuery, $options: "i" } },
          ]
        },
        { user_id: { $nin: excludedUserIds } }
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

export const clearSearchHistory = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const userId = req.user.id

    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ message: "Invalid user ID" });
      return
    }

    try {
      await SearchHistory.deleteMany({ userId });
      res.status(200).json({ message: "Search history cleared successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to clear search history", error: err });
    }
  }
)

export const searchUsersAndTeams = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { q, page = 1, pageSize = 10 } = req.query
    const userId = req.user.id

    if (!q) {
      res.status(400).json({ message: "Missing search query." });
      return
    }

    const query = String(q).trim();
    const currentPage = Number(page);
    const limit = Number(pageSize);
    const skip = (currentPage - 1) * limit;

    try {
      // Get deleted users to exclude from search
      const deletedUserIds = await User.find({ deletedAt: { $ne: null } }).select('_id').lean();
      const excludedUserIds = deletedUserIds.map((user: any) => user._id);

      // Get all matching teams and profiles first
      const [teams, profiles] = await Promise.all([
        Team.find({
          owner_id: userId,
          $or: [
            { name: { $regex: query, $options: "i" } },
            { teamUsername: { $regex: query, $options: "i" } }
          ]
        })
          .select("_id name teamColor domain subdomain subdomainTopics owner_id"),

        UserProfile.find({
          $and: [
            {
              $or: [
                { firstName: { $regex: query, $options: "i" } },
                { lastName: { $regex: query, $options: "i" } },
                { username: { $regex: query, $options: "i" } },
              ]
            },
            { user_id: { $nin: excludedUserIds } }
          ]
        })
          .select("user_id firstName lastName username profile_picture")
      ]);

      // Process profile pictures
      profiles.forEach((profile: any) => {
        profile.profile_picture = profile.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${profile.profile_picture}` : null
      });

      // Get total counts
      const [teamCount, profileCount] = await Promise.all([
        Team.countDocuments({
          owner_id: userId,
          $or: [
            { name: { $regex: query, $options: "i" } },
            { teamUsername: { $regex: query, $options: "i" } }
          ]
        }),

        UserProfile.countDocuments({
          $and: [
            {
              $or: [
                { firstName: { $regex: query, $options: "i" } },
                { lastName: { $regex: query, $options: "i" } },
                { username: { $regex: query, $options: "i" } },
              ]
            },
            { user_id: { $nin: excludedUserIds } }
          ]
        })
      ]);

      const totalCount = teamCount + profileCount;

      // Combine and format all results
      const allResults = [
        ...teams.map(team => ({
          ...team.toObject(),
          type: 'team'
        })),
        ...profiles.map(profile => ({
          ...profile.toObject(),
          type: 'profile'
        }))
      ];

      // Apply pagination to the combined results
      const paginatedResults = allResults.slice(skip, skip + limit);

      res.status(200).json({
        data: {
          results: paginatedResults,
          pagination: {
            currentPage,
            totalPages: Math.ceil(totalCount / limit),
            totalResults: totalCount
          }
        }
      });
    } catch (err) {
      res.status(500)
      throw new Error(`Search failed with error: ${err}`);
    }
  }
);
