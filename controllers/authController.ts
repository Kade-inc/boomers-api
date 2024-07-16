import { Request, Response } from "express";
import bcrypt from "bcrypt";
import asyncHandler from "express-async-handler";
import User from "../models/userModel";
import UserLoginCode from "../models/userLoginCodeModel";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
//@desc Sign in a user
//@route POST /api/users/login
//access public
const logInUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { password, accountId } = req.body;

    if (!password.trim()) {
      res.status(400);
      throw new Error("Please put a password");
    }

    const user = await User.find({
      $or: [
        { phoneNumber: accountId.trim() },
        { username: accountId.trim() },
        { email: accountId.trim() },
      ],
    });

    if (!user.length) {
      res.status(401);
      throw new Error("Invalid email/phone or password");
    }

    if (!user[0].isVerified) {
      res.status(401);
      throw new Error("Invalid email/phone or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user[0].password);

    if (!isPasswordValid) {
      res.status(401);
      throw new Error("Invalid email/phone or password");
    }

    const existingAuthCode = await UserLoginCode.findOne({
      userId: user[0]._id,
    });

    if (existingAuthCode) {
      await UserLoginCode.findByIdAndDelete(existingAuthCode._id);
    }

    // Generate Auth Code
    const authCode = generateAuthCode();

    // Hash the Auth Code
    const hashedAuthCode = await bcrypt.hash(authCode, 10);

    // Store the hashed authentication code in the database
    await UserLoginCode.create({
      userId: user[0]._id,
      logInCode: hashedAuthCode,
    });

    res.status(200).json({ message: "Log in successful", authCode });
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Verify Auth Code
//@route POST /api/users/verify-code
//access public
export const verifyUserCode = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { authCode, accountId } = req.body;

      if (!accountId && !authCode) {
        res.status(400).json({
          message: "Please provide both accountId and verification code",
        });
        return;
      }

      const user = await User.find({
        $or: [
          { phoneNumber: accountId.trim() },
          { username: accountId.trim() },
          { email: accountId.trim() },
        ],
      });
      if (!user.length) {
        res.status(404);
        throw new Error("User not found");
      }

      const logInAuthCode = await UserLoginCode.findOne({
        userId: user[0]._id,
      });

      if (!logInAuthCode) {
        res.status(400).json({ message: "No authentication code found" });
        return;
      }

      // Check if the code has expired
      const createdDate: any = logInAuthCode._id.getTimestamp();
      const currentDate: any = new Date();
      const diffTime = Math.abs(createdDate - currentDate);
      const fiveminutes = 1000 * 60 * 5;
      if (diffTime > fiveminutes) {
        await UserLoginCode.findByIdAndDelete(logInAuthCode._id);
        res.status(400).json({ error: "Authentication code expired" });
        return;
      }

      // Compare the entered code with the hashed code retrieved from the database
      const isCodeValid = await bcrypt.compare(
        authCode,
        logInAuthCode.logInCode
      );

      if (!isCodeValid) {
        res.status(400).json({ message: "Incorrect code" });
        return;
      }

      // Delete the authentication code from the database
      await UserLoginCode.deleteOne({ userId: user[0]._id });

      // Create a JWT token with an expiration time of 1 hour
      const token = jwt.sign(
        {
          user: {
            phoneNumber: user[0].phoneNumber,
            email: user[0].email,
            id: user[0]._id,
          },
        },
        process.env.ACCESS_TOKEN_SECRET!,
        {
          expiresIn: "1h",
        }
      );

      res.status(200).json({ message: "Code verified successfully", token });
    } catch (error: any) {
      throw new Error(error);
    }
  }
);

// Function to generate a random authentication code
const generateAuthCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default logInUser;
