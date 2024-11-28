import express from "express";
import validateToken from "../../middleware/validateTokenHandler";
import {
  addTeamMember,
  deleteTeamMember,
  fetchTeamMemberRequests,
  joinTeam,
  leaveTeam,
  updateJoinRequest,
} from "../../controllers/team/teamMemberController";

const teamMemberRouter = express.Router();

teamMemberRouter.use(validateToken);

/**
 * @openapi
 * '/api/team-member/create':
 *  post:
 *     tags:
 *     - Team Controller
 *     summary: Add team member
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - email
 *              - team_id
 *            properties:
 *              email:
 *                type: string
 *                default: janedoe@gmail.com
 *              team_id:
 *                type: string
 *                default: hnhre943u843493
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
teamMemberRouter.post("/create", addTeamMember);

/**
 * @openapi
 * '/api/team-member/join':
 *  post:
 *     tags:
 *     - Team Controller
 *     summary: Join a team
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - team_id
 *            properties:
 *              team_id:
 *                type: string
 *                default: fjh98938434
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
teamMemberRouter.post("/join", joinTeam);

/**
 * @openapi
 * '/api/team-member/join/:id':
 *  patch:
 *     tags:
 *     - Team Controller
 *     summary: Update Join Request
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - status
 *              - comment
 *            properties:
 *              status:
 *                type: string
 *                default: APPROVED
 *              comment:
 *                type: string
 *                default: "Looks good"
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
teamMemberRouter.put("/join/:id", updateJoinRequest);

teamMemberRouter.get("/requests/:teamId", fetchTeamMemberRequests)

teamMemberRouter.delete("/", deleteTeamMember)

teamMemberRouter.delete("/leave/:teamId", leaveTeam)

export default teamMemberRouter;
