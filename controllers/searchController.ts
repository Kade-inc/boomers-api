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
    // Cache key: include userId to personalize exclusion lists if needed, though exclusion logic below is generic for now (superadmin/deleted users). 
    // If exclusion logic changes per user, userId in key is vital.
    const cacheKey = `search:global:${userId}:${query}`;

    try {
      // 1. Try Cache
      const cachedResult = await redisConnection.get(cacheKey);
      if (cachedResult) {
        logger.info(`Serving global search results from cache for: ${query}`);
        res.status(200).json({ data: JSON.parse(cachedResult) });
        return;
      }

      logger.info(`Performing global search (DB): ${query}`);

      // 2. Prepare Exclusion Lists (Parallel)
      const [superAdminRole, deletedUsers] = await Promise.all([
        Role.findOne({ name: 'superadmin' }).select('_id'),
        User.find({ deletedAt: { $ne: null } }).select('_id').lean()
      ]);

      let superAdminUserIds: any[] = [];
      if (superAdminRole) {
        superAdminUserIds = await User.find({ role: superAdminRole._id }).select('_id').lean();
      }

      const excludedUserIds = [
        ...superAdminUserIds.map((user: any) => user._id),
        ...deletedUsers.map((user: any) => user._id)
      ];

      // 3. Execute all search queries in parallel
      // We run 6 queries concurrently: 3 data fetches + 3 counts
      const [
        teams,
        profiles,
        challenges,
        teamCount,
        profileCount,
        challengeCount
      ] = await Promise.all([
        // Search Teams
        Team.find({
          $or: [
            { name: { $regex: query, $options: "i" } },
            { teamUsername: { $regex: query, $options: "i" } }
          ]
        }).select("_id name teamColor domain subdomain subdomainTopics").limit(10),

        // Search Profiles
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
        }).select("user_id firstName lastName username profile_picture").limit(10),

        // Search Challenges
        TeamChallenge.find({
          $or: [
            { challenge_name: { $regex: query, $options: "i" } },
          ],
          valid: true,
        }).select("_id challenge_name").limit(10),

        // Count Teams
        Team.countDocuments({
          $or: [
            { name: { $regex: query, $options: "i" } },
            { teamUsername: { $regex: query, $options: "i" } }
          ]
        }),

        // Count Profiles
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
        }),

        // Count Challenges
        TeamChallenge.countDocuments({
          $or: [{ challenge_name: { $regex: query, $options: "i" } }],
          valid: true
        })
      ]);

      // Process profile pictures
      profiles.forEach((profile: any) => {
        profile.profile_picture = profile.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${profile.profile_picture}` : null
      });

      // 4. Save search to history (Async - don't await blocking response)
      if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
        SearchHistory.findOneAndUpdate(
          { userId, term: query },
          { $set: { timestamp: new Date() } },
          { upsert: true }
        ).catch(err => logger.error("Failed to save search history", err));
      }

      const responseData = {
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
      };

      // 5. Cache result
      await redisConnection.setex(cacheKey, 60, JSON.stringify(responseData));

      res.status(200).json({ data: responseData });

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

      // Prepare Exclusion Lists
      const [superAdminRole, deletedUsers] = await Promise.all([
        Role.findOne({ name: 'superadmin' }).select('_id'),
        User.find({ deletedAt: { $ne: null } }).select('_id').lean()
      ]);

      let superAdminUserIds: any[] = [];
      if (superAdminRole) {
        superAdminUserIds = await User.find({ role: superAdminRole._id }).select('_id').lean();
      }

      const excludedUserIds = [
        ...superAdminUserIds.map((user: any) => user._id),
        ...deletedUsers.map((user: any) => user._id)
      ];

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
