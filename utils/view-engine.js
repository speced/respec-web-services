async function engine(filePath, options, callback) {
  try {
    if (!options.cache) {
      delete require.cache[require.resolve(filePath)];
    }
    const template = require(filePath);
    const html = template(options).toString();
    callback(null, html);
  } catch (error) {
    callback(error);
  }
}

function register(app) {
  app.engine("js", engine);
  app.set("view engine", "js");
}

module.exports = { register };
