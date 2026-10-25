/**
 * Pure helpers behind the Interactive Outage Map feed.
 *
 * The page merges two endpoints, filters and pages the result, so keeping that
 * logic out of the component makes it testable without a browser. No React or
 * Leaflet imports here.
 */
import { isOpenStatus } from './constants.js';

const SEVERITY_ALIASES = {
  critical: 'critical',
  high: 'critical',
  severe: 'critical',
  moderate: 'moderate',
  medium: 'moderate',
  warning: 'moderate',
  minor: 'minor',
  low: 'minor',
};

const SEVERITY_RANK = { critical: 3, moderate: 2, minor: 1, unknown: 0 };

export const SEVERITY_STYLES = {
  critical: {
    key: 'critical',
    label: 'CRITICAL',
    color: '#FF2E1F',
    badge: 'border-[#FF2E1F]/25 bg-[#FF2E1F]/15 text-[#FF2E1F]',
    swatch: 'bg-[#FF2E1F]',
  },
  moderate: {
    key: 'moderate',
    label: 'MODERATE',
    color: '#FFBB02',
    badge: 'border-[#FFBB02]/25 bg-[#FFBB02]/15 text-[#FFBB02]',
    swatch: 'bg-[#FFBB02]',
  },
  minor: {
    key: 'minor',
    label: 'MINOR',
    color: '#34FB34',
    badge: 'border-[#34FB34]/25 bg-[#34FB34]/15 text-[#34FB34]',
    swatch: 'bg-[#34FB34]',
  },
  unknown: {
    key: 'unknown',
    label: 'UNKNOWN',
    color: '#9CA3AF',
    badge: 'border-[#9CA3AF]/25 bg-[#9CA3AF]/15 text-[#9CA3AF]',
    swatch: 'bg-[#9CA3AF]',
  },
};

/** Severity bucket used by the markers, badges and legend. */
export function severityKey(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return SEVERITY_ALIASES[key] || 'unknown';
}

export function severityStyle(value) {
  return SEVERITY_STYLES[severityKey(value)];
}

/** "power_outage" -> "Power Outage"; empty values become a readable fallback. */
export function formatCategory(value, fallback = 'Unknown Issue') {
  const text = String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!text) return fallback;
  return text.replace(/\b\w/g, (character) => character.toUpperCase());
}

/** "under_review" -> "Under Review". */
export function formatLabel(value, fallback = 'Unknown') {
  const text = String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!text) return fallback;
  return text.replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Merge report arrays from the public and "my reports" endpoints.
 * Later arrays win, so an owned row (which carries the owner's latest state)
 * replaces the public copy instead of producing a duplicate card.
 */
export function mergeReports(...lists) {
  const byId = new Map();
  lists.flat().forEach((report, index) => {
    if (!report) return;
    const id = report.id ?? report.reportKey ?? `report-${index}`;
    byId.set(String(id), report);
  });
  return [...byId.values()];
}

/** Active hides resolved/rejected; resolved is explicit; all keeps every row. */
export function filterByStatus(reports, status) {
  const key = String(status ?? 'all').toLowerCase();
  if (key === 'active') {
    return reports.filter((report) => isOpenStatus(report.status));
  }
  if (key === 'resolved') {
    return reports.filter((report) => String(report.status ?? '').toLowerCase() === 'resolved');
  }
  return reports;
}

/** Search location, barangay, description and both raw/humanised category. */
export function searchReports(reports, query) {
  const term = String(query ?? '').trim().toLowerCase();
  if (!term) return reports;
  return reports.filter((report) =>
    [report.locationName, report.barangay, report.description, report.category, formatCategory(report.category)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  );
}

/** Highest severity first; newest first inside the same severity. */
export function sortByAlertLevel(reports) {
  return [...reports].sort((first, second) => {
    const rankDifference =
      SEVERITY_RANK[severityKey(second.severity)] - SEVERITY_RANK[severityKey(first.severity)];
    if (rankDifference !== 0) return rankDifference;
    return String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? ''));
  });
}

export function pageSlice(items, page, pageSize = 3) {
  const safeSize = Math.max(1, Number(pageSize) || 1);
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeSize;
  return items.slice(start, start + safeSize);
}

export function pageCount(total, pageSize = 3) {
  const safeSize = Math.max(1, Number(pageSize) || 1);
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / safeSize));
}

/**
 * Page numbers with gaps collapsed. `null` is an ellipsis marker the UI renders
 * as "…"; keeping it as data avoids a second layout pass in the component.
 */
export function pageNumbers(current, total) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = Math.min(Math.max(1, Number(current) || 1), safeTotal);
  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const selected = new Set([1, safeTotal, safeCurrent]);
  for (const offset of [-2, -1, 1, 2]) {
    const page = safeCurrent + offset;
    if (page > 1 && page < safeTotal) selected.add(page);
  }

  const sorted = [...selected].sort((first, second) => first - second);
  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  });
  return result;
}
