import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface UserDeletionJobData {
    userId: string;
    userEmail: string;      // Original email (before anonymization) for sending notification
    username: string;       // Username for personalized email
    requestedBy: string;    // ID of user who requested the deletion
    requestedAt: Date;
}

// Create the user deletion queue
export const userDeletionQueue = new Queue<UserDeletionJobData>("user-deletion", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000, // Start with 5 seconds, then 10s, 20s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs for debugging
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
    },
});

/**
 * Queue a user deletion to be processed asynchronously
 * @param userId - ID of user to delete
 * @param userEmail - Original email of the user (for notification)
 * @param username - Username of the user (for personalized email)
 * @param requestedBy - ID of user who requested the deletion
 */
export const queueUserDeletion = async (
    userId: string,
    userEmail: string,
    username: string,
    requestedBy: string
): Promise<string> => {
    const job = await userDeletionQueue.add("delete-user", {
        userId,
        userEmail,
        username,
        requestedBy,
        requestedAt: new Date(),
    });

    return job.id || "";
};

export default queueUserDeletion;
