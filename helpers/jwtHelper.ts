import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const signAccessToken = (user:any) => {
    return jwt.sign(
      {
        user: {
          email: user.email,
          id: user.id,
        },
      },
      process.env.ACCESS_TOKEN_SECRET!,
      {
        expiresIn: "1h",
        audience: user.id
      }
    );
}

export const signRefreshToken = (user:any) => {
    return jwt.sign(
      {
        user: {
          phoneNumber: user.phoneNumber,
          email: user.email,
          id: user.id,
        },
      },
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: "1y",
        audience: user.id
      }
    );
}

export const verifyRefreshToken = (refreshToken:string) => {
    return jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!, (err: any, payload:any) => {
        if (err) {
          throw new Error("User is not authorized");
        }
        const user = payload.user
        return user
      })
}

// TODO: Add issuer to the options once I have the domain. issuer: 'boomers.com'