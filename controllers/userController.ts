import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import asyncHandler from "express-async-handler";
import User from "../models/userModel";
import * as EmailValidator from "email-validator";
import UserVerificationCode from "../models/userVerificationCodeModel";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import UserProfile from "../models/userProfileModel";
import { CustomRequest } from "../middleware/validateTokenHandler";
import ResetPasswordToken from "../models/resetPasswordTokenModel";
import Joi from "joi";
const myCustomJoi = Joi.extend(require("joi-phone-number"));

dotenv.config();

//@desc Register a user
//@route POST /api/users/register
//access public
const registerUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { phoneNumber, email, password, username, countryCode, source } = req.body;

    if (!email && !phoneNumber) {
      res.status(400);
      throw new Error("Please put an email or phone number");
    }
    if (!password.trim()) {
      res.status(400);
      throw new Error("Please put a password");
    }

    if (email && phoneNumber) {
      res.status(400);
      throw new Error("Please select either email or phone number");
    }

    if (!username.trim()) {
      res.status(400);
      throw new Error("Please put a username");
    }

    if (username.length < 3) {
      res.status(400);
      throw new Error("Username should be between 3 and 30 characters");
    }

    let userAvailable = [];
    let validatedPhoneNumber;

    if (email) {
      const isValid = EmailValidator.validate(email);

      if (!isValid) {
        res.status(400);
        throw new Error("Email is not valid");
      }

      userAvailable = await User.find({
        $or: [{ email: email }, { username: username }],
      });
    }

    if (phoneNumber) {
      if (phoneNumber.length > 10 || phoneNumber.length < 9) {
        res.status(400).json({ message: "Invalid phone Number" });
        return;
      }

      const isValidPhone = myCustomJoi
        .string()
        .phoneNumber({ defaultCountry: countryCode, format: "e164" })
        .validate(phoneNumber);

      if (isValidPhone.error) {
        res.status(400).json({ message: "Invalid phone number" });
        return;
      }

      validatedPhoneNumber = isValidPhone.value;

      userAvailable = await User.find({
        $or: [{ phoneNumber: validatedPhoneNumber }, { username: username }],
      });
    }

    if (userAvailable.length > 0) {
      res.status(409).json({ message: "User exists" });
      return;
    }

    const regexPattern =
      /^(?=.*[-\#\$\.\%\&\@\!\+\=\<\>\*])(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

    if (!password.trim().match(regexPattern)) {
      res.status(400).json({
        error:
          "Password must be at least 8 characters long, have at least one alphabet (uppercase or lowercase), have at least one number present and have at least one special character (-,.,@,$,!,%,+,=,<,>,#,?,&)",
      });
      return;
    }

    const hashPassword = await bcrypt.hash(password.trim(), 10);

    const user = await User.create({
      password: hashPassword,
      email,
      phoneNumber: validatedPhoneNumber,
      username: username.trim(),
    });

    if (user) {
      const unhashedCode = generateRandomNumber();
      const hashCode = await bcrypt.hash(unhashedCode, 10);

      await UserVerificationCode.create({
        code: hashCode,
        phoneNumber: validatedPhoneNumber,
        email,
        userId: user.id,
      });

      res.status(201).json({
        successful: true,
        verificationCode: unhashedCode,
      });

      let verificationLink;
      if (source === "mobile") {
        verificationLink = `exp://localhost:8081/--/verificationSuccess?email=${email}&verificationCode=${unhashedCode}`
        console.log("VERIFICATION LINK: ", verificationLink)
      } else {
        verificationLink = `${process.env.FRONTEND_URL}/signup-verification?email=${email}&verificationCode=${unhashedCode}`
      }
      
      if (email) {
        const emailTemplate = `<div>
        <p>Hi ${username.trim()},</p>
        <p>Thank you for signing up to Boomers.</p>
        <p>Click on the link below to verify your account: </p>
        <p><a href="${verificationLink}" target="_blank">Verify Account</a></p>
        <p>This link will expire in 24 hours.</p>
        </div>`;
        sendMail(transporter, email, emailTemplate);
      }
    } else {
      res.status(400).json({ error: "User not registered." });
    }
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Verify a user
//@route POST /api/users/verify
//access public
export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { verificationCode, accountId } = req.body;

    if (!accountId) {
      res.status(400).json({ message: "Please put email or phoneNumber" });
      return;
    }
    const hashedVerificationCode = await UserVerificationCode.find({
      $or: [{ phoneNumber: accountId.trim() }, { email: accountId.trim() }],
    });

    const user = await User.find({
      $or: [{ phoneNumber: accountId.trim() }, { email: accountId.trim() }],
    });

    if (!hashedVerificationCode.length) {
      if (!user) {
        res.status(404).json({ error: "User does not exist." });
        return;
      } else {
        res.status(400).json({ error: "Verification code expired." });
        return;
      }
    }

    console.log("VERIFICATION CODE: ", verificationCode)
    const isCorrect = await bcrypt.compare(
      verificationCode.toString(),
      hashedVerificationCode[0].code
    );

    const createdDate: any = hashedVerificationCode[0]._id.getTimestamp();
    const currentDate: any = new Date();
    const diffTime = Math.abs(createdDate - currentDate);
    const twentyFourHours = 1000 * 60 * 60 * 24;

    if (diffTime > twentyFourHours) {
      await UserVerificationCode.findByIdAndDelete(
        hashedVerificationCode[0]._id
      );
      res.status(400).json({ error: "User code expired" });
      return;
    } else {
      if (isCorrect) {
        const updateUser = await User.findByIdAndUpdate(user[0]._id, {
          isVerified: true,
        });

        const isVerified = await UserVerificationCode.findByIdAndDelete(
          hashedVerificationCode[0]._id
        );

        if (isVerified) {
          if (user[0].email) {
            const emailTemplate = `<div>
            <p>Hi ${user[0].username},</p>
            <p>Your email has been verified successfully!</p>
            <p>Best,</p>
            <p>Boomers Support</p>
          </div>`;
            sendMail(transporter, user[0].email, emailTemplate);
          }
          const userProfile = await UserProfile.create({
            email: user[0].email,
            phoneNumber: user[0].phoneNumber,
            user_id: user[0]._id,
            username: user[0].username,
          });

          if (userProfile) {
            await User.findByIdAndUpdate(user[0]._id, {
              profile: userProfile._id,
            });
          }
          res.status(200).json({ successful: true, message: "User verified!" });
        }
      } else {
        res.status(400).json({ error: "User code invalid" });
      }
    }
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
});

