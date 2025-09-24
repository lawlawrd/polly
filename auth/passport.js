import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import {
  findUserByEmail,
  findUserById,
  verifyPassword,
} from "../services/userService.js";

const localStrategy = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
  },
  async (email, password, done) => {
    try {
      const user = findUserByEmail(email);

      if (!user) {
        return done(null, false, {
          message: "Invalid email or password.",
        });
      }

      const isValid = await verifyPassword(user, password);
      if (!isValid) {
        return done(null, false, {
          message: "Invalid email or password.",
        });
      }

      return done(null, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      return done(error);
    }
  },
);

passport.use(localStrategy);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const user = findUserById(id);
    if (!user) {
      done(null, false);
      return;
    }

    done(null, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    done(error);
  }
});

export default passport;
