import path from "path";
import EventEmitter from "events";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { mkdir, writeFile } from "fs/promises";

import { nanoid } from "nanoid";
import split2 from "split2";
import { serializeError, deserializeError } from "serialize-error";

import { env } from "./misc.js";

type Message = { id: string };

interface OperationRequest extends Message {
  type: "init";
  modulePath: string;
}
interface CallRequest extends Message {
  type: "call";
  input?: unknown;
}
type Request = OperationRequest | CallRequest;

interface Response extends Message {
  type: "success" | "failure";
  result: unknown;
}

if (!isMainThread) {
  let task: (input: CallRequest["input"]) => Promise<unknown>;
  parentPort!.addListener("message", async (req: Request) => {
    const { id } = req;

    if (req.type === "init") {
      try {
        const mod = await import(req.modulePath);
        task = mod.default;
        const res: Response = { id, type: "success", result: null };
        return parentPort!.postMessage(res);
      } catch (error) {
        const result = serializeError(error);
        const res: Response = { id, type: "failure", result };
        return parentPort!.postMessage(res);
      }
    }

    if (req.type === "call") {
      try {
        const result = await task(req.input);
        const msg: Response = { id, type: "success", result };
        return parentPort!.postMessage(msg);
      } catch (error) {
        const result = serializeError(error);
        const msg: Response = { id, type: "failure", result };
        return parentPort!.postMessage(msg);
      }
    }
  });
}

class Lock {
  private isLocked = false;
  private emitter = new EventEmitter();

  async acquire() {
    // If we use if, multiple requests can start at once when the lock is released
    // (all pending promises resolve at once). The while loop disallows it.
    while (this.isLocked) {
      await new Promise(resolve => this.emitter.once("unlock", resolve));
    }
    this.isLocked = true;
  }

  release() {
    this.isLocked = false;
    this.emitter.emit("unlock");
  }
}

class Logger {
  static LOG_DIR = path.join(env("DATA_DIR"), "jobs");

  id: string;
  input: unknown;
  timings: Record<string, Date> = {};
  result!: { type: "success" | "failure"; value: unknown };
  stdout: [date: Date, line: string][] = [];
  stderr: [date: Date, line: string][] = [];

  constructor(id: string, input: unknown) {
    this.id = id;
    this.input = input;
  }

  markTime(key: "init" | "queue" | "start" | "finish") {
    this.timings[key] = new Date();
  }

  setResult(type: "success" | "failure", value: unknown) {
    this.result = { type, value };
  }

  onstdout = (line: string) => {
    this.stdout.push([new Date(), line]);
  };

  onstderr = (line: string) => {
    this.stderr.push([new Date(), line]);
  };

