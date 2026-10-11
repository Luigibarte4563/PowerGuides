# SETUP.md — PowerGuide Dagupan from scratch

Everything needed to run this project on a machine that has never seen it, including
the CORS setup. `README.md` documents how the app works; this file documents how to
get it running.

- [1. What you need](#1-what-you-need)
- [2. The two repositories](#2-the-two-repositories)
- [3. Backend setup](#3-backend-setup)
- [4. Frontend setup](#4-frontend-setup)
- [5. CORS](#5-cors)
- [6. Google sign-in](#6-google-sign-in)
- [7. Verify the install](#7-verify-the-install)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Creating staff accounts](#9-creating-staff-accounts)

---

## 1. What you need

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ (tested on 20) | [nodejs.org](https://nodejs.org) |
| npm | 9+ | ships with Node |
| XAMPP | any current | Apache + PHP 8 + MariaDB in one installer |
| Composer | 2.x | [getcomposer.org](https://getcomposer.org) — only needed for the backend |
| Git | any | to clone the two repositories |

PHP needs the `pdo_mysql`, `curl`, `json`, `fileinfo` and `openssl` extensions. XAMPP
enables all of them by default.

Two accounts/API keys are optional but needed for the features that use them: a
**Geoapify** key (used only once, by `database/fill_barangay_coordinates.php` to
give the `barangays` table their centroids — after that the API never geocodes
addresses) and **Google OAuth** credentials.

---

## 2. The two repositories

This is the single most common source of confusion: **CORS lives in the backend repo,
not in this one.**

| Repo | GitHub | Contains |
|------|--------|----------|
| `PowerGuidesDagupan` | `Luigibarte4563/PowerGuides` | this React app (Vite + Tailwind) |
| `CrowdsourcedAPI` | `Luigibarte4563/CrowdsourcedAPI` | the PHP API, the database schema, **and `config/cors.php`** |

Because `cors.php` is only in the second repo, a clone of this repo alone contains no
CORS configuration at all — and if you edit `FRONTEND_URL` in the backend `.env`
expecting that to change CORS, nothing will happen. It does not. See [§5](#5-cors).

The frontend must be cloned anywhere; the backend must sit inside Apache's web root:

```
C:\xampp\htdocs\CrowdsourcedAPI     <- backend, web root (or wherever your htdocs is)
C:\path\to\PowerGuidesDagupan        <- frontend, anywhere
```

---

## 3. Backend setup

### 3.1 Clone and install

```bash
cd C:\xampp\htdocs
git clone https://github.com/Luigibarte4563/CrowdsourcedAPI.git
cd CrowdsourcedAPI
composer install
```

`composer install` is not optional — `config/env.php` requires
`vendor/autoload.php` (phpdotenv) before anything else runs.

### 3.2 Create the database

Start MySQL in the XAMPP control panel, then either:

**phpMyAdmin** — <http://localhost/phpmyadmin> → **Import** → choose
`database/powerguidedagupan.sql` → **Go**.

Or from a terminal:

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root < database\powerguidedagupan.sql
```

The script creates the `powerguide` database itself (it starts with
`DROP DATABASE IF EXISTS powerguide`, which is safe on a fresh install and
**destructive on an existing one** — never re-run it against real data).

It seeds everything needed, including the 36 Dagupan barangays and the `roles`,
`outage_categories`, `severity_levels`, `hazard_types`, `outage_statuses`,
`power_station_types`, `safety_timer_types` and `notification_types` lookup tables.

Already have a database from an older schema? Apply the additive migration instead:

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root powerguide < database\002_lineman_assignments.sql
```

### 3.3 Create `.env`

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

`.env` is **gitignored**, so a fresh clone does not have one — and without it every
endpoint fails immediately. Fill in:

| Key | Value |
|-----|-------|
| `DB_HOST` | `localhost` |
| `DB_NAME` | `powerguide` |
| `DB_USER` / `DB_PASS` | your MySQL credentials (XAMPP default is `root` / empty) |
| `JWT_SECRET_KEY` | a long random string. Changing it later invalidates every existing session |
| `GEOAPIFY_GEOCODING_API_KEY` | optional, needed for address geocoding |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | optional, see [§6](#6-google-sign-in) |
| `FRONTEND_URL` | `http://localhost:5174` — the OAuth redirect target, **not** CORS |
| `ALLOWED_ORIGINS` | leave commented out unless you bypass the proxy, see [§5](#5-cors) |

### 3.4 Confirm the API is serving

Start Apache in XAMPP, then:

```bash
curl -i http://localhost/CrowdsourcedAPI/api/reference/get.php
```

A `401` with a JSON body is the **correct** healthy answer — that endpoint needs a
session. A blank page, a PHP warning, or a 500 means `.env` or the database is wrong.

---

## 4. Frontend setup

```bash
cd <somewhere>\PowerGuidesDagupan
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

The committed `.env.example` is already correct for a normal machine — no editing
required:

```
VITE_API_BASE_URL=/CrowdsourcedAPI
```

That is a **relative** path. Requests go to the Vite dev server, which forwards
`/CrowdsourcedAPI` to Apache using the proxy in `vite.config.js`. The browser only
ever talks to one origin, so CORS never comes into play.

Open **<http://localhost:5174>**. The port is pinned with `strictPort: true` — if
something else already holds 5174, Vite refuses to start instead of silently moving
to 5175. That is deliberate: `FRONTEND_URL` in the backend `.env` must match this
origin exactly for Google sign-in to work.

If Apache is not on this machine's `localhost:80`, set the proxy destination in
`.env`:

```
API_PROXY_TARGET=http://192.168.1.10:8080
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | start the dev server with hot reload |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run lint` | ESLint over `src/` |

---

## 5. CORS

### The short version

**With the default configuration you do not need CORS at all.** The frontend calls
the API through the Vite proxy on its own origin, so every request is same-origin
and the browser never applies its CORS rules. This is why a fresh clone works on any
machine, over any host or port, without touching a single header setting.

CORS only becomes relevant if you switch `VITE_API_BASE_URL` to an absolute URL.

### Why the proxied path is the default

| | Proxied (default) | Absolute URL |
|---|---|---|
| `VITE_API_BASE_URL` | `/CrowdsourcedAPI` | `http://localhost/CrowdsourcedAPI` |
| Browser → | `localhost:5174` | `localhost:5174` then `localhost:80` |
| Cross-origin? | no | yes (different port) |
| `config/cors.php` consulted? | no | yes |
| Session cookie | always works | works only if the origin is allow-listed |

### Where the CORS config actually is

`CrowdsourcedAPI/config/cors.php`, included at the top of every endpoint, and the
only file that sets `Access-Control-*` headers. It matches the request's `Origin`
against an allow-list and **echoes it back only on a match**:

```php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    // ...
}
```

The default list is `http://localhost:5173`, `http://127.0.0.1:5173`,
`http://localhost:5174` and `http://127.0.0.1:5174`.

### If you need CORS: `ALLOWED_ORIGINS`

In `CrowdsourcedAPI/.env`:

```dotenv
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.20:5174
```

Comma separated, no spaces. This **replaces** the default list rather than adding to
it, so re-list any default you still want.

Typical reason to set it: you opened the dev server at `http://192.168.1.20:5174` (the
machine's LAN IP) and pointed `VITE_API_BASE_URL` at the absolute API URL. A LAN
origin is not on the localhost list, so the browser gets **no**
`Access-Control-Allow-Origin` header and blocks the request.

### Two rules that are not negotiable

- **`Access-Control-Allow-Origin: *` will not work.** The session is an httpOnly
  `jwt_token` cookie and every request is sent with `credentials: 'include'`. The
  spec requires a single exact origin in that case. The API must name your origin.
- **`FRONTEND_URL` does not control CORS.** In `CrowdsourcedAPI/.env` it is the
  Google OAuth redirect destination and nothing else. Editing it in the hope of
  fixing a CORS error is the most common wasted hour in this project.

### Checking it by hand

```bash
# Origin is allowed -> header comes back
curl -i -H "Origin: http://localhost:5174" \
  http://localhost/CrowdsourcedAPI/api/reference/get.php

# Origin is not allowed -> no Access-Control-Allow-Origin header at all
curl -i -H "Origin: http://192.168.1.20:5174" \
  http://localhost/CrowdsourcedAPI/api/reference/get.php
```

A missing header on the second command is correct behaviour, not a bug — it means
that origin is not on the list.

---

## 6. Barangay-sourced coordinates

This is the most important behaviour change in the frontend/backend contract:

**Every report, hazard, flood, power station and saved location is placed on the
map by its barangay's stored centroid.** The `barangays` table in the API
database holds `latitude`/`longitude` for each barangay. The form shows a
barangay dropdown (required); selecting one drops the map pin on that centroid.
The user may drag the pin to refine the point. The free-text `Location name` /
`Address` field is only a label shown to others; it is **never geocoded**.

### Where the coordinates live

| File | Purpose |
|------|---------|
| `database/fill_barangay_coordinates.php` | One-off script that geocodes each of the 37 barangay names via OSM/Geoapify and writes the result to the `barangays` table. Idempotent. |
| `database/003_barangay_coordinates.sql` | The script's output as literal `UPDATE` statements, so a second machine or CI just imports SQL. |
| `database/powerguidedagupan.sql` | The canonical seed now includes the coordinates, so a fresh import is correct. |
| `config/cors.php` | NOT involved — same-origin proxy means this never runs in dev. |

### What happens when a barangay has no coordinates

11 of the 37 barangays could not be resolved automatically (OSM/Geoapify had no
entry or returned the city centre). Those rows have `NULL` latitude/longitude in
the seed. If a user tries to submit a report in one of them, the API answers
**503** with the full list of missing barangays. The form surfaces this before
the user submits.

To fill in a missing barangay:

```bash
# Look up the centroid on a map, then:
"C:\xampp\mysql\bin\mysql.exe" -u root powerguide -e \
  "UPDATE barangays SET latitude = 16.0xxx, longitude = 120.3xxx WHERE barangay_name = 'Bacag';"
```

### Endpoints affected

| Endpoint | Required field | Optional refine |
|---|---|---|
| `outage_report/create.php` | `barangay_name` | `latitude`, `longitude` |
| `flood_report/create.php` | `barangay_name` | `latitude`, `longitude` |
| `electrical_hazard/create.php` | `barangay_name` | `latitude`, `longitude` |
| `power_station/create.php` | `barangay_name` | `latitude`, `longitude` |
| `user_location/location.php` | `barangay_name` | — |
| `maintenance/create.php` | `barangays[]` (names) | — |

---

## 7. Google sign-in

Optional. Skip it if you do not need it — email/password sign-in works regardless.

1. In the [Google Cloud console](https://console.cloud.google.com/), enable the
   **Google People API** and create an **OAuth 2.0 Client ID** of type *Web
   application*.
2. Add the exact authorized redirect URI:

   ```
   http://localhost/CrowdsourcedAPI/api/auth/google_callback.php
   ```

3. Copy the client ID and secret into `CrowdsourcedAPI/.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   GOOGLE_REDIRECT_URI=http://localhost/CrowdsourcedAPI/api/auth/google_callback.php
   FRONTEND_URL=http://localhost:5174
   ```

`FRONTEND_URL` is where `google_callback.php` sends the browser once the code is
exchanged — to `/auth/google-callback?token=...` on success. **It must match the dev
server origin exactly, including the port.** A mismatch is silent and confusing: the
round trip completes, a valid JWT is issued, and the browser is simply redirected to
a port nothing is listening on, so the app never loads. If Google sign-in lands on a
blank page, this value is the first thing to check.

Google accounts created for testing land in the `user` role — see
[§9](#9-creating-staff-accounts).

---

## 8. Verify the install

```bash
# 1. API reachable (a 401 here is healthy - the endpoint requires a session)
curl -i http://localhost/CrowdsourcedAPI/api/reference/get.php

# 2. Register through the API
curl -c cookies.txt -X POST http://localhost/CrowdsourcedAPI/api/auth/register.php \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","email":"test@example.com","password":"secret123"}'

# 3. Read back with the session cookie
curl -b cookies.txt http://localhost/CrowdsourcedAPI/api/auth/me.php
```

In the browser:

- <http://localhost:5174> loads the landing page.
- `/login` → register a throwaway account → you land on `/dashboard`.
- The dashboard loads reference data (barangays, categories, statuses) from
  `api/reference/get.php`. An empty sidebar or a failing reference call means the
  proxy is not reaching Apache.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Console: `CORS policy: No 'Access-Control-Allow-Origin' header` | Absolute URL + origin not allow-listed | Switch to `VITE_API_BASE_URL=/CrowdsourcedAPI`, or add the origin to `ALLOWED_ORIGINS` |
| Every request fails, API returns 500 | No `.env` in `CrowdsourcedAPI`, or a key is missing | Copy `.env.example` → `.env` and fill it in |
| `Failed to fetch` / `ECONNREFUSED` on every call | Apache is not running, or the proxy target is wrong | Start Apache; set `API_PROXY_TARGET` in the frontend `.env` |
| 404 on `/CrowdsourcedAPI/...` | API not in Apache's web root, or the folder name differs | Confirm the URL — the frontend hardcodes the `CrowdsourcedAPI` path |
| Vite refuses to start, "Port 5174 is in use" | Something else holds the pinned port | Free the port; the port cannot move (Google OAuth depends on it) |
| Login works, then 401 on the next call | Cookie blocked | Stay on the proxied relative URL — an absolute URL across origins drops the cookie unless the origin is allow-listed |
| Google sign-in lands on a blank page | `FRONTEND_URL` mismatch | Set `FRONTEND_URL=http://localhost:5174` in the backend `.env` |
| Dashboard loads but reference data is empty | `reference/get.php` failing | Check the browser network tab; the endpoint needs a valid session |
| Geocoded locations land in the wrong country | Known backend issue — no `countrycodes=ph` on the Geoapify request | Backend fix; out of scope for setup |

---

## 10. Creating staff accounts

New accounts always get the `user` role. There is no role-management UI and no
role endpoint — roles are granted by writing `users.role_id` in the database:

| Role | `role_id` | Can do |
|------|-----------|--------|
| `user` | 1 | resident app only |
| `lineman` | 2 | verify/update outages in **assigned** barangays only |
| `electric_company` | 3 | all company writes, maintenance, notifications, assign linemen |
| `admin` | 4 | everything |

Verify the ids against the `roles` table before writing:

```sql
SELECT id, role_name FROM roles;

UPDATE users SET role_id = 2 WHERE email = 'lineman@example.com';
```

Confirm the ids against your own `roles` table before trusting the numbers above —
the table is seeded by `database/powerguidedagupan.sql`.

Lineman access is scoped by the `lineman_assignments` table, which has no UI in the
resident app. Create assignments in the **company** app (`/company/assignments`,
managers only) or insert the rows directly.