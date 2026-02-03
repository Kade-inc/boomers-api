import asyncHandler from "express-async-handler";
import { CustomRequest } from "../middleware/validateTokenHandler";
import { Response } from "express";
import ChallengeSolution from "../models/challengeSolutionModel";
import ChallengeStep from "../models/challengeStepModel";
import TeamChallenge from "../models/teamChallengeModel";
import TeamMember from "../models/teamMemberModel";
import UserProfile from "../models/userProfileModel";
import SolutionComment from "../models/solutionCommentModel";
import ChallengeStepComment from "../models/challengeStepCommentModel";
import Notification from "../models/notificationModel";
import { Types } from "mongoose";
import sseNotificationService from "../services/sseService";

interface PopulatedStepComment {
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

//@desc POST Step
//@route POST /api/challenges/:id/solutions/:solutionId/steps
//access private
export const addChallengeStep = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;
      const solution = await ChallengeSolution.findById({ _id: solutionId });

      if (req.user.id !== solution?.user_id.toString()) {
        res.status(403).json({ error: "Solution does not belong to you" });
      } else {
        const { description } = req.body;

        if (!description.trim()) {
          res.status(400).json({ error: "Please put a valid description" });
        } else {
          const challengeStep = await ChallengeStep.create({
            solution_id: solutionId,
            user_id: req.user.id,
            description: description,
            challenge_id: req.params.id,
          });

          const challengeSolution = await ChallengeSolution.findById({
            _id: solutionId,
          });

          // Initialize steps array if it doesn't exist
          const initialSteps = challengeSolution?.steps || [];
          initialSteps.push(challengeStep);

          const completedSteps: any = [];
          initialSteps.map((step: any) => {
            if (step.completed) completedSteps.push(step);
          });

          const percentageCompleted = Math.round(
            (completedSteps.length / initialSteps.length) * 100
          );

          await ChallengeSolution.findByIdAndUpdate(
            solutionId,
            {
              steps: initialSteps,
              percentageCompleted: percentageCompleted,
            },
            { new: true }
          );

          res.status(201).json({ message: "successful", data: challengeStep });
        }
      }
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc GET Steps
//@route GET /api/challenges/:id/solutions/:solutionId/steps
//access private
export const getAllChallengeSteps = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;

      const steps = await ChallengeStep.find({ solution_id: solutionId });

      res.status(200).json({ message: "successful", data: steps });
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Update Step
//@route Update /api/challenges/:id/solutions/:solutionId/steps/:stepId
//access private
export const updateChallengeStep = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;
      const solution = await ChallengeSolution.findById({ _id: solutionId });

      if (req.user.id !== solution?.user_id.toString()) {
        res.status(403).json({ error: "Solution does not belong to you" });
      } else {
        const { description, completed } = req.body;

        if (description && !description.trim()) {
          res.status(400).json({ error: "Please put a valid description" });
        } else {
          let challengeSolution: any = await ChallengeSolution.findById({
            _id: solutionId,
          });

          const updatedChallengeStep: any =
            await ChallengeStep.findByIdAndUpdate(
              req.params.stepId,
              {
                description: description,
                completed: completed ? completed : false,
              },
              { new: true }
            );
          if (updatedChallengeStep) {
            const updatedChallengeSolutionSteps = challengeSolution?.steps.map(
              (step: any) => {
                if (
                  step._id.toString() === updatedChallengeStep._id.toString()
                ) {
                  step.description = description;
                  step.completed = completed ? completed : false;
                }
                return step;
              }
            );

            challengeSolution.steps = updatedChallengeSolutionSteps;
            const initialSteps = challengeSolution?.steps;

            const completedSteps: any = [];
            initialSteps.map((step: any) => {
              if (step.completed) completedSteps.push(step);
            });

            const percentageCompleted = Math.round(
              (completedSteps.length / initialSteps.length) * 100
            );

            await ChallengeSolution.findByIdAndUpdate(
              solutionId,
              {
                steps: initialSteps,
                percentageCompleted: percentageCompleted,
              },
              { new: true }
            );

            res
              .status(200)
              .json({ message: "successful", data: updatedChallengeStep });
          }
        }
      }
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc GET Step
//@route GET /api/challenges/:id/solutions/:solutionId/steps/:stepId
//access private
export const getChallengeStep = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const stepId = req.params.stepId;

