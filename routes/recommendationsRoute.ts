import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import dotenv from "dotenv";
import { getTeamRecommendations } from "../controllers/recommendations";
dotenv.config();


const recommendationsRouter = express.Router();

recommendationsRouter.use(validateToken);

/**
 * @openapi
 * '/api/recommendations':
 *  get:
 *     tags:
 *     - Team Controller
 *     summary: Get all teams
 *     requestBody:
 *      required: false
 *     responses:
 *      200:
 *        description: Success
 *      400:
 *        description: Bad Request
 *      409:
 *        description: Conflict
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
recommendationsRouter.get("/", getTeamRecommendations);

export default recommendationsRouter;