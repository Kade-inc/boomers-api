import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import ChallengeSolution from "../models/challengeSolutionModel";
import TeamChallenge from "../models/teamChallengeModel";
import Team from "../models/teamModel";
import TeamMember from "../models/teamMemberModel";
import ChallengeStep from "../models/challengeStepModel";
import UserProfile from "../models/userProfileModel";
import SolutionComment from "../models/solutionCommentModel";
import SolutionRating from "../models/solutionRatingModel";
import Notification from "../models/notificationModel";
import { Types, Document } from "mongoose";

interface PopulatedUser {
  _id: Types.ObjectId;
  profile: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

interface PopulatedChallengeSolution extends Document {
  user_id: PopulatedUser;
  // ... other fields from ChallengeSolution
}

interface PopulatedSolutionComment {
  user: {
    _id: Types.ObjectId;
    profile: {
      firstName: string;
      lastName: string;
      username: string;
    };
  };
  // ... other fields
}

//@desc Post Solution
//@route POST /api/challenges/:id/solutions
//access private
export const postChallengeSolution = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challengeExists[0].team_id,
      });

      if (!teamMembers) {
        res.status(404);
        throw new Error("No team members");
      }

      const teamMemberExists: any = teamMembers.find((member) => {
        return member.user_id.toString() === req.user.id;
      });

      if (!teamMemberExists) {
        res.status(403).json({ message: "User does not belong to the team" });
      } else {
        const solutionExists = await ChallengeSolution.find({
          challenge_id: challenge_id,
        });

        const userSolution = solutionExists.find((solution) => {
          return solution.user_id.toString() === req.user.id;
        });

        if (!userSolution) {
          const challengeSolution = await ChallengeSolution.create({
            challenge_id: challenge_id,
            user_id: req.user.id,
          });

          res
            .status(201)
            .json({ message: "successful", data: challengeSolution });
        } else {
          res
            .status(409)
            .json({ error: "User has already began taking the quiz." });
        }
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc PATCH Solution
//@route PATCH /api/challenges/:id/solutions/:solutionId
//access private
export const updateChallengeSolution = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;
      const initialChallengeSolution = await ChallengeSolution.findById({ _id: solutionId }).populate({
        path: 'user_id',
        model: 'User',
        select: 'profile',
        populate: {
          path: 'profile',
          model: 'UserProfile',
          select: 'firstName lastName username'
        }
      }).lean();
    

      const challenge = await TeamChallenge.findById({
        _id: req.params.id,
      });

      if (!initialChallengeSolution || !challenge) {
        res.status(404).json({ error: "Solution does not exist" });
        return;
      }
      if (req.user.id !== (initialChallengeSolution?.user_id as any)._id.toString()) {
        res.status(403).json({ error: "Solution does not belong to you" });
        return;
      } else {

        const { status, demo_url, solution } = req.body;
        let completedDate;

        if (status && status !== 1 && status !== 0 && status !== 2) {
          res.status(400).json({
            error: "Kindly put a valid value.",
          });
          return;
        }

        if (status && status === 2) {
          const challengeSolution = await ChallengeSolution.findById({
            _id: solutionId,
          });

          if (challengeSolution?.percentageCompleted !== 100) {
            res.status(400).json({
              error: "Kindly complete all the steps before submitting",
            });
            return;
          }
          completedDate = new Date();
  
            const username = (initialChallengeSolution.user_id as any).profile.firstName ? `${(initialChallengeSolution.user_id as any).profile.firstName} ${(initialChallengeSolution.user_id as any).profile.lastName}` : (initialChallengeSolution.user_id as any).profile.username;
        
              const notification = await Notification.create({
                user: challenge.owner_id,
                message: `${username} has submitted a solution for the challenge: "${challenge.challenge_name}".`,
                reference: challenge._id,
                referenceModel: "TeamChallenge",
                subreference: solutionId,
                subreferenceModel: "ChallengeSolution",
              });
            
              const io = req.app.locals.io;
              // Emit notification only to the challenge owner's personal room
              io.to(challenge.owner_id.toString()).emit("pushNotification", notification);
              console.log("Notification emitted to challenge owner's room " + challenge.owner_id.toString(), notification);
            
  
        }

        const updatedSolution = await ChallengeSolution.findByIdAndUpdate(
          solutionId,
          {
            status: status,
            demo_url,
            solution,
            completedDate,
          },
          { new: true }
        );
        res.status(200).json({ message: "successful", data: updatedSolution });
      }
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution
//@route GET /api/challenges/:id/solutions/:solutionId
//access private
export const getChallengeSolution = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;

      const solution = await ChallengeSolution.findById({ _id: solutionId })
        .populate({
          path: 'challenge_id',
          model: 'TeamChallenge',
          select: '-__v'
        })
        .populate({
          path: 'user_id',
          model: 'User',
          select: 'profile _id',
          populate: {
            path: 'profile',
            model: 'UserProfile',
            select: 'firstName lastName username'
          }
        });

      if (!solution) {
        res.status(404).json({ message: "Solution not found" });
        return;
      }

      // Transform the response to rename challenge_id to challenge and user_id to user
      const { challenge_id, user_id, ...rest } = solution.toObject();
      const responseData = {
        ...rest,
        challenge: challenge_id,
        user: user_id
      };

      res.status(200).json({ message: "successful", data: responseData });
    } catch (error: any) {
      console.log("ERROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Delete Solutions
//@route GET /api/challenges/:id/solutions
//access private
export const getAllChallengeSolutions = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challengeId = req.params.id;

      const solutions = await ChallengeSolution.find({
        challenge_id: challengeId,
      }).populate({
        path: 'user_id',
        model: 'User',
        select: 'profile _id',
        populate: {
          path: 'profile',
          model: 'UserProfile',
          select: 'firstName lastName username profile_picture',
          transform: (doc) => {
            if (doc.profile_picture) {
              doc.profile_picture = `${process.env.S3_BUCKET_PREFIX}${doc.profile_picture}`;
            }
            return doc;
          }
        },
       
      });

      // Transform the response to rename user_id to user
      const transformedSolutions = solutions.map(solution => {
        const { user_id, ...rest } = solution.toObject();
        return {
          ...rest,
          user: user_id
        };
      });

      res.status(200).json({ message: "successful", data: transformedSolutions });
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc DELETE Solution
//@route DELETE /api/challenges/:id/solutions/:solutionId
//access private
export const deleteChallengeSolution = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solution_id = req.params.solutionId;
      const solution = await ChallengeSolution.findById({ _id: solution_id });

      const challenge = await TeamChallenge.findById({
        _id: req.params.id,
      });

      if (!solution || !challenge) {
        res.status(404).json({ error: "Solution does not exist" });
        return;
      }
      if (req.user.id !== solution?.user_id.toString()) {
        res.status(403).json({ error: "Solution does not belong to you" });
        return;
      } else {
        await ChallengeSolution.findByIdAndDelete(solution_id);

        await ChallengeStep.deleteMany({ solution_id: { $in: solution_id } });

        res.status(204).json({ message: "successful" });
      }
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Post Solution comment
//@route POST /api/challenges/:id/solutions/:solutionId/comments
//access private
export const postSolutionComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challengeExists[0].team_id,
      });

      if (!teamMembers) {
        res.status(404);
        throw new Error("No team members");
      }

      const teamMemberExists: any = teamMembers.find((member) => {
        return member.user_id.toString() === req.user.id;
      });

      if (!teamMemberExists) {
        res.status(403).json({ message: "User does not belong to the team" });
      } else {
        const { comment } = req.body;

        if (!comment.trim()) {
          res.status(400).json({ message: "Put a comment will ya" });
          return;
        }

        const solutionComment = await SolutionComment.create({
          solution_id: req.params.solutionId,
          comment,
          user: req.user.id,
        });

        const populatedSolutionComment = await solutionComment.populate({
          path: 'user',
          model: 'User',
          select: 'profile _id',
          populate: {
            path: 'profile',
            model: 'UserProfile',
            select: 'firstName lastName username',
          }
        }) as PopulatedSolutionComment;

        console.log("populatedSolutionComment", populatedSolutionComment);
        
        const username = populatedSolutionComment.user.profile.firstName && populatedSolutionComment.user.profile.lastName ? `${populatedSolutionComment.user.profile.firstName} ${populatedSolutionComment.user.profile.lastName}` : populatedSolutionComment.user.profile.username;
        
        // Get the solution to find its creator
        const solution = await ChallengeSolution.findById(req.params.solutionId)
          .populate({
            path: 'user_id',
            model: 'User',
            select: 'profile',
            populate: {
              path: 'profile',
              model: 'UserProfile',
              select: 'firstName lastName username'
            }
          });

        if (!solution) {
          res.status(404).json({ message: "Solution not found" });
          return;
        }

        const solutionCreatorName = (solution.user_id as any).profile.firstName && (solution.user_id as any).profile.lastName 
          ? `${(solution.user_id as any).profile.firstName} ${(solution.user_id as any).profile.lastName}`
          : (solution.user_id as any).profile.username;

        // Get all unique users who have commented on this solution
        const previousComments = await SolutionComment.find({
          solution_id: req.params.solutionId,
          user: { $ne: req.user.id } // Exclude current user
        }).select('user').lean();

        // Create a Set of all users to notify (previous commenters + solution creator)
        const usersToNotify = new Set([...previousComments].map(comment => comment.user.toString()));
        
        // Add solution creator if they're not the one commenting
        if (solution.user_id.toString() !== req.user.id) {
          usersToNotify.add(solution.user_id.toString());
        }

        // Create notifications for all users to notify
        for (const userId of usersToNotify) {
          console.log("Processing userId:", userId);
          console.log("userId type:", typeof userId);
          console.log("userId length:", userId.length);

          // Validate that userId is a valid 24-character hex string
          if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
            console.error("Invalid userId format:", userId);
            continue;
          }

          const message = userId === (solution.user_id as any)._id.toString()
            ? `${username} has commented on your solution for the challenge: "${challengeExists[0].challenge_name}".`
            : `${username} has also commented on ${solutionCreatorName}'s solution for the challenge: "${challengeExists[0].challenge_name}".`;

          try {
            const notification = await Notification.create({
              user: new Types.ObjectId(userId),
              message,
              reference: challenge_id,
              referenceModel: "SolutionComment",
            });
          
            const io = req.app.locals.io;
            io.to(userId).emit("pushNotification", notification);
            console.log("Notification emitted to user's room " + userId, notification);
          } catch (error) {
            console.error("Error creating notification for userId:", userId, error);
          }
        }

        res.status(201).json({ message: "successful", data: solutionComment });
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Update Solution comment
//@route PUT /api/challenges/:id/solutions/:solutionId/comments/:commentId
//access private
export const updateSolutionComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challengeExists[0].team_id,
      });

      if (!teamMembers) {
        res.status(404);
        throw new Error("No team members");
      }

      const teamMemberExists: any = teamMembers.find((member) => {
        return member.user_id.toString() === req.user.id;
      });

      if (!teamMemberExists) {
        res.status(403).json({ message: "User does not belong to the team" });
      } else {
        const { comment } = req.body;

        if (!comment.trim()) {
          res.status(400).json({ message: "Put a comment will ya" });
          return;
        }

        const solutionComment = await SolutionComment.find({
          _id: req.params.commentId,
        });

        if (solutionComment[0]?.user.toString() !== req.user.id) {
          res.status(403).json({ error: "This is not your comment" });
          return;
        }

        const updatedComment = await SolutionComment.findByIdAndUpdate(
          req.params.commentId,
          {
            comment: comment,
          },
          { new: true }
        );

        res.status(200).json({ message: "successful", data: updatedComment });
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution comments
//@route GET /api/challenges/:id/solutions/:solutionId/comments
//access private
export const getSolutionComments = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const solutionComments = await SolutionComment.find({solution_id: req.params.solutionId}).populate({
        path: 'user',
        select: '_id',
        populate: {
          path: 'profile',
          select: 'firstName lastName username profile_picture',
          transform: (doc) => {
            if (doc.profile_picture) {
              doc.profile_picture = `${process.env.S3_BUCKET_PREFIX}${doc.profile_picture}`;
            }
            return doc;
          }
        }
      });

      res.status(200).json({ message: "successful", data: solutionComments });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution comment
//@route GET /api/challenges/:id/solutions/:solutionId/comments/:commentId
//access private
export const getSolutionComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const solutionComment = await SolutionComment.findOne({
        _id: req.params.commentId,
        solution_id: req.params.solutionId
      }).populate({
        path: 'user',
        select: '_id',
        populate: {
          path: 'profile',
          select: 'firstName lastName username profile_picture',
          transform: (doc) => {
            if (doc.profile_picture) {
              doc.profile_picture = `${process.env.S3_BUCKET_PREFIX}${doc.profile_picture}`;
            }
            return doc;
          }
        }
      });

      if (!solutionComment) {
        res.status(404).json({ message: "Comment not found" });
        return;
      }

      res.status(200).json({ message: "successful", data: solutionComment });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Delete Solution comment
//@route DELETE /api/challenges/:id/solutions/:solutionId/comments/:commentId
//access private
export const deleteSolutionComment = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const solutionComment = await SolutionComment.findOne({
        _id: req.params.commentId,
      });

      if (!solutionComment) {
        res.status(404).json({ message: "Comment does not exist" });
        return;
      }

      if (solutionComment.user.toString() !== req.user.id) {
        res.status(403).json({ error: "This is not your comment" });
        return;
      }

      await SolutionComment.findByIdAndDelete(req.params.commentId);

      res.status(204).json({ message: "successful" });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Post Solution rating
//@route POST /api/challenges/:id/solutions/:solutionId/rating
//access private
export const postSolutionRating = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { rating, feedback } = req.body;

      const challenge_id = req.params.id;
      const challenge: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });
      const solution = await ChallengeSolution.findById({
        _id: req.params.solutionId,
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      if (!solution) {
        res.status(404).json({ message: "Solution does not exist" });
        return;
      }

      const teamMembers = await TeamMember.find({
        team_id: challenge.team_id,
      });

      const belongsToTeam = teamMembers.find(
        (user) => user.user_id.toString() === req.user.id
      );

      if (challenge.owner_id.toString() !== req.user.id && !belongsToTeam) {
        res.status(403).json({ message: "User does not belong to the team" });
        return;
      }

      if (!rating) {
        res.status(400).json({ message: "No rating" });
        return;
      }
      if (parseInt(rating) > 5 || parseInt(rating) < 0) {
        res.status(400).json({ message: "Rating should be between 0 and 5" });
        return;
      }
      const ratingExists = await SolutionRating.find({
        user_id: req.user.id,
      });

      if (ratingExists.length) {
        res.status(409).json({ message: "Rating already exists" });
        return;
      }

      const response = await SolutionRating.create({
        challenge_id: challenge._id,
        solution_id: req.params.solutionId,
        rating: parseInt(rating),
        feedback: feedback ? feedback.trim() : null,
        user_id: req.user.id,
      });

      if (challenge.owner_id.toString() === req.user.id) {
        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            owner_rating: response.rating,
          },
          {
            new: true,
          }
        );
      } else {
        const solutionRatings = await SolutionRating.find({
          solution_id: req.params.solutionId,
        });

        const averageRating =
          solutionRatings.reduce((total, next) => total + next.rating, 0) /
          solutionRatings.length;

        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            overall_rating: averageRating,
          },
          {
            new: true,
          }
        );
      }
      res.status(201).json({ message: "successful", data: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution ratings
//@route GET /api/challenges/:id/solutions/:solutionId/rating
//access private
export const getSolutionRatings = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challenge: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });
      const solution = await ChallengeSolution.findById({
        _id: req.params.solutionId,
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      if (!solution) {
        res.status(404).json({ message: "Solution does not exist" });
        return;
      }

      const response = await SolutionRating.find({
        solution_id: req.params.solutionId,
      });

      res.status(200).json({ message: "successful", data: response });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution ratings
//@route GET /api/challenges/:id/solutions/:solutionId/rating/:ratingId
//access private
export const getSolutionRating = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challenge: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });
      const solution = await ChallengeSolution.findById({
        _id: req.params.solutionId,
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      if (!solution) {
        res.status(404).json({ message: "Solution does not exist" });
        return;
      }

      const response = await SolutionRating.findById(req.params.ratingId);

      res.status(200).json({ message: "successful", data: response });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);



//@desc Update Solution rating
//@route GET /api/challenges/:id/solutions/:solutionId/rating/:ratingId
//access private
export const updateSolutionRating = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const { rating, feedback } = req.body;
      const challenge_id = req.params.id;
      const challenge: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });
      const solution = await ChallengeSolution.findById({
        _id: req.params.solutionId,
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      if (!solution) {
        res.status(404).json({ message: "Solution does not exist" });
        return;
      }

      const userRating = await SolutionRating.findById(req.params.ratingId);

      if (!userRating) {
        res.status(404).json({ message: "Rating does not exist" });
        return;
      }
      if (req.user.id !== userRating?.user_id.toString()) {
        res
          .status(403)
          .json({ message: "Cannot update since this is not your rating." });
        return;
      }

      if (parseInt(rating) > 5 || parseInt(rating) < 0) {
        res.status(400).json({ message: "Rating should be between 0 and 5" });
        return;
      }

      const response = await SolutionRating.findByIdAndUpdate(
        req.params.ratingId,
        {
          rating: rating,
          feedback: feedback ? feedback.trim() : null,
        },
        { new: true }
      );

      if (challenge.owner_id.toString() === req.user.id) {
        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            owner_rating: rating,
          },
          {
            new: true,
          }
        );
      } else {
        const solutionRatings = await SolutionRating.find({
          solution_id: req.params.solutionId,
        });

        const averageRating =
          solutionRatings.reduce((total, next) => total + next.rating, 0) /
          solutionRatings.length;

        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            overall_rating: averageRating,
          },
          {
            new: true,
          }
        );
      }

      res.status(200).json({ message: "successful", data: response });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Delete Solution rating
