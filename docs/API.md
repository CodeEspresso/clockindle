# Clockindle Personal-Fork Backend API Contract

Base URL: configured per-install via cookie `apiBase` (default `http://localhost:8765`).

All responses are `application/json; charset=utf-8`.

All write endpoints (`POST/PATCH/DELETE`) require header `Authorization: Bearer <apiToken>`. The token is stored in cookie `apiToken` and was injected by the user via settings dialog. Backend must validate token and reject with `401` if missing/invalid.

CORS: backend must respond with `Access-Control-Allow-Origin: *` (this page is served from various origins, including GitHub Pages). Write endpoints must include `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS` and respond to `OPTIONS` with `204`.

---

## GET `/api/nas/devices`

Returns all NAS devices known to the backend. The page rotates through them.

**Response 200:**
```json
{
  "devices": [
    {
      "id": "synology-ds920",
      "name": "客厅 NAS",
      "status": {
        "cpu": 23,
        "mem": 41,
        "disk": 62,
        "temp": 42
      },
      "updatedAt": "2026-07-26T14:32:01+08:00"
    }
  ],
  "intervalMs": 30000
}
```

Field semantics:
- `cpu/mem/disk`: integers, percent (0–100)
- `temp`: integer, Celsius
- `intervalMs`: hint for how often the page should rotate to the next device (use as default; backend may override per device later)

---

## GET `/api/todo`

Returns today's active todos. The backend is responsible for **expanding repeat rules into concrete occurrences for today**, so the page never has to know about the rule schema.

**Query params (all optional):**
- `date`: ISO date `YYYY-MM-DD`; defaults to today in user's timezone (the page passes the local date).

**Response 200:**
```json
{
  "date": "2026-07-26",
  "items": [
    {
      "id": "abc123",
      "title": "买菜",
      "done": false,
      "source": "rule:weekly-mon",
      "due": "2026-07-26T18:00:00+08:00"
    }
  ],
  "intervalMs": 600000
}
```

Field semantics:
- `done`: boolean; toggled by the page via PATCH. Backend persists across reloads (same `id` next day = same item, not a new occurrence).
- `source`: opaque to the page; for debugging only.
- `due`: ISO datetime; page may render or skip if you want — default is "show regardless."
- `intervalMs`: page refresh cadence (10 min default).

**Response 200 (empty):** `{ "date": "2026-07-26", "items": [], "intervalMs": 600000 }`

---

## PATCH `/api/todo/{id}`

Toggle the `done` state of one occurrence. Kindle hits this on checkbox click.

**Body:**
```json
{ "done": true }
```

**Response 200:** the updated item (same shape as a single element of `items[]`).

**Errors:**
- `401` if token invalid
- `404` if no occurrence for today with that id

> Implementation note for future backend plan: when an item comes from a repeat rule, the persistence key is `(ruleId, date)`, not just `ruleId`. The id returned to the page encodes both, so the page can issue a stable PATCH without knowing the rule.

---

## POST `/api/todo`

Create a new todo (mini-program only — Kindle doesn't create). **Out of scope for this plan;** listed for the future mini-program plan.

```
POST /api/todo
Authorization: Bearer <token>
{ "title": "...", "repeat": { ... rule schema ... }, "due": "..." }
```

---

## DELETE `/api/todo/{id}`

Delete a todo rule (mini-program only).

---

## Repeat rule schema (mini-program creates; backend evaluates)

```jsonc
{
  "kind": "daily" | "weekly" | "monthly" | "yearly-festival" | "once",
  // for "weekly":
  "dayOfWeek": [1, 3, 5],          // 0=Sun, 1=Mon, ..., 6=Sat
  // for "monthly":
  "dayOfMonth": 1,
  // for "yearly-festival":
  "festivalKey": "春节" | "中秋" | "国庆" | "<any solar/lunar festival name>",
  // for "once":
  "date": "2026-12-25"
}
```

The backend uses `calendar.js` (jjonline/calendar.js)'s `solar2lunar()` output (`festival`, `lunarFestival`) to evaluate `yearly-festival` rules. This means the rule names must align with the festival strings calendar.js returns — see `beta/js/calendar.js`.

---

## Error shape (all endpoints)

```json
{ "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

| HTTP | code              | when                              |
| ---- | ----------------- | --------------------------------- |
| 400  | `BAD_REQUEST`     | malformed body / missing field    |
| 401  | `UNAUTHORIZED`    | missing or bad token              |
| 404  | `NOT_FOUND`       | unknown id / endpoint             |
| 500  | `INTERNAL`        | unexpected server error           |