// @ts-check
const crypto = require("crypto");

/**
 * Middleware to ensure the GitHub webhook request is authentic.
 * @param {string} secret
 */
module.exports = function githubWebhookAuthenticator(secret) {
  return (req, res, next) => {
    if (isValidGithubSignature(req, secret)) {
      return next();
    }
    const msg = "Failed to authenticate GitHub hook Signature";
    res.status(401).send(msg);
  };
};

/**
 * See: https://developer.github.com/webhooks/securing/
 * @param {string} secret
 */
function isValidGithubSignature(req, secret) {
  const hash = crypto
    .createHmac("sha1", secret)
    .update(req.rawBody)
    .digest("hex");
  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}