//@route GET /api/challenges/:id/solutions/:solutionId/rating/:ratingId
//access private
export const deleteSolutionRating = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const challenge_id = req.params.id;
      const challenge: any = await TeamChallenge.findOne({
        _id: challenge_id,
      });
      const solution = await ChallengeSolution.findById({
        _id: req.params.solutionId,
      });

      if (!challenge) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      if (!solution) {
        res.status(404).json({ message: "Solution does not exist" });
        return;
      }

      const userRating = await SolutionRating.findById(req.params.ratingId);

      if (!userRating) {
        res.status(404).json({ message: "Rating does not exist" });
        return;
      }
      if (req.user.id !== userRating?.user_id.toString()) {
        res
          .status(403)
          .json({ message: "Cannot delete since this is not your rating." });
        return;
      }

      const response = await SolutionRating.findByIdAndDelete(
        req.params.ratingId
      );

      if (challenge.owner_id.toString() === req.user.id) {
        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            owner_rating: 0,
          },
          {
            new: true,
          }
        );
      } else {
        const solutionRatings = await SolutionRating.find({
          solution_id: req.params.solutionId,
        });

        let averageRating = 0;
        if (solutionRatings.length) {
          averageRating =
            solutionRatings.reduce((total, next) => total + next.rating, 0) /
            solutionRatings.length;
        }

        await ChallengeSolution.findByIdAndUpdate(
          req.params.solutionId,
          {
            overall_rating: averageRating,
          },
          {
            new: true,
          }
        );
      }

      res.status(204).json({ message: "successful" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);
