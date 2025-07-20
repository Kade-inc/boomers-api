import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import UserProfile from "../models/userProfileModel";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand
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
      
      if (url) profile.profile_picture = url;
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

    if (profile.user_id.toString() !== req.user.id) {
      res.status(403).json({ error: "You do not own this profile!" });
      return;
    }
    const { phoneNumber, firstName, lastName, bio, interests, gender, job, location, city, country, latitude, longitude } =
      req.body;
    let updateProfileBody = {
      phoneNumber: profile.phoneNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      interests: profile.interests,
      gender: profile.gender,
      job: profile.job,
      location: profile.location,
      city: profile.city,
      country: profile.country,
      latitude: profile.latitude,
      longitude: profile.longitude,
      locationGeo: {}
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

    if (interests && typeof interests === "object") {}
      updateProfileBody.interests = interests;

      if (job && job.trim().length > 0)
        updateProfileBody.job = job.trim();

      if (location && location.trim().length > 0)
        updateProfileBody.location = location.trim();

      if (city && city.trim().length > 0)
        updateProfileBody.city = city.trim();

      if (country && country.trim().length > 0)
        updateProfileBody.country = country.trim();

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

        //   When updating interests
    //   {
    //     "interests": {
    //         "domain": [
    //             "Software Engineering"
    //         ],
    //         "subdomain": [
    //             "Frontend"
    //         ],
    //         "domainTopics": [
    //             "React Js"
    //         ]
    //     }
    // }

    if (
      typeof latitude === "number" &&
      typeof longitude === "number"
    ) {
      updateProfileBody.locationGeo = {
        type: "Point",
        coordinates: [longitude, latitude], // always [lng, lat]
      };
    }

    if (req.file) {
      //resize image
      // const buffer = await sharp(req.file.buffer)
      //   .resize({ height: 400, width: 400, fit: "contain" })
      //   .toBuffer();

      const imageKey = randomImageName()
      const params = {
        Bucket: bucketName,
        Key: imageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(params);

      await s3.send(command);

      // If only uploading an image, just update the profile picture
      if (!req.body || Object.keys(req.body).length === 0) {
        const updatedProfile = await UserProfile.findByIdAndUpdate(
          profile._id,
          {
            profile_picture: imageKey,
          },
          {
            new: true,
          }
        );

        if (updatedProfile) {
          updatedProfile.profile_picture = updatedProfile?.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${updatedProfile.profile_picture}` : null
        }
        
        res.status(200).json(updatedProfile);
        return;
      }

      // If uploading image with other data, update everything
      let updatedProfile = await UserProfile.findByIdAndUpdate(
        profile._id,
        {
          firstName: updateProfileBody.firstName,
          lastName: updateProfileBody.lastName,
          phoneNumber: updateProfileBody.phoneNumber,
          bio: updateProfileBody.bio,
          interests: updateProfileBody.interests ? (() => {
            try {
              return JSON.parse(updateProfileBody.interests);
            } catch (error) {
              console.error('Error parsing interests JSON:', error);
              return profile.interests;
            }
          })() : profile.interests,
          gender: updateProfileBody.gender,
          profile_picture: imageKey,
          job: updateProfileBody.job,
          location: updateProfileBody.location,
          city: updateProfileBody.city,
          country: updateProfileBody.country,
          latitude: updateProfileBody.latitude,
          longitude: updateProfileBody.longitude,
          locationGeo: updateProfileBody.locationGeo
        },
        {
          new: true,
        }
      );

      if (updatedProfile) {
        updatedProfile.profile_picture = updatedProfile?.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${updatedProfile.profile_picture}` : null
      }
      
      res.status(200).json(updatedProfile);
      return;
    }

    const updatedProfile = await UserProfile.findByIdAndUpdate(
      profile._id,
      {
        firstName: updateProfileBody.firstName,
        lastName: updateProfileBody.lastName,
        phoneNumber: updateProfileBody.phoneNumber,
        bio: updateProfileBody.bio,
        interests: updateProfileBody.interests ? (() => {
          try {
            return JSON.parse(updateProfileBody.interests);
          } catch (error) {
            console.error('Error parsing interests JSON:', error);
            return profile.interests;
          }
        })() : profile.interests,
        gender: updateProfileBody.gender,
        job: updateProfileBody.job,
        location: updateProfileBody.location,
        city: updateProfileBody.city,
        country: updateProfileBody.country,
        latitude: updateProfileBody.latitude,
        longitude: updateProfileBody.longitude,
        locationGeo: updateProfileBody.locationGeo
      },
      {
        new: true,
      }
    );

    if (updatedProfile) {
      updatedProfile.profile_picture = updatedProfile?.profile_picture ? `${process.env.S3_BUCKET_PREFIX}${updatedProfile.profile_picture}` : null
    }
    
    res.status(200).json(updatedProfile);
  } catch (error: any) {
    throw new Error(error);
  }
});


//@desc Delete profile picture
//@route DELETE /api/users/:id/profile-picture
//access private
export const deleteProfilePicture = asyncHandler(async (req:any, res) => {

  try {
    const userId = req.params.id
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return
    }

    if (profile.user_id.toString() !== req.user.id) {
      res.status(403).json({ error: "You do not own this profile!" });
      return;
    }

    const imageKey = profile.profile_picture;
    if (!imageKey) {
      res.status(404).json({ error: 'Profile picture not found.' });
      return
    }
    
    const deleteParams = {
      Bucket: bucketName,
      Key: imageKey,
    };

    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);
    await UserProfile.findByIdAndUpdate(profile._id, { profile_picture: null });
    res.status(204).json({ message: "Profile picture deleted" });
  
  }
   catch (error:any) {
    res.status(500)
    throw new Error(error)
  }
})