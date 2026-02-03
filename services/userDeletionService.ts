import mongoose from "mongoose";
import {
    User,
    UserProfile,
    Team,
    TeamMember,
    ChallengeSolution,
    ChallengeComment,
    SolutionComment,
    ChallengeStep,
    SolutionRating,
    ChatModel,
    Message,
    Notification,
    SearchHistory,
    UserVerificationCode,
    ResetPasswordToken,
    UserLoginCode,
} from "../models";
import TeamMemberRequest from "../models/teamMemberRequestModel";
import ChallengeStepComment from "../models/challengeStepCommentModel";
import logger from "./logger";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

// S3 client for deleting profile pictures
const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.ACCESS_KEY as string,
        secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
    },
    region: process.env.BUCKET_REGION as string,
});

const bucketName = process.env.BUCKET_NAME as string;

/**
 * User Deletion Service
 * Handles soft deletion of users with cascading cleanup of related data.
 * Teams are orphaned (preserved), but user's own content is deleted.
 */

/**
 * Anonymize user credentials to free up email/username for reuse
 */
const anonymizeUserCredentials = async (userId: string): Promise<void> => {
    const timestamp = Date.now();
    const anonymizedEmail = `deleted_${userId}_${timestamp}@deleted.local`;
    const anonymizedUsername = `deleted_${userId}_${timestamp}`;

    await User.findByIdAndUpdate(userId, {
        email: anonymizedEmail,
        username: anonymizedUsername,
        phoneNumber: null,
        password: null,
        pushTokens: [],
        deletedAt: new Date(),
    });

    logger.info(`Anonymized credentials for user ${userId}`);
};

/**
 * Orphan teams owned by the user (set owner_id to null, preserve team & challenges)
 */
const orphanUserTeams = async (userId: string): Promise<void> => {
    const result = await Team.updateMany(
        { owner_id: new mongoose.Types.ObjectId(userId) },
        { $set: { owner_id: null } }
    );

    logger.info(`Orphaned ${result.modifiedCount} teams for user ${userId}`);
};

/**
 * Delete user's profile picture from S3
 */
const deleteProfilePictureFromS3 = async (imageKey: string): Promise<void> => {
    try {
        const deleteParams = {
            Bucket: bucketName,
            Key: imageKey,
        };
        await s3.send(new DeleteObjectCommand(deleteParams));
        logger.info(`Deleted profile picture from S3: ${imageKey}`);
    } catch (error) {
        // Log but don't fail if S3 deletion fails (image might already be deleted)
        logger.warn(`Failed to delete profile picture from S3: ${imageKey}`, error);
    }
};

/**
 * Delete user's profile and profile picture (idempotent - safe to run multiple times)
 */
const deleteUserProfile = async (userId: string): Promise<void> => {
    // First, get the profile to check for profile picture
    const profile = await UserProfile.findOne({ user_id: new mongoose.Types.ObjectId(userId) });

    if (profile?.profile_picture) {
        await deleteProfilePictureFromS3(profile.profile_picture);
    }

    // Then delete the profile from database
    const result = await UserProfile.deleteMany({ user_id: new mongoose.Types.ObjectId(userId) });
    logger.info(`Deleted ${result.deletedCount} profile(s) for user ${userId}`);
};

/**
 * Delete user's memberships from teams (not owned teams, just memberships)
 */
const deleteUserMemberships = async (userId: string): Promise<void> => {
    // Delete team memberships where user is a member
    const memberResult = await TeamMember.deleteMany({
        user_id: new mongoose.Types.ObjectId(userId),
    });

    // Delete member requests made by or for the user
    const requestResult = await TeamMemberRequest.deleteMany({
        $or: [
            { user_id: new mongoose.Types.ObjectId(userId) },
            { owner_id: new mongoose.Types.ObjectId(userId) },
        ],
    });

    logger.info(
        `Deleted ${memberResult.deletedCount} memberships and ${requestResult.deletedCount} member requests for user ${userId}`
    );
};

/**
 * Delete user's own content (solutions, comments, ratings, steps)
 */
const deleteUserContent = async (userId: string): Promise<void> => {
    const objectId = new mongoose.Types.ObjectId(userId);

    // Delete user's challenge solutions
    const solutionsResult = await ChallengeSolution.deleteMany({ user_id: objectId });

    // Delete user's comments on challenges
    const challengeCommentsResult = await ChallengeComment.deleteMany({ user: objectId });

    // Delete user's comments on solutions
    const solutionCommentsResult = await SolutionComment.deleteMany({ user: objectId });

    // Delete user's comments on challenge steps
    const stepCommentsResult = await ChallengeStepComment.deleteMany({ user: objectId });

    // Delete user's challenge steps
    const stepsResult = await ChallengeStep.deleteMany({ user_id: objectId });

    // Delete user's solution ratings
    const ratingsResult = await SolutionRating.deleteMany({ user_id: objectId });

    logger.info(
        `Deleted user content for ${userId}: ${solutionsResult.deletedCount} solutions, ` +
        `${challengeCommentsResult.deletedCount} challenge comments, ` +
        `${solutionCommentsResult.deletedCount} solution comments, ` +
        `${stepCommentsResult.deletedCount} step comments, ` +
        `${stepsResult.deletedCount} steps, ` +
        `${ratingsResult.deletedCount} ratings`
    );
};

