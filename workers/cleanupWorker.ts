import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { CleanupJobData } from "../services/cleanupQueue";
import { User } from "../models";
import logger from "../services/logger";

const GRACE_PERIOD_DAYS = 30;

/**
 * Permanently delete a user record from the database
 */
const permanentlyDeleteUser = async (userId: string): Promise<void> => {
    await User.findByIdAndDelete(userId);
    logger.info(`Permanently deleted user ${userId}`);
};

// Create the cleanup worker
const cleanupWorker = new Worker<CleanupJobData>(
    "user-cleanup",
    async (job: Job<CleanupJobData>) => {
        logger.info(`[CleanupWorker] Starting scheduled cleanup job ${job.id}`);

        try {
            // Calculate the cutoff date (30 days ago)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

            // Find all users marked for deletion before the cutoff date
            const usersToDelete = await User.find({
                deletedAt: { $ne: null, $lt: cutoffDate },
            }).select("_id username email deletedAt");

            if (usersToDelete.length === 0) {
                logger.info("[CleanupWorker] No users to permanently delete");
                return;
            }

            logger.info(
                `[CleanupWorker] Found ${usersToDelete.length} users to permanently delete`
            );

            let successCount = 0;
            let errorCount = 0;

            for (const user of usersToDelete) {
                try {
                    await permanentlyDeleteUser(user._id.toString());
                    successCount++;
                } catch (error) {
                    logger.error(
                        `[CleanupWorker] Failed to delete user ${user._id}:`,
                        error
                    );
                    errorCount++;
                }
            }

            logger.info(
                `[CleanupWorker] Cleanup complete: ${successCount} deleted, ${errorCount} failed`
            );
        } catch (error) {
            logger.error("[CleanupWorker] Cleanup job failed:", error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Only run one cleanup job at a time
    }
);

// Worker event handlers
cleanupWorker.on("completed", (job) => {
    logger.info(`[CleanupWorker] Job ${job.id} completed successfully`);
});

cleanupWorker.on("failed", (job, err) => {
    logger.error(`[CleanupWorker] Job ${job?.id} failed:`, err.message);
});

cleanupWorker.on("error", (err) => {
    logger.error("[CleanupWorker] Worker error:", err);
});

logger.info("[CleanupWorker] Cleanup worker started and listening for jobs...");

export default cleanupWorker;
