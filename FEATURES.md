# PowerGuide Dagupan — Features

PowerGuide Dagupan is a crowdsourced platform for Dagupan residents to report and track power
outages, floods and electrical hazards, see scheduled maintenance, find nearby power stations and
get notified about risks near their location.

This document is the **product feature catalogue** — what the app does and who can do it.
For setup, architecture and the full API contract, see [`README.md`](README.md) and
[`SETUP.md`](SETUP.md).

---

## Apps at a glance

The codebase ships two apps:

| App | Route | Who uses it | Purpose |
| --- | ----- | ----------- | ------- |
| **Resident app** | `/dashboard` | Every signed-in user | Report problems, track status, see schedules and nearby risks |
| **Staff app** | `/company` | `lineman`, `electric_company`, `admin` | Verify reports, post field updates, manage maintenance, broadcast notifications, assign linemen |

| Role | Reaches |
| ---- | ------- |
| `user` | `/dashboard` only |
| `lineman` | both apps; outage access limited to assigned barangays |
| `electric_company` | both apps; all company writes, assignment management |
| `admin` | everything |

Role management itself is **not** built — the API has no endpoint for it, so roles are granted by
writing `users.role_id` in the database.

---

## Public site

| Route | Page |
| ----- | ---- |
| `/` | Landing page |
| `/login` | Login (email + Google) |
| `/register` | Register (email + Google) |
| `/auth/google-callback` | OAuth landing: stores the JWT, then redirects to `/dashboard` |

### Landing page

- **Hero** — the platform pitch with calls to action into sign-up and the resident app
- **Features grid** — the headline capabilities at a glance
- **How it works** — the report → verify → resolve flow, step by step
- **Safety** — guidance on what to do during an outage or around hazards
- **CTA banner** — closing prompt to create an account
- Header with anchor navigation and a mobile menu, plus a footer

### Accounts and sign-in

- Email registration with first / middle / last name and a password of at least 6 characters
- Email + password login
- **Google sign-in** — the API owns the OAuth round trip and redirects back with a JWT; the app
  stores it, restores the session and replaces the URL so it never lingers in history
- Friendly, plain-English messages for every Google error code (`google_auth_denied`,
  `google_exchange_failed`, `google_invalid_token`, …) — raw codes are never shown
- Session restored on load from `me.php`, so a reload never signs the user out
- Unauthenticated visitors are redirected to `/login` with their original destination remembered;
  signed-in visitors are redirected away from `/login` and `/register`
- Access-denied page for a signed-in user following a deep link they cannot use

---

## Resident app (`/dashboard`)

### Overview

- Summary cards across reports, stations, notifications and saved location
- Quick actions to the most common tasks (report an outage, report a hazard, check risk nearby)

### Outage reporting and tracking

- Report an outage with a barangay, location label, description, category, severity, hazard type,
  affected houses and a start time
- Attach a photo, with client-side preview, validation and upload progress
- Tabs for **All / Active / Resolved / My Reports**
- Report detail page with full status history
- Update or delete your own report (update and delete are owner-scoped by the API)
- Only one active report per user, enforced by the API

### Flood reports

- Report flooding with a location, flood level (`low`, `moderate`, `high`, `severe`), depth and
  description
- Browse all flood reports and the ones **nearby** you, to plan your routes

### Electrical hazards

- Flag downed wires, exposed cables and other hazards with severity
  (`low`, `moderate`, `high`, `critical`) and hazard type
- Browse all hazards and the ones **nearby** you
- Owners update their own hazard status: `reported` → `verified` → `resolved`

### Risk areas

- Combined nearby view of **active floods + unresolved hazards** around you
- Adjustable search radius, with per-item category, risk level and distance

### Heatmap and clusters

- Heatmap of report density, either **by barangay** or as stored **clusters**
- Layer toggles and a map legend
- Read-only for residents

### Maintenance schedules

- Upcoming, ongoing and completed schedules from the electric company
- List plus map, with each schedule's covered barangays drawn as a radius
- Read-only for residents

### Power stations

- Tabs for **All / Available / Near me / My Posts**, plus a map of every station
- Filter by station type, access type and availability status
- Post a station (one per user), then update or delete your own
- See operating hours and charging type

