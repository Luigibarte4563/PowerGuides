# PowerGuide Dagupan - User Web App

React front end for **PowerGuide Dagupan**, a crowdsourced platform where Dagupan residents report and
track power outages, floods and electrical hazards, see scheduled maintenance, find nearby power
stations and get notified about risks near their location.

This repository contains the **normal user app only** - there are no admin, company or role-management
screens.

---

## 1. Requirements

- Node.js 18+ (tested on Node 20)
- npm 9+
- A running XAMPP/Apache instance serving the PHP API at `http://localhost/CrowdsourcedAPI`

## 2. Setup

```bash
cd frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

The dev server runs on <http://localhost:5173>. Open that URL in your browser.

| Command           | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with hot reload      |
| `npm run build`   | Production build into `dist/`                  |
| `npm run preview` | Serve the production build locally             |
| `npm run lint`    | ESLint over `src/`                             |

### Environment variable

| Variable              | Default                            | Purpose                          |
| --------------------- | ---------------------------------- | -------------------------------- |
| `VITE_API_BASE_URL`   | `http://localhost/CrowdsourcedAPI` | Base URL of the PHP API          |

Only the base URL is configurable; **every request goes through the single client in
`src/api/client.js`**, which adds credentials (`credentials: 'include'`, plus an optional bearer
token if the API returns one), query-string building, timeouts, cancellation and error
normalisation.

### Local development: the dev proxy (recommended)

The PHP API only returns `Access-Control-Allow-Origin: http://localhost:5173`. If port 5173 is taken
by another project, Vite falls back to 5174 and every cross-origin request is blocked by the
browser.

To avoid that entirely, `vite.config.js` proxies `/CrowdsourcedAPI` to Apache and `.env` uses a
relative base URL, so every API call is same-origin:

```
# vite.config.js
server: { proxy: { '/CrowdsourcedAPI': { target: 'http://localhost' } } }

# .env
VITE_API_BASE_URL=/CrowdsourcedAPI
```

If you prefer the absolute URL (or you are building for a same-origin deployment), switch
`VITE_API_BASE_URL` in `.env` back to `http://localhost/CrowdsourcedAPI` and keep the app on port
5173.

## 3. Folder layout

```
frontend/                     # project root (this folder)
├── index.html
├── vite.config.js
├── tailwind.config.js        # design tokens (colours, radii, shadows, animation)
├── postcss.config.js
├── .env.example
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx              # providers: QueryClient, Router, Toast, Auth, Reference
    ├── App.jsx               # routes + scroll manager
    ├── index.css             # Tailwind layers, base styles, Leaflet overrides
    ├── api/                  # the ONLY place that talks to the backend
    │   ├── client.js         # fetch wrapper, ApiError, upload with progress, response helpers
    │   ├── auth.js           # register / login / logout / google / me
    │   ├── reference.js      # reference data
    │   ├── outages.js
    │   ├── maintenance.js
    │   ├── powerStations.js
    │   ├── notifications.js
    │   ├── location.js
    │   ├── battery.js
    │   ├── safetyTimers.js
    │   ├── floods.js
    │   ├── hazards.js
    │   ├── risk.js
    │   ├── heatmap.js        # heatmap + clusters
    │   └── index.js
    ├── assets/               # logo
    ├── components/           # shared UI
    │   ├── ui/               # Button, Input, Select, Card, Modal, Badge, Table, Tabs, Alert, States
    │   ├── layout/           # PageHeader
    │   ├── Map.jsx           # AppMap, MapPin, MapPoints, RadiusCircle, HeatLayer, MapLegend
    │   ├── MapPicker.jsx     # clickable map used by every location form
    │   ├── ImageUploader.jsx # preview + validation + progress
    │   ├── DataView.jsx      # loading / error / empty / data in one place
    │   ├── RecordCard.jsx    # responsive record card
    │   ├── FormModal.jsx     # modal + form with a wired submit button
    │   ├── ConfirmDialog.jsx
    │   └── Toast / context-backed toasts
    ├── context/
    │   ├── AuthContext.jsx   # user, session restore via me.php, login/register/logout
    │   ├── ReferenceContext.jsx  # loads reference/get.php once, shared everywhere
    │   └── ToastContext.jsx
    ├── hooks/
    │   ├── useGeolocation.js
    │   ├── useNotifications.js
    │   ├── useSavedLocation.js
    │   ├── useCountdown.js
    │   └── useDebouncedValue.js
    ├── layouts/
    │   ├── PublicLayout.jsx  # header, anchor nav, mobile menu, footer
    │   ├── DashboardLayout.jsx
    │   ├── Sidebar.jsx       # grouped nav, drawer on mobile
    │   └── Topbar.jsx        # page title, notification bell, user menu
    ├── pages/
    │   ├── Landing/          # landing page + sections
    │   ├── Auth/             # Login, Register, AuthShell
    │   ├── Dashboard/        # Overview, Outages, OutageDetail, Maintenance, PowerStations,
    │   │                     # Notifications, Location, Battery, SafetyTimers, Floods,
    │   │                     # Hazards, RiskAreas, Heatmap, Profile
    │   │   └── components/   # per-module form modals
    │   └── NotFound.jsx
    ├── routes/
    │   ├── index.jsx         # route map
    │   ├── navItems.js       # single source of truth for dashboard navigation
    │   ├── ProtectedRoute.jsx
    │   └── PublicOnlyRoute.jsx
    └── utils/
        ├── constants.js      # design tokens, tones, radii, query keys
        ├── formatters.js     # dates, durations, distances, labels
        ├── validators.js     # email, password, percentage, lat/lng validation
        ├── errorMessage.js   # human-readable errors + server field errors
        └── records.js        # response field normalisation (see "TODO" below)
```

