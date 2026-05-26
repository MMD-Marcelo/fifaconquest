// Map rendering, tooltip, pan/zoom, and team labels.

// ============================================================
// MAP RENDERING (Natural Earth GeoJSON)
// ============================================================
// Render from a real Natural Earth GeoJSON source using an equirectangular
// projection. Small islands can remain cosmetic; game territories are mapped
// to Natural Earth country features by ISO/ADM0 codes.

const MAP_WIDTH = 1440;
const MAP_HEIGHT = 720;
let MAP_FEATURE_COLLECTION = null;
let mapLabelPositions = {};
let mapLabelElements = [];
let mapPathElements = [];
let lastLabelScale = null;
let lastLabelVisibilityKey = '';
let attackableLabelCacheKey = '';
let attackableLabelCache = new Set();

const LABEL_POSITION_OVERRIDES = {
  AU: [134, -25],
  CA: [-106, 56],
  CL: [-71, -30],
  GF: [-53, 4],
  LK: [81, 7.5],
  NC: [165, -21],
  PR: [-66.5, 18.2],
  RU: [96, 61],
  US: [-98, 39]
};

const LABEL_TEXT_OFFSET_OVERRIDES = {
  DO: [0, 1.5],
  GF: [0, 3],
  XK: [0, 0.8]
};

const MAJOR_LABEL_COUNTRIES = new Set([
  'BR','AR','US','CA','GL','MX','RU','CN','IN','AU','ZA','CD','DZ','SD','LY','EG',
  'SA','IR','KZ','ID','FR','DE','ES','GB','IT','TR','NG','ET','TZ','AO','KR','KP'
]);

const A3_TO_GAME_ID = {
  FRA: 'FR',
  NOR: 'NO',
  GBR: 'GB',
  USA: 'US',
  RUS: 'RU',
  BRA: 'BR',
  AUS: 'AU',
  COD: 'CD',
  CIV: 'CI',
  ARE: 'AE',
  SAU: 'SA',
  KOR: 'KR',
  PRK: 'KP',
  TWN: 'TW',
  ARM: 'AM',
  NPL: 'NP',
  BTN: 'BT',
  SGP: 'SG',
  BRN: 'BN',
  HUN: 'HU',
  CZE: 'CZ',
  SOL: 'SO',
  LKA: 'LK',
  BHS: 'BS',
  DOM: 'DO',
  JAM: 'JM',
  KOS: 'XK',
  CYP: 'CY',
  CYN: 'NCY',
  PSX: 'PS',
  FJI: 'FJ',
  SLB: 'SB',
  NCL: 'NC',
  VUT: 'VU',
  PRI: 'PR'
};

function projectLonLat(coord) {
  const lon = Math.max(-180, Math.min(180, coord[0]));
  const lat = Math.max(-90, Math.min(90, coord[1]));
  return [
    ((lon + 180) / 360) * MAP_WIDTH,
    ((90 - lat) / 180) * MAP_HEIGHT
  ];
}

function getGameIdForGeoFeature(feature) {
  const props = feature.properties || {};
  const a3 = props.ADM0_A3 || props.ISO_A3 || props.SOV_A3;
  const iso2 = props.ISO_A2;
  if (A3_TO_GAME_ID[a3]) return A3_TO_GAME_ID[a3];
  if (COUNTRY_ID_SET.has(iso2)) return iso2;
  return null;
}

function projectGeoGeometry(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map(poly => poly.map(ring => ring.map(projectLonLat)))
  };
}

function buildMapFeature(feature, gameIdOverride = undefined, nameOverride = null, geometryOverride = null) {
  const gameId = gameIdOverride === undefined ? getGameIdForGeoFeature(feature) : gameIdOverride;
  return {
    type: 'Feature',
    id: gameId || feature.properties.ADM0_A3 || feature.properties.NAME,
    properties: {
      gameId,
      name: nameOverride || feature.properties.NAME || feature.properties.ADMIN || '',
      interactive: !!gameId
    },
    geometry: projectGeoGeometry(geometryOverride || feature.geometry)
  };
}

