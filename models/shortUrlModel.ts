import { Schema, model, Document } from "mongoose";
import crypto from "crypto";

interface IShortUrl extends Document {
    code: string;
    originalUrl: string;
    resourceType: "challenge" | "solution" | "team";
    resourceId: string;
    createdBy?: Schema.Types.ObjectId;
    clickCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const shortUrlSchema = new Schema<IShortUrl>(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        originalUrl: {
            type: String,
            required: true,
        },
        resourceType: {
            type: String,
            required: true,
            enum: ["challenge", "solution", "team"],
        },
        resourceId: {
            type: String,
            required: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        clickCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Create compound index for finding existing short URLs for a resource
shortUrlSchema.index({ resourceType: 1, resourceId: 1 });

/**
 * Generate a random alphanumeric code for short URLs
 * Default length: 8 characters (~2.8 trillion combinations)
 */
export function generateShortCode(length: number = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
}

const ShortUrl = model<IShortUrl>("ShortUrl", shortUrlSchema);

export default ShortUrl;
