import { Response } from "express";
import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import TeamDomain from "../models/teamDomainModel";
import TeamSubDomain from "../models/teamSubdomainModel";
import DomainTopic from "../models/domainTopicModel";

//@desc Get Domains
//@route GET /api/domains
//access private
export const getAllDomains = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      
    const domains = await TeamDomain.find({})
    
    res.status(200).json({ message: "successful", data: domains });
    } catch (error: any) {
      res.status(400)
      throw new Error(error)
    }
  }
);


//@desc Get Domains
//@route GET /api/:id/subdomains
//access private
export const getAllSubDomains = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      try {
        
        const parentDomain = await TeamDomain.findOne({_id: req.params.id})
        if (parentDomain) {
            const subdomains = await TeamSubDomain.find({ parentDomain: parentDomain._id})
            res.status(200).json({ message: "successful", data: subdomains });
            return
        } else {
            res.status(404).json({message: "Parent domain not found"})
            return
        }
      
      } catch (error: any) {
        res.status(400)
        throw new Error(error)
      }
    }
  );


//@desc Get Domains
//@route GET /api/domainTopics
//access private
export const getDomainTopics = asyncHandler(
    async (req: CustomRequest, res: Response) => {
      try {
        
        const domainTopics = await DomainTopic.find({})
        res.status(200).json({ message: "successful", data: domainTopics });
      
      } catch (error: any) {
        res.status(400)
        throw new Error(error)
      }
    }
  );