import { Router } from "express";

import { ensureAuthenticated } from "../auth/middleware.js";

export const createPagesRouter = ({ navigation }) => {
  const router = Router();

  router.use(ensureAuthenticated);

  router.get("/", (req, res) => {
    res.render("frontpage", {
      navigation,
      currentPath: req.originalUrl,
      activeNav: {
        path: "/",
        label: "Anonymizer",
        slug: "anonymizer",
      },
    });
  });

  // for (const nav of navigation) {
  //   const paramBase = nav.slug;
  //
  //   router.get(
  //     [
  //       nav.path,
  //       `${nav.path}/:${paramBase}Param1`,
  //       `${nav.path}/:${paramBase}Param1/:${paramBase}Param2`,
  //       `${nav.path}/:${paramBase}Param1/:${paramBase}Param2/:${paramBase}Param3`,
  //     ],
  //     (req, res) => {
  //       res.render("template", {
  //         navigation,
  //         currentPath: req.originalUrl,
  //         activeNav: nav,
  //       });
  //     },
  //   );
  // }

  return router;
};

export default createPagesRouter;
