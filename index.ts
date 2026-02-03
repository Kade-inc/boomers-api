import express, { Express } from "express";
import http from "http"; // Import Node.js HTTP module
import { Server } from "socket.io"; // Import Socket.IO

import { errorHandler } from "./middleware/errorHandler";
import connectDb from "./config/dbConnection";
import swaggerDocs from "./swagger";

import dotenv from "dotenv";

// Import email worker to start processing email jobs
import "./workers/emailWorker";
// Import user deletion worker to start processing deletion jobs
import "./workers/userDeletionWorker";

import userRouter from "./routes/userRoutes";
import userProfileRouter from "./routes/userProfileRoutes";
import teamRouter from "./routes/team/teamRoutes";
import teamMemberRouter from "./routes/team/teamMemberRoutes";
import teamChallengeRouter from "./routes/team/teamChallengeRoutes";
import challengeRouter from "./routes/challenges/challengeRoutes";
import chatRouter from "./routes/chatRoutes";
import messageRouter from "./routes/messageRoutes";
import adviceRouter from "./routes/adviceRoutes";
import domainRouter from "./routes/domainRoutes";
import requestsRouter from "./routes/requestsRoutes";
import notificationRouter from "./routes/notificationRoutes";
import searchRouter from "./routes/searchRoutes";
import recommendationsRouter from "./routes/recommendationsRoute";
import shortUrlRouter, { shortUrlResolveRouter } from "./routes/shortUrlRoutes";
const cors = require('cors')
dotenv.config();

connectDb();
const app: Express = express();
const session = require("express-session");

const port = process.env.PORT || 5001;

app.use(cors())
app.use(express.json());



app.use("/api/users", [userRouter, userProfileRouter]);
// app.use("/api/teams", [teamRouter, teamChallengeRouter]);
app.use("/api/teams/:teamId/challenges", teamChallengeRouter);
app.use("/api/teams", teamRouter);
app.use("/api/team-member", teamMemberRouter);
app.use("/api/challenges", challengeRouter);
app.use("/api/chats", chatRouter);
app.use("/api/messages", messageRouter);
app.use("/api/advice", adviceRouter)
app.use("/api/domains", domainRouter)
app.use("/api/user-requests", requestsRouter)
app.use("/api/notifications", notificationRouter)
app.use("/api/search", searchRouter)
app.use("/api/recommendations", recommendationsRouter)
app.use("/api/short-urls", shortUrlRouter)
app.use("/s", shortUrlResolveRouter)  // Short URL redirect endpoint
app.use(errorHandler);
app.disable("x-powered-by"); // less hackers know about our stack

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
export const io = new Server(server, {
  cors: {
    origin: `http://localhost:5173`,
    methods: ["GET", "POST", "PATCH"],
  },
});

// Optional: Store the io instance in app.locals so it can be accessed in your controllers or routes
app.locals.io = io;

// Set up Socket.IO connection events

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });

  // Chat-specific events only (notifications now use SSE)
  socket.on("joinChat", ({ chatId }) => {
    socket.join(`chat_${chatId}`);
    console.log(`Socket ${socket.id} joined chat room ${chatId}`);
  });

  socket.on("leaveChat", ({ chatId }) => {
    socket.leave(`chat_${chatId}`);
    console.log(`Socket ${socket.id} left chat room ${chatId}`);
  });

  socket.on("typing", ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit("userTyping", { userId });
  });

  socket.on("stopTyping", ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit("userStoppedTyping", { userId });
  });
});


server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);

});

// server.listen(
//   {
//     port: Number(port),
//   },
//   () => {
//     console.log(`Server running on http://0.0.0.0:${port}`);
//   }
// );


swaggerDocs(app, port);

export default app;
