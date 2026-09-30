import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import clsx from 'clsx';
import { DEFAULT_CENTER } from '@/utils/formatters';
/**
 * Basemap providers, tried in order. Both need no API key.
 *
 * The OSM Foundation's volunteer servers (`tile.openstreetmap.org`) are
 * deliberately NOT in this list: they answer with an "Access blocked" tile and an
 * `x-blocked: Access denied` header because their tile usage policy forbids this
 * kind of use. It answers 200, so the failure is invisible to `tileerror` and
 * simply shows a grey map - hence the switch rather than relying on failover.
 */
const TILE_PROVIDERS = [
  {
    name: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, INCREMENT P, USGS, EPA, NPS',
  },
  {
    name: 'OpenStreetMap.de',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

/**
 * Basemap layer that falls over to the next provider when the current one is
 * genuinely unreachable. Catches server/network faults only - a provider that
 * answers 200 with a placeholder tile cannot be detected from the browser, which
 * is why `TILE_PROVIDERS` is curated instead.
 */
function BaseLayer() {
  const [index, setIndex] = useState(0);
  const failures = useRef(0);
  const provider = TILE_PROVIDERS[index];
  const isLast = index === TILE_PROVIDERS.length - 1;

  const handleError = useCallback(() => {
    if (isLast) return;
    failures.current += 1;
    if (failures.current < 3) return;
    failures.current = 0;
    setIndex((current) => Math.min(current + 1, TILE_PROVIDERS.length - 1));
  }, [isLast]);

  return (
    <TileLayer
      // Remounting on a URL change clears the already-broken tile placeholders.
      key={provider.url}
      url={provider.url}
      attribution={provider.attribution}
      eventHandlers={{ tileerror: handleError }}
      maxZoom={19}
    />
  );
}

const PIN_COLORS = {
  primary: '#F59E0B',
  danger: '#DC2626',
  warning: '#D97706',
  success: '#059669',
  info: '#2563EB',
  neutral: '#33415C',
};

/**
 * The app-wide map pin, drawn as inline SVG so there is no image asset to load
 * and nothing for a bundler to rewrite (which is what breaks Leaflet's default
 * marker images).
 *
 * Geometry lives in a 32 x 42 box: a circular head (r 11.5, centred at y 14.5)
 * tapering to a tip at `PIN_TIP_Y`. The tip stops just short of the box floor so
 * its white outline is not clipped, and `iconAnchor` is derived from `PIN_TIP_Y`
 * so the tip - not the box centre - sits on the coordinate.
 */
const PIN_BOX = { width: 32, height: 42 };
const PIN_TIP_Y = 40.5;
const PIN_PATH =
  `M16 ${PIN_TIP_Y}C16 ${PIN_TIP_Y} 4.5 26 4.5 14.5` +
  'A11.5 11.5 0 1 1 27.5 14.5' +
  `C27.5 26 16 ${PIN_TIP_Y} 16 ${PIN_TIP_Y}Z`;
const PIN_HEAD = { cx: 16, cy: 14.5, r: 4.5 };
const PIN_WIDTH = 30;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&#39;';
  });

/**
 * The pin as an inline SVG string. Shared by the markers and the legend.
 * `tone` is either a tone name from `PIN_COLORS` or a raw colour (the heatmap
 * legend swatches gradient stops that are not tones).
 */
export function pinSvg(tone = 'primary', glyph = '') {
  const color = PIN_COLORS[tone] || tone || PIN_COLORS.primary;
  const centre = glyph
    ? `<text x="${PIN_HEAD.cx}" y="${PIN_HEAD.cy}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="#ffffff">${escapeHtml(glyph)}</text>`
    : `<circle cx="${PIN_HEAD.cx}" cy="${PIN_HEAD.cy}" r="${PIN_HEAD.r}" fill="#ffffff" />`;

  return (
    `<svg viewBox="0 0 ${PIN_BOX.width} ${PIN_BOX.height}" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    `<path d="${PIN_PATH}" fill="${color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />` +
    centre +
    `</svg>`
  );
}

/**
 * Custom teardrop pin as a divIcon. `size` is the pin WIDTH in pixels (height
 * follows the 32:42 ratio); `className` is appended by Leaflet, so `pg-pin` is
 * what `index.css` hooks onto for the drop shadow.
 */
export function pinIcon(tone = 'primary', glyph = '', options = {}) {
  const { size = PIN_WIDTH, className = '' } = options;
  const width = Math.max(14, Math.round(Number(size) || PIN_WIDTH));
  const height = Math.round((width * PIN_BOX.height) / PIN_BOX.width);
  const tipOffset = Math.round((height * PIN_TIP_Y) / PIN_BOX.height);

  return L.divIcon({
    className: clsx('pg-pin', className),
    html: pinSvg(tone, glyph),
    iconSize: [width, height],
    iconAnchor: [width / 2, tipOffset],
    popupAnchor: [0, -tipOffset + 6],
  });
}