  async write() {
    const { id, input, timings, result, stdout, stderr } = this;
    const data = { id, input, timings, result, stdout, stderr };
    const logFile =
      path.join(Logger.LOG_DIR, id.replace(/\//g, path.sep)) + ".json";
    await mkdir(path.dirname(logFile), { recursive: true });
    await writeFile(logFile, JSON.stringify(data, null, 2));
  }
}

// Method shorthand syntax enables bivariant parameter checking so concrete
// worker input types (e.g. `{ webhookId: string }`) satisfy this constraint.
type TaskModule = { default(input?: unknown): unknown };
/**
 * Create a worker thread to run a task in background. A task/job added to the
 * queue with `add()`, and run serially in order of calling `run()` on the job
 * returned from `add()`. Each instance of this class creates a new worker
 * thread where jobs can run.
 *
 * @example
 * ```js
 * // file: worker.js
 * export default async function task(a, b) { return a + b; }
 *
 * // file: jobs-queue.js
 * const queue = new BackgroundTaskQueue("worker.js");
 * const a1 = queue.add(1, 2);
 * const a2 = queue.add(5, 10);
 * a1.run().then((result) => console.assert(result === 3));
 * // a2 will start only after a1 finishes, even when we don't await a1.run()
 * a2.run().then((result) => console.assert(result === 15));
 * ```
 */
export class BackgroundTaskQueue<M extends TaskModule> {
  private modulePath: string;
  private name: string;

  private worker: Worker;
  private lock = new Lock();
  private isActivated = false;
  private jobCounter = 0;

  constructor(jobDescriptionModulePath: string, queueName: string) {
    this.modulePath = jobDescriptionModulePath;
    this.name = queueName;
    const __filename = import.meta.filename;
    this.worker = new Worker(__filename, { stderr: true, stdout: true });
  }

  add(input: Parameters<M["default"]>[0] = {}) {
    type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
    type RetType = ThenArg<ReturnType<M["default"]>>;

    const id = this.generateId();

    const log = new Logger(id, input);
    log.markTime("init");
    let hasRun = false;

    const run = async () => {
      log.markTime("queue");
      if (hasRun) {
        throw new Error("Cannot run the same job again.");
      }
      hasRun = true;

      if (!this.isActivated) {
        await this.activate();
      }

      await this.lock.acquire();
      log.markTime("start");

      const msg: CallRequest = { id, type: "call", input };
      this.worker.postMessage(msg);

      const stdoutSplit = this.worker.stdout.pipe(split2());
      const stderrSplit = this.worker.stderr.pipe(split2());
      stdoutSplit.on("data", log.onstdout);
      stderrSplit.on("data", log.onstderr);

      const cleanup = () => {
        stdoutSplit.off("data", log.onstdout);
        stderrSplit.off("data", log.onstderr);
        this.worker.stdout.unpipe(stdoutSplit);
        this.worker.stderr.unpipe(stderrSplit);
        log.markTime("finish");
      };

      try {
        const { promise, resolve, reject } = Promise.withResolvers<RetType>();

        const onWorkerError = (err: Error) => {
          this.worker.removeListener("message", listener);
          this.worker.removeListener("exit", onWorkerExit);
          this.lock.release();
          cleanup();
          reject(err);
        };

        const onWorkerExit = (code: number | null) => {
          this.worker.removeListener("message", listener);
          this.worker.removeListener("error", onWorkerError);
          this.lock.release();
          cleanup();
          reject(
            new Error(
              `Worker exited unexpectedly with code ${code} (job: ${id})`,
            ),
          );
        };

        const listener = (response: Response) => {
          if (response.id === id) {
            this.worker.removeListener("message", listener);
            this.worker.removeListener("error", onWorkerError);
            this.worker.removeListener("exit", onWorkerExit);
            this.lock.release();

            const { type, result } = response;
            log.setResult(type, result);
            cleanup();

            if (type === "success") {
              resolve(result as RetType);
            } else {
              reject(deserializeError(result));
            }
          }
        };

        this.worker.once("error", onWorkerError);
        this.worker.once("exit", onWorkerExit);
        this.worker.addListener("message", listener);
        return await promise;
      } finally {
        await log.write();
      }
    };

    return { id, run };
  }

  private async activate() {
    this.isActivated = true;

    const id = nanoid();
    const modulePath = this.modulePath;
    const msg: OperationRequest = { id, type: "init", modulePath };
    this.worker.postMessage(msg);

    const { promise, resolve, reject } = Promise.withResolvers<void>();

    const onError = (err: Error) => {
      this.worker.removeListener("exit", onExit);
      reject(err);
    };

    const onExit = (code: number | null) => {
      this.worker.removeListener("error", onError);
      reject(
        new Error(
          `Worker exited with code ${code} during module initialization: ${modulePath}`,
        ),
      );
    };

    this.worker.once("error", onError);
    this.worker.once("exit", onExit);

    this.worker.once("message", (response: Response) => {
      this.worker.removeListener("error", onError);
      this.worker.removeListener("exit", onExit);
      if (response.id !== id) {
        reject(new Error(`Failed to register worker module: ${modulePath}`));
      } else {
        if (response.type === "success") {
          resolve();
        } else {
          reject(deserializeError(response.result));
        }
      }
    });
    await promise;
  }

  private generateId() {
    const count = `${++this.jobCounter}`.padStart(3, "0");
    const now = new Date().toISOString().slice(0, 10);
    return `${now}/${this.name}/${count}-${nanoid(5)}`;
  }
}
