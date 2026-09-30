/**
 * Barrel export for the API layer.
 *
 * Import from `@/api` in components so that the client stays the single place
 * where the base URL, credentials and error normalisation are configured.
 */
export * from './client';
export { authApi, userFromAuthResponse } from './auth';
export { getReference } from './reference';
export { outagesApi, extractCreatedId } from './outages';
export { maintenanceApi, UPCOMING_STATUSES } from './maintenance';
export { powerStationsApi } from './powerStations';
export { notificationsApi } from './notifications';
export { locationApi } from './location';
export { batteryApi, BATTERY_DEVICE_TYPES } from './battery';
export { safetyTimersApi } from './safetyTimers';
export { floodsApi, FLOOD_LEVELS } from './floods';
export { hazardsApi, HAZARD_SEVERITIES, HAZARD_STATUSES } from './hazards';
export { getNearbyRisks } from './risk';
export { heatmapApi } from './heatmap';
