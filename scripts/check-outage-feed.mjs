/**
 * Dependency-free self-check for the outage feed helpers.
 * Run with: npm run check:outage-feed
 */
import assert from 'node:assert/strict';
import {
  filterByStatus,
  formatCategory,
  mergeReports,
  pageNumbers,
  pageSlice,
  searchReports,
  severityStyle,
  sortByAlertLevel,
} from '../src/utils/outageFeed.js';

const reports = [
  {
    id: 1,
    locationName: 'Rizal Street',
    barangay: 'Poblacion',
    description: 'Transformer sparks',
    category: 'transformer_explosion',
    severity: 'minor',
    status: 'active',
    createdAt: '2026-01-01 10:00:00',
  },
  {
    id: 2,
    locationName: 'Mabini Street',
    barangay: 'Pantal',
    description: 'Lights out',
    category: 'power_outage',
    severity: 'critical',
    status: 'resolved',
    createdAt: '2026-01-02 10:00:00',
  },
  {
    id: 3,
    locationName: 'Bonifacio Street',
    barangay: 'Poblacion',
    description: 'Low voltage',
    category: 'low_voltage',
    severity: 'moderate',
    status: 'under_review',
    createdAt: '2026-01-03 10:00:00',
  },
];

assert.equal(mergeReports([reports[0], reports[1]], [reports[1], reports[2]]).length, 3);
assert.equal(mergeReports([reports[0]], [reports[0]])[0].id, 1);
assert.deepEqual(
  filterByStatus(reports, 'active').map((report) => report.id),
  [1, 3]
);
assert.deepEqual(
  filterByStatus(reports, 'resolved').map((report) => report.id),
  [2]
);
assert.deepEqual(
  searchReports(reports, 'power outage').map((report) => report.id),
  [2]
);
assert.deepEqual(
  searchReports(reports, 'power_outage').map((report) => report.id),
  [2]
);
assert.deepEqual(
  searchReports(reports, 'poblacion').map((report) => report.id),
  [1, 3]
);
assert.deepEqual(
  sortByAlertLevel(reports).map((report) => report.id),
  [2, 3, 1]
);
assert.equal(severityStyle('high').key, 'critical');
assert.equal(severityStyle('bogus').key, 'unknown');
assert.equal(formatCategory('power_outage'), 'Power Outage');
assert.deepEqual(pageSlice([1, 2, 3, 4], 2, 3), [4]);
assert.deepEqual(pageNumbers(1, 1), [1]);
assert.deepEqual(pageNumbers(5, 20).includes(null), true);
assert.equal(pageNumbers(5, 20)[0], 1);
assert.equal(pageNumbers(5, 20).at(-1), 20);

console.log('outage feed checks passed');
