import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { allSearchChallenges, allSearchProfiles, allSearchTeams, search, searchHistory, clearSearchHistory } from "../controllers/searchController";

const searchRouter = express.Router();
searchRouter.use(validateToken);

searchRouter.get("/", search);

searchRouter.get("/history", searchHistory)

searchRouter.delete("/history", clearSearchHistory)

searchRouter.get("/teams", allSearchTeams)

searchRouter.get("/challenges", allSearchChallenges)

searchRouter.get("/profiles", allSearchProfiles)

export default searchRouter;