      const step = await ChallengeStep.findById({ _id: stepId });

      res.status(200).json({ message: "successful", data: step });
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Delete Step
//@route DELETE /api/challenges/:id/solutions/:solutionId/steps/:stepId
//access private
export const deleteChallengeStep = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      const solutionId = req.params.solutionId;
      const challenge = await TeamChallenge.findById({
        _id: req.params.id,
      });

      let challengeSolution = await ChallengeSolution.findById({
        _id: solutionId,
      });

      if (!challengeSolution || !challenge) {
        res.status(404).json({ error: "Solution does not exist" });
        return;
      }
      if (req.user.id !== challengeSolution?.user_id.toString()) {
        res.status(403).json({ error: "Solution does not belong to you" });
      } else {
        const deletedStep = await ChallengeStep.findByIdAndDelete(
          req.params.stepId
        );

        if (!deletedStep) {
          res.status(400).json({ error: "Step does not exist" });
          return;
        }
        const updatedChallengeSolutionSteps = challengeSolution?.steps.filter(
          (step: any) => step._id.toString() !== req.params.stepId
        );

        challengeSolution.steps = updatedChallengeSolutionSteps;
        const initialSteps = challengeSolution?.steps;

        const completedSteps: any = [];
        initialSteps.map((step: any) => {
          if (step.completed) completedSteps.push(step);
        });

        const percentageCompleted = Math.round(
          (completedSteps.length / initialSteps.length) * 100
        );

        await ChallengeSolution.findByIdAndUpdate(
          solutionId,
          {
            steps: initialSteps,
            percentageCompleted: percentageCompleted,
          },
          { new: true }
        );

        res.status(204).json({ message: "successful" });
      }
    } catch (error: any) {
      console.log("ERRROR: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Post Solution Step comment
//@route POST /api/challenges/:id/solutions/:solutionId/steps/:stepId/comments
//access private
export const postSolutionStepComment = asyncHandler(
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

        const solutionStepComment = await ChallengeStepComment.create({
          step_id: req.params.stepId,
          comment,
          user: req.user.id
        });

        // Get the populated comment with user info
        const populatedStepComment = await solutionStepComment.populate({
          path: 'user',
          model: 'User',
          select: 'profile _id',
          populate: {
            path: 'profile',
            model: 'UserProfile',
            select: 'firstName lastName username',
          }
        }) as PopulatedStepComment;

        const username = populatedStepComment.user.profile.firstName && populatedStepComment.user.profile.lastName
          ? `${populatedStepComment.user.profile.firstName} ${populatedStepComment.user.profile.lastName}`
          : populatedStepComment.user.profile.username;

        // Get the step to find its solution
        const step = await ChallengeStep.findById(req.params.stepId)
          .populate({
            path: 'solution_id',
            model: 'ChallengeSolution',
            select: 'user_id',
            populate: {
              path: 'user_id',
              model: 'User',
              select: 'profile',
              populate: {
                path: 'profile',
                model: 'UserProfile',
                select: 'firstName lastName username'
              }
            }
          });

        if (!step) {
          res.status(404).json({ message: "Step not found" });
          return;
        }

        const solutionCreatorName = (step.solution_id as any).user_id.profile.firstName && (step.solution_id as any).user_id.profile.lastName
          ? `${(step.solution_id as any).user_id.profile.firstName} ${(step.solution_id as any).user_id.profile.lastName}`
          : (step.solution_id as any).user_id.profile.username;

        // Get all unique users who have commented on this step
        const previousComments = await ChallengeStepComment.find({
          step_id: req.params.stepId,
          user: { $ne: req.user.id } // Exclude current user
        }).select('user').lean();

        // Create a Set of all users to notify (previous commenters + solution creator)
        const usersToNotify = new Set([...previousComments].map(comment => comment.user.toString()));

        // Add solution creator if they're not the one commenting
        if ((step.solution_id as any).user_id._id.toString() !== req.user.id) {
          usersToNotify.add((step.solution_id as any).user_id._id.toString());
        }

        // Create notifications for all users to notify
        for (const userId of usersToNotify) {
          // Validate that userId is a valid 24-character hex string
          if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
            console.error("Invalid userId format:", userId);
            continue;
          }

          const message = userId === (step.solution_id as any).user_id._id.toString()
            ? `${username} has commented on your solution step for the challenge: "${challengeExists[0].challenge_name}".`
            : `${username} has also commented on ${solutionCreatorName}'s solution step for the challenge: "${challengeExists[0].challenge_name}".`;

          try {
            const notification = await Notification.create({
              user: new Types.ObjectId(userId),
              message,
              reference: challenge_id,
              referenceModel: "TeamChallenge",
              subreference: step.solution_id,
              subreferenceModel: "ChallengeStep",
            });

            // Send notification via SSE
            sseNotificationService.sendNotification(userId, notification);
            console.log("Notification sent via SSE to user " + userId, notification);
          } catch (error) {
            console.error("Error creating notification for userId:", userId, error);
          }
        }

        res.status(201).json({ message: "successful", data: solutionStepComment });
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Update Solution Step comment
//@route PUT /api/challenges/:id/solutions/:solutionId/steps/:stepId/comments/:commentId
//access private
export const updateSolutionStepComment = asyncHandler(
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

        const solutionStepComment = await ChallengeStepComment.findOne({
          _id: req.params.commentId,
          step_id: req.params.stepId
        });

        if (!solutionStepComment) {
          res.status(404).json({ message: "Comment not found" });
          return;
        }

        if (solutionStepComment.user.toString() !== req.user.id) {
          res.status(403).json({ error: "This is not your comment" });
          return;
        }

        const updatedComment = await ChallengeStepComment.findByIdAndUpdate(
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

//@desc Get Solution Step comments
//@route GET /api/challenges/:id/solutions/:solutionId/steps/:stepId/comments
//access private
export const getSolutionStepComments = asyncHandler(
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("CALLING")
      const challenge_id = req.params.id;
      const challengeExists: any = await TeamChallenge.find({
        _id: challenge_id,
      });

      if (!challengeExists.length) {
        res.status(404).json({ message: "Challenge does not exist" });
        return;
      }

      const solutionStepComments = await ChallengeStepComment.find({
        step_id: req.params.stepId
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

      res.status(200).json({ message: "successful", data: solutionStepComments });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Get Solution Step comment
//@route GET /api/challenges/:id/solutions/:solutionId/steps/:stepId/comments/:commentId
//access private
export const getSolutionStepComment = asyncHandler(
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

      const solutionStepComment = await ChallengeStepComment.findOne({
        _id: req.params.commentId,
        step_id: req.params.stepId
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

      if (!solutionStepComment) {
        res.status(404).json({ message: "Comment not found" });
        return;
      }

      res.status(200).json({ message: "successful", data: solutionStepComment });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

//@desc Delete Solution Step comment
//@route DELETE /api/challenges/:id/solutions/:solutionId/steps/:stepId/comments/:commentId
//access private
export const deleteSolutionStepComment = asyncHandler(
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

      const solutionStepComment = await ChallengeStepComment.findOne({
        _id: req.params.commentId,
        step_id: req.params.stepId
      });

      if (!solutionStepComment) {
        res.status(404).json({ message: "Comment does not exist" });
        return;
      }

      if (solutionStepComment.user.toString() !== req.user.id) {
        res.status(403).json({ error: "This is not your comment" });
        return;
      }

      await ChallengeStepComment.findByIdAndDelete(req.params.commentId);

      res.status(204).json({ message: "successful" });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);