//@desc Resend verification code to user
//@route POST /api/users/resend-verification
//access public
export const resendVerificationCode = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { email, phoneNumber, countryCode } = req.body;
      if (!email && !phoneNumber) {
        res.status(400);
        throw new Error("Please put an email or phone number");
      }

      if (email && phoneNumber) {
        res.status(400);
        throw new Error("Please select either email or phone number");
      }
      let user;
      let validatedPhoneNumber;
      if (email) user = await User.findOne({ email: { $in: [email] } });

      if (phoneNumber) {
        const isValidPhone = myCustomJoi
          .string()
          .phoneNumber({
            defaultCountry: countryCode ? countryCode : "KE",
            format: "e164",
          })
          .validate(phoneNumber);

        if (isValidPhone.error) {
          res.status(400).json({ message: "Invalid phone number" });
          return;
        }

        validatedPhoneNumber = isValidPhone.value;

        user = await User.findOne({
          phoneNumber: { $in: [validatedPhoneNumber] },
        });
      }

      if (user) {
        if (!user.isVerified) {
          let codeAvailable;
          if (email) {
            codeAvailable = await UserVerificationCode.findOne({
              email: { $in: [email] },
            });
          } else {
            codeAvailable = await UserVerificationCode.findOne({
              phoneNumber: { $in: [validatedPhoneNumber] },
            });
          }

          if (codeAvailable) {
            const unhashedCode = generateRandomNumber();
            const hashCode = await bcrypt.hash(unhashedCode, 10);
            const userCode = await UserVerificationCode.findByIdAndUpdate(
              codeAvailable._id,
              {
                code: hashCode,
              },
              { new: true }
            );
            if (email) {
              const emailTemplate = `<div>
              <p>Hi ${user.username},</p>
              <p>You requested a new verification code.</p>
              <p>Your verification code is: </p>
              <h2>${unhashedCode}</h2>
              <p>This code will expire in 24 hours.</p>
            </div>`;
              sendMail(transporter, email, emailTemplate);
            }
            res.status(201).json({
              successful: true,
              verificationCode: unhashedCode,
            });
            return;
          }
        } else {
          res.status(400).json({ error: "User is already verified!" });
        }
      } else {
        res.status(400).json({ error: "User does not exist" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error });
    }
  }
);

//@desc Get user
//@route GET /api/users/:id
//access public
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      res.status(404).json({ message: "User does not exist" });
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    throw new Error(error);
  }
});

