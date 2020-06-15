/**
 * Get env variable value
 * @param {string} name name of env variable
 * @throws if env variable is not set
 */
function env(name) {
  const value = process.env[name];
  if (value) return value;
  throw `env variable \`${name}\` is not set.`;
}

module.exports = {
  env,
};
