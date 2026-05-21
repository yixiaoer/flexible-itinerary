# Flexible Itinerary

[中文版](./README.zh.md)

Page: https://yixiaoer.github.io/flexible-itinerary/

A flexible itinerary planner for independent travel. Start with a rough day-by-day plan, then refine it into morning, afternoon, evening, or minute-level blocks. Lock fixed events like shows, flights, trains, and sunrise plans, then arrange everything else around them.

## Core Capabilities

- **Flexible time granularity**: In the same trip, an activity can simply belong to a day, sit in a morning / afternoon / evening block, or use exact start and end times. Can plan freely first, also can refine as needed.
- **Flexible dates and dayparts**: Plan by trip length only, or add a concrete start date when you have one.
- **Lock fixed plans**: Lock concerts, flights, trains, sunrise plans, restaurant bookings, tickets, and other fixed activities so later drag-and-drop edits do not accidentally change them.
- **Drag-and-drop board**: Move places and activities between the candidate pool and daily columns, reorder within a day, move across days, or drag scheduled items back to candidates.
- **Map view**: Resolved places appear on a map. You can also search for a place directly and add it as a candidate activity.
- **Local trip library**: Manage multiple trip files locally. New trips are saved immediately; click a trip card to switch to it, or drag to reorder trips.
- **Versions and backups**: The current trip auto-saves. You can also save a version snapshot, export a trip as JSON, or import JSON to restore a trip.
- **Trip overview and status tags**: Trips can be marked as past, upcoming, ongoing, or long-term. Review / trip intelligence (planned) can summarize days, activities, candidates, total duration, and risk hints.
- **AI-assisted planning (planned)**: Future work may include AI-generated drafts, more candidate suggestions, replanning around weather or disruptions, and checks for opening hours or route conflicts.

## How to Use

Users do not need to install or configure a local environment. Open the deployed GitHub Pages site and use it directly.

1. **Create or open a trip**: Click New trip in the header to create a new trip file; open My Trips to switch by clicking an existing trip card.
2. **Fill in trip basics**: Enter destination, number of days, optional dates, must-visit places, and preferences in the sidebar. Changes update the current trip automatically.
3. **Manage candidate activities**: Must-visit places become candidates, and the app tries to resolve their map locations automatically. Resolved places are saved with the trip.
4. **Drag to schedule**: Drag candidates into a day, reorder within a day, move across days, or drag scheduled activities back to candidates. You can also clear a single day, moving that day's activities back to candidates while keeping the day.
5. **Adjust dayparts**: Activities support morning, afternoon, evening, and flexible. Drag position can affect daypart; manually setting evening creates a new boundary.
6. **Edit activities**: Click an activity to edit title, place, duration, time, notes, lock state, and more. Duration can be empty.
7. **Check map and review**: Switch to Map to view place distribution. Switch to Review / trip intelligence for overview and risk hints. Fuller AI-based review is planned.
8. **Save versions or backups**: The current trip auto-saves. Click Save version when you want a snapshot. Individual trips can also be exported to JSON or restored from JSON.
9. **Clear or restart**: Clear plan keeps the destination but clears other planning details. New trip creates a new blank trip file.

## Feature Status and Roadmap

### Time Granularity and Dates

- [x] Activities can belong to a day without requiring an exact time.
- [x] Activities can be set to morning, afternoon, evening, or flexible.
- [x] Activities can use exact start and end times.
- [x] Activity duration can be empty; internal calculations use a temporary default without writing it back.
- [x] Travel dates can be fuzzy: use only trip length, or add a start date as well.
- [x] Dragging can infer morning, afternoon, or evening from position while keeping daypart boundaries consistent.

### Locking and Activity Editing

- [x] Activities can be locked for concerts, flights, trains, sunrise plans, restaurant bookings, and other fixed arrangements.
- [x] Locked activities preserve key fields during movement and automatic scheduling logic.
- [x] The activity editor supports title, place, notes, daypart, time, lock state, optional status, and related fields.
- [x] Flexible activities are supported and are not affected by automatic daypart boundaries.

### Drag-and-Drop Board

- [x] Candidate activities can be dragged into any day.
- [x] Scheduled activities can be reordered within the same day.
- [x] Scheduled activities can be moved across days.
- [x] Scheduled activities can be dragged back to the candidate pool.
- [x] A single day can be cleared, moving that day's activities back to candidates while keeping the day.
- [x] A single day can be deleted, moving that day's activities back to candidates.
- [x] Unlocked activities can be dragged by the whole card.

### Map View and Place Resolution

- [x] Must-visit places automatically create candidate activities.
- [x] Resolvable places automatically receive latitude and longitude.
- [x] Previously resolved places are recovered from trip data, so refreshes or unrelated edits do not repeatedly geocode them.
- [x] The map view can display resolved places.
- [x] The map view supports direct place search and adding results to candidates.
- [ ] Dragging map markers to update places.

### Local Trip Library, Versions, and Backups

- [x] Local-first editor with core data stored in browser `localStorage`.
- [x] Local trip library: view, click to switch, duplicate, delete, import JSON, and export JSON.
- [x] New trips immediately create matching trip files, so switching away does not lose them.
- [x] The currently open trip auto-saves and syncs back to its matching card in My Trips.
- [x] My Trips supports drag-to-reorder with a handle on each trip card.
- [x] The current plan can be cleared while keeping the destination and removing dates, must-visit places, preferences, candidates, and daily arrangements.
- [x] `Save version` creates an extra standalone snapshot without overwriting the trip being edited.
- [ ] Custom version history, version comparison, rollback, and named versions; currently only Save version snapshots are supported.
- [ ] Account login, passwords, Apple ID, iCloud, or cross-device sync.
- [ ] Multi-user collaboration.
- [ ] Mobile web layout is not optimized yet.

### Trip Overview and Status Tags

- [x] Trip status tags support past, upcoming, ongoing, and long-term.
- [x] Trip status can be inferred from dates or manually overridden.
- [x] Review / trip intelligence can show days, activity counts, candidates, total duration, and risk hints.

### AI-Related

- [ ] AI configuration is not enabled yet; base URL, API key, model, temperature, and extra system prompt fields are disabled placeholders.
- [ ] AI full-trip generation is not officially enabled yet.
- [ ] AI single-day and full-trip replanning are not officially enabled yet.
- [ ] AI suggestions for more candidate activities are not officially enabled yet.
- [ ] LLM opening-hours checks and the full evidence layer are not officially enabled yet.
- [ ] Streaming AI output is not implemented yet.

## Privacy

The current trip, trip library, notes, and settings are stored in your browser `localStorage`. You can inspect or clear them through DevTools -> Application -> Local Storage.

## License

MIT.
