const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_PATH = path.join(REPO_ROOT, 'state', 'periods.json');

const OVERDUE_DAYS = 31;
// A file's range runs from its first to its last movement, not the bank's actual
// period, so a short distance between two periods is usually just a quiet stretch.
const GAP_DAYS = 7;

const COUNTED_STATUSES = new Set(['created', 'duplicate', 'possible_duplicate']);
const INCOMPLETE_STATUSES = new Set(['failed', 'unknown', 'not_attempted']);
// A correction made by hand says nothing about where it went, so it counts for all.
const ANY_DESTINATION = 'manual';

function toDay(value) {
  const date = dayjs(value);
  return value && date.isValid() ? date.format('YYYY-MM-DD') : null;
}

function rangeOf(dates) {
  const days = dates.map(toDay).filter(Boolean).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : null;
}

/**
 * The range a Wallet or Board import can vouch for, or null when it can't vouch
 * for any. Rows held by `walletFrom` count: they are there already.
 */
function coveredRange(items) {
  if (items.some((item) => INCOMPLETE_STATUSES.has(item.status))) return null;
  return rangeOf(items
    .filter((item) => COUNTED_STATUSES.has(item.status) || item.alreadyRecorded)
    .map((item) => item.row.date));
}

/**
 * What has been loaded for each bank, as periods. Lives outside git because the
 * repo is public, and unlike the rest of state/ it can't be rebuilt.
 */
class PeriodLog {
  constructor(filePath = process.env.PERIODS_PATH || DEFAULT_PATH, now = () => new Date()) {
    this.filePath = filePath;
    this.now = now;
  }

  /**
   * Returns false when there was nothing to record. Repeating a range only
   * refreshes it, so re-importing a file doesn't add a line.
   */
  recordPeriod({ source, from, to, via, file }) {
    if (!from || !to) return false;
    const data = this.#load();
    const at = this.now().toISOString();
    const existing = data.periods.find((p) => p.source === source && p.from === from && p.to === to && p.via === via);
    if (existing) {
      existing.at = at;
      if (file) existing.file = file;
    } else {
      data.periods.push({ source, from, to, via, at, ...(file ? { file } : {}) });
    }
    this.#save(data);
    return true;
  }

  /**
   * A single movement says nothing about the rest of its period, so screenshots
   * are kept apart and never move coveredThrough.
   */
  recordScreenshot({ source, date }) {
    const lastMovement = toDay(date);
    if (!source || !lastMovement) return false;
    const data = this.#load();
    const current = data.screenshots[source]?.lastMovement;
    data.screenshots[source] = {
      lastMovement: current && current > lastMovement ? current : lastMovement,
      at: this.now().toISOString(),
    };
    this.#save(data);
    return true;
  }

  /**
   * @param {string} source
   * @param {string} [via] only the periods that reached this destination
   */
  coveredThrough(source, via) {
    return summarize(source, this.#load(), via).coveredThrough;
  }

  /**
   * @param {Object} opts
   * @param {Array<{id: string, label: string, destinations: Array<string>}>} opts.sources
   * @param {string} [opts.today] YYYY-MM-DD
   */
  status({ sources, today = toDay(this.now()) }) {
    const data = this.#load();
    const known = new Map(sources.map((source) => [source.id, source]));
    const ids = new Set([
      ...known.keys(),
      ...data.periods.map((p) => p.source),
      ...Object.keys(data.screenshots),
    ]);

    return [...ids]
      .map((id) => {
        const destinations = known.get(id)?.destinations || [];
        const all = summarize(id, data);
        const byDestination = Object.fromEntries(destinations.map((dest) => {
          const { coveredThrough, gaps } = summarize(id, data, dest);
          return [dest, { coveredThrough, gaps, ...behind(coveredThrough, today) }];
        }));

        // A source is only as current as its most behind destination.
        const states = Object.values(byDestination);
        const dates = states.map((state) => state.coveredThrough);
        let coveredThrough = all.coveredThrough;
        if (states.length) coveredThrough = dates.includes(null) ? null : dates.sort()[0];
        const gaps = states.length
          ? Object.entries(byDestination).flatMap(([dest, state]) => state.gaps.map((gap) => ({ ...gap, destination: dest })))
          : all.gaps;

        return {
          source: id,
          label: known.get(id)?.label || id,
          destinations,
          coveredThrough,
          lastScreenshot: all.lastScreenshot,
          gaps,
          periods: all.periods,
          byDestination,
          ...behind(coveredThrough, today),
        };
      })
      .sort((a, b) => (b.daysBehind ?? Infinity) - (a.daysBehind ?? Infinity) || a.label.localeCompare(b.label));
  }

  #load() {
    let text;
    try {
      text = fs.readFileSync(this.filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return { periods: [], screenshots: {} };
      throw err;
    }

    // Throw rather than start empty: the next save would wipe the history.
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${this.filePath} is damaged. Fix or move it; nothing was changed.`);
    }
    if (!Array.isArray(data?.periods)) {
      throw new Error(`${this.filePath} is damaged. Fix or move it; nothing was changed.`);
    }
    return { periods: data.periods, screenshots: data.screenshots || {} };
  }

  #save(data) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, this.filePath);
  }
}

function behind(coveredThrough, today) {
  const daysBehind = coveredThrough
    ? dayjs(today).startOf('day').diff(dayjs(coveredThrough).startOf('day'), 'day')
    : null;
  return { daysBehind, overdue: daysBehind !== null && daysBehind >= OVERDUE_DAYS };
}

function summarize(source, data, via) {
  const periods = data.periods
    .filter((p) => p.source === source && (!via || p.via === via || p.via === ANY_DESTINATION))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const gaps = [];
  let coveredThrough = null;
  for (const period of periods) {
    if (coveredThrough) {
      const days = dayjs(period.from).diff(dayjs(coveredThrough), 'day');
      if (days > GAP_DAYS) gaps.push({ from: coveredThrough, to: period.from, days });
    }
    if (!coveredThrough || period.to > coveredThrough) coveredThrough = period.to;
  }

  return {
    coveredThrough,
    lastScreenshot: data.screenshots[source]?.lastMovement || null,
    gaps,
    periods,
  };
}

module.exports = { PeriodLog, coveredRange, rangeOf };