## 4. Routes

| Route | Access | Page |
| ----- | ------ | ---- |
| `/` | Public | Landing page |
| `/login` | Public | Login (email + Google) |
| `/register` | Public | Register (email + Google) |
| `/auth/google-callback` | Public | OAuth landing: stores the JWT, then redirects to `/dashboard` |
| `/dashboard` | Protected | Overview with summary cards and quick actions |
| `/dashboard/outages` | Protected | Outage reports: All / Active / Resolved / My Reports |
| `/dashboard/outages/:id` | Protected | Outage report detail |
| `/dashboard/maintenance` | Protected | Maintenance schedules (list + map, read only) |
| `/dashboard/power-stations` | Protected | All / Available / Near me / My Posts + map |
| `/dashboard/notifications` | Protected | Notifications with mark-as-read |
| `/dashboard/location` | Protected | Saved location (geolocation + map adjustment) |
| `/dashboard/battery` | Protected | Devices, charge level, usage history and chart |
| `/dashboard/safety-timers` | Protected | Safety timers with live countdown |
| `/dashboard/floods` | Protected | Flood reports: all + nearby + create |
| `/dashboard/hazards` | Protected | Electrical hazards: all + nearby + create + owner status update |
| `/dashboard/risk-areas` | Protected | Combined nearby risks with adjustable radius |
| `/dashboard/heatmap` | Protected | Heatmap, clusters and layer toggles (read only) |
| `/dashboard/profile` | Protected | Account info from `me.php` + logout |

Unauthenticated visitors are redirected to `/login` (with the original destination remembered), and
signed-in visitors are redirected away from `/login` and `/register`.

### Google sign-in

`api/auth/google_callback.php` ends the OAuth round trip by redirecting the browser to
`{FRONTEND_URL}/auth/google-callback?token=<jwt>` on success, or to `{FRONTEND_URL}/login?error=<code>`
on failure. This app handles both:

- `/auth/google-callback` (`src/pages/Auth/GoogleCallback.jsx`) stores the token, restores the session
  through `me.php`, and replaces the URL with `/dashboard`. A missing token or a failed session shows a
  friendly message with a link back to login instead of a blank screen.
- `/login` maps the `error` codes (`google_auth_denied`, `google_exchange_failed`,
  `google_invalid_token`, ...) to plain-English copy in `src/pages/Auth/googleErrors.js`; raw codes are
  never shown.

Because the redirect target is decided by the backend, `FRONTEND_URL` in
`C:\xampp\htdocs\CrowdsourcedAPI\.env` **must match this dev server's origin** (currently
`http://localhost:5174`, because port 5173 is taken by another project). If Google sign-in lands on a
blank page or the wrong app, check that value first.

## 5. API coverage (52 endpoints)

