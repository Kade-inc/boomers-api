import User from "../models/userModel";
import UserProfile from "../models/userProfileModel";

const passport = require("passport");

require("dotenv").config();

const GoogleStrategy = require("passport-google-oauth2").Strategy;
const facebookStrategy = require("passport-facebook").Strategy;
// const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
// const TwitterStrategy = require("passport-twitter").Strategy;

// used to serialize the user for the session
passport.serializeUser(function (user: any, done: any) {
  done(null, user);
});

// used to deserialize the user
passport.deserializeUser(function (user: any, done: any) {
  done(null, user);
});

//Google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `http://localhost:${process.env.PORT}/google/callback`,
      passReqToCallback: true,
    },
    async (
      request: any,
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: any
    ) => {
      console.log(profile);
      const email = profile.email;
      const userAvailable = await User.findOne({
        email,
      });
      if (!userAvailable) {
        const user = await User.create({
          email,
          username: profile.displayName.replace(/\s/g, ""),
          isVerified: true,
        });

        await UserProfile.create({
          email,
          user_id: user?.id,
          username: profile.displayName.replace(/\s/g, ""),
          profile_picture: profile.picture,
        });
      } else {
        console.log("USER EXISTS");
      }

      done(null, profile);
    }
  )
);

//Facebook strategy
passport.use(
  new facebookStrategy(
    {
      // pull in our app id and secret from our auth.js file
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_SECRET_ID,
      callbackURL: "http://localhost:3000/facebook/callback",
      profileFields: [
        "id",
        "displayName",
        "name",
        "gender",
        "picture.type(large)",
        "email",
      ],
    }, // facebook will send back the token and profile
    function (token: any, refreshToken: string, profile: any, done: any) {
      console.log(profile);
      return done(null, profile);
    }
  )
);

// //LinkedIn strategy
// passport.use(
//   new LinkedInStrategy(
//     {
//       clientID: process.env.LINKEDIN_CLIENT_ID,
//       clientSecret: process.env.LINKEDIN_SECRET_ID,
//       callbackURL: "http://localhost:3000/linkedin/callback",
//       scope: ["r_emailaddress", "r_liteprofile"],
//     },
//     function (token: any, tokenSecret: any, profile: any, done: any) {
//       return done(null, profile);
//     }
//   )
// );

//Twitter Strategy
// passport.use(
//   new TwitterStrategy(
//     {
//       clientID: process.env.TWITTER_CLIENT_ID,
//       clientSecret: process.env.TWITTER_SECRET_ID,
//       callbackURL: "http://localhost:3000/twitter/callback",
//     },
//     function (token: any, tokenSecret: any, profile: any, cb: any) {
//       console.log("call");
//       process.nextTick(function () {
//         console.log(profile);
//       });
//     }
//   )
// );
