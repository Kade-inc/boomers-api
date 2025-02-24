import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { fetchRequests } from "../controllers/requests";

const requestsRouter = express.Router();
requestsRouter.use(validateToken);

requestsRouter.get("/", fetchRequests);

export default requestsRouter;
