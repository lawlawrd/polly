import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import passport from "./auth/passport.js";
import { createAuthRouter } from "./routes/auth.js";
import { navigation } from "./utils/miscUtils.js";
import { createPagesRouter } from "./routes/pages.js";
import { createAnonymizeRouter } from "./routes/anonymize.js";
import { ensureAuthenticated } from "./auth/middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 8081;
const DEFAULT_THEME =
  (process.env.POLLY_THEME || "light") === "dark" ? "dark" : "light";
const SUPPORTED_THEMES = new Set(["light", "dark"]);
const SESSION_SECRET = process.env.SESSION_SECRET || "polly-dev-secret";
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "5mb";

const PRESIDIO_ANALYZER_URL =
  process.env.PRESIDIO_ANALYZER_URL || "http://localhost:5002";
const PRESIDIO_ANONYMIZER_URL =
  process.env.PRESIDIO_ANONYMIZER_URL || "http://localhost:5001";

const SQLiteStore = connectSqlite3(session);

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: dataDirectory,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const sessionTheme =
    typeof req.session?.theme === "string" &&
    SUPPORTED_THEMES.has(req.session.theme)
      ? req.session.theme
      : DEFAULT_THEME;

  if (req.session) {
    req.session.theme = sessionTheme;
  }

  res.locals.currentUser = req.user ?? null;
  res.locals.theme = sessionTheme;
  res.locals.navigation = navigation;
  next();
});

app.get("/theme-switch", ensureAuthenticated, (req, res) => {
  const requestedTheme =
    typeof req.query?.theme === "string" ? req.query.theme.toLowerCase() : "";

  if (SUPPORTED_THEMES.has(requestedTheme) && req.session) {
    req.session.theme = requestedTheme;
    res.locals.theme = requestedTheme;
  }

  let redirectTarget = "/";

  if (
    typeof req.query?.redirect === "string" &&
    req.query.redirect.startsWith("/")
  ) {
    redirectTarget = req.query.redirect;
  } else {
    const referer = req.get("referer");
    if (typeof referer === "string" && referer.startsWith("http")) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.pathname?.startsWith("/")) {
          redirectTarget = refererUrl.pathname;
        }
      } catch (error) {
        console.warn(
          "Failed to parse referer for theme switch redirect:",
          error,
        );
      }
    }
  }

  res.redirect(redirectTarget);
});

app.use("/", createAuthRouter());

app.use(
  "/",
  createPagesRouter({
    navigation,
  }),
);

app.use(
  "/api",
  createAnonymizeRouter({
    analyzerUrl: PRESIDIO_ANALYZER_URL,
    anonymizerUrl: PRESIDIO_ANONYMIZER_URL,
  }),
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
