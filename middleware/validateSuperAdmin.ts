import { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { User } from "../models";

interface DecodedToken {
  user: {
    id: string;
    email: string;
    role: string;
  };
  iat: number;
  exp: number;
  aud: string;
}

const validateSuperAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401);
      throw new Error("Not authorized, no token");
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as DecodedToken;
      
      const user = await User.findById(decoded.user.id).populate("role");

      if (!user || (user.role as any).name !== "superadmin") {
        res.status(403);
        throw new Error("Not authorized as superadmin");
      }

      next();
    } catch (error) {
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }
);

export default validateSuperAdmin; 