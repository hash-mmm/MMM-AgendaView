const NodeHelper = require("node_helper");
const ical = require("node-ical");

const RETRY_INTERVAL = 5 * 60 * 1000;

module.exports = NodeHelper.create({
  start() {
    // instanceId → { calendars, daysAhead, fetchInterval }
    this.instances = {};

    // "instanceId|calendarName" → { events, lastFetch, error }
    this.cache = {};

    // "instanceId|calendarName" → timeout handle
    this.timers = {};
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== "AGENDAVIEW_INIT") return;

    const { instanceId, calendars = [], daysAhead = 14, fetchInterval = 60 * 60 * 1000 } = payload;

    // Clear existing timers belonging to this instance before re-initialising.
    for (const [key, handle] of Object.entries(this.timers)) {
      if (key.startsWith(instanceId + "|")) {
        clearTimeout(handle);
        delete this.timers[key];
      }
    }

    this.instances[instanceId] = { calendars, daysAhead, fetchInterval };

    for (const cal of calendars) {
      this._fetchCalendar(instanceId, cal);
    }
  },

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async _fetchCalendar(instanceId, cal) {
    const instance = this.instances[instanceId];
    if (!instance) return;

    const cacheKey = `${instanceId}|${cal.name}`;
    const interval = cal.fetchInterval ?? instance.fetchInterval;

    try {
      const data = await ical.async.fromURL(cal.url);
      const events = this._parseEvents(data, cal, instance.daysAhead);
      this.cache[cacheKey] = { events, lastFetch: new Date(), error: null };
      console.log(`[MMM-AgendaView:${instanceId}] ${cal.name}: fetched ${events.length} events`);
    } catch (err) {
      console.error(`[MMM-AgendaView:${instanceId}] ${cal.name}: fetch failed — ${err.message}`);
      if (!this.cache[cacheKey]) {
        this.cache[cacheKey] = { events: [], lastFetch: null, error: err.message };
      } else {
        this.cache[cacheKey].error = err.message;
      }
      this.timers[cacheKey] = setTimeout(() => this._fetchCalendar(instanceId, cal), RETRY_INTERVAL);
      this._sendEvents(instanceId);
      return;
    }

    this._sendEvents(instanceId);
    this.timers[cacheKey] = setTimeout(() => this._fetchCalendar(instanceId, cal), interval);
  },

  // ── Parse ─────────────────────────────────────────────────────────────────

  _parseEvents(data, cal, daysAhead) {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);

    const to = new Date();
    to.setDate(to.getDate() + daysAhead + 1);
    to.setHours(23, 59, 59, 999);

    const results = [];
    const overrides = new Map();
    const rawEvents = Object.values(data).filter(e => e.type === "VEVENT");

    for (const ev of rawEvents) {
      if (ev.recurrenceid) {
        if (!overrides.has(ev.uid)) overrides.set(ev.uid, new Set());
        overrides.get(ev.uid).add(new Date(ev.recurrenceid).getTime());
        const norm = this._normalizeEvent(ev, cal);
        if (norm.startDate < to.getTime() && norm.endDate > from.getTime()) {
          results.push(norm);
        }
      }
    }

    for (const ev of rawEvents) {
      if (ev.recurrenceid) continue;

      if (ev.rrule) {
        const occurrences = ical.expandRecurringEvent(ev, {
          from,
          to,
          includeOverrides: false,
          excludeExdates: true,
          expandOngoing: true,
        });
        for (const occ of occurrences) {
          if (overrides.get(ev.uid)?.has(new Date(occ.start).getTime())) continue;
          results.push(this._normalizeEvent(occ, cal));
        }
      } else {
        const norm = this._normalizeEvent(ev, cal);
        if (norm.startDate < to.getTime() && norm.endDate > from.getTime()) {
          results.push(norm);
        }
      }
    }

    return results;
  },

  _normalizeEvent(ev, cal) {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : new Date(start);
    const fullDay = ev.datetype === "date";

    return {
      uid: ev.uid || `${cal.name}|${start.getTime()}`,
      title: (ev.summary || "(No title)").trim(),
      startDate: start.getTime(),
      endDate: end.getTime(),
      fullDay,
      location: ev.location || null,
      calendarName: cal.name,
      color: cal.color || "#aaaaaa",
      symbol: cal.symbol || null,
    };
  },

  // ── Broadcast ─────────────────────────────────────────────────────────────

  _sendEvents(instanceId) {
    const prefix = instanceId + "|";
    const all = [];
    for (const [key, entry] of Object.entries(this.cache)) {
      if (key.startsWith(prefix)) all.push(...entry.events);
    }
    this.sendSocketNotification("AGENDAVIEW_EVENTS", { instanceId, events: all });
  },
});
