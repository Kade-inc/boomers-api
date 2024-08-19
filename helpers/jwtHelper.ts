import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { refreshToken } from "../controllers/authController";

dotenv.config();

export const signAccessToken = (user:any) => {
    return jwt.sign(
      {
        user: {
          phoneNumber: user[0].phoneNumber,
          email: user[0].email,
          id: user[0]._id,
        },
      },
      process.env.ACCESS_TOKEN_SECRET!,
      {
        expiresIn: "30s",
        audience: user[0]._id.toString()
      }
    );
}

export const signRefreshToken = (user:any) => {
    return jwt.sign(
      {
        user: {
          phoneNumber: user[0].phoneNumber,
          email: user[0].email,
          id: user[0]._id,
        },
      },
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: "1y",
        audience: user[0]._id.toString()
      }
    );
}

export const verifyRefreshToken = (refreshToken:string) => {
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!, (err: any, payload:any) => {
        if (err) {
          throw new Error("User is not authorized");
        }
        
        const user = payload.aud
        console.log("FROM TOKEN: ", user)
        return user
      })
}

// TODO: Add issuer to the options once I have the domain. issuer: 'boomers.com'