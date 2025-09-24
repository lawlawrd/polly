import { Router } from "express";
import passport from "../auth/passport.js";
import {
  createUser,
  findUserByEmail,
} from "../services/userService.js";
import {
  ensureAuthenticated,
  redirectIfAuthenticated,
} from "../auth/middleware.js";

export const createAuthRouter = () => {
  const router = Router();

  const resolveNextUrl = (value) => {
    if (typeof value !== "string") return "/";
    if (!value.startsWith("/")) {
      return "/";
    }

    return value;
  };

  router.get("/login", redirectIfAuthenticated, (req, res) => {
    const nextUrl = resolveNextUrl(req.query.next);
    res.render("auth/login", {
      next: nextUrl,
      error: null,
      email: "",
    });
  });

  router.post("/login", (req, res, next) => {
    const nextUrl = resolveNextUrl(req.body.next);

    passport.authenticate("local", (error, user, info) => {
      if (error) {
        return next(error);
      }

      if (!user) {
        res.status(400).render("auth/login", {
          next: nextUrl,
          error: info?.message ?? "Unable to log in.",
          email: req.body.email ?? "",
        });
        return;
      }

      req.logIn(user, (loginError) => {
        if (loginError) {
          return next(loginError);
        }

        res.redirect(nextUrl || "/");
      });
    })(req, res, next);
  });

  router.get("/register", redirectIfAuthenticated, (req, res) => {
    res.render("auth/register", {
      error: null,
      form: {
        email: "",
        firstName: "",
        lastName: "",
      },
    });
  });

  router.post("/register", async (req, res, next) => {
    const { email, firstName, lastName, password, confirmPassword } = req.body ?? {};

    const form = {
      email: email ?? "",
      firstName: firstName ?? "",
      lastName: lastName ?? "",
    };

    const errors = [];

    if (!email || typeof email !== "string") {
      errors.push("Email is required.");
    }

    if (!firstName || typeof firstName !== "string") {
      errors.push("First name is required.");
    }

    if (!lastName || typeof lastName !== "string") {
      errors.push("Last name is required.");
    }

    if (!password || typeof password !== "string") {
      errors.push("Password is required.");
    } else if (password.length < 5) {
      errors.push("Password must be at least 5 characters long.");
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }

    try {
      if (!errors.length && findUserByEmail(email)) {
        errors.push("An account with that email already exists.");
      }

      if (errors.length) {
        res.status(400).render("auth/register", {
          error: errors.join(" "),
          form,
        });
        return;
      }

      const userRecord = await createUser({
        email,
        firstName,
        lastName,
        password,
      });

      req.logIn(
        {
          id: userRecord.id,
          email: userRecord.email,
          firstName: userRecord.firstName,
          lastName: userRecord.lastName,
        },
        (loginError) => {
          if (loginError) {
            next(loginError);
            return;
          }

          res.redirect("/");
        },
      );
    } catch (error) {
      if (error?.code === "USER_EXISTS") {
        res.status(400).render("auth/register", {
          error: "An account with that email already exists.",
          form,
        });
        return;
      }

      next(error);
    }
  });

  router.get("/logout", ensureAuthenticated, (req, res, next) => {
    req.logout((error) => {
      if (error) {
        next(error);
        return;
      }
      res.redirect("/login");
    });
  });

  return router;
};

export default createAuthRouter;
