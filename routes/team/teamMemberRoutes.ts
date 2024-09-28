import express from "express";
import {
  deleteTeam,
  getAllTeams,
  getTeam,
  updateTeam,
} from "../../controllers/team/teamController";
import validateToken from "../../middleware/validateTokenHandler";
import {
  addTeamMember,
  fetchTeamMemberRequests,
  joinTeam,
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
teamMemberRouter.patch("/join/:id", updateJoinRequest);
/**
 * @openapi
 * '/api/teams':
 *  post:
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
teamMemberRouter.get("/", getAllTeams);

/**
 * @openapi
 * '/api/teams/:id':
 *  put:
 *     tags:
 *     - Team Controller
 *     summary: Update a team
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
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
 *              teamUserName:
 *                type: string
 *                default: thefunkyBunch
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
teamMemberRouter.put("/:id", updateTeam);

/**
 * @openapi
 * '/api/teams/:id':
 *  delete:
 *     tags:
 *     - Team Controller
 *     summary: Delete a team
 *     responses:
 *      200:
 *        description: Ok
 *      400:
 *        description: Bad Request
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
teamMemberRouter.delete("/:id", deleteTeam);

/**
 * @openapi
 * '/api/teams/:id':
 *  get:
 *     tags:
 *     - Team Controller
 *     summary: Get a team
 *     responses:
 *      200:
 *        description: Ok
 *      400:
 *        description: Bad Request
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
teamMemberRouter.get("/:id", getTeam);


teamMemberRouter.get("/requests/:teamId", fetchTeamMemberRequests)

export default teamMemberRouter;