| Feature | Endpoint(s) |
| ------- | ----------- |
| Auth | `register.php`, `login.php`, `logout.php`, `google.php`, `me.php` |
| Reference | `reference/get.php` |
| Outages | `create`, `get`, `get_active`, `get_resolve`, `get_my_report`, `get_detail`, `update` (owner), `delete` (owner), `upload_image` |
| Maintenance | `get`, `get_upcoming`, `maintenance_map/get` (read only) |
| Power stations | `create`, `get`, `get_available`, `get_near_location`, `get_my_posts`, `update` (owner), `delete` (owner) |
| Notifications | `get`, `mark_as_read`, `mark_all_as_read` |
| User location | `user_location/get`, `user_location/location` |
| Battery | `create`, `get`, `get_history`, `update`, `set_percentage`, `log_usage`, `delete` |
| Safety timers | `create`, `get`, `stop`, `delete` |
| Floods | `create`, `get`, `get_nearby` |
| Hazards | `create`, `get`, `get_nearby`, `update_status` (owner) |
| Risk areas | `risk/get_nearby` |
| Heatmap / clusters | `heatmap/get`, `cluster/get` |

`cluster/store.php` is intentionally unused, and maintenance create/update/delete is not built
because those actions are restricted to the utility company.

## 6. Design system

Tokens live in `tailwind.config.js` and are used consistently on every page:

- **Primary** electric amber (`primary-50…950`) - primary buttons, active states
- **Navy** (`navy-50…950`) - sidebar, top bar headings, body text
- **Status** colours: `success` (green), `warning` (amber), `danger` (red), `info` (blue)
- **Neutrals**: `canvas` page background, `surface`/white cards
- **Shape**: `rounded-card` (12px) and `rounded-control` (10px), soft `shadow-card`
- **Type**: Inter with a clear `h1 → h4` hierarchy
- **Icons**: `lucide-react` everywhere
- Severity and status are **always** rendered as a coloured badge **plus** text, never colour alone

## 7. Accessibility and responsiveness

- Mobile-first layout; sidebar becomes a drawer, tables become cards on small screens
- Semantic landmarks, a skip link per layout, `aria-current`/`aria-selected` on navigation
- Every input has a label, inline validation and `aria-invalid`/`aria-describedby`
- Modals trap focus, close on `Escape`, restore focus and lock body scroll
- Visible focus rings, status colours paired with text, `alt` on all images

## 8. Confirmed API contract

The contracts below were verified against the live API in `C:\xampp\htdocs\CrowdsourcedAPI`
(every response shape and write payload was exercised with a throwaway account).

### Authentication

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST api/auth/register.php` | `{ first_name*, middle_name?, last_name*, email*, password* }` (min 6 chars) | `{ success, message, user_id, token_issued }` |
| `POST api/auth/login.php` | `{ email*, password* }` | `{ success, message, user_id, token_issued }` |
| `GET api/auth/me.php` | – | `{ success, data: { id, first_name, middle_name, last_name, email, picture, auth_provider, role, role_id, created_at } }` |
| `POST api/auth/logout.php` | – | `{ success, message }` |
| `GET api/auth/google.php` | – | 302 to Google |
| `GET api/auth/google_callback.php` | – | 302 to `{FRONTEND_URL}/auth/google-callback?token=<jwt>`, or `/login?error=<code>` |

**Session handling:** the JWT is delivered as an httpOnly `jwt_token` cookie, and
`auth/jwt_auth.php` reads **only** that cookie - the `Authorization` header is ignored. Every request
therefore needs `credentials: 'include'` (the client does this). The one exception is the Google
flow, which hands the JWT to the frontend in the URL; `GoogleCallback.jsx` mirrors it into the same
cookie so the rest of the app is unchanged.

**Important:** `FRONTEND_URL` in the backend `.env` must point at the dev server origin
(`http://localhost:5174` if 5173 is taken) or the OAuth redirect lands on the wrong app.

### Payload rules that differ from the obvious guess

