# Kindle On-Device Smoke Checklist (personal-fork)

Tailored to the state of `CodeEspresso/clockindle` fork as of the deploy on 2026-07-27.

---

## 0. Pre-flight (run before going to the Kindle)

These steps are the user's responsibility; the AI agent does not open tunnels.

### 0.1 Enable GitHub Pages (one-time, via browser)

1. Open `https://github.com/CodeEspresso/clockindle/settings/pages`.
2. Under **Source**, choose **Deploy from a branch**.
3. Branch: **`master`**, folder: **`/ (root)`**.
4. Click **Save**.
5. Wait ~30s. Reload the page; the banner will read "Your site is live at `https://codeespresso.github.io/clockindle/`".

If the Pages API still 404s after a minute, re-check that the branch actually contains `index.html` at the root:

```bash
gh api repos/CodeEspresso/clockindle/contents/index.html?ref=master --jq '.name'
```

### 0.2 Expose `mock-backend/server.py` to the Kindle

The Kindle browser lives off-LAN from the dev box. Pick ONE:

- **Cloudflare quick tunnel** (no account needed):
  ```bash
  cloudflared tunnel --url http://localhost:8765
  ```
  Note the printed `https://*.trycloudflare.com` URL — that becomes your `apiBase` cookie value (Step 2 below).
