import { Application } from "express";

async function engine(
  filePath: string,
  options: Record<string, unknown>,
  callback: (err: Error | null, rendered?: string) => void,
) {
  try {
    const { default: template } = await import(filePath);
    const rendered: string = template(options).toString();
    callback(null, rendered);
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}

export function register(app: Application) {
  app.engine("js", engine as Parameters<Application["engine"]>[1]);
  app.set("view engine", "js");
}