//@desc Get all users
//@route GET /api/users
//access public
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const bucketPrefix = process.env.S3_BUCKET_PREFIX || "";
    let users;

    if (search) {
      const regex = new RegExp(search.toString(), "i");

      // 1. Find matching user profiles
      const matchingProfiles = await UserProfile.find({
        $or: [
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
        ],
      }).select("_id user_id"); // user_id references the User

      const profileUserIds = matchingProfiles.map(profile => profile.user_id);

      // 2. Find users whose username matches or whose _id is in profileUserIds
      users = await User.find({
        $or: [
          { username: { $regex: regex } },
          { _id: { $in: profileUserIds } },
        ],
      })
        .populate("profile", "firstName lastName profile_picture")
        .lean();
    } else {
      // No search term: just return all users.
      users = await User.find({})
        .populate("profile", "firstName lastName profile_picture")
        .lean();
    }

    // Post-process to add S3 prefix if necessary.
    users = users.map(user => {
      const profile = user.profile as {
        firstName?: string;
        lastName?: string;
        profile_picture?: string | null;
      }
      if (profile && profile.profile_picture) {
        profile.profile_picture = `${bucketPrefix}${profile.profile_picture}`;
      }
      return user;
    });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: "Error searching for users", error: error.message });
  }
});



//@desc Get current user info
//@route GET /api/users
//access private
export const currentUser = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    res.json(req.user);
  }
);

//@desc Forgot password
//@route POST /api/forgot-password
//access public

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    // Check if the user exists in the database:
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const saltRounds = 10;

    // Generate salt and hash the token
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(resetToken, salt);

    const userToken = await ResetPasswordToken.findOne({
      userId: user._id
    })

    if (userToken) {
      await ResetPasswordToken.findByIdAndUpdate(
        userToken._id,
          {
            token: hash,
          },
          {
            new: true,
          }
      )
    } else {
       // Save token to the database
   
      await new ResetPasswordToken({
        userId: user._id,
        token: hash,
        createdAt: Date.now(),
      }).save();
    }
   

    // Send email with the reset link
    const emailTemplate = `
            <div>
                <h2>Hi ${user.username}</h2>
                <p>You requested to reset your password</p>
                <p>Please click on the below link to reset your password</p>
                <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user._id}" target=_"blank">Reset Password</a>
            </div>`;
    // Assuming you have a function sendMail defined somewhere
    sendMail(transporter, email, emailTemplate, "Forgot Password");
    res.status(200).json({
      message: "Reset password email sent successfully",
      data: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user._id}`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

//@desc Reset password
//@route POST /api/reset-password
//access public
export const resetPassword = async (req: Request, res: Response) => {
  try {
    // Extract userId, token, and newPassword from request body
    const { userId, token, password } = req.body;

    const user = await User.find({ _id: userId });

    // Check if the password reset token exists for the user
    const passwordResetToken = await ResetPasswordToken.findOne({ userId });
    if (!passwordResetToken) {
      return res
        .status(404)
        .json({ message: "Invalid or expired password reset token" });
    }

    // Compare the provided token with the stored hashed token
    const isValidToken = await bcrypt.compare(token, passwordResetToken.token);
    if (!isValidToken) {
      return res
        .status(404)
        .json({ message: "Invalid or expired password reset token" });
    }

    const regexPattern =
      /^(?=.*[-\#\$\.\%\&\@\!\+\=\<\>\*])(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

    if (!password.trim().match(regexPattern)) {
      res.status(400).json({
        error:
          "Password must be 8-15 characters, have at least one alphabet (uppercase or lowercase), have at least one number present and have at least one special character (-,.,@,$,!,%,+,=,<,>,#,?,&)",
      });
      return;
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    await User.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    // Delete the password reset token
    await passwordResetToken.deleteOne();

    // Send email with the reset link
    const emailTemplate = `
             <div>
                 <h2>Hi ${user[0].username}</h2>
                 <p>Your password was reset successfully</p>
             </div>`;
    // Assuming you have a function sendMail defined somewhere
    sendMail(transporter, user[0].email, emailTemplate, "Password Reset");
    // Return success response
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(400).json({ error: error });
  }
};

function generateRandomNumber(): string {
  const min = 100000;
  const max = 999999;
  const generateRandomNumber =
    Math.floor(Math.random() * (max - min + 1)) + min;
  return generateRandomNumber.toString();
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.MAIL_PASSWORD,
  },
});

// async..await is not allowed in global scope, must use a wrapper
const sendMail = async (
  transporter: any,
  user: any,
  template: any,
  subject?: string
) => {
  const mailOptions = {
    from: {
      name: "Boomers",
      address: process.env.USER_EMAIL,
    }, // sender address
    to: [user], // list of receivers
    subject: subject ? subject : "Verification Link", // Subject line
    html: template,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    throw new Error(error);
  }
};

export default registerUser;
