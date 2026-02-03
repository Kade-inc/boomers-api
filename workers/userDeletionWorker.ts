import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { UserDeletionJobData } from "../services/userDeletionQueue";
import { processUserDeletion } from "../services/userDeletionService";
import logger from "../services/logger";

// Create the user deletion worker
const userDeletionWorker = new Worker<UserDeletionJobData>(
    "user-deletion",
    async (job: Job<UserDeletionJobData>) => {
        const { userId, requestedBy, requestedAt } = job.data;

        logger.info(
            `[UserDeletionWorker] Processing job ${job.id} - deleting user: ${userId}, requested by: ${requestedBy}`
        );

        try {
            await processUserDeletion(userId);
            logger.info(
                `[UserDeletionWorker] Job ${job.id} completed - user ${userId} deleted successfully`
            );
        } catch (error) {
            logger.error(`[UserDeletionWorker] Job ${job.id} failed:`, error);
            throw error; // Rethrow to trigger retry
        }
    },
    {
        connection: redisConnection,
        concurrency: 2, // Process up to 2 deletions concurrently
    }
);

// Worker event handlers
userDeletionWorker.on("completed", (job) => {
    logger.info(`[UserDeletionWorker] Job ${job.id} has completed successfully`);
});

userDeletionWorker.on("failed", (job, err) => {
    logger.error(
        `[UserDeletionWorker] Job ${job?.id} failed with error:`,
        err.message
    );
});

userDeletionWorker.on("error", (err) => {
    logger.error("[UserDeletionWorker] Worker error:", err);
});

logger.info(
    "[UserDeletionWorker] User deletion worker started and listening for jobs..."
);

export default userDeletionWorker;
