import { Response } from "express";
import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import TeamDomain from "../models/teamDomainModel";
import TeamSubDomain from "../models/teamSubdomainModel";
import DomainTopic from "../models/domainTopicModel";
import logger from "../services/logger";

//@desc Get Domains
//@route GET /api/domains
//access private
export const getAllDomains = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {

      const domains = await TeamDomain.find({})

      logger.info(`Fetched ${domains.length} domains`);
      res.status(200).json({ message: "successful", data: domains });
    } catch (error: any) {
      logger.error("Error getting all domains", { error });
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
      const parentDomainId = req.params.id;
      logger.info(`Fetching subdomains for domain: ${parentDomainId}`);

      const parentDomain = await TeamDomain.findOne({ _id: parentDomainId })
      if (parentDomain) {
        const subdomains = await TeamSubDomain.find({ parentDomain: parentDomain._id })
        logger.info(`Fetched ${subdomains.length} subdomains for domain ${parentDomainId}`);
        res.status(200).json({ message: "successful", data: subdomains });
        return
      } else {
        logger.warn(`Parent domain not found: ${parentDomainId}`);
        res.status(404).json({ message: "Parent domain not found" })
        return
      }

    } catch (error: any) {
      logger.error("Error getting subdomains", { error });
      res.status(400)
      throw new Error(error)
    }
  }
);

//@desc Get All Subdomains
//@route GET /api/subdomains
//access private
export const getAllSubDomainsList = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info("Fetching all subdomains list");
      const subdomains = await TeamSubDomain.find({})
        .populate({
          path: 'parentDomain',
          select: '_id name commonName',
          model: 'TeamDomain'
        });

      logger.info(`Fetched ${subdomains.length} subdomains in total`);
      res.status(200).json({ message: "successful", data: subdomains });
    } catch (error: any) {
      logger.error("Error getting all subdomains list", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);


//@desc Get Domains
//@route GET /api/domainTopics
//access private
export const getDomainTopics = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info("Fetching domain topics");

      const domainTopics = await DomainTopic.find({})
        .populate({
          path: 'parentSubdomain',
          select: '_id name commonName',
          model: 'TeamSubDomain'
        });

      logger.info(`Fetched ${domainTopics.length} domain topics`);
      res.status(200).json({ message: "successful", data: domainTopics });

    } catch (error: any) {
      logger.error("Error getting domain topics", { error });
      res.status(400)
      throw new Error(error)
    }
  }
);


//@desc Post Domain
//@route POST /api/domains
//access private
export const addDomain = asyncHandler(async (req: CustomRequest, res: Response) => {
  try {
    const { name } = req.body;
    logger.info(`Adding domain: ${name}`);

    if (!name.trim()) {
      res.status(400);
      throw new Error("No name inputed");
    }

    const commonName = name.trim().replace(/ /g, "_").toLowerCase();

    const domain = await TeamDomain.create({ name, commonName });
    logger.info(`Domain added: ${domain._id}`);
    res.status(201).json(domain);
  } catch (error: any) {
    logger.error("Error adding domain", { error });
    res.status(400).json({ error: error });
  }
});

//@desc Post Subdomain
//@route POST /api/teams/domains/:id/subdomain
//access private
export const addSubDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name } = req.body;
      logger.info(`Adding subdomain: ${name} to domain ${req.params.id}`);

      const teamDomain = await TeamDomain.findOne({ _id: req.params.id });
      if (!name.trim()) {
        res.status(400);
        throw new Error("No name inputed");
      }

      if (!teamDomain) {
        logger.warn(`Parent domain not found for new subdomain: ${req.params.id}`);
        res.status(404).json({ error: "Not found" });
        return;
      }

      const teamSubDomain = await TeamSubDomain.findOne({ name: name });

      if (teamSubDomain) {
        logger.warn(`Subdomain already exists: ${name}`);
        res.status(409).json({ error: "Sub Domain exists" });
        return;
      }

      const commonName = name.trim().replace(/ /g, "_").toLowerCase();

      const domain = await TeamSubDomain.create({
        name,
        parentDomain: req.params.id,
        commonName,
      });
      logger.info(`Subdomain created: ${domain._id}`);
      res.status(201).json(domain);
    } catch (error: any) {
      logger.error("Error adding subdomain", { error });
      res.status(400).json({ error: error });
    }
  }
);

