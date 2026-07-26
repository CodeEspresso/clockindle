# Personal Fork Widgets (NAS + Todo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the V2 clockindle page (`index.html` + `js/main.js`) into a personal information panel showing today's todos (with on-Kindle check-off) and rotating NAS status, both backed by a write-capable API the user will deploy on their home NAS. Define the API contract so a future backend + WeChat mini-program can plug in.

**Architecture:**
- Two new widgets (NAS, Todo) follow the existing `function xxx() { xhr.open(); onreadystatechange; } + setInterval + cookie` pattern.
- The middle slot becomes a flex container: clock shrinks to ~6rem when at least one todo is active, expands back to ~13rem when empty. Click on clock still rotates screen (existing behavior preserved).
- API calls go through a single `js/api.js` helper that reads base URL + token from cookies (configurable via settings dialog).
- A self-contained `mock-backend/` Python server in this repo provides realistic stub data during local development, so the page works without the live NAS-deployed service.
- Treat Kindle as the deploy target; e-ink: every successful click causes a full container repaint via `innerHTML` (existing pattern). No incremental DOM patching.

**Tech Stack:**
- Vanilla ES5 JavaScript (Kindle WebKit constraint — see `beta/js/main.js:1` comment: "不支持模版字符串、箭头函数等es6语法").
- Python 3 stdlib `http.server` for `mock-backend/` (no extra deps).
- Existing third-party: `calendar.js` (local vendored, solar-lunar), `cookie.js` helpers.

