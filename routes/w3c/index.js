const express = require("express");
const cors = require("cors");

const w3c = express.Router();

w3c.options("/groups/:shortname?/:type?", cors({ methods: ["GET"] }));
w3c.get("/groups/:shortname?/:type?", cors(), require("./group").route);

module.exports = {
  routes: w3c,
};
