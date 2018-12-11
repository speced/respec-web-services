class BackgroundTaskQueue extends Set {
  constructor(...args) {
    super(...args);
    this.isActive = false;
    this.completed = [];
  }

  /**
   * @param {function} handler () => Promise<any>
   * @param {string} id unique task ID
   */
  add(handler, id) {
    super.add({ id, handler });
    if (!this.isActive) this.runTasks();
  }

  async runTasks() {
    this.isActive = true;
    for (const task of this.values()) {
      this.delete(task);
      try {
        const result = await task.handler();
        task.status = "success";
        task.message = result;
      } catch (err) {
        task.status = "failed";
        if (err) {
          console.error(`Task ${task.id} failed: ${err.message}`);
          task.message = err.message;
        }
      } finally {
        this.completed.push(task);
      }
    }
    this.isActive = false;
  }
}

const queue = new BackgroundTaskQueue();

module.exports = { BackgroundTaskQueue, queue };