- **`ngrok tcp`** (only useful if your Kindle can reach a TCP port — it can't, only HTTPS, so prefer cloudflared or `ngrok http 8765`).

Run the mock on the dev box first:

```bash
cd /vol2/1000/projects/clockindle
python3 mock-backend/server.py 8765
```

You should see `mock-backend listening on http://localhost:8765  (data: /vol2/1000/projects/clockindle/mock-backend/data.json)`.

Smoke test the tunnel from any browser before going to the Kindle:

```
https://<your-tunnel-host>/api/todo
```

Expected JSON: `{"date":"2026-07-27","items":[...3 sample todos...],"intervalMs":600000}`.

> **Security note:** `data.json` ships with `token = "dev-token-please-change-me"`. This is a known credential. Tear the tunnel down as soon as the smoke test is done. Do not point the tunnel at the real backend until you have rotated the token.

---

## 1. Open the page on the Kindle

On the Kindle experimental browser, navigate to:

```
https://codeespresso.github.io/clockindle/
```

(That's the Pages URL once Step 0.1 is done. If you are testing from a desktop emulator first, the same URL works.)

Tick when the page renders:
- [ ] Large clock digits visible (e.g. `15:42`).
- [ ] Three todo lines visible **under** the clock: `买菜`, `还信用卡`, `水费`. The first two are open boxes `☐` for the first one and `☑` for the second (already done in `data.json`).
- [ ] Clock digits are visibly smaller than the upstream build (the `shrunk` class is applied because `todo_data.items.length > 0`).
- [ ] No console error banner; no missing-asset warning.

---

## 2. Configure backend cookies (one-time per Kindle)

The page uses three cookies read on every request:

| Cookie name  | Example value (Cloudflare tunnel)                  | Purpose                                                                 |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `apiBase`    | `https://abc-xyz.trycloudflare.com`                | Backend root. Read by `js/api.js:getApiBase()` (default `http://localhost:8765`). |
| `apiToken`   | `dev-token-please-change-me`                       | Bearer token for write endpoints. **Required** to toggle todos.         |
| `qweatherKey`| `<your-qweather-web-api-key>`                      | HeFeng weather. The page shows a QR code in settings to create a free key. |

How to set them on the Kindle (the experimental browser does **not** expose `document.cookie` devtools, so the supported path is the in-page settings dialog):

1. Tap the gear icon in the top-right (id `#settings_icon`). The settings card slides in.
2. Fill the three fields:
   - **后端 API 地址** -> `<your tunnel URL>` (no trailing slash).
   - **API Token** -> `dev-token-please-change-me` (or whatever the real backend uses).
   - **天气API KEY** -> your QWeather key.
3. Tap the green save button (`#save_button`). The page reloads.

Tick when each is set:
- [ ] Re-open the settings dialog; all three fields show what you typed (they're now persisted as cookies).
- [ ] The weather module (after a top-zone / bottom-zone cycle that lands on weather) shows real city/temp instead of "请刷新后点击右上角设置按钮填写 API Key～".
- [ ] The todo checkbox click succeeds without the "尚未配置 API Token" alert (see Step 6).

If you can't reach the settings dialog (rare, but e-ink ghost taps happen), reset cookies via Kindle Settings -> Apps -> Experimental Browser -> Clear Cookies, then reload.

---

## 3. Zone taps (top / bottom / clock / date)

Each tap is one observation. Tick the box only when the **exact** thing described happens.

- [ ] **Tap top zone (`#top`)** — cycles: none -> hitokoto -> poem -> weibo -> none. Each widget fully draws (text fills, no half-rendered frame stuck on the previous one).
- [ ] **Tap bottom zone (`#bottom`)** — cycles: none -> weather -> NAS. When NAS lands, after ~30s the body rotates from "客厅 NAS" to "书房 NAS" and back.
- [ ] **Tap clock (`.time`)** — page rotates 90 degrees each tap. Clock digits remain readable (no clipping, no overlapping todo lines) at 0/90/180/270. The `.rotate-90/180/270` classes on `<body>` reflect the change.
- [ ] **Tap date (`#date`)** — background cycles: light -> dark -> auto -> pic -> light. In **auto** mode, the page re-evaluates light vs dark based on the local hour (Kindle's clock vs QWeather location may disagree — this is expected, no fix in scope).

---

## 4. NAS widget specifically

With bottom zone on NAS:
- [ ] Title shows `设备状态` (not `NAS 数据获取失败 (...)`).
- [ ] First device rendered is `客厅 NAS` with CPU / 内存 / 磁盘 / 温度 lines and a °C suffix on the temp value.
- [ ] After ~30s, the body swaps to `书房 NAS` with its own values; title stays `设备状态`.
- [ ] The small `id` line at the bottom reads `synology-ds920` then `qnap-ts453d`.
- [ ] Refresh the page: device rotation restarts from device index 0 (matches `nas_index = 0` reset on reload).

If the title reads `NAS 数据获取失败 (0)`: tunnel is down or `apiBase` cookie missing/wrong.
If the title reads `暂未配置 NAS`: `data.json` has an empty `nasDevices` array.

---

## 5. Todo widget specifically

With the page showing todos (Step 1), without toggling anything yet:
- [ ] Three lines: `☐ 买菜`, `☑ 还信用卡`, `☐ 水费`.
- [ ] Clock digits are visibly smaller than on a todo-less page (the `middle` element gets `.shrunk`).

Now tap the `☐` next to `买菜`:
- [ ] Box flips to `☑` **immediately** (optimistic UI), then the page keeps that state. No page reload.
- [ ] In a desktop browser pointed at `http://localhost:8765/api/todo`, the `买菜` item now reports `done: true`.
- [ ] In `mock-backend/data.json` on disk, `todos[0].done === true` (the mock persists to disk).

Tap the same box again to flip back:
- [ ] Box reverts to `☐`; backend confirms `done: false`.

Edge case: tap a box **before** `apiToken` cookie is set — the page should `alert("尚未配置 API Token,无法标记完成。请先打开右上角设置填写。")` and the box must NOT flip.

---

## 6. Settings dialog round-trip

- [ ] Open settings (gear icon). Fill all three fields with junk (`http://example.invalid` / `wrong-token` / `wrong-key`).
- [ ] Tap save. Page reloads.
- [ ] Re-open settings. All three fields show the junk (proves cookies persisted).
- [ ] Reset to the real values from Step 2. Save. Page reloads.
- [ ] Weather module shows real data again (proves `qweatherKey` cookie survived the reload).

---

## 7. Offline / airplane mode

After first paint with the network on:
- [ ] Toggle airplane mode (swipe down from top on the Kindle, enable Airplane Mode).
- [ ] Wait 60s. The clock digits keep ticking (the clock module is a JS `setInterval` on local time — no network).
- [ ] Hitokoto / poem / weibo / weather / NAS show the **last cached** value they had before airplane mode. They do NOT clear, they do NOT spin a loader forever — they're stale until network returns. (`todo()` will silently no-op because `fetchJson` will produce status=0; the existing todo list stays rendered until the next successful fetch.)
- [ ] Only `calendar.js` (lunar + solar festival) is fully offline — `getLunar()` should still produce a valid lunar date string when offline.

Expected (NOT a bug): the iplookup-backed weather cache (`cityLocation`, `timezoneOffset`) becomes stale once offline; do not file an issue for that.

---

## 8. Screen-lock disable

Per the README, on the Kindle home screen (NOT inside the browser):

- [ ] Tap the search bar, type `~ds`, press Enter. No visible UI feedback is expected.
- [ ] Press the power button. The screen should NOT lock — the page keeps showing.
- [ ] After testing, reboot the Kindle to restore normal lock behavior.

---

## 9. Cleanup (do NOT skip)

- [ ] Stop `python3 mock-backend/server.py` (Ctrl-C).
- [ ] Kill the tunnel process (`Ctrl-C` on `cloudflared` or `ngrok`).
- [ ] Verify `mock-backend/data.json` — if the smoke test left real todos toggled, restore them manually or revert the file (the mock writes back on every successful PATCH).
- [ ] Do NOT leave `dev-token-please-change-me` exposed anywhere.

---

## Failure routing

| Symptom                                          | Likely owner | Notes                                                            |
| ------------------------------------------------ | ------------ | ---------------------------------------------------------------- |
| NAS widget shows `NAS 数据获取失败 (status)`     | Task 5 / T2  | Check tunnel + `apiBase` cookie first; then file against T5.     |
| Todo PATCH flips back to old state instantly     | Task 7       | PATCH endpoint not responding; auth (401) or CORS preflight.     |
| Tap zones don't cycle or page layout is broken   | Task 8       | Layout / click binding regression.                               |
| Settings dialog won't save or fields don't stick | Task 9       | Cookie write or `saveSettings` regression.                       |
| Clock face is full-size even with todos present  | Task 8       | `applyTodoLayout` not running (check `middle.shrunk` class).     |
| Page won't load at all on Pages                  | Task 10 / 0  | Confirm `master` branch on fork has `index.html` at root.        |