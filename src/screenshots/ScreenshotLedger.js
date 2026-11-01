const fs = require('fs');
const path = require('path');

const OVERDUE_MS = 24 * 60 * 60 * 1000;

/**
 * Remembers which screenshots were already reviewed so they aren't sent to a model
 * again. Only an optimization: if the file is lost, note tags still stop duplicates.
 */
class ScreenshotLedger {
  constructor(filePath, now = () => new Date()) {
    this.filePath = filePath;
    this.now = now;
    this.data = this.#load();
  }

  /**
   * Screenshots older than the first run are never reviewed unless asked for, so
   * connecting a folder doesn't send its whole history to a model.
   */
  get since() {
    if (!this.data.since) {
      this.data.since = this.now().toISOString();
      this.save();
    }
    return this.data.since;
  }

  isDone(id) {
    return Boolean(this.data.done[id]);
  }

  markDone(id, status, reason) {
    this.data.done[id] = { status, reason, at: this.now().toISOString() };
    delete this.data.retrying[id];
  }

  /**
   * Keeps a screenshot pending. Returns true once it has been stuck for over a day.
   */
  markRetry(id, status) {
    const firstSeen = this.data.retrying[id]?.firstSeen || this.now().toISOString();
    this.data.retrying[id] = { status, firstSeen };
    return this.now().getTime() - new Date(firstSeen).getTime() > OVERDUE_MS;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2));
    fs.renameSync(temp, this.filePath);
  }

  #load() {
    const empty = { since: null, done: {}, retrying: {} };
    try {
      return { ...empty, ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) };
    } catch {
      return empty;
    }
  }
}

module.exports = { ScreenshotLedger };
