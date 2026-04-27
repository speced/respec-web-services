import { Application } from "express";

type EngineCallback = Parameters<Application["engine"]>[1];

const engine: EngineCallback = (
  filePath: string,
  options: object,
  callback: (err: Error | null, rendered?: string) => void,
) => {
  import(filePath).then(
    ({ default: template }) => {
      callback(null, (template(options) as { toString(): string }).toString());
    },
    error => {
      callback(error instanceof Error ? error : new Error(String(error)));
    },
  );
};

export function register(app: Application) {
  app.engine("js", engine);
  app.set("view engine", "js");
}
