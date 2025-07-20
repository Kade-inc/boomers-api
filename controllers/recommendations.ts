//@desc Get Team recommendations
//@route GET /api/teams/recommendations

import { CustomRequest } from "../middleware/validateTokenHandler";
import asyncHandler from "express-async-handler";
import { Team, UserProfile } from "../models";
import { Response } from "express";

//access private
export const getTeamRecommendations = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      try {
        const userId = req.user.id;
        console.log("USER ID: ", userId)
        const userProfile: any = await UserProfile.findOne({ user_id: userId });
  
        let teams: any = [];
        // Safely check if interests, subDomains, and subTopics exist
        const interests = userProfile?.interests ?? {};
        const subdomains = interests.subdomain ?? [];
        const domainTopics = interests.domainTopics ?? [];
        const domains = interests.domain ?? [];
  
        if (Object.keys(interests).length > 0) {
          if (subdomains.length > 0) {
            if (domainTopics.length > 0) {
              teams = await Team.find({
                subdomainTopics: { $in: domainTopics},
              });
            } else {
              teams = await Team.find({
                subdomain: { $in: subdomains },
              });
            }
          } else {
            teams = await Team.find({
              domain: { $in: domains },
            });
          }
        } 
  
        res.status(200).json({ data: teams });
      } catch (error: any) {
        res.status(400).json({ error: error });
      }
    }
  );