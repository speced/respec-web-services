import { Application } from "express";

async function engine(
  filePath: string,
  options: Record<string, unknown>,
  callback: (err: Error | null, rendered?: string) => void,
) {
  try {
    const { default: template } = await import(filePath);
    const html: string = template(options).toString();
    callback(null, html);
  } catch (error) {
    callback(error);
  }
}

export function register(app: Application) {
  app.engine("js", engine);
  app.set("view engine", "js");
}
