import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import { redisConnection } from "../config/redis";
import { Team, UserProfile, SearchHistory, TeamChallenge, Role, User } from "../models";
import mongoose from "mongoose";
import logger from "../services/logger";

export const search = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const { q } = req.query
    const userId = req.user.id

    if (!q) {
      res.status(400).json({ message: "Missing search query." });
      return
    }

    const query = String(q).trim();
    logger.info(`Searching for: ${query}`);

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
      logger.error("Error performing search", { error: err });
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

      logger.info(`Fetched search history for user: ${userId}`);
      res.status(200).json({ data: history });
    } catch (err) {
      logger.error("Error fetching search history", { error: err });
      res.status(500).json({ message: "Failed to get search history", error: err });
    }
  }
)

export const allSearchTeams = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    const searchQuery = String(req.query.q || "").trim();
    const page = Number(req.query.page || 1);
    const pageSize = 10;
    logger.info(`Searching all teams: ${searchQuery}`);

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
    logger.info(`Searching all challenges: ${searchQuery}`);

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
    logger.info(`Searching all profiles: ${searchQuery}`);

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
      logger.info(`Search history cleared for user: ${userId}`);
      res.status(200).json({ message: "Search history cleared successfully" });
    } catch (err) {
      logger.error("Error clearing search history", { error: err });
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

    // Cache key generation
    const cacheKey = `search:usersAndTeams:${userId}:${query}:${currentPage}:${limit}`;

    try {
      // 1. Try to fetch from cache
      const cachedResult = await redisConnection.get(cacheKey);
      if (cachedResult) {
        logger.info(`Serving search results from cache for: ${query}`);
        res.status(200).json(JSON.parse(cachedResult));
        return;
      }

      logger.info(`Searching users and teams (DB): ${query}`);

      // Get deleted users to exclude from search
      const deletedUserIds = await User.find({ deletedAt: { $ne: null } }).select('_id').lean();
      const excludedUserIds = deletedUserIds.map((user: any) => user._id);

      // Define query conditions
      const teamQuery = {
        owner_id: userId,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { teamUsername: { $regex: query, $options: "i" } }
        ]
      };

      const profileQuery = {
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
      };

      // 2. Count total documents first to handle layout/pagination logic
      const [teamCount, profileCount] = await Promise.all([
        Team.countDocuments(teamQuery),
        UserProfile.countDocuments(profileQuery)
      ]);

      const totalCount = teamCount + profileCount;
      let teams: any[] = [];
      let profiles: any[] = [];

      // 3. Optimized Pagination Logic (Sequential: Teams then Profiles)
      if (skip < teamCount) {
        // We need at least some teams
        const teamLimit = Math.min(limit, teamCount - skip);
        teams = await Team.find(teamQuery)
          .select("_id name teamColor domain subdomain subdomainTopics owner_id")
          .skip(skip)
          .limit(teamLimit);

        // If we didn't fill the page with teams, fetch profiles
        if (teams.length < limit) {
          const profileLimit = limit - teams.length;
          // Profile skip is 0 because we are starting from the top of profiles
          profiles = await UserProfile.find(profileQuery)
            .select("user_id firstName lastName username profile_picture")
            .skip(0)
            .limit(profileLimit);
        }
      } else {
        // We are past teams, only fetch profiles
        const profileSkip = skip - teamCount;
        profiles = await UserProfile.find(profileQuery)
          .select("user_id firstName lastName username profile_picture")
          .skip(profileSkip)
          .limit(limit);
      }

      // Process profile pictures
      profiles.forEach((profile: any) => {
        profile.profile_picture = profile.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${profile.profile_picture}` : null
      });

      // Combine and format results
      const results = [
        ...teams.map(team => ({
          ...team.toObject(),
          type: 'team'
        })),
        ...profiles.map(profile => ({
          ...profile.toObject(),
          type: 'profile'
        }))
      ];

      const responseData = {
        data: {
          results: results,
          pagination: {
            currentPage,
            totalPages: Math.ceil(totalCount / limit),
            totalResults: totalCount
          }
        }
      };

      // 4. Set cache with expiry (e.g., 60 seconds)
      await redisConnection.setex(cacheKey, 60, JSON.stringify(responseData));

      res.status(200).json(responseData);

    } catch (err) {
      logger.error("Error searching users and teams", { error: err });
      res.status(500)
      throw new Error(`Search failed with error: ${err}`);
    }
  }
);