function rawPolygonBounds(poly) {
  const pts = poly.flat();
  const lons = pts.map(p => p[0]);
  const lats = pts.map(p => p[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

function isFrenchGuianaPolygon(poly) {
  const bounds = rawPolygonBounds(poly);
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  return centerLon > -56 && centerLon < -50 && centerLat > 1 && centerLat < 7;
}

function isPolygonCenterInside(poly, lonMin, lonMax, latMin, latMax) {
  const bounds = rawPolygonBounds(poly);
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  return centerLon >= lonMin && centerLon <= lonMax && centerLat >= latMin && centerLat <= latMax;
}

function splitFranceFeatureForMap(feature) {
  const props = feature.properties || {};
  const a3 = props.ADM0_A3 || props.ISO_A3 || props.SOV_A3;
  if (a3 !== 'FRA' || feature.geometry?.type !== 'MultiPolygon') return null;

  const frenchGuiana = [];
  const france = [];
  const cosmetic = [];
  feature.geometry.coordinates.forEach(poly => {
    if (isFrenchGuianaPolygon(poly)) frenchGuiana.push(poly);
    else if (isPolygonCenterInside(poly, -6, 10, 41, 52)) france.push(poly);
    else cosmetic.push(poly);
  });

  const features = [];
  if (france.length) {
    features.push(buildMapFeature(feature, 'FR', null, { type: 'MultiPolygon', coordinates: france }));
  }
  if (frenchGuiana.length && COUNTRY_ID_SET.has('GF')) {
    features.push(buildMapFeature(feature, 'GF', 'Guiana Francesa', { type: 'MultiPolygon', coordinates: frenchGuiana }));
  }
  if (cosmetic.length) {
    features.push(buildMapFeature(feature, null, 'France overseas', { type: 'MultiPolygon', coordinates: cosmetic }));
  }
  return features.length ? features : [buildMapFeature(feature)];
}

function splitFeatureForPlayableMainland(feature, gameId, bounds) {
  if (feature.geometry?.type !== 'MultiPolygon') return null;
  const active = [];
  const cosmetic = [];
  feature.geometry.coordinates.forEach(poly => {
    if (isPolygonCenterInside(poly, ...bounds)) active.push(poly);
    else cosmetic.push(poly);
  });

  const features = [];
  if (active.length) {
    features.push(buildMapFeature(feature, gameId, null, { type: 'MultiPolygon', coordinates: active }));
  }
  if (cosmetic.length) {
    features.push(buildMapFeature(feature, null, `${feature.properties.NAME || gameId} islands`, { type: 'MultiPolygon', coordinates: cosmetic }));
  }
  return features.length ? features : [buildMapFeature(feature)];
}

function splitRemoteIslandTerritories(feature) {
  const props = feature.properties || {};
  const a3 = props.ADM0_A3 || props.ISO_A3 || props.SOV_A3;
  if (a3 === 'FRA') return splitFranceFeatureForMap(feature);
  if (a3 === 'ESP') return splitFeatureForPlayableMainland(feature, 'ES', [-10, 5, 35, 44]);
  if (a3 === 'PRT') return splitFeatureForPlayableMainland(feature, 'PT', [-10, -6, 36, 43]);
  if (a3 === 'NLD') return splitFeatureForPlayableMainland(feature, 'NL', [3, 8, 50, 54]);
  return null;
}

function geometryToPath(geometry) {
  return geometry.coordinates.map(poly => poly.map(ring => {
    if (!ring.length) return '';
    return ring.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join('') + 'Z';
  }).join(' ')).join(' ');
}

function getCountryLabelLines(id) {
  const homeTeams = G.homeOf?.[id] ? (G.homeTeams?.[id] || []).filter(Boolean) : null;
  if (homeTeams?.length) return homeTeams;
  const terr = G.territories?.[id];
  const country = COUNTRY_BY_ID.get(id);
  return [terr?.team || country?.name || id];
}

function setCountryLabelLines(textEl, id) {
  if (!textEl) return;
  const lines = getCountryLabelLines(id);
  const x = textEl.getAttribute('x') || '0';
  textEl.replaceChildren();
  lines.forEach((line, index) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('dy', index === 0 ? `${((lines.length - 1) * -0.55).toFixed(2)}em` : '1.1em');
    tspan.textContent = line;
    textEl.appendChild(tspan);
  });
}

function applyCountryLabelTextOffset(textEl, id) {
  const offset = LABEL_TEXT_OFFSET_OVERRIDES[id];
  if (!textEl || !offset) return;
  textEl.setAttribute('transform', `translate(${offset[0]} ${offset[1]})`);
}

function geometryBounds(geometry) {
  const pts = geometry.coordinates.flat(2);
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    area += (x1 * y2) - (x2 * y1);
  }
  return area / 2;
}

function ringCentroid(ring) {
  const area = ringArea(ring);
  if (!area) {
    const bounds = geometryBounds({ coordinates: [[ring]] });
    return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const cross = (x1 * y2) - (x2 * y1);
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  return [cx / (6 * area), cy / (6 * area)];
}

function getLabelPosition(feature) {
  const override = LABEL_POSITION_OVERRIDES[feature.properties.gameId];
  if (override) return projectLonLat(override);

  let biggestRing = null;
  let biggestArea = 0;
  feature.geometry.coordinates.forEach(poly => {
    const outerRing = poly[0];
    if (!outerRing) return;
    const area = Math.abs(ringArea(outerRing));
    if (area > biggestArea) {
      biggestArea = area;
      biggestRing = outerRing;
    }
  });

  if (biggestRing) return ringCentroid(biggestRing);

  const bounds = geometryBounds(feature.geometry);
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

function getMapFeatureCollection() {
  if (MAP_FEATURE_COLLECTION) return MAP_FEATURE_COLLECTION;
  const source = typeof WORLD_GEOJSON !== 'undefined' ? WORLD_GEOJSON : { features: [] };
  MAP_FEATURE_COLLECTION = {
    type: 'FeatureCollection',
    features: source.features.flatMap(feature => splitRemoteIslandTerritories(feature) || [buildMapFeature(feature)])
  };
  return MAP_FEATURE_COLLECTION;
}

function setupGeometryToPath(geometry) {
  return geometry.coordinates.map(poly => {
    const outerRing = poly[0];
    if (!outerRing || Math.abs(ringArea(outerRing)) < 8) return '';
    return [outerRing].map(ring => {
      return ring.map((pt, index) => `${index === 0 ? 'M' : 'L'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join('') + 'Z';
    }).join(' ');
  }).filter(Boolean).join(' ');
}

function isSetupBackgroundFeature(feature) {
  const bounds = geometryBounds(feature.geometry);
  if (bounds.minY > MAP_HEIGHT * 0.78) return false;
  return true;
}

function getSetupRegionClass(feature) {
  const bounds = geometryBounds(feature.geometry);
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const normalizedY = centerY / MAP_HEIGHT;
  if (normalizedY > 0.68) return 'region-far-south';
  if (normalizedY > 0.62) return 'region-south';
  if (normalizedY > 0.5) return 'region-south-mid';
  if (normalizedY > 0.38) return 'region-mid';
  if (normalizedY > 0.26) return 'region-north-mid';
  return 'region-north';
}

function renderSetupBackgroundMap() {
  const container = document.getElementById('setup-map-bg');
  if (!container || container.dataset.rendered === 'true') return;

  const collection = getMapFeatureCollection();
  if (!collection.features.length) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'setup-network-svg');
  svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

  const landGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  landGroup.setAttribute('class', 'setup-bg-land');
  collection.features.forEach(feature => {
    if (!isSetupBackgroundFeature(feature)) return;
    const d = setupGeometryToPath(feature.geometry);
    if (!d) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', `setup-bg-country ${getSetupRegionClass(feature)}`);
    path.setAttribute('d', d);
    landGroup.appendChild(path);
  });
  svg.appendChild(landGroup);

  container.replaceChildren(svg);
  container.dataset.rendered = 'true';
}

function renderMap() {
  const container = document.getElementById('map-container');
  // Remove existing svg
  const existing = document.getElementById('world-svg');
  if (existing) existing.remove();
  mapTransform = { x: 0, y: 0, scale: 1 };
  isDragging = false;

  const svg = createWorldSVG();
  svg.id = 'world-svg';
  container.insertBefore(svg, container.firstChild);
  initMapPanZoom(svg);
  updateMapColors();
}

function createWorldSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  mapLabelPositions = {};
  mapLabelElements = [];
  mapPathElements = [];
  lastLabelScale = null;
  lastLabelVisibilityKey = '';
  attackableLabelCacheKey = '';
  attackableLabelCache = new Set();

  // Ocean background
  const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  ocean.setAttribute('width', String(MAP_WIDTH)); ocean.setAttribute('height', String(MAP_HEIGHT));
  ocean.setAttribute('fill', 'var(--map-water)');
  svg.appendChild(ocean);

  // Add graticule lines (subtle grid)
  const graticule = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  graticule.setAttribute('stroke', 'rgba(244,247,239,0.09)');
  graticule.setAttribute('stroke-width', '0.28');
  graticule.setAttribute('class', 'map-graticule');
  graticule.style.pointerEvents = 'none';
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * MAP_WIDTH;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', 0);
    line.setAttribute('x2', x); line.setAttribute('y2', MAP_HEIGHT);
    graticule.appendChild(line);
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * MAP_HEIGHT;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0); line.setAttribute('y1', y);
    line.setAttribute('x2', MAP_WIDTH); line.setAttribute('y2', y);
    graticule.appendChild(line);
  }
  svg.appendChild(graticule);

  const featureCollection = getMapFeatureCollection();

  const renderCountryPath = (feature) => {
    const gameId = feature.properties.gameId;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', geometryToPath(feature.geometry));
    if (gameId) {
      path.setAttribute('class', 'country-path neutral');
      if (gameId === 'SO') path.classList.add('no-internal-border');
      path.setAttribute('data-id', gameId);
      mapPathElements.push(path);
      path.addEventListener('mouseenter', (e) => {
        updateHoverPreview(gameId);
        showTooltip(e, gameId);
      });
      path.addEventListener('mouseleave', () => {
        updateHoverPreview(null);
        hideTooltip();
      });
      path.addEventListener('mousemove', moveTooltip);
      path.addEventListener('click', () => handleCountryClick(gameId));
    } else {
      // Non-game country: render but not interactive
      path.setAttribute('class', 'country-path');
      path.setAttribute('fill', '#cdd9e5');
      path.setAttribute('stroke', '#bcc8d4');
      path.setAttribute('stroke-width', '0.4');
      path.style.pointerEvents = 'none';
    }
    svg.appendChild(path);
  };

  featureCollection.features.filter(f => !f.properties.interactive).forEach(renderCountryPath);
  featureCollection.features.filter(f => f.properties.interactive).forEach(renderCountryPath);

  const seaRouteGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  seaRouteGroup.id = 'sea-route-layer';
  svg.appendChild(seaRouteGroup);

  // Country label group (shown at zoom level >= 2.5)
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelGroup.id = 'country-labels';
  const renderedLabelIds = new Set();
  featureCollection.features.forEach(feature => {
    const gameId = feature.properties.gameId;
    if (!gameId) return;
    if (renderedLabelIds.has(gameId)) return;
    const terr = G.territories[gameId];
    if (!terr) return;
    const country = COUNTRY_BY_ID.get(gameId);
    if (!country) return;
    renderedLabelIds.add(gameId);
    const [cx, cy] = getLabelPosition(feature);
    mapLabelPositions[gameId] = [cx, cy];
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx.toFixed(1));
    text.setAttribute('y', cy.toFixed(1));
    text.setAttribute('class', 'country-label');
    if (hasPort(gameId)) text.classList.add('has-port');
    text.setAttribute('data-id', gameId);
    setCountryLabelLines(text, gameId);
    applyCountryLabelTextOffset(text, gameId);
    labelGroup.appendChild(text);
    mapLabelElements.push(text);
  });
  svg.appendChild(labelGroup);

  return svg;
}

function hasPort(id) {
  return !!OCEAN_ROUTES[id]?.length;
}

function updateMapColors() {
  // Update country labels text (team may have changed)
  updateTeamLabels();
  const highlightSource = getMapHighlightSource();
  const selectedAttackable = G.selectedCountry ? getAttackableIdsFrom(G.selectedCountry) : null;
  const previewAttackable = !G.selectedCountry && highlightSource ? getAttackableIdsFrom(highlightSource) : null;
  const seaInfoTargets = hoverSeaPreviewCountry ? new Set(OCEAN_ROUTES[hoverSeaPreviewCountry] || []) : null;
  mapPathElements.forEach(path => {
    const id = path.dataset.id;
    const terr = G.territories[id];
    path.className.baseVal = 'country-path';
    if (id === 'SO') path.classList.add('no-internal-border');
    if (!terr) return;
    if (terr.owner) {
      const pl = G.players.find(p => p.id === terr.owner);
      const idx = G.players.indexOf(pl) + 1;
      path.classList.add(`p${idx}`);
    } else {
      path.classList.add('neutral');
    }
    if (G.homeOf[id]) path.classList.add('home');
    if (G.selectedCountry === id) path.classList.add('selected');
    if (!G.selectedCountry && hoverPreviewCountry === id) path.classList.add('preview-source');
    if (!G.selectedCountry && hoverSeaPreviewCountry === id) path.classList.add('sea-preview-source');
    if (!G.selectedCountry && seaInfoTargets?.has(id)) path.classList.add('sea-preview-target');
    if (selectedAttackable?.has(id)) {
      path.classList.add('attackable');
      if (getSeaRouteSegmentForAttack(G.selectedCountry, id)) path.classList.add('sea-attackable');
    } else if (previewAttackable?.has(id)) {
      path.classList.add('preview-attackable');
      if (getSeaRouteSegmentForAttack(highlightSource, id)) path.classList.add('sea-attackable');
    }
  });
  updateSeaRouteHighlights();
}

function clearMapHighlights() {
  updateMapColors();
}

function getMapHighlightSource() {
  if (G.selectedCountry) return G.selectedCountry;
  const pl = currentPlayerObj();
  if (hoverPreviewCountry && G.territories[hoverPreviewCountry]?.owner === pl?.id) return hoverPreviewCountry;
  return null;
}

function updateHoverPreview(id) {
  const pl = currentPlayerObj();
  const next = id && G.territories[id]?.owner === pl?.id ? id : null;
  const terr = id ? G.territories[id] : null;
  const nextSea = id && !G.selectedCountry && terr && !terr.owner && hasPort(id) ? id : null;
  if (hoverPreviewCountry === next && hoverSeaPreviewCountry === nextSea) return;
  hoverPreviewCountry = next;
  hoverSeaPreviewCountry = nextSea;
  if (!G.selectedCountry) updateMapColors();
}

function isDirectSeaRoute(fromId, toId) {
  if (!fromId || !toId) return false;
  return (OCEAN_ROUTES[fromId] || []).includes(toId);
}

function getSeaRouteSegmentForAttack(fromId, targetId) {
  const pl = currentPlayerObj();
  if (!fromId || !targetId || !pl) return null;
  const path = getAttackPath(fromId, targetId, pl.id);
  if (!path || path.length < 2) return null;
  for (let i = 0; i < path.length - 1; i++) {
    if (isDirectSeaRoute(path[i], path[i + 1])) return [path[i], path[i + 1]];
  }
  return null;
}

function getSeaRouteSegmentsForSource(fromId) {
  if (!fromId) return [];
  const seen = new Set();
  return COUNTRIES
    .map(c => c.id)
    .filter(id => isAttackableFrom(fromId, id))
    .map(id => getSeaRouteSegmentForAttack(fromId, id))
    .filter(Boolean)
    .filter(([a, b]) => {
      const key = `${a}-${b}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getSeaRouteSegmentsForInfoSource(fromId) {
  if (!fromId) return [];
  return (OCEAN_ROUTES[fromId] || [])
    .filter(toId => COUNTRY_ID_SET.has(toId))
    .map(toId => [fromId, toId]);
}

function makeSeaCurvePath(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distance = Math.hypot(dx, dy) || 1;
  const lift = Math.min(120, Math.max(34, distance * 0.18));
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const nx = -dy / distance;
  const ny = dx / distance;
  const cx = midX + nx * lift;
  const cy = midY + ny * lift;
  return `M${from[0].toFixed(1)} ${from[1].toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`;
}

function updateSeaRouteScale() {
  const layer = document.getElementById('sea-route-layer');
  if (!layer) return;
  const scale = Math.max(0.5, mapTransform.scale || 1);
  const stroke = (1.25 / scale).toFixed(3);
  const dash = (6 / scale).toFixed(3);
  const gap = (7 / scale).toFixed(3);
  const cycle = ((6 + 7) / scale).toFixed(3);
  layer.querySelectorAll('.sea-route-line').forEach(path => {
    path.style.strokeWidth = `${stroke}px`;
    path.style.strokeDasharray = `${dash}px ${gap}px`;
    path.style.setProperty('--sea-route-cycle', `${cycle}px`);
  });
  layer.querySelectorAll('.sea-route-dot').forEach(dot => {
    const baseRadius = dot.classList.contains('sea-route-start') ? 2.2 : 2.7;
    dot.setAttribute('r', (baseRadius / scale).toFixed(3));
    dot.style.strokeWidth = `${(0.7 / scale).toFixed(3)}px`;
  });
}

function updateSeaRouteHighlights() {
  const layer = document.getElementById('sea-route-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const source = getMapHighlightSource();
  const infoSource = !source && hoverSeaPreviewCountry;
  if (!source && !infoSource) return;
  const segments = source
    ? getSeaRouteSegmentsForSource(source).map(segment => ({ segment, isInfo: false }))
    : getSeaRouteSegmentsForInfoSource(infoSource).map(segment => ({ segment, isInfo: true }));

  segments.forEach(({ segment: [fromId, toId], isInfo }) => {
    const from = mapLabelPositions[fromId];
    const to = mapLabelPositions[toId];
    if (!from || !to) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', `sea-route-line${isInfo ? ' sea-route-info' : ''}`);
    path.setAttribute('d', makeSeaCurvePath(from, to));
    layer.appendChild(path);

    const start = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    start.setAttribute('class', `sea-route-dot sea-route-start${isInfo ? ' sea-route-info' : ''}`);
    start.setAttribute('cx', from[0].toFixed(1));
    start.setAttribute('cy', from[1].toFixed(1));
    layer.appendChild(start);

    const end = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    end.setAttribute('class', `sea-route-dot${isInfo ? ' sea-route-info' : ''}`);
    end.setAttribute('cx', to[0].toFixed(1));
    end.setAttribute('cy', to[1].toFixed(1));
    layer.appendChild(end);
  });
  updateSeaRouteScale();
}

// ============================================================
// TOOLTIP
// ============================================================
let tooltipVisible = false;
function showTooltip(e, id) {
  const tt = document.getElementById('map-tooltip');
  const terr = G.territories[id];
  const country = COUNTRY_BY_ID.get(id);
  if (!terr || !country) return;
  document.getElementById('tt-country').textContent = country.name;
  const ttTeamName = terr.team || '';
  const ttLeagueName = TEAM_LEAGUE[ttTeamName] || '';
  document.getElementById('tt-team').textContent = ttTeamName;
  // Add/update league span
  let ttLeagueEl = document.getElementById('tt-league');
  if (!ttLeagueEl) {
    ttLeagueEl = document.createElement('div');
    ttLeagueEl.id = 'tt-league';
    ttLeagueEl.className = 'tt-league';
    const ttTeamEl = document.getElementById('tt-team');
    ttTeamEl.parentNode.insertBefore(ttLeagueEl, ttTeamEl.nextSibling);
  }
  ttLeagueEl.textContent = ttLeagueName;
  const ownerEl = document.getElementById('tt-owner');
  if (G.homeOf[id]) {
    const pl = G.players.find(p => p.id === G.homeOf[id]);
    ownerEl.innerHTML = `<span style="color:${pl.color}">${escapeHtml(t('base_of', { name: pl.name }))}</span>`;
  } else if (terr.owner) {
    const pl = G.players.find(p => p.id === terr.owner);
    ownerEl.innerHTML = `<span style="color:${pl.color}">${escapeHtml(t('controlled_by', { name: pl.name }))}</span>`;
  } else {
    ownerEl.innerHTML = `<span style="color:var(--muted)">${t('neutral_territory')}</span>`;
  }
  if (G.homeOf[id]) {
    const homeId = id;
    const lives = G.homeLives[homeId];
    ownerEl.innerHTML += `<br><span style="color:var(--home-color)">${t('lives_left', { count: lives, plural: plural(lives) })}</span>`;
  }
  tt.style.display = 'block';
  moveTooltip(e);
  tooltipVisible = true;
}
function hideTooltip() {
  document.getElementById('map-tooltip').style.display = 'none';
  tooltipVisible = false;
}
function moveTooltip(e) {
  const tt = document.getElementById('map-tooltip');
  const container = document.getElementById('map-container');
  const rect = container.getBoundingClientRect();
  let x = e.clientX - rect.left + 12;
  let y = e.clientY - rect.top - 10;
  if (x + 180 > rect.width) x -= 200;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

// ============================================================
// MAP PAN/ZOOM
// ============================================================
let mapTransform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let mapWindowHandlers = null;
let hoverPreviewCountry = null;
let hoverSeaPreviewCountry = null;
let lastMapPointer = null;
let mapPointerDown = null;
let mapDidDrag = false;
let mapTransformSettleTimer = null;
let queuedZoom = null;
let queuedZoomFrame = null;

function getMapPointerFromEvent(e) {
  const container = document.getElementById('map-container');
  if (!container || !e) return null;
  const rect = container.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function initMapPanZoom(svg) {
  if (mapWindowHandlers) {
    window.removeEventListener('mousemove', mapWindowHandlers.move);
    window.removeEventListener('mouseup', mapWindowHandlers.up);
  }

  svg.addEventListener('mousedown', e => {
    lastMapPointer = getMapPointerFromEvent(e);
    mapPointerDown = { x: e.clientX, y: e.clientY };
    mapDidDrag = false;
    if (e.target.classList.contains('country-path')) return;
    isDragging = true;
    dragStart = { x: e.clientX - mapTransform.x, y: e.clientY - mapTransform.y };
    svg.style.cursor = 'grabbing';
  });
  svg.addEventListener('mousemove', e => {
    lastMapPointer = getMapPointerFromEvent(e);
  });

  mapWindowHandlers = {
    move: e => {
      if (!isDragging) return;
      lastMapPointer = getMapPointerFromEvent(e);
      if (mapPointerDown && Math.hypot(e.clientX - mapPointerDown.x, e.clientY - mapPointerDown.y) > 4) {
        mapDidDrag = true;
      }
      mapTransform.x = e.clientX - dragStart.x;
      mapTransform.y = e.clientY - dragStart.y;
      applyMapTransform(svg);
    },
    up: () => {
      isDragging = false;
      const currentSvg = document.getElementById('world-svg');
      if (currentSvg) currentSvg.style.cursor = 'grab';
    }
  };

  window.addEventListener('mousemove', mapWindowHandlers.move);
  window.addEventListener('mouseup', mapWindowHandlers.up);
  svg.addEventListener('click', e => {
    if (e.target.classList.contains('country-path')) return;
    if (mapDidDrag) return;
    deselectMapAttack();
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    queueMapZoom(factor, getMapPointerFromEvent(e));
  }, { passive: false });
}

function deselectMapAttack() {
  if (!G.selectedCountry && !G.attackTarget && !G.selectedAttackTeam && !G.selectedAttackFrom) return;
  G.selectedCountry = null;
  G.attackTarget = null;
  G.selectedAttackTeam = null;
  G.selectedAttackFrom = null;
  updateMapColors();
  renderSidebar();
  switchTab('map');
  saveGameState();
}

function queueMapZoom(factor, anchor) {
  if (!queuedZoom) {
    queuedZoom = { factor, anchor };
  } else {
    queuedZoom.factor *= factor;
    queuedZoom.anchor = anchor || queuedZoom.anchor;
  }
  if (queuedZoomFrame) return;
  queuedZoomFrame = requestAnimationFrame(() => {
    const next = queuedZoom;
    queuedZoom = null;
    queuedZoomFrame = null;
    if (next) mapZoom(next.factor, next.anchor);
  });
}

function applyMapTransform(svg) {
  if (!svg) svg = document.getElementById('world-svg');
  if (!svg) return;
  svg.classList.add('is-transforming');
  if (mapTransformSettleTimer) clearTimeout(mapTransformSettleTimer);
  mapTransformSettleTimer = setTimeout(() => {
    updateLabelScale();
    document.getElementById('world-svg')?.classList.remove('is-transforming');
  }, 120);
  svg.style.transform = `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.scale})`;
  svg.style.transformOrigin = 'center center';
  updateSeaRouteScale();
  updateLabelVisibilityForZoom();
  return;
  // Show/hide labels based on zoom - scale font inversely to CSS transform
  const labelGroup = document.getElementById('country-labels');
  if (labelGroup) {
    // Target ~11px screen size; SVG is scaled by mapTransform.scale via CSS
    // So SVG font-size = targetPx / scale
    const targetPx = 11;
    const svgFs = Math.max(2, targetPx / mapTransform.scale).toFixed(2);
    if (svgFs !== lastLabelScale) {
      labelGroup.style.setProperty('--label-font-size', `${svgFs}px`);
      lastLabelScale = svgFs;
    }
    mapLabelElements.forEach(l => {
      const id = l.dataset.id;
      l.classList.toggle('is-visible', shouldShowTeamLabel(id));
    });
  }
}

function mapZoom(factor, anchor = null) {
  const oldScale = mapTransform.scale;
  const nextScale = Math.max(0.5, Math.min(8, oldScale * factor));
  if (factor > 1 && nextScale > oldScale) {
    const container = document.getElementById('map-container');
    const rect = container?.getBoundingClientRect();
    const point = anchor || lastMapPointer || (rect ? { x: rect.width / 2, y: rect.height / 2 } : null);
    if (point && rect) {
      const originX = rect.width / 2;
      const originY = rect.height / 2;
      mapTransform.x = point.x - originX - (nextScale / oldScale) * (point.x - originX - mapTransform.x);
      mapTransform.y = point.y - originY - (nextScale / oldScale) * (point.y - originY - mapTransform.y);
    }
  } else if (factor < 1 && nextScale < oldScale) {
    const pullToCenter = nextScale / oldScale;
    mapTransform.x *= pullToCenter;
    mapTransform.y *= pullToCenter;
    if (nextScale <= 0.55) {
      mapTransform.x = 0;
      mapTransform.y = 0;
    }
  }
  mapTransform.scale = nextScale;
  applyMapTransform();
}

function resetMapView() {
  mapTransform = { x: 0, y: 0, scale: 1 };
  applyMapTransform();
}

function centerMapOnCountry(countryId) {
  const container = document.getElementById('map-container');
  if (!container) return;
  const pos = mapLabelPositions[countryId];
  if (!pos) return;
  const rect = container.getBoundingClientRect();
  const scale = Math.max(2.2, mapTransform.scale);
  const px = (pos[0] / MAP_WIDTH) * rect.width;
  const py = (pos[1] / MAP_HEIGHT) * rect.height;
  mapTransform = {
    scale,
    x: -scale * (px - rect.width / 2),
    y: -scale * (py - rect.height / 2)
  };
  applyMapTransform();
}

// ============================================================
// TEAM LABELS TOGGLE
// ============================================================
function toggleTeamLabels() {
  teamLabelsVisible = !teamLabelsVisible;
  G.teamLabelsVisible = teamLabelsVisible;
  updateTeamLabelButton();
  updateTeamLabels();
  saveGameState();
}

function updateTeamLabelButton() {
  const btn = document.getElementById('btn-toggle-teams');
  if (btn) {
    btn.classList.toggle('active', teamLabelsVisible);
    btn.textContent = teamLabelsVisible ? t('hide_teams') : t('show_teams');
  }
}

function getLabelZoomBucket() {
  if (!teamLabelsVisible) return 'off';
  if (mapTransform.scale >= 3.1) return 'all';
  if (mapTransform.scale >= 2.1) return 'mid';
  return 'major';
}

function getAttackableLabelIds() {
  const current = currentPlayerObj();
  const key = `${G.selectedCountry || ''}|${G.currentPlayer}|${G.attackTarget || ''}|${current?.territories?.join(',') || ''}`;
  if (key === attackableLabelCacheKey) return attackableLabelCache;
  attackableLabelCacheKey = key;
  attackableLabelCache = getAttackableIdsFrom(G.selectedCountry);
  return attackableLabelCache;
}

function getLabelVisibilityKey() {
  const current = currentPlayerObj();
  const viewportKey = mapTransform.scale >= 2.1
    ? `${Math.round(mapTransform.x / 160)}:${Math.round(mapTransform.y / 160)}:${Math.round(mapTransform.scale * 10)}`
    : 'wide';
  return [
    getLabelZoomBucket(),
    viewportKey,
    G.selectedCountry || '',
    G.attackTarget || '',
    G.currentPlayer,
    current?.territories?.join(',') || '',
    Object.keys(G.homeOf || {}).join(',')
  ].join('|');
}

function updateLabelScale() {
  const labelGroup = document.getElementById('country-labels');
  if (!labelGroup) return;
  const targetPx = 11;
  const svgFs = Math.max(2, targetPx / Math.max(0.5, mapTransform.scale)).toFixed(2);
  if (svgFs !== lastLabelScale) {
    labelGroup.style.setProperty('--label-font-size', `${svgFs}px`);
    lastLabelScale = svgFs;
  }
}

function updateLabelVisibilityForZoom(force = false) {
  const labelGroup = document.getElementById('country-labels');
  if (!labelGroup) return;
  const key = getLabelVisibilityKey();
  if (!force && key === lastLabelVisibilityKey) return;
  lastLabelVisibilityKey = key;
  mapLabelElements.forEach(l => {
    const id = l.dataset.id;
    l.classList.toggle('is-visible', shouldShowTeamLabel(id));
  });
}

function isLabelNearViewport(id) {
  if (mapTransform.scale < 2.1) return true;
  const container = document.getElementById('map-container');
  const pos = mapLabelPositions[id];
  if (!container || !pos) return true;
  const rect = container.getBoundingClientRect();
  const baseX = (pos[0] / MAP_WIDTH) * rect.width;
  const baseY = (pos[1] / MAP_HEIGHT) * rect.height;
  const screenX = (rect.width / 2) + mapTransform.x + (mapTransform.scale * (baseX - (rect.width / 2)));
  const screenY = (rect.height / 2) + mapTransform.y + (mapTransform.scale * (baseY - (rect.height / 2)));
  const padding = 180;
  return screenX >= -padding
    && screenX <= rect.width + padding
    && screenY >= -padding
    && screenY <= rect.height + padding;
}

function shouldShowTeamLabel(id) {
  if (!teamLabelsVisible || !id) return false;
  if (!isLabelNearViewport(id)) return false;
  if (mapTransform.scale >= 3.1) return true;
  if (G.selectedCountry === id || G.attackTarget === id || G.homeOf[id]) return true;
  const terr = G.territories?.[id];
  const current = currentPlayerObj();
  if (mapTransform.scale >= 2.1) {
    return MAJOR_LABEL_COUNTRIES.has(id) || terr?.owner === current?.id || getAttackableLabelIds().has(id);
  }
  return MAJOR_LABEL_COUNTRIES.has(id) && !!terr?.owner;
}

function updateTeamLabels() {
  const labelGroup = document.getElementById('country-labels');
  if (!labelGroup) return;
  updateLabelScale();
  mapLabelElements.forEach(l => {
    const id = l.dataset.id;
    if (G.territories?.[id]) setCountryLabelLines(l, id);
  });
  updateLabelVisibilityForZoom(true);
}

