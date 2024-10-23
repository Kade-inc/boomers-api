import { Response } from "express";
import asyncHandler from "express-async-handler";
const NodeCache = require('node-cache');
import { CustomRequest } from "../middleware/validateTokenHandler";

// Set up cache with a 24-hour expiration time
const cache = new NodeCache({ stdTTL: 86400 }); // TTL in seconds (86400 seconds = 24 hours)

//@desc Get Advice
//@route GET /api/advice
//access public
export const getAdvice = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
         // Check if advice is cached
        let cachedAdvice = cache.get('dailyAdvice');
        
        if (cachedAdvice) {
            // Return cached advice
            res.status(200).json({ message: "Advice Retrieved successfully", data: cachedAdvice });
        } else {
            const response = await fetch('https://api.adviceslip.com/advice');
            const data = await response.json();
            // Store new advice in cache
            cache.set('dailyAdvice', data.slip.advice);
            res.status(200).json({ message: "Advice Retrieved successfully", data: data.slip.advice  });
        }
        
    } catch (error: any) {
        res.status(400)
        throw new Error(error)
    }
  }
);
