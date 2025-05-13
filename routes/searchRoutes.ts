import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { search, searchHistory } from "../controllers/searchController";

const searchRouter = express.Router();
searchRouter.use(validateToken);

searchRouter.get("/", search);

searchRouter.get("/history", searchHistory)

export default searchRouter;