**Out of Scope (separate plans, future repos):**
- Backend API server deployment (lives in its own repo, will run on user's home NAS, Python or Go).
- WeChat mini-program (lives in its own project, separate AppID + audit).

## Global Constraints

- **ES5 only.** No `let/const`, no arrow functions, no template literals, no `class`. Use `var` and `function () {}`. `setInterval` arguments are strings (e.g., `setInterval("clock()", 60 * 1000)`), matching existing code.
- **No new build tooling.** No `package.json`, no webpack/vite/esbuild in this repo. If a step seems to need one, find a stdlib or single-binary alternative instead.
- **No new dependency in `js/`.** All third-party JS that exists today is already vendored (`calendar.js`); nothing else may be added without explicit user OK.
- **No upstream PRs.** Everything below is personal-fork-only. The `beta/` directory mirrors upstream for sync only; do not edit files under `beta/` unless explicitly part of a task.
- **CLAUDE.md is untracked** (created during /init). Plan must not commit it; either leave it untracked or add it to `.gitignore`.
- **Cookie scope.** All settings use cookies via `js/cookie.js` (expiry in days). No `localStorage` (Kindle WebKit supports it but cookie pattern is established here).
- **Kindle browser constraints:** no synchronous XHR for widget fetches that block first paint. `getIpInfo()` synchronous call is upstream's choice — we won't add more.

## File Structure

```
clockindle/
├── index.html                                    # MODIFY  — add NAS + todo containers, load new widget scripts
├── js/
│   ├── main.js                                   # MODIFY  — un-minify, add NAS/todo modes + click handlers
│   ├── api.js                                    # CREATE  — base URL + token helper, fetchJson()
│   ├── cookie.js                                 # unchanged
│   ├── calendar.js                               # unchanged
│   └── widgets/
│       ├── nas.js                                # CREATE  — fetch + rotate + render
│       └── todo.js                               # CREATE  — fetch + render + click-toggle
├── css/
│   └── style.css                                 # MODIFY  — combined middle flex layout
├── docs/
│   ├── API.md                                    # CREATE  — backend contract spec
│   └── superpowers/plans/2026-07-26-personal-fork-widgets.md   # CREATE (this file)
└── mock-backend/
    ├── data.json                                 # CREATE  — sample NAS devices + todos
    └── server.py                                 # CREATE  — stdlib http server with CORS
```

Files that change together stay together: `js/widgets/nas.js` and the `nas` mode entry in `js/main.js` (declaration at top + click handler in `addEvent`); same for todo. We don't fragment each widget across three files.

---

## Task 1: Un-minify `js/main.js`

**Files:**
- Modify: `js/main.js` (replace its content with pretty-printed version)

The shipped `js/main.js` is one 29 KB line — unreadable, un-editable. Pretty-print it once now so subsequent tasks can be done by reading the file. The upstream `beta/js/main.js` is already readable, so this task only needs to port that readable form back into the canonical `js/main.js`.

**Why it matters:** Tasks 5–9 modify `main.js`. Doing that on a minified file is error-prone. The reproduction risk of one-time reformatting is acceptable because the un-minified version is already known-good (it's used by `beta/index.html`).

- [ ] **Step 1: Compare the two files byte-for-byte at the symbol level**

```bash
# Sanity check the beta copy is in fact a readable version of the same code.
diff <(grep -oE '[A-Za-z_][A-Za-z0-9_]*' js/main.js | sort -u) \
     <(grep -oE '[A-Za-z_][A-Za-z0-9_]*' beta/js/main.js | sort -u) | head -20
```
Expected: a small difference set (mostly minifier artifacts like `_tmp` renaming, string concatenation). If the diff is huge, stop and investigate — the files may have drifted.

- [ ] **Step 2: Replace `js/main.js` with the readable source**

```bash
cp js/main.js /tmp/main.js.bak
cp beta/js/main.js js/main.js
```

- [ ] **Step 3: Smoke test the page locally**

```bash
cd /vol2/1000/projects/clockindle
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
curl -s -o /tmp/page.html -w '%{http_code}' http://localhost:8000/
kill $SERVER_PID
```

Expected: `200` and `/tmp/page.html` contains `<title>　</title>` (the page loaded). Then open `http://localhost:8000/` in a real browser and click the top zone several times — top widget should still cycle. If anything breaks, `cp /tmp/main.js.bak js/main.js` to roll back.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "refactor: un-minify js/main.js to readable source for personal fork"
```

---

## Task 2: Document the backend API contract

**Files:**
- Create: `docs/API.md`

This task produces the **contract** that the future backend plan and WeChat mini-program plan both target. Treat this doc as ground truth — any drift later must update the doc first, then both consumers. The `mock-backend/` will conform to this contract from day one so the page can be developed against it.

- [ ] **Step 1: Write the contract**

Create `docs/API.md` with this exact content:

````markdown
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
````

- [ ] **Step 2: Verify the doc parses as valid Markdown**

```bash
# A rough check — Markdown files should at minimum start with H1 and contain one code block.
head -1 docs/API.md
grep -c '^```' docs/API.md
```
Expected: first line is `# Clockindle Personal-Fork Backend API Contract`; grep count is even (matches code fences).

- [ ] **Step 3: Commit**

```bash
git add docs/API.md
git commit -m "docs: backend API contract for personal-fork widgets"
```

---

## Task 3: Mock backend (local dev server + sample data)

**Files:**
- Create: `mock-backend/data.json`
- Create: `mock-backend/server.py`

Lets you develop against a real-ish HTTP server with CORS, no live NAS deployment needed. The page reads/writes here during dev; production flips to the user's NAS-deployed API.

- [ ] **Step 1: Sample data file**

Create `mock-backend/data.json`:

```json
{
  "nasDevices": [
    {
      "id": "synology-ds920",
      "name": "客厅 NAS",
      "status": { "cpu": 23, "mem": 41, "disk": 62, "temp": 42 },
      "updatedAt": "2026-07-26T14:32:01+08:00"
    },
    {
      "id": "qnap-ts453d",
      "name": "书房 NAS",
      "status": { "cpu": 9, "mem": 28, "disk": 51, "temp": 38 },
      "updatedAt": "2026-07-26T14:32:01+08:00"
    }
  ],
  "todos": [
    { "id": "t1", "title": "买菜", "done": false, "source": "rule:weekly-mon", "due": "2026-07-26T18:00:00+08:00" },
    { "id": "t2", "title": "还信用卡", "done": true,  "source": "rule:monthly-15", "due": "2026-07-26T20:00:00+08:00" },
    { "id": "t3", "title": "水费",   "done": false, "source": "rule:monthly-end", "due": "2026-07-26T21:00:00+08:00" }
  ],
  "token": "dev-token-please-change-me"
}
```

- [ ] **Step 2: Stdlib HTTP server**

Create `mock-backend/server.py` (Python 3, stdlib only):

```python
#!/usr/bin/env python3
"""Mock backend for clockindle personal-fork development.
Conforms to docs/API.md. NOT for production.
Run: python3 mock-backend/server.py [port]
Default port: 8765
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "data.json")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}


def load_data():
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def make_response(handler, status, body):
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    for k, v in CORS_HEADERS.items():
        handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(payload)


def check_auth(handler, data):
    header = handler.headers.get("Authorization", "")
    return header == "Bearer " + data.get("token", "")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # quieter than default
        sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/nas/devices":
            data = load_data()
            return make_response(self, 200, {
                "devices": data["nasDevices"],
                "intervalMs": 30000,
            })

        if parsed.path == "/api/todo":
            data = load_data()
            return make_response(self, 200, {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "items": data["todos"],
                "intervalMs": 600000,
            })

        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/todo/"):
            return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})

        data = load_data()
        if not check_auth(self, data):
            return make_response(self, 401, {"error": {"code": "UNAUTHORIZED", "message": "bad token"}})

        todo_id = parsed.path[len("/api/todo/"):]
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return make_response(self, 400, {"error": {"code": "BAD_REQUEST", "message": "invalid json"}})

        if "done" not in body or not isinstance(body["done"], bool):
            return make_response(self, 400, {"error": {"code": "BAD_REQUEST", "message": "missing bool field 'done'"}})

        for item in data["todos"]:
            if item["id"] == todo_id:
                item["done"] = body["done"]
                save_data(data)
                return make_response(self, 200, item)

        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": todo_id}})

    # POST and DELETE are out of scope (mini-program only). Return 404 so it is obvious.
    def do_POST(self):
        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": "use mini-program, not mock"}})

    def do_DELETE(self):
        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": "use mini-program, not mock"}})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = HTTPServer(("0.0.0.0", port), Handler)
    print("mock-backend listening on http://localhost:%d  (data: %s)" % (port, DATA_FILE))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Smoke test the mock backend**

```bash
cd /vol2/1000/projects/clockindle

# start server in background
python3 mock-backend/server.py 8765 > /tmp/mock-backend.log 2>&1 &
SERVER_PID=$!
sleep 1

# GET devices
curl -s http://localhost:8765/api/nas/devices | head -c 200
echo
# GET todos
curl -s http://localhost:8765/api/todo | head -c 200
echo
# PATCH with auth
curl -s -X PATCH \
     -H "Authorization: Bearer dev-token-please-change-me" \
     -H "Content-Type: application/json" \
     -d '{"done": true}' \
     http://localhost:8765/api/todo/t1
echo
# PATCH without auth → expect 401
curl -s -w '%{http_code}\n' -o /dev/null -X PATCH \
     -H "Content-Type: application/json" \
     -d '{"done": true}' \
     http://localhost:8765/api/todo/t1
# CORS preflight
curl -s -w '%{http_code}\n' -o /dev/null -X OPTIONS \
     -H "Origin: http://localhost:8000" \
     -H "Access-Control-Request-Method: PATCH" \
     http://localhost:8765/api/todo/t1

kill $SERVER_PID
```

Expected:
- First curl prints JSON with `devices` array.
- Second curl prints JSON with `items` array.
- Third curl prints JSON for the updated item with `done: true`.
- Fourth curl prints `401`.
- Fifth curl prints `204`.

- [ ] **Step 4: Add `.gitignore` entry for runtime logs**

Add `mock-backend/*.log` to `.gitignore`. Edit `.gitignore` and append:

```
mock-backend/*.log
```

- [ ] **Step 5: Commit**

```bash
git add mock-backend/ .gitignore
git commit -m "feat: mock-backend stdlib server for local dev"
```

---

## Task 4: API helper module

**Files:**
- Create: `js/api.js`

Single chokepoint for all HTTP calls. Reads base URL + token from cookies. Catches the failure modes that matter for this page (network down, CORS-preflight failures, JSON parse errors) and surfaces a friendly status string the caller can show.

- [ ] **Step 1: Write `js/api.js`**

```javascript
// Central API helper. ES5 only (Kindle WebKit).
// Reads apiBase + apiToken from cookies set via settings dialog.

var DEFAULT_API_BASE = "http://localhost:8765";

function getApiBase() {
  var b = getCookie("apiBase");
  return b ? b : DEFAULT_API_BASE;
}

function setApiBase(url) {
  setCookie("apiBase", url, 30);
}

function getApiToken() {
  return getCookie("apiToken");
}

function setApiToken(token) {
  setCookie("apiToken", token, 360); // 1 year
}

// fetchJson({ method, path, body, auth })
//   callback(status, parsedOrNull)  — status is HTTP code, parsedOrNull is
//   the parsed body on success or a {error:{code,message}} object on failure.
// Never throws; XHR errors produce status=0.
function fetchJson(opts, callback) {
  var xhr = new XMLHttpRequest();
  var url = getApiBase() + opts.path;
  xhr.open(opts.method || "GET", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (opts.auth !== false && getApiToken()) {
    xhr.setRequestHeader("Authorization", "Bearer " + getApiToken());
  }
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var status = xhr.status;
    var body = null;
    try {
      body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    } catch (e) {
      body = { error: { code: "BAD_RESPONSE", message: "invalid JSON" } };
    }
    callback(status, body);
  };
  try {
    xhr.send(opts.body ? JSON.stringify(opts.body) : null);
  } catch (e) {
    callback(0, { error: { code: "NETWORK", message: String(e) } });
  }
}
```

- [ ] **Step 2: Verify it loads without throwing in node**

```bash
# Just parse-check; the module touches `document`/`cookie` at runtime.
node -e "
  var fs = require('fs');
  var src = fs.readFileSync('js/api.js', 'utf8');
  // The file references globals getCookie/setCookie; declare stubs to satisfy a parse.
  var stub = 'var getCookie=function(){}; var setCookie=function(){}; var DEFAULT_API_BASE=\"x\";';
  new Function(stub + src)();
  console.log('API_HELPER_OK');
"
```
Expected: prints `API_HELPER_OK`.

- [ ] **Step 3: Load it in `index.html`**

Edit `index.html`, in the `<head>` after the `js/cookie.js` line, add:

```html
<script src="js/api.js"></script>
```

Add the same line in `index.html` (yes, the same line is added here — `index.html` is the only page the personal fork cares about; V1 pages are dormant).

- [ ] **Step 4: Smoke test**

```bash
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
curl -s http://localhost:8000/ | grep 'js/api.js'
kill $SERVER_PID
```
Expected: contains `<script src="js/api.js">`.

- [ ] **Step 5: Commit**

```bash
git add js/api.js index.html
git commit -m "feat: js/api.js helper with cookie-driven base URL + token"
```

---

## Task 5: NAS widget

**Files:**
- Modify: `js/main.js` (top-of-file mode arrays + click handler block)
- Modify: `index.html` (add `nas_container` div)
- Create: `js/widgets/nas.js`

Mirrors the existing widget pattern. Rotates `devices[]` every `intervalMs`, displaying one device at a time. Field-agnostic: whatever keys are in `status` get rendered as `key: value` lines.

- [ ] **Step 1: Add the widget script reference**

In `index.html`, after the `js/api.js` `<script>` tag (added in Task 4), add:

```html
<script src="js/widgets/nas.js"></script>
```

- [ ] **Step 2: Add the HTML container**

In `index.html`, inside the `<div id="bottom">` block, after `weather_container`, add:

```html
<div class="nas_container">
  <div id="nasTitle">NAS 加载中...</div>
  <div id="nasBody"></div>
</div>
```

- [ ] **Step 3: Write the widget**

Create `js/widgets/nas.js`:

```javascript
// NAS rotation widget.
// Fetches /api/nas/devices, rotates through devices every intervalMs.

var nas_data = null;       // full { devices, intervalMs }
var nas_index = 0;
var nas_timer = null;

function nas() {
  console.log("nas update");
  fetchJson({ method: "GET", path: "/api/nas/devices", auth: false }, function (status, body) {
    if (status !== 200 || !body || !body.devices) {
      document.getElementById("nasTitle").innerHTML = "NAS 数据获取失败 (" + status + ")";
      return;
    }
    nas_data = body;
    renderNas();
    if (!nas_timer) {
      nas_timer = setInterval("renderNas()", (body.intervalMs || 30000));
    }
  });
}

function renderNas() {
  if (!nas_data || !nas_data.devices || nas_data.devices.length === 0) {
    document.getElementById("nasTitle").innerHTML = "暂未配置 NAS";
    document.getElementById("nasBody").innerHTML = "";
    return;
  }
  var d = nas_data.devices[nas_index % nas_data.devices.length];
  nas_index++;

  var html = "<div style='font-size:1.5rem'>" + d.name + "</div>";
  // Render every status field generically. Unknown keys just become "key: value".
  var keys = Object.keys(d.status || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var label = k;
    if (k === "cpu") label = "CPU";
    else if (k === "mem") label = "内存";
    else if (k === "disk") label = "磁盘";
    else if (k === "temp") label = "温度";
    html += "<div>" + label + ": " + d.status[k] + (k === "temp" ? "°C" : "%") + "</div>";
  }
  html += "<div style='font-size:0.8rem'>" + d.id + "</div>";

  document.getElementById("nasTitle").innerHTML = "设备状态";
  document.getElementById("nasBody").innerHTML = html;
}
```

- [ ] **Step 4: Wire it into the V2 mode cycle**

Open `js/main.js`. Find `var BOTTOM_MODE = ["nonebtm", "weather"];` and change it to:

```javascript
var BOTTOM_MODE = ["nonebtm", "weather", "nas"];
```

Find `var BOTTOM_MODE = ["nonebtm", "weather"];` and verify there is no second definition downstream. (There shouldn't be — earlier exploration confirmed a single source.)

- [ ] **Step 5: Smoke test in browser**

1. Start mock backend: `python3 mock-backend/server.py &`
2. Start static server: `python3 -m http.server 8000 &`
3. Open `http://localhost:8000/`, click the bottom zone until you see "设备状态" with NAS name and stats. After ~30s the device name should rotate to the second NAS.
4. If the widget never appears, check console for `[nas update]` log.

- [ ] **Step 6: Commit**

```bash
git add js/widgets/nas.js js/main.js index.html
git commit -m "feat: NAS rotation widget"
```

---

## Task 6: Todo widget (read)

**Files:**
- Create: `js/widgets/todo.js`
- Modify: `js/main.js` (add a small render function called from `clock()` so combined-layout logic has data)
- Modify: `index.html` (add a `<div id="todo_container">` inside `#middle`)

This task adds the data fetch + render only; the combined middle-layout refactor is Task 8. For now, render the list directly into `#middle`, after the clock block, so we can verify the fetch & render in isolation.

- [ ] **Step 1: Add HTML container**

In `index.html`, inside `<div id="middle">` directly after the `</div>` that closes `#time_container`, add:

```html
<div id="todo_container" style="display:none">
  <ul id="todo_list" style="list-style:none;padding:0;margin:0;font-size:1.5rem"></ul>
</div>
```

Initial style is `display:none`; Task 8 swaps it based on data presence.

- [ ] **Step 2: Write the widget**

Create `js/widgets/todo.js`:

```javascript
// Todo widget (read-only this task; write is Task 7).

var todo_data = null;
var todo_timer = null;

function todo() {
  console.log("todo update");
  fetchJson({ method: "GET", path: "/api/todo", auth: false }, function (status, body) {
    if (status !== 200 || !body || !body.items) {
      // silent: clock+todo layout will fall back to clock-only when todo_data is null
      return;
    }
    todo_data = body;
    renderTodo();
    if (!todo_timer) {
      todo_timer = setInterval("todo()", (body.intervalMs || 600000));
    }
  });
}

function renderTodo() {
  var ul = document.getElementById("todo_list");
  if (!ul) return;
  if (!todo_data || !todo_data.items || todo_data.items.length === 0) {
    ul.innerHTML = "<li style='opacity:0.4'>没有待办</li>";
    return;
  }
  var html = "";
  for (var i = 0; i < todo_data.items.length; i++) {
    var it = todo_data.items[i];
    // Checkbox rendering: filled square for done, empty for pending.
    // Click handler is wired in Task 7.
    var box = it.done ? "☑" : "☐";
    var row = "<li data-id='" + it.id + "'>"
            + "<span class='todo_box'>" + box + "</span> "
            + escapeHtml(it.title)
            + "</li>";
    html += row;
  }
  ul.innerHTML = html;
}

function escapeHtml(s) {
  // Tiny HTML escaper for todo titles. Titles come from the user (mini-program).
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 3: Trigger fetch on load**

In `js/main.js`, find the `window.onload` function and append one more initialization call inside it (after the existing `changeBottomMode();` line). Add:

```javascript
todo();
```

(no timer setup here — `todo()` sets up its own timer once data arrives.)

- [ ] **Step 4: Smoke test**

1. `python3 mock-backend/server.py &` + `python3 -m http.server 8000 &`
2. Open `http://localhost:8000/` in browser, open DevTools console.
3. Console should print `[todo update]` after page load, and a `<ul id="todo_list">` should exist. It is `display:none` for now (Task 7/8 makes it visible when there are items).

- [ ] **Step 5: Commit**

```bash
git add js/widgets/todo.js js/main.js index.html
git commit -m "feat: todo widget (read-only render)"
```

---

## Task 7: Todo checkbox write-back

**Files:**
- Modify: `js/widgets/todo.js`
- Modify: `js/main.js` (wire container `click` event delegation in `addEvent`)

Turns the rendered list into a live widget: clicking a row PATCHes the backend. Also clears the saved todo timer when switching between dates so re-render on next fetch picks up the new state cleanly.

- [ ] **Step 1: Append click handler to `js/widgets/todo.js`**

Open `js/widgets/todo.js`. Append at the end of the file (below the existing `escapeHtml` function):

```javascript
var todo_click_bound = false;
function bindTodoClick() {
  if (todo_click_bound) return;
  var ul = document.getElementById("todo_list");
  if (!ul) return;
  ul.addEventListener("click", function (e) {
    var li = e.target && e.target.closest && e.target.closest("li[data-id]");
    if (!li) return;
    var id = li.getAttribute("data-id");
    if (!id) return;
    toggleTodo(id, li);
  });
  todo_click_bound = true;
}

function toggleTodo(id, liEl) {
  if (!getApiToken()) {
    alert("尚未配置 API Token,无法标记完成。请先打开右上角设置填写。");
    return;
  }
  var currentDone = liEl.querySelector(".todo_box").innerHTML === "☑";
  var nextDone = !currentDone;
  // optimistic UI: flip the box immediately so the e-ink user sees feedback
  liEl.querySelector(".todo_box").innerHTML = nextDone ? "☑" : "☐";
  fetchJson({ method: "PATCH", path: "/api/todo/" + encodeURIComponent(id), body: { done: nextDone } }, function (status, body) {
    if (status !== 200) {
      // revert on failure
      liEl.querySelector(".todo_box").innerHTML = currentDone ? "☑" : "☐";
      console.error("toggle failed", status, body);
    } else {
      // update local cache so next renderTodo() reflects the new state
      if (todo_data && todo_data.items) {
        for (var i = 0; i < todo_data.items.length; i++) {
          if (todo_data.items[i].id === id) todo_data.items[i].done = nextDone;
        }
      }
    }
  });
}
```

The `todo_click_bound` flag prevents duplicate handler attachment on every todo refresh.

- [ ] **Step 2: Auto-bind on first paint**

Open `js/widgets/todo.js`. Find the `todo()` function. Inside its `if (status === 200)` block, immediately after the existing `renderTodo();` line, add:

```javascript
bindTodoClick();
```

- [ ] **Step 3: Verify server-side persistence**

1. With both servers running, open the page.
2. After loading, click the first todo's box. Confirm the box flips to ☑ immediately.
3. `curl -s http://localhost:8765/api/todo | python3 -m json.tool`
4. Expected: the matching `id` has `"done": true` now.

- [ ] **Step 4: Verify auth failure path**

1. In browser DevTools, run: `document.cookie = "apiToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; location.reload();`
2. Click any todo box. Expected: `alert("尚未配置 API Token...")` and no network request issued (check DevTools Network tab).

- [ ] **Step 5: Commit**

```bash
git add js/widgets/todo.js
git commit -m "feat: todo checkbox click toggles done state via PATCH"
```

---

## Task 8: Combined clock + todo middle layout

**Files:**
- Modify: `css/style.css`
- Modify: `js/main.js` (call layout update after data loads)
- Modify: `js/widgets/todo.js` (trigger layout after render)

The middle slot becomes a column flex container holding clock + todo list. The clock shrinks when todos are present, re-expands when todos are empty. Existing click semantics survive: clicking `.time` rotates screen, clicking `#date` cycles background.

- [ ] **Step 1: Add CSS rules**

In `css/style.css`, before the final `.light{...}/.dark{...}` definitions, append:

```css
/* Personal-fork: combined clock + todo middle slot. */
#middle {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
#middle.shrunk .time { font-size: 6rem; line-height: 5rem; }
#middle.shrunk .date { font-size: 1.5rem; line-height: 1.5rem; }
#middle.shrunk #apmOuterWrapper { line-height: 1.8rem; height: 6rem; }
#middle.shrunk #apmOuterWrapper #apm { font-size: 1rem; }
#todo_container { width: 90%; }
#todo_container ul li { line-height: 1.6; }
#todo_container .todo_box { display: inline-block; width: 1.5rem; }
#time_container { transition: none; }
```

Note: no `transition` — e-ink can't animate, and CSS transitions cause partial repaints we don't want.

- [ ] **Step 2: Add layout-toggle helper**

In `js/widgets/todo.js`, after `renderTodo`, append:

```javascript
function applyTodoLayout() {
  var middle = document.getElementById("middle");
  var todo = document.getElementById("todo_container");
  if (!middle || !todo) return;
  var hasItems = todo_data && todo_data.items && todo_data.items.length > 0;
  todo.style.display = hasItems ? "block" : "none";
  if (hasItems) middle.classList.add("shrunk");
  else middle.classList.remove("shrunk");
}
```

Then inside `renderTodo()`, after `ul.innerHTML = html;`, add:

```javascript
applyTodoLayout();
```

- [ ] **Step 3: Trigger layout update when clock() runs**

`clock()` runs every minute. If the user cleared all todos during the day, we want the layout to relax back to full-size without waiting for the next todo fetch. In `js/main.js`, find the `clock(autoMode)` function. At the bottom, just before its closing `}`, add:

```javascript
if (typeof applyTodoLayout === "function") applyTodoLayout();
```

- [ ] **Step 4: Smoke test**

1. With mock backend running, `python3 -m http.server 8000 &`.
2. Open page in browser at `http://localhost:8000/`.
3. Initial paint: clock should be small (6rem class active), todo list visible below.
4. In console run: `todo_data = { items: [] }; applyTodoLayout(); clock(document.getElementsByClassName('page')[0].classList.contains('dark'));`
5. Expected: clock jumps to full 13rem size, todo container hides.
6. Restore: `todo();` then wait for refresh; layout goes back to shrunk.

- [ ] **Step 5: Commit**

```bash
git add css/style.css js/main.js js/widgets/todo.js
git commit -m "feat: combined clock+todo middle layout"
```

---

## Task 9: Settings dialog update — API base + token

**Files:**
- Modify: `index.html` (settings_card body)
- Modify: `css/style.css` (extra input spacing)
- Modify: `js/main.js` (extend `saveSettings`)

Right now the settings dialog only accepts the qweather API key. Add two fields above it: API base URL and API token. Save persists all three to cookies.

- [ ] **Step 1: Extend the HTML form**

In `index.html`, locate the `<div class="settings_content">` block. Add two more input lines BEFORE the existing qweather line:

```html
<div class="settings_row">
  <span>后端 API 地址:</span>
  <input id="api_base_input" class="settings_input" type="text"
         placeholder="http://localhost:8765">
</div>
<div class="settings_row">
  <span>API Token:</span>
  <input id="api_token_input" class="settings_input" type="password"
         placeholder="dev-token-please-change-me">
</div>
```

Keep the existing qweather block below.

- [ ] **Step 2: Add CSS for the new rows**

Append to `css/style.css`:

```css
#settings_dialog .settings_row { padding: 0.5rem 0; }
#settings_dialog .settings_row span { display: inline-block; min-width: 8rem; }
```

- [ ] **Step 3: Hydrate + persist inputs in settings dialog**

In `js/main.js`, find `openSettingsDialog()`. Replace its body with:

```javascript
function openSettingsDialog() {
  clearTimeout(settings_timer);
  document.getElementById("api_base_input").value = getApiBase();
  document.getElementById("api_token_input").value = getApiToken();
  document.getElementById("qweather_input").value = KEY_QWEATHER;
  document.getElementById("settings_dialog").style.display = "block";
}
```

Find `saveSettings()`. Replace its body with:

```javascript
function saveSettings() {
  var baseEl = document.getElementById("api_base_input");
  var tokEl = document.getElementById("api_token_input");
  var qEl = document.getElementById("qweather_input");
  setApiBase(baseEl.value || DEFAULT_API_BASE);
  setApiToken(tokEl.value);
  KEY_QWEATHER = qEl.value;
  setCookie("qweatherKey", KEY_QWEATHER, 360);
  closeSettingsDialog();
  window.location.reload();
}
```

- [ ] **Step 4: Smoke test**

1. Open page, click gear icon (top-right). Dialog should show three fields.
2. Type `http://localhost:8765` and `dev-token-please-change-me`, save. Page reloads.
3. Confirm `document.cookie` contains `apiBase=http%3A%2F%2Flocalhost%3A8765` and `apiToken=dev-token-please-change-me`.
4. Click any todo — should now succeed (no alert) because token is set.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/main.js
git commit -m "feat: settings dialog accepts apiBase + apiToken"
```

---

## Task 10: On-device Kindle smoke test

**Files:** none.

This is verification, not implementation. Run through every interaction on a real Kindle (or Kindle emulator).

- [ ] **Step 1: Deploy to GitHub Pages on the fork**

```bash
git push origin dev/personal-fork:master
# Now CodeEspresso/clockindle GitHub Pages is live on the personal fork.
```

Verify Pages is enabled: GitHub → repo → Settings → Pages → Build from `master` branch root.

- [ ] **Step 2: Front the mock backend publicly (temporary)**

If you can't put a Kindle on the same LAN as your dev box, expose `mock-backend/server.py` via Cloudflare Tunnel or `ngrok tcp` long enough to do the smoke test. **Disable the tunnel afterwards — `dev-token-please-change-me` is a known credential.**

- [ ] **Step 3: Kindle interactions checklist**

On the Kindle browser, navigate to `https://<your-gh-pages>/`, then verify (each is one observation):

- [ ] Page loads (clock + 3 sample todos visible, clock font shrunk).
- [ ] Tap top zone: cycles through none → hitokoto → poem → weibo → none. Each widget fully draws.
- [ ] Tap bottom zone: cycles through none → weather → NAS (rotates devices every 30s).
- [ ] Tap `.time`: page rotates 90° each tap; clock remains readable after each rotation.
- [ ] Tap `#date`: background cycles light → dark → auto → pic → light.
- [ ] Tap a todo box: flips immediately to ☑; refresh confirms `done: true` in backend.
- [ ] Tap gear icon, fill settings, save: page reloads, settings persist.
- [ ] In airplane mode after first paint: clock keeps ticking, ip-based modules show stale data (expected — only calendar.js is fully offline).
- [ ] With `~ds` typed in Kindle search bar (per README), confirm screen does not lock.

If any item fails, file an issue against the task that owns that area (Task 4 for NAS, Task 7 for todo PATCH, Task 8 for layout, etc.).

- [ ] **Step 4: Final commit / close branch**

```bash
# If smoke test surfaced changes, commit them first.
git status
git add -A
git commit -m "fix: <task-X> adjustments from on-device verification"
git push origin dev/personal-fork:master
```

---

## Spec Coverage Self-Review

| Requirement | Task |
| --- | --- |
| Two new widgets (NAS, Todo) | T5, T6 |
| Multi-device NAS rotation | T5 (renderNas + intervalMs) |
| Field-agnostic NAS interface | T5 (Object.keys loop on status) |
| Self-hosted backend contract | T2 |
| WeChat mini-program hookup | (deferred to future plan; T2 documents POST/DELETE shape) |
| Daily/weekly/monthly/yearly-festival/once repeat | T2 (schema), backend plan will implement |
| Clock shrinks when todo present | T8 |
| Checkbox marks done from Kindle | T7 |
| IPv6 / domain / CORS readiness | T2 (CORS headers), T3 (mock has them) |
| Fork workflow | set up before this plan (see context) |
| ES5 constraint | every `js/` file uses var + function declarations |
| No new build tooling | .gitignore unchanged (no node_modules), no package.json added |
| CLAUDE.md not committed | not touched in any task |

## Known Open Decisions (for future plans, not blockers)

1. **Backend tech** (next plan). Plan assumes Python Flask or stdlib `http.server` since the mock is already that. Could be Go if user prefers — would just re-implement `mock-backend/server.py`'s shape.
2. **WeChat mini-program stack** (later plan). `tcb` (云开发) would let us skip hosting the backend on NAS entirely. Or native mini-program + custom backend. Decision affects `cloudfunctionId` config field needed in `index.html`.
3. **Auth scheme strength.** Currently a single Bearer token. For real deploy, swap to per-device tokens or pin to specific origin. Backend plan owns.
4. **Time zone handling for "today"**. The page passes `?date=` to backend when off-by-one risk is high; default is server-side "today in user's tz." Backend plan owns.
