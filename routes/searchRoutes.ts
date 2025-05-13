import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { allSearchChallenges, allSearchProfiles, allSearchTeams, search, searchHistory } from "../controllers/searchController";

const searchRouter = express.Router();
searchRouter.use(validateToken);

searchRouter.get("/", search);

searchRouter.get("/history", searchHistory)

searchRouter.get("/teams", allSearchTeams)

searchRouter.get("/challenges", allSearchChallenges)

searchRouter.get("/profiles", allSearchProfiles)

export default searchRouter;