/**
 * Keeps the viewport on `center` as it changes.
 *
 * `MapContainer` only reads its centre on mount, so a map rendered before its
 * coordinates arrive (nearly every page loads the saved location asynchronously)
 * would stay stuck on the default Dagupan view. Only acts when a real centre is
 * supplied, so pages with no location keep the default view, and it never fires
 * on a plain re-render - so it does not fight the user after they pan.
 */
function SyncView({ center, zoom }) {
  const map = useMap();
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  const targetZoom = Number(zoom) || null;
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasCenter) return;
    const current = map.getCenter();
    if (Math.abs(current.lat - lat) < 1e-6 && Math.abs(current.lng - lng) < 1e-6) return;
    map.setView([lat, lng], targetZoom || map.getZoom(), { animate: true });
  }, [hasCenter, lat, lng, targetZoom, map]);

  return null;
}

/** Leaflet map with the app's tile layer and default Dagupan centre. */
export default function AppMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_CENTER.zoom,
  className = 'h-96 w-full',
  children,
  scrollWheelZoom = false,
  whenReady,
  ...rest
}) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

  const initialView = useMemo(
    () => ({
      center: hasCenter ? [lat, lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: Number(zoom) || DEFAULT_CENTER.zoom,
    }),
    // Mount-only: Leaflet keeps its own view state afterwards, and <SyncView>
    // moves it from there as `center` resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <MapContainer
      center={initialView.center}
      zoom={initialView.zoom}
      scrollWheelZoom={scrollWheelZoom}
      className={className}
      {...rest}
    >
      <BaseLayer />
      <SyncView center={center} zoom={zoom} />
      {whenReady}
      {children}
    </MapContainer>
  );
}

/** Imperatively move the map when the coordinates change (no remount). */
export function MapView({ center, zoom, animate = true }) {
  const map = useMap();
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  const nextZoom = Number(zoom) || null;

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (animate) {
      map.flyTo([lat, lng], nextZoom || map.getZoom(), { duration: 0.6 });
    } else {
      map.setView([lat, lng], nextZoom || map.getZoom(), { animate: false });
    }
  }, [lat, lng, nextZoom, animate, map]);

  return null;
}

/** Single record marker with a popup. */
export function MapPin({ position, tone = 'primary', glyph = '', size, children }) {
  if (!position) return null;
  const lat = Number(position.lat);
  const lng = Number(position.lng ?? position.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <Marker position={[lat, lng]} icon={pinIcon(tone, glyph, { size })}>
      {children ? <Popup>{children}</Popup> : null}
    </Marker>
  );
}

/** Many records drawn as the custom pin (one marker each). */
export function MapPoints({ items = [], toneFor, size = PIN_WIDTH, glyphFor, children }) {
  return (
    <>
      {items.map((item, index) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng ?? item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const tone = toneFor ? toneFor(item) : item.tone || 'primary';
        return (
          <Marker
            key={item.id ?? `${lat}-${lng}-${index}`}
            position={[lat, lng]}
            icon={pinIcon(tone, glyphFor ? glyphFor(item) : '', { size })}
          >
            {children ? <Popup>{children(item)}</Popup> : null}
          </Marker>
        );
      })}
    </>
  );
}

/**
 * Invisible clickable areas over a set of points, each opening a popup.
 *
 * Used for the heatmap, whose blobs are drawn by leaflet.heat and therefore carry
 * no click handling of their own. These are sized DOM `divIcon`s rather than
 * transparent `CircleMarker`s on purpose: a DOM element reliably receives clicks
 * across its whole box, whereas a zero-opacity SVG fill is hit-tested
 * inconsistently between browsers.
 */
export function MapHitAreas({ items = [], radius = 36, radiusFor, children }) {
  return (
    <>
      {items.map((item, index) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng ?? item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const size = Math.max(
          20,
          Math.round(Number(radiusFor ? radiusFor(item) : item.hitRadius ?? radius) || radius)
        );

        return (
          <Marker
            key={item.id ?? `${lat}-${lng}-${index}`}
            position={[lat, lng]}
            icon={L.divIcon({
              className: 'pg-hit-area',
              html: '',
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              popupAnchor: [0, -size / 2],
            })}
          >
            {children ? <Popup>{children(item)}</Popup> : null}
          </Marker>
        );
      })}
    </>
  );
}

/**
 * Fits the viewport to the plotted points without remounting the map.
 *
 * Re-fits only when the SET of coordinates changes (not on every render), so
 * panning/zooming by hand is not fought by a re-render of the parent.
 */
