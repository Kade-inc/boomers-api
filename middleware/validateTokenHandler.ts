import { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import Blacklist from "../models/blacklistModel";

export interface CustomRequest extends Request {
  user?: any;
}

const validateToken = asyncHandler(
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    let token;
    const authHeader = req.headers.authorization;

    // Check for Bearer token
    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    } else {
      res.status(401);
      return next(new Error("User is not authorized or token is missing"));
    }

    // If token is missing, respond early
    if (!token) {
      res.status(401);
      return next(new Error("User is not authorized or token is missing"));
    }

    // Check if token is blacklisted
    const isBlacklisted = await Blacklist.findOne({ token });
    if (isBlacklisted) {
      res.status(401);
      return next(new Error("This session has expired. Please login"));
    }

    // Verify JWT
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, (err, decoded: any) => {
      if (err) {
        res.status(401);
        return next(new Error("User is not authorized"));
      }
      req.user = decoded.user;
      next();
    });
  }
);

export default validateToken;