| Module | Key facts |
| --- | --- |
| `outage_report/create.php` | `{ location_name*, description*, barangay_name?, category?, severity?, hazard_type?, affected_houses?, started_at? }` -> `{ report_id }`. **Coordinates are geocoded from `location_name`** (no map pin is sent). Only one active report per user (`403`), and locations outside the coverage area are rejected (`403`). |
| `outage_report/get.php` | `?status=&category=` (matched by **name**). Rows carry **no `user_id`**, so ownership is resolved by intersecting ids with `get_my_report.php`; `get_detail.php` returns `403` for other users' reports. |
| `outage_report/get_active.php` / `get_resolve.php` | **Counts only** (`total_active_reports`, `total_resolved`) - the Active/Resolved tabs filter `get.php?status=` instead. |
| `outage_report/upload_image.php` | multipart field is **`image`** (not `file`) plus `outage_report_id`; 5 MB max. |
| `outage_report/delete.php` | `{ id }`, soft delete (`status = rejected`). |
| `maintenance/get.php` | one row per schedule with `locations: [{ barangay_name, lat, lng }]` and `radius` in metres. |
| `maintenance/get_upcoming.php` | **Count only** (`upcoming_count`), so the Upcoming tab filters `get.php` by `upcoming`/`ongoing`. |
| `power_station/create.php` | `{ station_name*, location_name*, station_type, access_type, availability_status, barangay_name?, operating_hours?, charging_type?, description? }`. Coordinates geocoded from `location_name`; **one station per user**; returns no id. |
| `power_station/delete.php` | `{ station_id }` (not `id`). |
| `power_station/get_available.php` | **Count only** (`total_available`) - the Available tab filters the list client-side. |
| `power_station/get_near_location.php` | takes **only `radius`**; the centre is the user's saved primary location. |
| `user_location/location.php` | `{ address*, barangay_name? }` - the client **cannot** send coordinates, so the location form is address-first. |
| `notification/get.php` | returns `unread_count` (total unread) - used for the bell. `mark_as_read.php` expects `{ notification_id }`. |
| `battery/*` | `device_type` enum: `phone, laptop, powerbank, ups, tablet, other`; keys are `device_id`, `device_name`, `current_percentage`, and `log_usage` needs `battery_percentage_start` + `battery_percentage_end`. |
| `safety_timer/create.php` | `timer_type_name` **or** `duration_hours` (hours, not minutes), plus `warning_hours_before`, `title`, `notes`. `get.php` returns the server-computed `status` (`running/warning/expired/stopped`) and `expected_expiration_at`. |
| `flood_report/create.php` | `{ location_name*, flood_level?, latitude?, longitude?, description?, barangay_name?, flood_depth_cm? }`; `flood_level` enum `low, moderate, high, severe`. |
| `electrical_hazard/create.php` | `{ location_name*, severity?, hazard_type?, latitude?, longitude?, description?, barangay_name? }`; `severity` enum `low, moderate, high, critical`; `update_status.php` expects `{ hazard_id, status }` with `reported/verified/resolved`. |
| `risk/get_nearby.php` | `{ counts, data: { floods, hazards } }`; rows use `category` (`flood`/`hazard`), `risk_level` and `distance` (metres). |
| `heatmap/get.php` | `?mode=by_barangay\|clusters&radius=&days=`; rows have `latitude`/`longitude`/`report_count`/`forecast_level` (intensity is derived from `report_count` for leaflet.heat). |
| `cluster/get.php` | rows use `center_latitude` / `center_longitude` / `radius_meters` / `forecast_level`. |
| `reference/get.php` | `data` keys: `roles`, `barangays`, `outage_categories`, `severity_levels`, `hazard_types`, `outage_statuses`, `power_station_types`, `safety_timer_types`, `notification_types`. Label columns are table specific (`barangay_name`, `category_name`, `severity_name`, `hazard_name`, `status_name`, `type_name`, `timer_name`) and **the API looks them up by name**, so the option value is the name. Requires a session (`401` otherwise). |

### Still unconfirmed / server-side issues to raise with the backend team

- **Geocoding is inaccurate.** `api/services/get_coordinates.php` calls Geoapify without
  `countrycodes=ph` or a proximity bias, so Dagupan addresses resolve to the wrong place
  (e.g. "San Carlos Cathedral, Dagupan City" -> California, "Poblacion, Dagupan City" -> Mindanao).
  Reports and power stations will land in the wrong country until the request is restricted, e.g.
  `...&countrycodes=ph&bias=proximity:120.3329,16.0433`.
- `outage_report/create.php` anti-spam counts reports whose status is `active`, `under_review` or
  `verified` without checking `is_active`.
- `flood_report/create.php` and `electrical_hazard/create.php` have a `!$geo['success'] ?? false`
  precedence bug, so an unresolvable address produces a 500 instead of the intended 404.
- `maintenance/update.php` and `maintenance/delete.php` return HTTP 500 (with `line`/`file` in the
  body) for ordinary validation failures.
- `notification/get.php` `unread_count` and `total` are not paginated totals, so the list is capped
  at the `limit` (100 is used in the app).
- `maintenance/get.php` drops schedules whose creator role is not `electric_company`.

## 9. Out of scope

- The `/backend` folder
- Admin / company dashboards and role management
- Maintenance create/update/delete
- `cluster/store.php`
