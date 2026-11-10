# PowerGuide Dagupan: A Smart Power Outage Survival and Resource Management System

PowerGuide Dagupan is a smart power outage and resource management system designed to help
residents of Dagupan City report and monitor power outages, floods, and electrical hazards.
The system allows users to view scheduled maintenance, locate nearby power stations, view
possible risks around their saved location, and track the status of reported incidents. It
also provides a staff dashboard where linemen can verify reports and update field
information within their assigned barangays, and where electric company managers can assign
linemen, manage maintenance schedules, and send notifications to residents, helping improve
communication between the community and the electric company.

PowerGuide Dagupan aims to address the difficulties residents experience during power
outages, floods, and electrical hazards, especially when information about affected areas,
maintenance schedules, and available resources is limited. Without a centralized platform,
residents may have difficulty reporting incidents, tracking their status, and finding nearby
power stations. The system helps solve these problems by providing a centralized source of
information, allowing residents and staff to share updates, monitor risks, and coordinate
responses more efficiently.

The features of the system are the following:

## Public Website Module

This module introduces PowerGuide Dagupan and allows users to access the system.

- Landing Page – Displays the system introduction, feature highlights, report-and-resolve
  flow, safety guidelines, and links into registration and the resident app.
- Account Registration – Allows users to create an account with their first name, last name,
  email, and a password with confirmation, strength meter, and a terms agreement.
- Login – Allows users to access their accounts using email and password or Google sign-in,
  with plain-English messages for session expiry, changed roles, and Google errors.
- Google Callback – Receives the Google sign-in result, stores the session, and redirects
  each role to its home application.

## Resident Dashboard Module

This module provides residents with a central dashboard for accessing important system
information.

- Summary Cards – Display the available power stations, upcoming maintenance, open hazards,
  and risks near the saved location.
- Quick Actions – Provide shortcuts for reporting outages, floods, and hazards, and for
  starting a safety timer.
- Nearby Risks Panel – Lists active floods and unresolved hazards within two kilometres of
  the saved location, with a prompt to set a location when none is saved.
- Latest Reports Feed – Merges outages, floods, and hazards from across the city, newest
  first.
- Area Map – Shows the saved location and nearby reported incidents on a mini map.

## Outage Reporting and Tracking Module

This module allows residents to report power outages and monitor their progress.

- Report Outage – Allows users to submit the severity, houses affected, category, associated
  hazard type, location name, barangay, start time, and a photo of the outage.
- Live Outage Map – Plots reports as severity-coloured circles with popups, a plotted count,
  and a severity legend.
- Live Report Feed – Refreshes every ten seconds and merges public reports with the user's
  own, marking personally submitted reports.
- Track Reports – Filters reports by an All/My scope and an active, resolved, or all status,
  with search and summary tiles for active, critical, and affected homes.
- Report History – Shows the full status history, verifications, photos, and location of the
  user's own reports on a detail page.
- Manage Reports – Allows users to update or delete their own reports, with one active
  report per user enforced by the server.

## Flood Reporting Module

This module allows residents to report flooding and view affected areas.

- Report Flood – Allows users to submit the flood location name, flood level, barangay,
  depth in centimetres, description, and an exact map pin.
- View Flood Reports – Displays all reported flooding incidents with barangay and level
  filters, search, and summary tiles.
- Nearby Floods – Shows flooding incidents near the user's saved location within an
  adjustable radius, with each report's distance shown.
- Flood Map – Mirrors the list with severity-coloured pins, a radius circle, the user's
  location pin, and a flood-level legend.

## Electrical Hazard Reporting Module

This module allows residents to report dangerous electrical conditions.

- Report Hazards – Allows users to report downed wires, exposed cables, and other electrical
  dangers with a location name, severity, hazard type, barangay, description, and map pin.
- Hazard Filters – Allow users to filter the city-wide feed by hazard type, severity, and
  status, with search and summary tiles for open, high-risk, and resolved hazards.
- Hazard Tracking – Allows users to view all hazards on a map and list and monitor their
  status.
- Status Updates – Allow reporters to move their own hazards through reported, verified, and
  resolved.

## Risk Areas Module

This module helps residents identify flooding and electrical hazards across the city.

- Combined Risk Feed – Displays open flood reports and unresolved electrical hazards in one
  merged list, newest first.
- Search Radius – Allows users to narrow the loaded risks to a chosen distance from their
  saved location, with a radius circle on the map.
- Risk Information – Shows each risk's kind, severity, description, and distance from the
  user.
- Service Area Warning – Warns users whose saved location falls outside Dagupan and offers a
  shortcut to fix it, plus a button to widen the radius when risks exist just beyond it.

## Heatmap and Cluster Module

This module provides a visual representation of reported incidents across Dagupan City.

