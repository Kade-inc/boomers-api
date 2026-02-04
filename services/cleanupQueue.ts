import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import logger from "./logger";

export interface CleanupJobData {
    scheduledAt: Date;
}

// Create the cleanup queue for scheduled permanent deletion
export const cleanupQueue = new Queue<CleanupJobData>("user-cleanup", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 10000, // 10 seconds between retries
        },
        removeOnComplete: 50,
        removeOnFail: 100,
    },
});

/**
 * Initialize the scheduled cleanup job
 * Runs daily at 3:00 AM to permanently delete users marked for deletion > 30 days ago
 */
export const initializeCleanupSchedule = async (): Promise<void> => {
    // Use upsertJobScheduler (BullMQ v5+) - creates or updates the scheduler
    await cleanupQueue.upsertJobScheduler(
        "daily-user-cleanup", // scheduler ID
        {
            pattern: "0 3 * * *", // Cron: 3:00 AM daily
        },
        {
            name: "permanent-deletion",
            data: { scheduledAt: new Date() },
        }
    );

    logger.info("[CleanupQueue] Scheduled daily user cleanup job at 3:00 AM");
};

export default cleanupQueue;
