/* global Module */

Module.register("MMM-AgendaView", {
  defaults: {
    // Each entry: { name, url, color, symbol, fetchInterval? }
    calendars: [],

    // Days to look ahead from today.
    daysAhead: 7,

    // How often to re-fetch all calendars (ms). Per-calendar override via fetchInterval.
    fetchInterval: 60 * 60 * 1000,

    // Cap on total events rendered.
    maxEvents: 30,

    // Show only the first N days that have events (null = disabled, use daysAhead window only).
    nextEventDays: null,

    // Show timed event start time.
    showTime: true,
    // Show end time alongside start time.
    showEndTime: false,
    // Show calendar name in the meta line.
    showCalendarName: false,
    // Show location when present.
    showLocation: false,

    // "box"    – all-day events rendered as pill boxes (grouped above timed events when allDayAtTop is true)
    // "inline" – all-day events rendered the same way as timed events
    allDayStyle: "box",

    // When true, all-day boxes flow left-to-right and wrap onto the next line as needed.
    // When false, each box is placed on its own line.
    allDayWrap: true,

    // When true, all-day events appear before timed events within each day group.
    allDayAtTop: true,

    // Show the calendar's Font Awesome icon (colored with the calendar color).
    // Falls back to a colored dot when the calendar has no symbol configured.
    showIcon: true,

    // Whether to repeat multi-day events on each day they span.
    repeatMultiDay: false,

    // 12 or 24.
    timeFormat: 12,

    noEventsText: "No upcoming events",

    // Show the day title header above each day's events.
    showDayHeader: true,

    // Gradient color for day header text. Set to false for plain white.
    dayHeaderGradient: true,

    // Prefix non-today day titles with days remaining, e.g. "in 5d Wed, Sep 5".
    showDaysRemaining: true,

    // Use 3-letter abbreviated day names: "Wed" instead of "Wednesday".
    shortDayName: true,

    // Use 3-letter abbreviated month names: "Sep" instead of "September".
    shortMonth: true,

    // Hide the extending horizontal line on the first day header.
    hideFirstDayLine: true,

    // Re-render interval (ms) — keeps Today/Tomorrow labels current.
    updateInterval: 60 * 1000,

    animationSpeed: 300,
  },

  requiresVersion: "2.1.0",

  getStyles() {
    return ["MMM-AgendaView.css"];
  },

  start() {
    this.events = [];
    this.loaded = false;
    this.timer = null;

    this.sendSocketNotification("AGENDAVIEW_INIT", {
      instanceId: this.identifier,
      calendars: this.config.calendars,
      daysAhead: this.config.daysAhead,
      fetchInterval: this.config.fetchInterval,
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "AGENDAVIEW_EVENTS" && payload.instanceId === this.identifier) {
      this.events = payload.events;
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
    }
  },

  notificationReceived(notification) {
    if (notification === "MODULE_DOM_CREATED") {
      this.timer = setInterval(() => this.updateDom(0), this.config.updateInterval);
    }
  },

  // ── Data helpers ──────────────────────────────────────────────────────────

  _getVisibleEvents() {
    const now = Date.now();
    const cutoff = now + this.config.daysAhead * 24 * 60 * 60 * 1000;

    let events = this.events.filter(e => e.endDate > now && e.startDate < cutoff);

    const seen = new Set();
    events = events.filter(e => {
      const key = `${e.calendarName}|${e.uid}|${e.startDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    events.sort((a, b) => a.startDate - b.startDate);
    return events.slice(0, this.config.maxEvents);
  },

  _groupByDay(events) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const groups = new Map();

    for (const ev of events) {
      if (this.config.repeatMultiDay && ev.endDate - ev.startDate > 24 * 60 * 60 * 1000) {
        let cursor = new Date(Math.max(ev.startDate, todayStart.getTime()));
        cursor.setHours(0, 0, 0, 0);
        while (cursor.getTime() < ev.endDate) {
          const key = _dateKey(cursor);
          if (!groups.has(key)) groups.set(key, { date: new Date(cursor), events: [] });
          groups.get(key).events.push(Object.assign({}, ev, { _continued: cursor.getTime() > ev.startDate }));
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const effectiveStart = Math.max(ev.startDate, todayStart.getTime());
        const d = new Date(effectiveStart);
        d.setHours(0, 0, 0, 0);
        const key = _dateKey(d);
        if (!groups.has(key)) groups.set(key, { date: new Date(d), events: [] });
        groups.get(key).events.push(ev);
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => a.date - b.date)
      .map(g => {
        const allDay = g.events.filter(e => e.fullDay).sort((a, b) => a.startDate - b.startDate);
        const timed  = g.events.filter(e => !e.fullDay).sort((a, b) => a.startDate - b.startDate);
        return { date: g.date, allDay, timed };
      });
  },

  // Returns { countdown: "in 5d" | null, label: "Wed, Sep 5" }
  _dayParts(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const daysAway = Math.round((date - today) / (24 * 60 * 60 * 1000));

    const DAYS_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const DAYS_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    let label;
    if (date.getTime() === today.getTime()) {
      label = "Today";
    } else if (date.getTime() === tomorrow.getTime()) {
      label = "Tomorrow";
    } else {
      const dayName   = this.config.shortDayName ? DAYS_SHORT[date.getDay()]     : DAYS_FULL[date.getDay()];
      const monthName = this.config.shortMonth   ? MONTHS_SHORT[date.getMonth()] : MONTHS_FULL[date.getMonth()];
      label = `${dayName}, ${monthName} ${date.getDate()}`;
    }

    const countdown = (this.config.showDaysRemaining && daysAway > 0) ? `in ${daysAway}d` : null;
    return { countdown, label };
  },

  _formatTime(ts, fullDay) {
    if (fullDay) return "All day";
    const d = new Date(ts);
    if (this.config.timeFormat === 24) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    const h = d.getHours();
    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  },

  // ── Icon / dot helper ────────────────────────────────────────────────────

  _makeCalendarIndicator(ev, extraClass) {
    const color = ev.color || "rgba(255,255,255,0.5)";
    if (this.config.showIcon && ev.symbol) {
      const icon = document.createElement("span");
      // symbol is the bare FA icon name e.g. "seedling" — MagicMirror ships FA 6
      icon.className = `mmm-agendaview-icon fas fa-${ev.symbol}${extraClass ? " " + extraClass : ""}`;
      icon.style.color = color;
      return icon;
    }
    // Fallback: colored dot.
    const dot = document.createElement("span");
    dot.className = `mmm-agendaview-dot${extraClass ? " " + extraClass : ""}`;
    dot.style.backgroundColor = color;
    return dot;
  },

  // ── Event renderers ───────────────────────────────────────────────────────

  _renderAllDayBox(ev) {
    const color = ev.color || "rgba(255,255,255,0.3)";
    const box = document.createElement("div");
    box.className = "mmm-agendaview-allday-box";
    box.style.borderLeftColor = color;
    box.style.backgroundColor = _colorWithAlpha(color, 0.18);

    const title = document.createElement("span");
    title.className = "mmm-agendaview-allday-title bright";
    title.textContent = ev._continued ? `${ev.title} (cont.)` : ev.title;
    box.appendChild(title);

    return box;
  },

  _renderEventRow(ev) {
    const row = document.createElement("div");
    row.className = "mmm-agendaview-event";

    row.appendChild(this._makeCalendarIndicator(ev, "mmm-agendaview-row-icon"));

    const info = document.createElement("div");
    info.className = "mmm-agendaview-info";

    const titleRow = document.createElement("div");
    titleRow.className = "mmm-agendaview-title-row";

    if (this.config.showTime) {
      const timeEl = document.createElement("span");
      timeEl.className = "mmm-agendaview-event-time dimmed";
      let t = this._formatTime(ev.startDate, ev.fullDay);
      if (this.config.showEndTime && !ev.fullDay) t += ` – ${this._formatTime(ev.endDate, false)}`;
      timeEl.textContent = t;
      titleRow.appendChild(timeEl);
    }

    const titleEl = document.createElement("span");
    titleEl.className = "mmm-agendaview-title bright";
    titleEl.textContent = ev._continued ? `${ev.title} (cont.)` : ev.title;
    titleRow.appendChild(titleEl);

    info.appendChild(titleRow);

    if (this.config.showCalendarName && ev.calendarName) {
      const meta = document.createElement("div");
      meta.className = "mmm-agendaview-meta dimmed small";
      meta.textContent = ev.calendarName;
      info.appendChild(meta);
    }

    if (this.config.showLocation && ev.location) {
      const loc = document.createElement("div");
      loc.className = "mmm-agendaview-location dimmed xsmall";
      loc.textContent = ev.location;
      info.appendChild(loc);
    }

    row.appendChild(info);
    return row;
  },

  // ── Main render ───────────────────────────────────────────────────────────

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-agendaview" + (this.config.hideFirstDayLine ? " no-first-line" : "");

    if (!this.loaded) {
      const loading = document.createElement("div");
      loading.className = "mmm-agendaview-empty dimmed light small";
      loading.textContent = "Loading…";
      wrapper.appendChild(loading);
      return wrapper;
    }

    const events = this._getVisibleEvents();
    if (events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mmm-agendaview-empty dimmed light small";
      empty.textContent = this.config.noEventsText;
      wrapper.appendChild(empty);
      return wrapper;
    }

    const useBoxes = this.config.allDayStyle === "box";

    let groups = this._groupByDay(events);
    if (this.config.nextEventDays != null) {
      groups = groups.slice(0, this.config.nextEventDays);
    }

    for (const group of groups) {
      if (this.config.showDayHeader) {
        const header = document.createElement("div");
        header.className = "mmm-agendaview-day-header" + (this.config.dayHeaderGradient ? " gradient" : "");

        const { countdown, label } = this._dayParts(group.date);
        if (countdown) {
          const cdEl = document.createElement("span");
          cdEl.className = "mmm-agendaview-day-countdown";
          cdEl.textContent = countdown;
          header.appendChild(cdEl);
        }

        const labelEl = document.createElement("span");
        labelEl.className = "mmm-agendaview-day-label";
        labelEl.textContent = label;
        header.appendChild(labelEl);

        wrapper.appendChild(header);
      }

      // All-day events — either boxes (grouped) or inline rows.
      if (group.allDay.length > 0) {
        if (useBoxes) {
          const boxRow = document.createElement("div");
          boxRow.className = "mmm-agendaview-allday-boxes" + (this.config.allDayWrap ? "" : " no-wrap");
          for (const ev of group.allDay) boxRow.appendChild(this._renderAllDayBox(ev));
          wrapper.appendChild(boxRow);
        } else {
          // Inline: render before timed events when allDayAtTop is true (already sorted),
          // otherwise they'll be interleaved in the combined pass below.
          if (this.config.allDayAtTop) {
            for (const ev of group.allDay) wrapper.appendChild(this._renderEventRow(ev));
          }
        }
      }

      // Timed events.
      for (const ev of group.timed) wrapper.appendChild(this._renderEventRow(ev));

      // When inline + not allDayAtTop, render all-day events after timed ones.
      if (!useBoxes && !this.config.allDayAtTop && group.allDay.length > 0) {
        for (const ev of group.allDay) wrapper.appendChild(this._renderEventRow(ev));
      }
    }

    return wrapper;
  },
});

function _dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Convert any CSS color string to rgba(..., alpha).
// Works for "#rrggbb", "#rgb", and named colors that browsers can parse.
function _colorWithAlpha(color, alpha) {
  // Named colors and hex shorthand both resolve fine via a temporary canvas.
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r},${g},${b},${alpha})`;
  } catch (_) {
    return `rgba(255,255,255,${alpha})`;
  }
}
