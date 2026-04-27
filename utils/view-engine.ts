import { Application } from "express";

type EngineCallback = Parameters<Application["engine"]>[1];

const engine: EngineCallback = (filePath, options, callback) => {
  import(filePath).then(
    ({ default: template }) => callback(null, template(options).toString()),
    error =>
      callback(error instanceof Error ? error : new Error(String(error))),
  );
};

export function register(app: Application) {
  app.engine("js", engine);
  app.set("view engine", "js");
}