export function FitPoints({ items = [], padding = 56, maxZoom = 16, animate = true }) {
  const map = useMap();

  const points = useMemo(
    () =>
      items
        .map((item) => [Number(item.lat), Number(item.lng ?? item.lon)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [items]
  );

  const signature = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15), { animate });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom, animate });
    // `signature` stands in for `points` so a re-render with an equal set of
    // coordinates does not yank the viewport back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map, padding, maxZoom, animate]);

  return null;
}

/** "Near me" search radius. */
export function RadiusCircle({ center, radius, color = '#2563EB' }) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number(radius)) return null;

  return (
    <Circle
      center={[lat, lng]}
      radius={Number(radius)}
      pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.08 }}
    />
  );
}

/**
 * A circle with an optional popup - used for cluster footprints and risk radii.
 *
 * Wrapped rather than used directly because react-leaflet paths do NOT treat children
 * as popup content: a path ports its children into its own DOM node. The popup has to
 * be an explicit `<Popup>` child for `bindPopup` to be called, and that is easy to get
 * wrong, so callers get one component with a `children`-means-popup contract.
 */
export function MapCircle({ center, radius, color = '#D97706', fillColor, fillOpacity = 0.18, weight = 1.5, children }) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number(radius)) return null;

  return (
    <Circle
      center={[lat, lng]}
      radius={Number(radius)}
      pathOptions={{ color, weight, fillColor: fillColor || color, fillOpacity }}
    >
      {children ? <Popup>{children}</Popup> : null}
    </Circle>
  );
}

/**
 * Heat gradient, shared by the layer and the Heatmap legend so the two cannot
 * drift apart. Fully saturated stops: leaflet.heat multiplies the gradient colour
 * by the pixel alpha, so a pale stop renders as a pale wash.
 */
export const HEAT_GRADIENT = {
  0.2: '#F59E0B',
  0.4: '#F97316',
  0.6: '#EA580C',
  0.8: '#DC2626',
  1: '#991B1B',
};

/** Legend rows derived from `HEAT_GRADIENT`. */
export const HEAT_LEGEND = [
  { label: 'Low intensity', color: HEAT_GRADIENT[0.2] },
  { label: 'Moderate', color: HEAT_GRADIENT[0.4] },
  { label: 'High', color: HEAT_GRADIENT[0.6] },
  { label: 'Very high', color: HEAT_GRADIENT[0.8] },
];

/**
 * Leaflet.heat layer. `points` = [{ lat, lng, intensity }].
 * Read-only: rendered straight from `heatmap/get.php`.
 *
 * `minOpacity` is the important knob here, not just a floor for empty pixels:
 * leaflet.heat draws each point at `globalAlpha = max(intensity / max, minOpacity)`
 * and then recolours the canvas by alpha, so a low value washes the whole layer
 * out. 0.6 keeps colours close to solid while intensity still separates the stops.
 *
 * `leaflet.heat` is a UMD plugin that expects a global `L`, so it is imported
 * lazily with the global provided - a static import would throw at startup.
 */
export function HeatLayer({
  points = [],
  radius = 30,
  blur = 18,
  minOpacity = 0.6,
  maxZoom = 17,
  gradient = HEAT_GRADIENT,
}) {
  const map = useMap();
  const validPoints = useMemo(
    () =>
      points
        .map((point) => [Number(point.lat), Number(point.lng), Number(point.intensity) || 0.5])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [points]
  );

  useEffect(() => {
    if (!validPoints.length) return undefined;

    let layer = null;
    let cancelled = false;

    if (typeof window !== 'undefined') {
      window.L = L; // leaflet.heat reads the global L
    }

    import('leaflet.heat').then(() => {
      if (cancelled || typeof L.heatLayer !== 'function') return;
      layer = L.heatLayer(validPoints, { radius, blur, minOpacity, maxZoom, gradient });
      layer.addTo(map);
    });

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [validPoints, map, radius, blur, minOpacity, maxZoom, gradient]);

  return null;
}

/** Small legend rendered over the map (bottom-left by default). */
export function MapLegend({ items = [], title, className, position = 'bottom' }) {
  if (!items.length) return null;

  return (
    <div
      className={clsx(
        'absolute z-[400] rounded-card border border-navy-100 bg-white/95 p-3 shadow-card',
        position === 'top' ? 'left-3 top-3' : 'bottom-3 left-3',
        className
      )}
    >
      {title ? <p className="mb-2 text-xs font-bold text-navy-800">{title}</p> : null}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs font-medium text-navy-700">
            <PinSwatch
              className="h-5 w-5 shrink-0"
              color={item.color || PIN_COLORS[item.tone] || PIN_COLORS.primary}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Miniature of the map pin, so the legend reads as the same marker. */
function PinSwatch({ color, className }) {
  return (
    <span
      className={clsx('block shrink-0', className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: pinSvg(color) }}
    />
  );
}

export { PIN_COLORS, PIN_WIDTH };
