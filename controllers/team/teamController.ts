import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import Team from "../../models/teamModel";
import { CustomRequest } from "../../middleware/validateTokenHandler";
import TeamMember from "../../models/teamMemberModel";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import TeamDomain from "../../models/teamDomainModel";
import TeamSubDomain from "../../models/teamSubdomainModel";
import DomainTopic from "../../models/domainTopicModel";
import UserProfile from "../../models/userProfileModel";

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");
const bucketName: any = process.env.BUCKET_NAME;
const bucketRegion: any = process.env.BUCKET_REGION;
const accessKey: any = process.env.ACCESS_KEY;
const secretAccessKey: any = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

//@desc Create team
//@route POST /api/teams
//access private
export const createTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name, teamUsername, domain, subDomain, subDomainTopics } =
        req.body;
      if (!name.trim() || !domain.trim()) {
        res.status(400);
        throw new Error("Please put name and domain");
      }

      const teamExists = await Team.findOne({ teamUsername });

      if (teamExists) {
        res.status(409);
        throw new Error("Team already exists");
      }

      const domainExists = await TeamDomain.findOne({ name: domain });

      if (!domainExists) {
        res.status(409).json({ error: "Domain doesn't exist" });
        return;
      }

      const subDomainExists: any = await TeamSubDomain.findOne({
        name: subDomain,
      });

      if (
        subDomainExists?.parentDomain.toString() !== domainExists._id.toString()
      ) {
        res.status(400).json({ error: "Sub Domain does not belong to domain" });
        return;
      }

      const domainTopics = await DomainTopic.find({});
      const missingTopics: any = [];
      subDomainTopics.map((topic: any) => {
        const foundTopic = domainTopics.some((el) => el.name === topic);
        if (!foundTopic) {
          missingTopics.push(topic);
        }
      });

      if (missingTopics.length > 0) {
        res.status(404).json({
          error: "The following topics are not created",
          data: missingTopics,
        });
        return;
      }

      if (req.file) {
        //resize image
        const buffer = await sharp(req.file.buffer)
          .resize({ height: 400, width: 400, fit: "contain" })
          .toBuffer();
        const params = {
          Bucket: bucketName,
          Key: randomImageName(),
          Body: buffer,
          ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(params);

        await s3.send(command);

        const team = await Team.create({
          name,
          teamUsername,
          owner_id: req.user.id,
          domain: domainExists.name,
          subdomain: subDomain,
          subdomainTopics: subDomainTopics,
          displayImage: randomImageName(),
        });

        await TeamMember.create({
          owner_id: req.user.id,
          team_id: team._id,
          user_id: req.user.id,
        });
        res.status(201).json({ message: "successful", data: team });
        return;
      }

      console.log("SUB: ", subDomainTopics);

      const team = await Team.create({
        name,
        teamUsername,
        domain: domainExists.name,
        subdomain: subDomain,
        subdomainTopics: subDomainTopics,
        owner_id: req.user.id,
      });

      await TeamMember.create({
        owner_id: req.user.id,
        team_id: team._id,
        user_id: req.user.id,
      });
      res.status(201).json({ message: "successful", data: team });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Get teams
//@route GET /api/teams
//access private
export const getAllTeams = asyncHandler(async (req: Request, res: Response) => {
  try {
    let teams: any = [];
    let { name } = req.query;

    if (req.query.userId) {
      teams = await Team.find({ owner_id: req.query.userId });
    } else if (req.query.name) {
      teams = await Team.find({ name: { $regex: ".*" + name + ".*" } });
    } else {
      teams = await Team.find();
    }

    res.status(200).json({ message: "successful", data: teams });
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Get Team
//@route GET /api/teams/:id
//access public
export const getTeam = asyncHandler(async (req: Request, res: Response) => {
  try {
    const team = await Team.findOne({ _id: req.params.id });

    if (!team) {
      res.status(404).json({ message: "Team does not exist" });
      return;
    }
    res.status(200).json(team);
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Update team
//@route PUT /api/teams/:id
//access private
export const updateTeam = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const team = await Team.findOne({ _id: req.params.id });
      if (!team) {
        res.status(404);
        throw new Error("Team not found");
      }

      if (team.owner_id.toString() !== req.user.id) {
        res.status(409).json({ error: "You do not own this team!" });
        return;
      }
      const { name, teamUsername, domain, subDomain, subDomainTopics } =
        req.body;
      let updateTeamBody = {
        name: team.name,
        teamUsername: team.teamUsername,
        domain: team.domain,
        subdomain: team.subdomain,
        subDomainTopics: team.subdomainTopics,
      };

      if (name && name.trim().length > 0) updateTeamBody.name = name.trim();

      if (teamUsername && teamUsername.trim().length > 0)
        updateTeamBody.teamUsername = teamUsername.trim();

      if (domain && domain.trim().length > 0)
        updateTeamBody.domain = domain.trim();

      if (subDomain && subDomain.trim().length > 0)
        updateTeamBody.subdomain = subDomain.trim();

      if (subDomainTopics.length > 0)
        updateTeamBody.subDomainTopics = subDomainTopics;

      const domainExists = await TeamDomain.findOne({ name: domain });

      if (!domainExists) {
        res.status(409).json({ error: "Domain doesn't exist" });
        return;
      }

      const subDomainExists: any = await TeamSubDomain.findOne({
        name: subDomain,
      });

      if (
        subDomainExists?.parentDomain.toString() !== domainExists._id.toString()
      ) {
        res.status(409).json({ error: "Sub Domain does not belong to domain" });
        return;
      }

      const domainTopics = await DomainTopic.find({});
      const missingTopics: any = [];
      subDomainTopics.map((topic: any) => {
        const foundTopic = domainTopics.some((el) => el.name === topic);
        if (!foundTopic) {
          missingTopics.push(topic);
        }
      });

      if (missingTopics.length > 0) {
        res.status(404).json({
          error:
            "The following topics were not updated because they do not exist",
          data: missingTopics,
        });
        return;
      }

      if (req.file) {
        //resize image
        const buffer = await sharp(req.file.buffer)
          .resize({ height: 400, width: 400, fit: "contain" })
          .toBuffer();
        const params = {
          Bucket: bucketName,
          Key: randomImageName(),
          Body: buffer,
          ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(params);

        await s3.send(command);

        const updatedTeam = await Team.findByIdAndUpdate(
          team._id,
          {
            displayImage: randomImageName(),
          },
          {
            new: true,
          }
        );
        res.status(200).json({ message: "successful", data: updatedTeam });
        return;
      }

      if (!name && !teamUsername) {
        res.status(400);
        throw new Error("Please put a valid value");
      }
      const updatedTeam = await Team.findByIdAndUpdate(
        team._id,
        {
          name: updateTeamBody.name,
          teamUsername: updateTeamBody.teamUsername,
          domain: domainExists.name,
          subdomain: subDomainExists.name,
          subdomainTopics: updateTeamBody.subDomainTopics,
        },
        {
          new: true,
        }
      );
      res.status(200).json(updatedTeam);
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

//@desc Delete team
//@route DELETE /api/teams/:id
//access private
export const deleteTeam = asyncHandler(async (req: Request, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404);
      throw new Error("Team not found");
    }
    //   if(contact.user_id.toString() !== req.user.id) {
    //     res.status(403)
    //     throw new Error("User doesn't have permission to update other user contacts")
    // }

    // await Contact.remove()
    await Team.deleteOne({ _id: req.params.id });
    res.status(200).json(team);
  } catch (error) {}
});

//@desc Post Domain
//@route POST /api/teams/domains
//access private
export const addDomain = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name.trim()) {
      res.status(400);
      throw new Error("No name inputed");
    }

    const commonName = name.trim().replace(/ /g, "_").toLowerCase();

    const domain = await TeamDomain.create({ name, commonName });
    res.status(201).json(domain);
  } catch (error: any) {
    console.log(error);
    res.status(400).json({ error: error });
  }
});

//@desc Post Subdomain
//@route POST /api/teams/domains/:id/subdomain
//access private
export const addSubDomain = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { name } = req.body;

      const teamDomain = await TeamDomain.findOne({ _id: req.params.id });
      if (!name.trim()) {
        res.status(400);
        throw new Error("No name inputed");
      }

      if (!teamDomain) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const teamSubDomain = await TeamSubDomain.findOne({ name: name });

      if (teamSubDomain) {
        res.status(409).json({ error: "Sub Domain exists" });
        return;
      }

      const commonName = name.trim().replace(/ /g, "_").toLowerCase();

      const domain = await TeamSubDomain.create({
        name,
        parentDomain: req.params.id,
        commonName,
      });
      res.status(201).json(domain);
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error });
    }
  }
);

//@desc Post Domain Topic
//@route POST /api/teams/domains/topics
//access private
export const addDomainTopic = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { name } = req.body;

      if (!name.trim()) {
        res.status(400);
        throw new Error("No name inputed");
      }

      const domainTopic = await DomainTopic.create({
        name,
      });
      res.status(201).json(domainTopic);
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ error: error });
    }
  }
);

//@desc Get Team recommendations
//@route GET /api/teams/recommendations
//access private
export const getTeamRecommendations = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const userProfile: any = await UserProfile.findOne({ user_id: userId });

      let teams: any = [];
      if (Object.keys(userProfile.interests).length > 0) {
        if (userProfile.interests.subDomains?.length > 0) {
          if (userProfile.interests.subTopics?.length > 0) {
            teams = await Team.find({
              subdomainTopics: { $in: userProfile.interests.subTopics },
            });
          } else {
            teams = await Team.find({
              subdomain: { $in: userProfile.interests.subDomains },
            });
          }
        } else {
          teams = await Team.find({
            domain: { $in: userProfile.interests.domains },
          });
        }
      } else {
        teams = await Team.find();
      }
      res.status(200).json({ data: teams });
    } catch (error: any) {
      res.status(400).json({ error: error });
    }
  }
);