### Notifications

- Inbox of alerts about outages, hazards and maintenance near you
- Unread count on the topbar bell
- Mark as read / mark all as read

### Saved location

- One primary saved location used as the centre for "near me" queries
- Browser geolocation to fill it in, plus a map to adjust it by hand
- Address-first form (barangay optional) with a map pin to confirm the point

### Battery tracking

- Register your own devices (`phone`, `laptop`, `powerbank`, `ups`, `tablet`, `other`)
- Current charge level per device, set manually or logged through usage
- Usage history per device with a chart
- Update or delete devices

### Safety timers

- Create a timer for an appliance or battery, either by type or by hours
- Warning threshold before expiry
- Live countdown on the page, server-computed status
  (`running` / `warning` / `expired` / `stopped`), plus stop and delete

### Profile

- Account information from `me.php`: name, email, picture, provider, role
- Logout

---

## Staff app (`/company`)

Staff only. A resident following a company deep link lands on the access-denied page rather than
inside a dashboard they cannot use.

### Operations overview

- 15 stat cards covering reports, statuses, severities, hazards, floods, maintenance, stations and
  notifications
- Recent activity feed

### Outage management

- **Company view** and **All reports (raw)**, with filters for status, severity and active state
- Report detail: status, verification and field updates
- **Verify** a report and post field updates as the assigned lineman
- Bulk status changes at three scopes:
  - a single report
  - every report in a barangay
  - every report in Dagupan (manager-only — there is no barangay to narrow it to)

### Lineman assignments

- Assign field linemen to the barangays they cover
- Create, move (partial update), deactivate and reactivate assignments
- Duplicate pairs are rejected; deactivation is soft, so history survives and re-assignment
  reactivates the same row
- **Manager-only** (`electric_company`, `admin`)

### Maintenance

- Browse, create, edit and delete maintenance schedules
- Authoring is **manager-only**; all staff can read

### Map and risk

- Heatmap, clusters, floods, hazards and risk layers on one map, for operational situational
  awareness

### Power stations

- Station directory for the whole city

### Notifications

- Staff inbox
- Compose and send notifications to explicit users (**manager-only**)

### Hazards

- Review reported hazards and update their status

### Profile

- Account information plus the capabilities of your current role

---

## Access control

`useAuth().role` drives the app, through allow-lists that mirror the `requireRole(...)` arrays in
the PHP endpoints.

- Hiding UI is a convenience, never a control — the API re-checks every permission
- Lineman outage access is scoped server-side from the `lineman_assignments` table, so a
  deactivated assignment revokes access on the lineman's very next request
- A resident's own reports, stations and hazards are ownership-scoped by the API
- Bulk city-wide updates and assignment management require a manager

---

## Platform capabilities

### Location model (barangay-sourced)

Every report, hazard, flood, power station and saved location is placed on the map by its
**barangay's stored centroid**. The form shows a required barangay dropdown; selecting one drops the
map pin on that centroid, and the pin can be dragged to refine the point. The free-text
`Location name` field is only a label shown to others — it is **never geocoded**.

### Maps

- Leaflet-based maps throughout: report points, custom pins, radius circles, heat layer and legend
- One clickable map component is reused by every location form
- Heatmap, cluster and risk layers available on both the resident and staff maps

### Design system

- Consistent tokens for colour, shape, shadow and type, applied on every page
- Severity and status are always rendered as a coloured badge **plus** text, never colour alone
- Icons from a single icon set throughout

### Accessibility and responsiveness

- Mobile-first layout: the sidebar becomes a drawer, tables become cards on small screens
- Semantic landmarks and a skip link per layout
- Every input has a label, inline validation, and `aria-invalid` / `aria-describedby`
- Modals trap focus, close on `Escape`, restore focus and lock body scroll
- Visible focus rings, status colours paired with text, `alt` on all images

---

## Not built

- **Role management** — there is no API endpoint, so roles are changed directly in the database
- **Audience / broadcast targeting** — `notification/create.php` takes explicit `user_id`s, so
  "notify a whole barangay" has to be resolved to ids client-side
- **A user directory** — `lineman_assignment/linemen.php` is the only user listing and is restricted
  to `role = 'lineman'`