- Heatmap – Displays the intensity of reported outages as a heat layer with clickable areas
  showing report counts, affected households, forecast level, and confidence.
- Clusters – Groups stored outage hotspots into bubbles sized by report count.
- Map Layers – Allows users to switch the heatmap and cluster layers on or off and refresh
  them.
- Top Areas List – Ranks the ten areas with the most reports and the largest stored
  clusters.

## Maintenance Schedule Module

This module allows residents to view scheduled electrical maintenance activities.

- Maintenance Schedules – Displays upcoming and all published schedules with search, a
  status filter, and summary tiles for upcoming, ongoing, and completed work.
- Affected Areas – Identifies the barangays covered by each maintenance activity.
- Maintenance Map – Draws a coverage circle at every affected barangay based on the
  schedule's radius, with a status legend.
- Read-Only Viewing – Keeps scheduling with the utility; residents can view but not create
  or edit schedules.

## Power Station Module

This module helps residents locate charging facilities and manage station information.

- Station Directory – Displays registered power stations under All, Available, Near my
  location, and My post tabs.
- Station Filters – Allow users to filter stations by availability, station type, and
  search term, with an adjustable radius on the nearby tab.
- Nearby Stations – Shows power stations near the user's saved location with distances.
- Station Management – Allows users to add one station post per account and update or
  delete their own post, showing operating hours, charging type, and access type.

## Notification Module

This module provides residents with important updates about outages, hazards, and
maintenance.

- Notification Inbox – Displays received notifications under All and Unread tabs with
  search, a type filter, and an unread banner.
- Notification History – Organizes previous alerts into a timeline grouped by day with
  load-more paging.
- Read Notifications – Allows users to mark single notifications or all of them as read.
- Related Information – Opens the report, schedule, flood, or hazard connected to a
  notification from its detail view.

## Saved Location Module

This module allows residents to save their primary location for nearby searches.

- Save Location – Allows users to register a primary address with an optional barangay,
  which the server resolves into coordinates.
- Geolocation – Uses browser location to fill the address field with the device's
  coordinates.
- Map Preview – Displays the resolved point on a map with its coordinates, matched
  barangay, and last-saved time.

## Battery Tracking Module

This module allows residents to monitor their personal devices and battery levels.

- Device Registration – Allows users to register phones, laptops, power banks, UPS units,
  tablets, and other devices with capacity and notes.
- Battery Monitoring – Displays each device's charge level as a colour-coded bar with
  summary cards for tracked devices, average charge, and devices needing charging.
- Usage History – Records usage entries and displays the battery history of a device
  through a chart or a list.
- Device Management – Allows users to set the current percentage, log usage, and update or
  delete registered devices.

## Safety Timer Module

This module allows residents to monitor appliance and battery timers.

- Create Timer – Allows users to set timers by appliance type or duration in hours, with
  quick duration presets, a title, and notes.
- Warning Threshold – Warns the user during a chosen window before the timer expires.
- Countdown – Displays the remaining time with a progress bar and a server-computed running,
  warning, expired, or stopped status.
- Timer Management – Allows users to stop or delete timers, grouped into active and
  finished sections.

## User Profile Module

This module allows users to view their account information and manage their session.

- Account Information – Displays the user's name, email, role, user ID, saved-location
  status, and member-since date.
- Activity Summary – Shows the user's notification count, unread count, and location
  status.
- Logout – Allows users to securely end their session and return to the landing page.

## Staff Operations Module

This module provides staff members with an overview of ongoing electrical operations.

- Operations Overview – Displays outage reports by status, hazards and floods, and power
  stations, clusters, and maintenance counts.
- Field Crew Coverage – Shows active and total lineman assignments, visible to managers.
- Recent Activities – Displays the newest outage reports with links to their detail pages.
- Quick Actions – Provide shortcuts to reviewing reports, planning maintenance, assigning
  linemen, opening the map, and notifications.

## Outage Management Module

This module allows electric company staff to review and manage outage reports.

- Outage Reports – Displays a company view and a raw report list with filters for status,
  severity, category, barangay, and date range, plus search, sorting, and pagination.
- Report Verification – Allows staff to record a confirmed, not confirmed, or false-report
  verdict that moves the report's status accordingly.
- Field Updates – Allows staff to append field notes, optionally changing the status at the
  same time.
- Lineman Assignment – Allows managers to assign a lineman to a report's barangay straight
  from the list.
- Status Management – Allows staff to change a single report's status, with bulk updates per
  barangay and city-wide reserved for managers.
- Report Detail – Shows the full report, evidence photos, field updates, verification
  history, and location map for every report.

## Lineman Assignment Module

This module allows managers to assign linemen to specific barangays.

