// @ts-check
import { createHmac } from "crypto";

/**
 * Middleware to ensure the GitHub webhook request is authentic.
 * @param {string} secret
 */
export default function githubWebhookAuthenticator(secret) {
  return (req, res, next) => {
    if (isValidGithubSignature(req, secret)) {
      if (req.body.zen /** is ping event */) {
        return res.send("pong");
      }
      return next();
    }
    const msg = "Failed to authenticate GitHub hook Signature";
    res.status(401).send(msg);
  };
}

/**
 * See: https://developer.github.com/webhooks/securing/
 * @param {string} secret
 */
function isValidGithubSignature(req, secret) {
  const hash = createHmac("sha1", secret).update(req.rawBody).digest("hex");
  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}
