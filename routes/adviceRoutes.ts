import express from "express";
import { getAdvice } from "../controllers/adviceController";

const adviceRouter = express.Router();

adviceRouter.get("/", getAdvice);

export default adviceRouter;