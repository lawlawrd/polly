export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (req.originalUrl.startsWith("/api")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || "/")}`);
};

export const redirectIfAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.redirect("/");
    return;
  }

  next();
};

export default {
  ensureAuthenticated,
  redirectIfAuthenticated,
};
