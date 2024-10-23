import express, { Express, Request, Response } from "express";
import userRouter from "./routes/userRoutes";

import { errorHandler } from "./middleware/errorHandler";
import connectDb from "./config/dbConnection";
import swaggerDocs from "./swagger";

import passport from "passport";
import dotenv from "dotenv";
const cookieSession = require("cookie-session");
require("./config/passport-setup");
import userProfileRouter from "./routes/userProfileRoutes";
import teamRouter from "./routes/team/teamRoutes";
import teamMemberRouter from "./routes/team/teamMemberRoutes";
import teamChallengeRouter from "./routes/team/teamChallengeRoutes";
import challengeRouter from "./routes/challenges/challengeRoutes";
import chatRouter from "./routes/chatRoutes";
import messageRouter from "./routes/messageRoutes";
import adviceRouter from "./routes/adviceRoutes";

const cors = require('cors')
dotenv.config();

connectDb();
const app: Express = express();
const session = require("express-session");

const port = process.env.PORT || 5001;

app.use(cors())
app.use(express.json());
// //Setting up cookies
// app.use(
//   cookieSession({
//     name: "tuto-session",
//     keys: ["key1", "key2"],
//   })
// );

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);
//Passport Initialized
app.use(passport.initialize());
//Setting Up Session
app.use(passport.session());
app.use("/api/users", [userRouter, userProfileRouter]);
app.use("/api/teams", [teamRouter, teamChallengeRouter]);
app.use("/api/team-member", teamMemberRouter);
app.use("/api/challenges", challengeRouter);
app.use("/api/chats", chatRouter);
app.use("/api/messages", messageRouter);
app.use("/api/advice", adviceRouter)
app.use(errorHandler);
app.disable("x-powered-by"); // less hackers know about our stack

app.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL}` }),
  (req, res) => {
    // Redirect to dashboard on successful registration
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

swaggerDocs(app, port);

export default app;