- Create Assignment – Assigns a lineman to a barangay with a work type and status.
- Manage Assignments – Allows managers to edit, deactivate, and reactivate assignments,
  where re-assigning the same pair reactivates the existing record.
- Work Type – Determines whether an assignment covers outages, maintenance, or both.
- My Assigned Barangays – Gives linemen a read-only view of their own assignments on both
  dashboards.

## Staff Maintenance Module

This module allows staff to view maintenance schedules and managers to maintain them.

- Schedule Viewing – Displays upcoming, ongoing, and completed schedules with counts and a
  coverage-circle map.
- Schedule Management – Allows managers to create, edit, and delete maintenance schedules.
- Assignment Shortcut – Lets managers open the assignment form from a schedule, prefilled
  when it covers a single known barangay.

## Staff Map and Risk Module

This module provides staff with a map for monitoring reported incidents.

- Incident Map – Displays four toggleable layers: the outage heatmap with a selectable
  lookback window, stored clusters, flood reports, and electrical hazards.
- Risk Monitoring – Lets staff probe risks around a chosen point and radius and filter to
  open incidents only.
- Cluster Storage – Allows staff to save a computed cluster with its barangay, forecast
  level, radius, and report count.

## Staff Notification Module

This module allows staff to receive and send important system updates.

- Staff Inbox – Displays notifications received by the signed-in staff account with search,
  a type filter, and All/Unread tabs.
- Notification History – Shows previous notifications in a date-grouped timeline with a
  detail view.
- Send Notifications – Allows managers to compose alerts with a title, message, type, and
  explicit recipient user IDs.

## Staff Hazard Management Module

This module allows staff to review and manage electrical hazard reports.

- Hazard Reports – Displays reported hazards under all, reported, verified, and resolved
  tabs with severity and barangay filters and pagination.
- Hazard Review – Allows staff to review each hazard's information, severity, and location
  on a map.
- Status Updates – Allows staff to mark hazards verified or resolved, or reopen resolved
  ones.
- Nearby Probe – Lets staff search hazards around a chosen point and radius, ordered by
  distance.

## Admin Dashboard Module

This module provides administrators with an overview of platform activities.

- Platform Statistics – Displays user totals, new accounts in the last 30 days, accounts by
  role, and notifications sent.
- Incident Monitoring – Shows totals for outage reports, floods, hazards, maintenance,
  power stations, and clusters.
- Report Analytics – Displays the 30-day report trend chart and the top barangays by report
  count.

## User and Role Management Module

This module allows administrators to manage user accounts and permissions.

- User Directory – Displays every registered account with its role, provider, and account
  dates.
- Search and Filter – Allows administrators to find users by name or email and filter by
  role, with pagination.
- Account Creation – Allows administrators to create local accounts with any role.
- Role Management – Allows administrators to change a user's role, excluding their own
  account, with the change taking effect at the target's next sign-in.

## Role-Based Access Control Module

This module manages user permissions based on their assigned roles.

- Resident Access – Allows residents to use the resident dashboard.
- Lineman Access – Restricts linemen to outage reports in their actively assigned barangays
  and the work their assignment type allows, with the server re-checking every request.
- Manager Access – Allows electric company and admin accounts to manage assignments,
  maintenance schedules, bulk status changes, and notifications.
- Admin Access – Provides administrators access to all applications plus the admin
  dashboard for users and platform analytics.

## Mapping and Accessibility Module

This module provides interactive maps and an accessible interface throughout the system.

- Location Mapping – Displays reports, hazards, floods, maintenance areas, and power
  stations on interactive maps.
- Map Pins – Place incidents using barangay-based coordinates, with a draggable pin to
  refine the exact point in report forms.
- Responsive Design – Adjusts the interface for mobile and desktop devices, with the
  sidebar becoming a drawer and tables becoming cards.
- Accessibility – Provides labels, inline validation, keyboard-navigable modals, visible
  focus indicators, and status colours always paired with text.

The primary users of the system are:

**Residents (Regular Users)**
Residents of Dagupan City who use the system to report power outages, floods, and electrical
hazards. They can track their reports, view scheduled maintenance, find nearby power
stations, save a primary location, monitor their devices and safety timers, and receive
notifications about possible risks in their area.

**Linemen**
Field personnel responsible for responding to reported power outages within the barangays
assigned to them. They can view their assignments, verify reports, provide field updates,
and change report statuses, with their outage data scoped to their assigned work.

**Electric Company Staff (Managers)**
Authorized personnel who manage power outage operations. They can monitor city-wide
reports, assign linemen to barangays, manage maintenance schedules, apply bulk status
updates per barangay or city-wide, review hazards, and send notifications to residents.

**System Administrator**
The administrator manages the overall system and its users. They can monitor platform
statistics, create accounts, manage user roles, and access every application, including the
company operations dashboard and the admin user-management app.