//@desc Post Domain Topic
//@route POST /api/domainTopics
//access private
export const addDomainTopic = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name, parentSubdomain } = req.body;

      if (!name.trim()) {
        res.status(400);
        throw new Error("No name inputed");
      }

      if (!parentSubdomain) {
        res.status(400);
        throw new Error("Parent subdomain is required");
      }

      // Verify that the subdomain exists
      const subdomain = await TeamSubDomain.findById(parentSubdomain);
      if (!subdomain) {
        res.status(404);
        throw new Error("Parent subdomain not found");
      }

      // Check if topic already exists
      const existingTopic = await DomainTopic.findOne({
        name: name,
        parentSubdomain: parentSubdomain
      });

      if (existingTopic) {
        res.status(409);
        throw new Error("Topic already exists in this subdomain");
      }

      const domainTopic = await DomainTopic.create({
        name,
        parentSubdomain,
      });
      logger.info(`Domain topic created: ${domainTopic._id}`);
      res.status(201).json({ message: "Domain topic created successfully", data: domainTopic });
    } catch (error: any) {
      logger.error("Error creating domain topic", { error });
      res.status(400).json({ error: error });
    }
  }
);

//@desc Get Single Domain
//@route GET /api/domains/:id
//access private
export const getDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const domain = await TeamDomain.findById(req.params.id);

      if (!domain) {
        logger.warn(`Domain not found: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain not found");
      }

      res.status(200).json({ message: "successful", data: domain });
    } catch (error: any) {
      logger.error("Error getting domain by id", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Get Single Subdomain
//@route GET /api/subdomains/:id
//access private
export const getSubDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const subdomain = await TeamSubDomain.findById(req.params.id)
        .populate('parentDomain', 'name commonName');

      if (!subdomain) {
        logger.warn(`Subdomain not found: ${req.params.id}`);
        res.status(404);
        throw new Error("Subdomain not found");
      }

      res.status(200).json({ message: "successful", data: subdomain });
    } catch (error: any) {
      logger.error("Error getting subdomain by id", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Get Single Domain Topic
//@route GET /api/domainTopics/:id
//access private
export const getDomainTopic = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const domainTopic = await DomainTopic.findById(req.params.id)
        .populate('parentSubdomain', 'name commonName');

      if (!domainTopic) {
        logger.warn(`Domain topic not found: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain topic not found");
      }

      res.status(200).json({ message: "successful", data: domainTopic });
    } catch (error: any) {
      logger.error("Error getting domain topic by id", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Update Domain
//@route PUT /api/domains/:id
//access private
export const updateDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name } = req.body;
      logger.info(`Updating domain: ${req.params.id}`);

      if (!name?.trim()) {
        res.status(400);
        throw new Error("Name is required");
      }

      const domain = await TeamDomain.findById(req.params.id);

      if (!domain) {
        logger.warn(`Domain not found for update: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain not found");
      }

      const commonName = name.trim().replace(/ /g, "_").toLowerCase();

      const updatedDomain = await TeamDomain.findByIdAndUpdate(
        req.params.id,
        { name, commonName },
        { new: true }
      );

      logger.info(`Domain updated: ${req.params.id}`);
      res.status(200).json({ message: "Domain updated successfully", data: updatedDomain });
    } catch (error: any) {
      logger.error("Error updating domain", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Update Subdomain
//@route PUT /api/subdomains/:id
//access private
export const updateSubDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name } = req.body;
      logger.info(`Updating subdomain: ${req.params.id}`);

      if (!name?.trim()) {
        res.status(400);
        throw new Error("Name is required");
      }

      const subdomain = await TeamSubDomain.findById(req.params.id);

      if (!subdomain) {
        logger.warn(`Subdomain not found for update: ${req.params.id}`);
        res.status(404);
        throw new Error("Subdomain not found");
      }

      const commonName = name.trim().replace(/ /g, "_").toLowerCase();

      const updatedSubdomain = await TeamSubDomain.findByIdAndUpdate(
        req.params.id,
        { name, commonName },
        { new: true }
      ).populate('parentDomain', 'name commonName');

      logger.info(`Subdomain updated: ${req.params.id}`);
      res.status(200).json({ message: "Subdomain updated successfully", data: updatedSubdomain });
    } catch (error: any) {
      logger.error("Error updating subdomain", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Update Domain Topic
//@route PUT /api/domainTopics/:id
//access private
export const updateDomainTopic = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { name, parentSubdomain } = req.body;
      logger.info(`Updating domain topic: ${req.params.id}`);

      if (!name?.trim()) {
        res.status(400);
        throw new Error("Name is required");
      }

      const domainTopic = await DomainTopic.findById(req.params.id);

      if (!domainTopic) {
        logger.warn(`Domain topic not found for update: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain topic not found");
      }

      // If parentSubdomain is provided, verify it exists
      if (parentSubdomain) {
        const subdomain = await TeamSubDomain.findById(parentSubdomain);
        if (!subdomain) {
          res.status(404);
          throw new Error("Parent subdomain not found");
        }
      }

      const updatedDomainTopic = await DomainTopic.findByIdAndUpdate(
        req.params.id,
        {
          name,
          ...(parentSubdomain && { parentSubdomain })
        },
        { new: true }
      ).populate('parentSubdomain', 'name commonName');

      logger.info(`Domain topic updated: ${req.params.id}`);
      res.status(200).json({ message: "Domain topic updated successfully", data: updatedDomainTopic });
    } catch (error: any) {
      logger.error("Error updating domain topic", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Delete Domain
//@route DELETE /api/domains/:id
//access private
export const deleteDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Deleting domain: ${req.params.id}`);
      const domain = await TeamDomain.findById(req.params.id);

      if (!domain) {
        logger.warn(`Domain not found for deletion: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain not found");
      }

      // Find all subdomains associated with this domain
      const subdomains = await TeamSubDomain.find({ parentDomain: req.params.id });

      // Get all subdomain IDs
      const subdomainIds = subdomains.map(sub => sub._id);

      // Delete all domain topics associated with these subdomains
      await DomainTopic.deleteMany({ parentSubdomain: { $in: subdomainIds } });

      // Delete all subdomains
      await TeamSubDomain.deleteMany({ parentDomain: req.params.id });

      // Finally delete the domain
      await TeamDomain.findByIdAndDelete(req.params.id);

      logger.info(`Domain deleted: ${req.params.id}`);
      res.status(200).json({
        message: "Domain and all associated subdomains and topics deleted successfully",
        deletedDomain: domain
      });
    } catch (error: any) {
      logger.error("Error deleting domain", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Delete Subdomain
//@route DELETE /api/subdomains/:id
//access private
export const deleteSubDomain = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Deleting subdomain: ${req.params.id}`);
      const subdomain = await TeamSubDomain.findById(req.params.id);

      if (!subdomain) {
        logger.warn(`Subdomain not found for deletion: ${req.params.id}`);
        res.status(404);
        throw new Error("Subdomain not found");
      }

      // Delete all domain topics associated with this subdomain
      await DomainTopic.deleteMany({ parentSubdomain: req.params.id });

      // Delete the subdomain
      await TeamSubDomain.findByIdAndDelete(req.params.id);

      logger.info(`Subdomain deleted: ${req.params.id}`);
      res.status(200).json({
        message: "Subdomain and all associated topics deleted successfully",
        deletedSubdomain: subdomain
      });
    } catch (error: any) {
      logger.error("Error deleting subdomain", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

//@desc Delete Domain Topic
//@route DELETE /api/domainTopics/:id
//access private
export const deleteDomainTopic = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      logger.info(`Deleting domain topic: ${req.params.id}`);
      const domainTopic = await DomainTopic.findById(req.params.id);

      if (!domainTopic) {
        logger.warn(`Domain topic not found for deletion: ${req.params.id}`);
        res.status(404);
        throw new Error("Domain topic not found");
      }

      await DomainTopic.findByIdAndDelete(req.params.id);

      logger.info(`Domain topic deleted: ${req.params.id}`);
      res.status(200).json({
        message: "Domain topic deleted successfully",
        deletedTopic: domainTopic
      });
    } catch (error: any) {
      logger.error("Error deleting domain topic", { error });
      res.status(400);
      throw new Error(error);
    }
  }
);

