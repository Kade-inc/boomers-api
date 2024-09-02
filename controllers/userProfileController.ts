import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import UserProfile from "../models/userProfileModel";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");
const bucketName: any = process.env.BUCKET_NAME;
const bucketRegion: any = process.env.BUCKET_REGION;
const accessKey: any = process.env.ACCESS_KEY;
const secretAccessKey: any = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

//@desc Get user
//@route GET /api/users/:id/profile
//access public
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.params.id });

    if (!profile) {
      res.status(404).json({ message: "User profile does not exist" });
      return;
    }
    if (profile.profile_picture) {
      const getObjectParams = {
        Bucket: bucketName,
        Key: profile?.profile_picture,
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      
      if (url) {
        profile.profile_picture = url;
      } else {
        console.log("Failed to generate URL");
      }
    } else {
      console.log("No profile picture found.");
    }
    
    res.status(200).json({
      successful: true,
      profile,
    });
  } catch (error: any) {
    res.status(400)
    throw new Error(error);
  }
});

//@desc Update user profile
//@route PUT /api/users/:id/profile
//access private
export const updateUserProfile = asyncHandler(async (req: any, res) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.params.id });
    if (!profile) {
      res.status(404);
      throw new Error("User profile not found");
    }

    const { phoneNumber, firstName, lastName, bio, interests, gender } =
      req.body;
    let updateProfileBody = {
      phoneNumber: profile.phoneNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      interests: profile.interests,
      gender: profile.gender,
    };

    // if (username && username.trim().length > 0)
    //   updateProfileBody.username = username.trim();

    if (phoneNumber && phoneNumber.trim().length > 0)
      updateProfileBody.phoneNumber = phoneNumber.trim();

    if (firstName && firstName.trim().length > 0)
      updateProfileBody.firstName = firstName.trim();

    if (lastName && lastName.trim().length > 0)
      updateProfileBody.lastName = lastName.trim();

    if (bio && bio.trim().length > 0) updateProfileBody.bio = bio.trim();

    if (interests && typeof interests === "object")
      updateProfileBody.interests = interests;

    // if (
    //   !interests &&
    //   !phoneNumber &&
    //   !firstName &&
    //   !lastName &&
    //   !bio &&
    //   !gender
    // ) {
    //   res.status(400);
    //   throw new Error("Please put a valid value");
    // }

    if (gender && gender.trim().length > 0) {
      const genderLower = gender.toLowerCase();

      if (
        genderLower === "male" ||
        genderLower === "female" ||
        genderLower === "other" ||
        genderLower === "none"
      ) {
        updateProfileBody.gender = genderLower;
      } else {
        res.status(400);
        throw new Error("Please put a valid gender");
      }
    }

    if (req.file) {
      //resize image
      const buffer = await sharp(req.file.buffer)
        .resize({ height: 400, width: 400, fit: "contain" })
        .toBuffer();
      const params = {
        Bucket: bucketName,
        Key: randomImageName(),
        Body: buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(params);

      const updatedImage = await s3.send(command);

      await UserProfile.findByIdAndUpdate(
        profile._id,
        {
          profile_picture: randomImageName(),
        },
        {
          new: true,
        }
      );
      
      const updatedProfile = await UserProfile.findByIdAndUpdate(
        profile._id,
        {
          firstName: updateProfileBody.firstName,
          lastName: updateProfileBody.lastName,
          phoneNumber: updateProfileBody.phoneNumber,
          bio: updateProfileBody.bio,
          interests: updateProfileBody.interests,
          gender: updateProfileBody.gender,
          profile_picture: randomImageName(),
        },
        {
          new: true,
        }
      );

      res.status(200).json({ message: "Profile updated!", data: updatedProfile });
      return;
    }

    const updatedProfile = await UserProfile.findByIdAndUpdate(
      profile._id,
      {
        firstName: updateProfileBody.firstName,
        lastName: updateProfileBody.lastName,
        phoneNumber: updateProfileBody.phoneNumber,
        bio: updateProfileBody.bio,
        interests: updateProfileBody.interests,
        gender: updateProfileBody.gender,
      },
      {
        new: true,
      }
    );
    res.status(200).json(updatedProfile);
  } catch (error: any) {
    throw new Error(error);
  }
});
