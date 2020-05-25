// @ts-check
const express = require("express");
const bodyParser = require("body-parser");

const router = express.Router({ mergeParams: true });

router.get("/size", require("./size").route.get);
router.put(
  "/size",
  bodyParser.urlencoded({ extended: false, parameterLimit: 4, limit: "128b" }),
  require("./size").route.put,
);

module.exports = {
  routes: router,
};
