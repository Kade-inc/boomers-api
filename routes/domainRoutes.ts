import express from "express";

import validateToken from "../middleware/validateTokenHandler";

import { getAllDomains, getAllSubDomains, getDomainTopics } from "../controllers/domainController";

const domainRouter = express.Router();
domainRouter.use(validateToken);

domainRouter.get("/", getAllDomains);

domainRouter.get("/:id/subdomains", getAllSubDomains);

domainRouter.get("/domainTopics", getDomainTopics);

export default domainRouter;
