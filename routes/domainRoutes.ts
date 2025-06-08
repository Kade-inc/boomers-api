import express from "express";

import validateToken from "../middleware/validateTokenHandler";

import { getAllDomains, getAllSubDomains, getDomainTopics, addDomain, addSubDomain, addDomainTopic, getDomain, getSubDomain, getDomainTopic, updateDomain, updateSubDomain, updateDomainTopic, deleteDomain, deleteSubDomain, deleteDomainTopic, getAllSubDomainsList } from "../controllers/domainController";

const domainRouter = express.Router();
domainRouter.use(validateToken);

// Domain Topics routes (specific routes first)
domainRouter.get("/domainTopics", getDomainTopics);
domainRouter.get("/domainTopics/:id", getDomainTopic);
domainRouter.post("/domainTopics", addDomainTopic);
domainRouter.put("/domainTopics/:id", updateDomainTopic);
domainRouter.delete("/domainTopics/:id", deleteDomainTopic);

// Subdomains routes
domainRouter.get("/subdomains", getAllSubDomainsList);
domainRouter.get("/subdomains/:id", getSubDomain);
domainRouter.put("/subdomains/:id", updateSubDomain);
domainRouter.delete("/subdomains/:id", deleteSubDomain);

// Domain routes (dynamic routes last)
domainRouter.get("/", getAllDomains);
domainRouter.get("/:id", getDomain);
domainRouter.get("/:id/subdomains", getAllSubDomains);
domainRouter.post("/", addDomain);
domainRouter.post("/:id/subdomain", addSubDomain);
domainRouter.put("/:id", updateDomain);
domainRouter.delete("/:id", deleteDomain);

/**
 * @openapi
 * '/api/domains':
 *  post:
 *     tags:
 *     - Domain Controller
 *     summary: Add domain
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - name
 *            properties:
 *              name:
 *                type: string
 *                default: thefunky Bunch   
 *     responses:
 *      201:
 *        description: Created
 *      400:
 *        description: Bad Request
 *      409:
 *        description: Conflict
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
domainRouter.post("/", addDomain);

/**
 * @openapi
 * '/api/domains/:id/subdomain':
 *  post:
 *     tags:
 *     - Domain Controller
 *     summary: Add subdomain
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - name
 *            properties:
 *              name:
 *                type: string
 *                default: thefunky Bunch
 *     responses:
 *      201:
 *        description: Created
 *      400:
 *        description: Bad Request
 *      409:
 *        description: Conflict
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
domainRouter.post("/:id/subdomain", addSubDomain);

/**
 * @openapi
 * '/api/domains/topics':
 *  post:
 *     tags:
 *     - Domain Controller
 *     summary: Add domain topic
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - name
 *            properties:
 *              name:
 *                type: string
 *                default: thefunky Bunch
 *              audience:
 *                type: array
 *                default: ['Developers', 'Farmers']
 *              category:
 *                type: array
 *                default: ['Software']
 *     responses:
 *      201:
 *        description: Created
 *      400:
 *        description: Bad Request
 *      409:
 *        description: Conflict
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
domainRouter.post("/domainTopic", addDomainTopic);

export default domainRouter;
