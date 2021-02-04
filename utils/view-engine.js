async function engine(filePath, options, callback) {
  try {
    const { default: template } = await import(filePath);
    const html = template(options).toString();
    callback(null, html);
  } catch (error) {
    callback(error);
  }
}

export function register(app) {
  app.engine("js", engine);
  app.set("view engine", "js");
}
