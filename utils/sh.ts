import { exec, ExecOptions } from "child_process";
import split from "split2";

type Logger = (line?: string) => void;
interface Options extends ExecOptions {
  output: "buffer" | "stream" | "silent";
  log: { out: Logger; err: Logger };
}

const defaultLogger: Required<Options["log"]> = {
  out: line => console.log(line),
  err: line => console.log(line),
};

/**
 * Asynchronously run a shell command get its result.
 */
export default async function sh(
  command: string,
  options: Options["output"] | Partial<Options> = {},
) {
  const { output = "silent", log = defaultLogger, ...execOptions } =
    typeof options === "string" ? { output: options } : options;
  const shouldStream =
    output === "stream" || (typeof options !== "string" && !!options.log);

  if (output !== "silent") {
    const BOLD = "\x1b[1m";
    const RESET = "\x1b[22m";
    console.group(`${BOLD}$ ${command}${RESET}`);
  }

  try {
    return await new Promise<string>((resolve, reject) => {
      let stdout = [];
      let stderr = [];
      const child = exec(command, {
        ...execOptions,
        env: { ...process.env, ...execOptions.env },
        encoding: "utf-8",
      });
      child.stdout.pipe(split()).on("data", line => {
        if (shouldStream) log.out(line);
        stdout.push(line);
      });
      child.stderr.pipe(split()).on("data", line => {
        if (shouldStream) log.err(line);
        stderr.push(line);
      });
      child.on("exit", code => {
        if (output === "buffer") {
          if (stdout.length) log.out(stdout.join("\n"));
          if (stderr.length) log.err(stderr.join("\n"));
        }
        if (code === 0) {
          resolve(stdout.join("\n"));
        } else {
          reject({ command, stdout, stderr, code });
        }
      });
    });
  } finally {
    if (output !== "silent") {
      console.groupEnd();
    }
  }
}
