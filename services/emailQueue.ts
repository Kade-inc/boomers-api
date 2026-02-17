import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface EmailJobData {
    to: string;
    template: string;
    subject?: string;
}

// Create the email queue
export const emailQueue = new Queue<EmailJobData>("email", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000, // Start with 2 seconds, then 4s, 8s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs for debugging
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
    },
});

/**
 * Queue an email to be sent asynchronously
 * @param to - Recipient email address
 * @param template - HTML email template
 * @param subject - Email subject (defaults to "Verification Link")
 */
export const queueEmail = async (
    to: string,
    template: string,
    subject?: string
): Promise<void> => {
    await emailQueue.add("send-email", {
        to,
        template,
        subject: subject || "Verification Link",
    });
};

export default queueEmail;
