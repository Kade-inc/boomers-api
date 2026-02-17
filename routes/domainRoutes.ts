import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import validateSuperAdmin from "../middleware/validateSuperAdmin";

import { getAllDomains, getAllSubDomains, getDomainTopics, addDomain, addSubDomain, addDomainTopic, getDomain, getSubDomain, getDomainTopic, updateDomain, updateSubDomain, updateDomainTopic, deleteDomain, deleteSubDomain, deleteDomainTopic, getAllSubDomainsList } from "../controllers/domainController";

const domainRouter = express.Router();
domainRouter.use(validateToken);

// Domain Topics routes (specific routes first)
domainRouter.get("/domainTopics", getDomainTopics);
domainRouter.get("/domainTopics/:id", getDomainTopic);
domainRouter.post("/domainTopics", validateSuperAdmin, addDomainTopic);
domainRouter.put("/domainTopics/:id", validateSuperAdmin, updateDomainTopic);
domainRouter.delete("/domainTopics/:id", validateSuperAdmin, deleteDomainTopic);

// Subdomains routes
domainRouter.get("/subdomains", getAllSubDomainsList);
domainRouter.get("/subdomains/:id", getSubDomain);
domainRouter.put("/subdomains/:id", validateSuperAdmin, updateSubDomain);
domainRouter.delete("/subdomains/:id", validateSuperAdmin, deleteSubDomain);

// Domain routes (dynamic routes last)
domainRouter.get("/", getAllDomains);
domainRouter.get("/:id", getDomain);
domainRouter.get("/:id/subdomains", getAllSubDomains);
domainRouter.post("/", validateSuperAdmin, addDomain);
domainRouter.post("/:id/subdomains", validateSuperAdmin, addSubDomain);
domainRouter.put("/:id", validateSuperAdmin, updateDomain);
domainRouter.delete("/:id", validateSuperAdmin, deleteDomain);


export default domainRouter;
