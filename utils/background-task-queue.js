class BackgroundTaskQueue extends Set {
  constructor(...args) {
    super(...args);
    this.isActive = false;
    /** @type Map<string, { status: string, message?: string }> */
    this.tasks = new Map();
  }

  /**
   * @param {() => Promise<any>} handler
   * @param {string} id unique task ID
   */
  add(handler, id) {
    super.add({ id, handler });
    this.tasks.set(id, { status: "pending" });
    if (!this.isActive) this.runTasks();
  }

  async runTasks() {
    this.isActive = true;
    for (const task of this.values()) {
      try {
        const message = await task.handler();
        this.tasks.set(id, { status: "success", message });
      } catch ({ message }) {
        console.error(`Task ${task.id} failed: ${message}`);
        this.tasks.set(id, { status: "failed", message });
      } finally {
        this.delete(task);
      }
    }
    this.isActive = false;
  }
}

const queue = new BackgroundTaskQueue();

module.exports = { BackgroundTaskQueue, queue };
