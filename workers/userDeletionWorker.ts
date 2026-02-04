import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { UserDeletionJobData } from "../services/userDeletionQueue";
import { processUserDeletion } from "../services/userDeletionService";
import logger from "../services/logger";
import queueEmail from "../services/emailQueue";
import { createEmailTemplate } from "../helpers/emailTemplates";

const GRACE_PERIOD_DAYS = 30;

/**
 * Send deletion confirmation email to the user
 */
const sendDeletionConfirmationEmail = async (
    email: string,
    username: string
): Promise<void> => {
    const emailTemplate = createEmailTemplate({
        greeting: `Hi ${username},`,
        content: `
            <p style="margin: 0 0 16px;">Your account has been successfully deleted from Boomers.</p>
            <p style="margin: 0 0 16px;">All your personal data has been removed. If you didn't request this deletion, please contact our support team immediately.</p>
            <p style="margin: 0;"><strong>Note:</strong> Your data will be permanently deleted after ${GRACE_PERIOD_DAYS} days. If you wish to recover your account, please contact us before then.</p>
        `,
        footer: "Thank you for being part of our community.",
    });

    await queueEmail(email, emailTemplate, "Your Account Has Been Deleted");
    logger.info(`Deletion confirmation email queued for ${email}`);
};

// Create the user deletion worker
const userDeletionWorker = new Worker<UserDeletionJobData>(
    "user-deletion",
    async (job: Job<UserDeletionJobData>) => {
        const { userId, userEmail, username, requestedBy } = job.data;

        logger.info(
            `[UserDeletionWorker] Processing job ${job.id} - deleting user: ${userId}, requested by: ${requestedBy}`
        );

        try {
            await processUserDeletion(userId);

            // Send confirmation email after successful deletion
            if (userEmail) {
                await sendDeletionConfirmationEmail(userEmail, username);
            }

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
