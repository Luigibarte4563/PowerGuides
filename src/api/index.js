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
export {
  companyOutagesApi,
  countAffected,
  isOpenCompanyStatus,
  MANAGEABLE_STATUSES,
  OPEN_STATUSES,
  VERIFICATION_STATUSES,
} from './companyOutages';
export { maintenanceApi, MAINTAINABLE_STATUSES, UPCOMING_STATUSES } from './maintenance';
export { powerStationsApi } from './powerStations';
export { notificationsApi } from './notifications';
export { locationApi } from './location';
export { batteryApi, BATTERY_DEVICE_TYPES } from './battery';
export { safetyTimersApi } from './safetyTimers';
export { floodsApi, FLOOD_LEVELS } from './floods';
export { hazardsApi, HAZARD_SEVERITIES, HAZARD_STATUSES } from './hazards';
export { getNearbyRisks } from './risk';
export { heatmapApi, CLUSTER_FORECAST_LEVELS } from './heatmap';
export {
  linemanAssignmentsApi,
  readAssignment,
  readMyAssignment,
  isActiveAssignment,
  ACTIVE_ASSIGNMENT_STATUS,
  INACTIVE_ASSIGNMENT_STATUS,
} from './linemanAssignments';
