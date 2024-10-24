import { Request, Response } from "express";
import asyncHandler from "express-async-handler";

import jwt from "jsonwebtoken";
import Blacklist from "../models/blacklistModel";
export interface CustomRequest extends Request {
  user?: any;
}

const validateToken = asyncHandler(
  async (req: CustomRequest, res: Response, next) => {
    let token;
    let authHeader: any =
      req.headers.Authorization || req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
      const checkIfBlacklisted = await Blacklist.findOne({ token: token }); // Check if that token is blacklisted
      // if true, send an unathorized message, asking for a re-authentication.
      if (checkIfBlacklisted) {
          res
              .status(401)
              .json({ message: "This session has expired. Please login" });
              return
      }
      // if token has not been blacklisted, verify with jwt to see if it has been tampered with or not.
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!,
        (err: any, decoded: any) => {
          if (err) {
            res.status(401);
            throw new Error("User is not authorized");
          }
          req.user = decoded.user;
          console.log(decoded);
          next();
        }
      );
    }

    if (!token) {
      res.status(404);
      throw new Error("User is not authorized or token is missing");
    }
  }
);

export default validateToken;
