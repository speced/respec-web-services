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
    console.log(`Task ${id} added to queue.`);
    if (!this.isActive) this.runTasks();
  }

  async runTasks() {
    this.isActive = true;
    for (const task of this.values()) {
      const { id, handler } = task;
      try {
        console.log(`Task ${id} started.`);
        const message = await handler();
        this.tasks.set(id, { status: "success", message });
        console.log(`Task ${id} finished.`);
      } catch ({ message }) {
        console.error(`Task ${id} failed: ${message}`);
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
