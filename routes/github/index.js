const express = require("express");
const cors = require("cors");

const gh = express.Router({ mergeParams: true });

gh.options("/contributors", cors({ methods: ["GET"] }));
gh.get("/contributors", cors(), require("./contributors").route);

gh.options("/issues", cors({ methods: ["GET"] }));
gh.get("/issues", cors(), require("./issues").route);

gh.options("/commits", cors({ methods: ["GET"] }));
gh.get("/commits", cors(), require("./commits").route);

module.exports = {
  routes: gh,
};
