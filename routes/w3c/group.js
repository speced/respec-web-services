// @ts-check
const { ms, seconds } = require("../../utils/misc.js");
const { update, file } = require("../../scripts/update-w3c-data.js").groups;

/** @type {Record<string, any>} */
let groups = require(file);
setInterval(updateGroupData, ms("3 days"));

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = function route(req, res) {
  const { groupName } = req.params;
  if (!groupName) {
    return res.json(groups);
  }

  try {
    const groupInfo = groups.hasOwnProperty(groupName) && groups[groupName];
    if (!groupInfo) {
      const message = `No group with groupName: ${groupName}`;
      throw { statusCode: 404, message };
    }
    res.set("Cache-Control", `max-age=${seconds("24h")}`);
    res.json(groupInfo);
  } catch (error) {
    const { statusCode, message } = error;
    res.set("Content-Type", "text/plain");
    res.status(statusCode).send(message);
  }
};

async function updateGroupData() {
  try {
    groups = await update({ verbose: true });
  } catch (error) {
    console.error(`Updating W3C groups failed: ${error.message}`);
  }
}
