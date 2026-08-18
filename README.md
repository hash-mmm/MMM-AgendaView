# MMM-AgendaView

A clean, stable agenda module for [MagicMirror²](https://magicmirror.builders/) that fetches ICS calendars directly — no dependency on the built-in `calendar` module. Supports multiple independent instances, each with its own set of calendars.

![Module preview placeholder](https://via.placeholder.com/600x300?text=MMM-AgendaView)

## Features

- Fetches ICS/iCal feeds directly via `node-ical` — works with Google Calendar, Outlook, iCloud, school calendars, and any public `.ics` URL
- Handles recurring events and recurrence exceptions (RECURRENCE-ID)
- Multiple module instances each fetch and display only their own calendars
- All-day events rendered as colored pill boxes, grouped above timed events
- Per-calendar Font Awesome icons and colors
- Gradient day headers with an extending rule line
- Auto-refreshes day labels (Today / Tomorrow) every minute without re-fetching

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/hash-mmm/MMM-AgendaView.git
```

No `npm install` needed — the module uses `node-ical`, which is already bundled with MagicMirror.

## Configuration

Add one or more entries to the `modules` array in `config/config.js`:

```javascript
{
  module: "MMM-AgendaView",
  position: "top_left",
  header: "Family",
  config: {
    calendars: [
      {
        name: "mom",
        url:  "https://calendar.google.com/calendar/ical/example%40gmail.com/private-abc123/basic.ics",
        color: "#febfff",
        symbol: "heart",
        fetchInterval: 60 * 60 * 1000,   // optional, overrides global fetchInterval
      },
      {
        name: "kids",
        url:  "https://www.example.com/calendar.ics",
        color: "#93C4FF",
        symbol: "star",
      },
    ],
    daysAhead: 7,
    showTime: true,
    showCalendarName: true,
  }
},
```

## Calendar entry options

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✓ | Display name, also used as the calendar identifier |
| `url` | string | ✓ | ICS feed URL |
| `color` | string | | CSS color for the icon and all-day box border (e.g. `"white"`, `"#72B37E"`) |
| `symbol` | string | | Font Awesome 6 icon name without the `fa-` prefix (e.g. `"heart"`, `"star"`, `"seedling"`) |
| `fetchInterval` | number (ms) | | Per-calendar fetch interval; overrides the global `fetchInterval` |

## Module config options

### Data

| Option | Default | Description |
|---|---|---|
| `calendars` | `[]` | Array of calendar entries (see above) |
| `daysAhead` | `7` | How many days ahead to show events for |
| `fetchInterval` | `3600000` | How often to re-fetch all calendars (ms). Overridable per calendar. |
| `maxEvents` | `30` | Maximum number of events to render |

### Display

| Option | Default | Description |
|---|---|---|
| `showDayHeader` | `true` | Show the day title (Today / Tomorrow / Mon, Aug 18) above each day group |
| `dayHeaderGradient` | `true` | Render day titles with a cyan-to-blue gradient. Set `false` for plain white |
| `showTime` | `true` | Show event start time before the title |
| `showEndTime` | `false` | Show end time alongside the start time |
| `showCalendarName` | `false` | Show the source calendar name below the event title |
| `showLocation` | `false` | Show event location when available |
| `showIcon` | `true` | Show the calendar's Font Awesome icon next to each event. Falls back to a colored dot when no `symbol` is set |
| `timeFormat` | `12` | `12` for 12-hour (9:00 AM) or `24` for 24-hour (09:00) |
| `noEventsText` | `"No upcoming events"` | Text shown when there are no upcoming events |

### All-day events

| Option | Default | Description |
|---|---|---|
| `allDayStyle` | `"box"` | `"box"` — render as colored pill boxes; `"inline"` — render like regular events |
| `allDayAtTop` | `true` | Show all-day events before timed events within each day group |
| `allDayWrap` | `true` | `true` — boxes flow left-to-right and wrap to the next line; `false` — one box per line |

### Multi-day events

| Option | Default | Description |
|---|---|---|
| `repeatMultiDay` | `false` | Show a multi-day event on every day it spans. When `false`, it appears only on its first visible day |

### Performance

| Option | Default | Description |
|---|---|---|
| `updateInterval` | `60000` | How often (ms) to re-render without new data, to keep Today/Tomorrow labels accurate |
| `animationSpeed` | `300` | DOM update fade duration (ms) |

## Multiple instances

You can add as many `MMM-AgendaView` blocks as you like. Each instance fetches only its own `calendars` and renders independently — they do not share state.

```javascript
// Dad's calendar — top left
{
  module: "MMM-AgendaView",
  position: "top_left",
  header: "Dad",
  config: {
    calendars: [
      { name: "dad", url: "https://...", color: "white", symbol: "seedling" },
    ],
  }
},

// Family calendar — also top left, stacked below
{
  module: "MMM-AgendaView",
  position: "top_left",
  header: "Family",
  config: {
    calendars: [
      { name: "mom",  url: "https://...", color: "#febfff", symbol: "heart" },
      { name: "kids", url: "https://...", color: "#93C4FF", symbol: "star"  },
    ],
    showCalendarName: true,
  }
},
```

## Getting a Google Calendar ICS URL

1. Open [calendar.google.com](https://calendar.google.com)
2. Click the ⋮ menu next to a calendar → **Settings and sharing**
3. Scroll to **Secret address in iCal format** (for private calendars) or **Public address in iCal format**
4. Copy the URL and paste it as the `url` field

## License

MIT