/**
 * Delete user's chats and messages
 */
const deleteUserChats = async (userId: string): Promise<void> => {
    // Delete all messages sent by the user
    const messagesResult = await Message.deleteMany({ senderId: userId });

    // Find chats where user is a member
    const userChats = await ChatModel.find({ members: userId });

    let deletedChats = 0;
    let updatedChats = 0;

    for (const chat of userChats) {
        if (chat.members.length <= 2) {
            // If chat has 2 or fewer members, delete the entire chat
            await ChatModel.findByIdAndDelete(chat._id);
            // Also delete all messages in this chat
            await Message.deleteMany({ chatId: chat._id.toString() });
            deletedChats++;
        } else {
            // Remove user from the members array
            await ChatModel.findByIdAndUpdate(chat._id, {
                $pull: { members: userId },
            });
            updatedChats++;
        }
    }

    logger.info(
        `Chat cleanup for user ${userId}: deleted ${messagesResult.deletedCount} messages, ` +
        `deleted ${deletedChats} chats, updated ${updatedChats} chats`
    );
};

/**
 * Delete user's metadata (notifications, search history, auth tokens)
 */
const deleteUserMeta = async (userId: string): Promise<void> => {
    const objectId = new mongoose.Types.ObjectId(userId);

    // Delete notifications
    const notificationsResult = await Notification.deleteMany({ user: objectId });

    // Delete search history
    const searchResult = await SearchHistory.deleteMany({ userId: objectId });

    // Delete verification codes
    const user = await User.findById(userId);
    if (user) {
        if (user.email) {
            await UserVerificationCode.deleteMany({ email: user.email });
        }
        if (user.phoneNumber) {
            await UserVerificationCode.deleteMany({ phoneNumber: user.phoneNumber });
            await UserLoginCode.deleteMany({ phoneNumber: user.phoneNumber });
        }
    }

    // Delete reset password tokens
    await ResetPasswordToken.deleteMany({ userId: objectId });

    logger.info(
        `Deleted metadata for user ${userId}: ${notificationsResult.deletedCount} notifications, ` +
        `${searchResult.deletedCount} search history entries`
    );
};

/**
 * Mark user as deleted immediately (fast operation for API response)
 * This is called by the controller before queueing the full deletion
 * @param userId - The ID of the user to mark as deleted
 */
export const markUserAsDeleted = async (userId: string): Promise<void> => {
    const timestamp = Date.now();
    const pendingEmail = `deleted_${userId}_${timestamp}@pending.local`;
    const pendingUsername = `deleted_${userId}_${timestamp}`;

    await User.findByIdAndUpdate(userId, {
        email: pendingEmail,
        username: pendingUsername,
        deletedAt: new Date(),
    });

    logger.info(`Marked user ${userId} as deleted (pending full cleanup)`);
};

/**
 * Process full user deletion (called by the worker)
 * This handles all the cascade deletion operations
 * @param userId - The ID of the user to delete
 */
export const processUserDeletion = async (userId: string): Promise<void> => {
    logger.info(`Starting full user deletion processing for user ${userId}`);

    // Validate user exists and is marked for deletion
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (!user.deletedAt) {
        logger.warn(`User ${userId} is not marked for deletion, skipping`);
        return;
    }

    const errors: Error[] = [];

    // Execute all deletion operations, continuing on error
    try { await deleteUserProfile(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to delete profile for ${userId}:`, e); }

    try { await orphanUserTeams(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to orphan teams for ${userId}:`, e); }

    try { await deleteUserMemberships(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to delete memberships for ${userId}:`, e); }

    try { await deleteUserContent(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to delete content for ${userId}:`, e); }

    try { await deleteUserChats(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to delete chats for ${userId}:`, e); }

    try { await deleteUserMeta(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to delete metadata for ${userId}:`, e); }

    // Finalize the anonymization (update from pending to deleted)
    try { await anonymizeUserCredentials(userId); }
    catch (e) { errors.push(e as Error); logger.error(`Failed to anonymize credentials for ${userId}:`, e); }

    if (errors.length > 0) {
        logger.error(`User deletion for ${userId} completed with ${errors.length} errors`);
        throw new Error(`User deletion completed with ${errors.length} errors`);
    }

    logger.info(`Successfully completed full user deletion for user ${userId}`);
};


export default {
    markUserAsDeleted,
    processUserDeletion,
};
