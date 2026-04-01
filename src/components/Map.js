import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import maplibregl from 'maplibre-gl';
import { CopcLayer } from '../vendor/maplibre-copc-layer';
import { extractCopcProfile } from '../utils/copcProfile';
import { Protocol } from 'pmtiles';
import '../styles/Map.css';

const MAPTILER_KEY = (process.env.REACT_APP_MAPTILER_KEY || '').replace(/^['"]|['"]$/g, '');
const MAPBOX_TOKEN = (
  process.env.REACT_APP_MAPBOX_TOKEN ||
  process.env.REACT_APP_MAPBOX_ACCESS_TOKEN ||
  ''
).replace(/^['"]|['"]$/g, '');
const PMTILES_REMOTE_URL =
  process.env.REACT_APP_PMTILES_URL ||
  'https://tiles.montfortvo.net/jovet.pmtiles';
const DEFAULT_LIDAR_COPC_URLS = [
  '/copc/LHD_FXX_0978_6495_PTS_LAMB93_IGN69.copc.laz',
  '/copc/LHD_FXX_0978_6494_PTS_LAMB93_IGN69.copc.laz',
  '/copc/LHD_FXX_0979_6495_PTS_LAMB93_IGN69.copc.laz',
  '/copc/LHD_FXX_0979_6494_PTS_LAMB93_IGN69.copc.laz',
];
const LIDAR_COPC_URLS = (process.env.REACT_APP_LIDAR_COPC_URLS || '')
  .split(',')
  .map((url) => url.replace(/^['"]|['"]$/g, '').trim())
  .filter(Boolean);
const ADMIN_SECTIONS_WMTS_URL = process.env.REACT_APP_ADMIN_SECTIONS_WMTS_URL ||
  'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image%2Fpng&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
const AERIAL_WMTS_URL = process.env.REACT_APP_AERIAL_WMTS_URL ||
  'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image%2Fjpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
const AERIAL_1952_WMTS_URL = process.env.REACT_APP_AERIAL_1952_WMTS_URL ||
  'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image%2Fpng&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
const FOREST_WMTS_URL = process.env.REACT_APP_FOREST_WMTS_URL ||
  'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image%2Fpng&LAYER=LANDCOVER.FORESTINVENTORY.V2&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
const MNT_WMTS_URL = process.env.REACT_APP_MNT_WMTS_URL ||
  'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM_0_18&FORMAT=image%2Fpng&LAYER=IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}';
const SARDE_TILESET_ID = process.env.REACT_APP_SARDE_TILESET_ID || 'samueldb.5agbtq27';
const NAPO_TILESET_ID = process.env.REACT_APP_NAPO_TILESET_ID || 'samueldb.2w36gjhb';
const MAP_ATTRIBUTIONS = [
  '© IGN',
  '© OpenStreetMap contributors',
  '© SDB',
];

const INITIAL_VIEW_STATE = {
  longitude: 6.568,
  latitude: 45.489,
  zoom: 15.3,
};
const LIDAR_LAYER_IDS = [
  'lidar-copc-layer-1',
  'lidar-copc-layer-2',
  'lidar-copc-layer-3',
  'lidar-copc-layer-4',
];
const DEFAULT_LIDAR_TILE_LAYOUT = [
  { quadrant: 'nw' },
  { quadrant: 'sw' },
  { quadrant: 'ne' },
  { quadrant: 'se' },
];
const LIDAR_MIN_ZOOM = 15.2;
const DEFAULT_LIDAR_RENDER_SETTINGS = {
  pointSize: 20,
  colorMode: 'classification',
  sseThreshold: 2,
  enableEDL: true,
  edlStrength: 0.45,
  edlRadius: 1.2,
};
const PROFILE_SOURCE_ID = 'lidar-profile-cut-source';
const PROFILE_BUFFER_LAYER_ID = 'lidar-profile-cut-buffer';
const PROFILE_BUFFER_OUTLINE_LAYER_ID = 'lidar-profile-cut-buffer-outline';
const PROFILE_LINE_HALO_LAYER_ID = 'lidar-profile-cut-line-halo';
const PROFILE_LINE_LAYER_ID = 'lidar-profile-cut-line';
const PROFILE_POINT_LAYER_ID = 'lidar-profile-cut-points';
const PROFILE_HOVER_CROSSBAR_LAYER_ID = 'lidar-profile-cut-hover-crossbar';
const PROFILE_HOVER_POINT_LAYER_ID = 'lidar-profile-cut-hover-point';
const PROFILE_MIN_ELEVATION = 500;
const PROFILE_MAX_ELEVATION = 2500;
const PROFILE_MAX_DISPLAY_POINTS = 12000;
const EARTH_RADIUS = 6378137;
const PROFILE_GUIDE_LAYER_IDS = [
  PROFILE_BUFFER_LAYER_ID,
  PROFILE_BUFFER_OUTLINE_LAYER_ID,
  PROFILE_LINE_HALO_LAYER_ID,
  PROFILE_LINE_LAYER_ID,
  PROFILE_POINT_LAYER_ID,
  PROFILE_HOVER_CROSSBAR_LAYER_ID,
  PROFILE_HOVER_POINT_LAYER_ID,
];

function lngLatToMercatorMeters(lng, lat) {
  const x = EARTH_RADIUS * (lng * Math.PI / 180);
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  return { x, y };
}

function mercatorMetersToLngLat(x, y) {
  const lng = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

function interpolateCutPoint(points, distanceMeters) {
  if (points.length !== 2) {
    return null;
  }

  const [start, end] = points.map(([lng, lat]) => lngLatToMercatorMeters(lng, lat));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length < 1e-6) {
    return points[0];
  }

  const t = Math.max(0, Math.min(1, distanceMeters / length));
  return mercatorMetersToLngLat(start.x + dx * t, start.y + dy * t);
}

function buildHoverCrossbar(points, distanceMeters, halfLengthMeters) {
  if (points.length !== 2) {
    return null;
  }

  const [start, end] = points.map(([lng, lat]) => lngLatToMercatorMeters(lng, lat));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length < 1e-6) {
    return null;
  }

  const t = Math.max(0, Math.min(1, distanceMeters / length));
  const x = start.x + dx * t;
  const y = start.y + dy * t;
  const nx = -dy / length;
  const ny = dx / length;

  return [
    mercatorMetersToLngLat(x - nx * halfLengthMeters, y - ny * halfLengthMeters),
    mercatorMetersToLngLat(x + nx * halfLengthMeters, y + ny * halfLengthMeters),
  ];
}

function buildCutBufferPolygon(points, bufferMeters) {
  if (points.length !== 2 || bufferMeters <= 0) {
    return null;
  }

  const [start, end] = points.map(([lng, lat]) => lngLatToMercatorMeters(lng, lat));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length < 1e-6) {
    return null;
  }

  const nx = -dy / length;
  const ny = dx / length;
  const corners = [
    { x: start.x + nx * bufferMeters, y: start.y + ny * bufferMeters },
    { x: end.x + nx * bufferMeters, y: end.y + ny * bufferMeters },
    { x: end.x - nx * bufferMeters, y: end.y - ny * bufferMeters },
    { x: start.x - nx * bufferMeters, y: start.y - ny * bufferMeters },
    { x: start.x + nx * bufferMeters, y: start.y + ny * bufferMeters },
  ];

  return corners.map(({ x, y }) => mercatorMetersToLngLat(x, y));
}

function buildAxisTicks(minValue, maxValue, tickCount = 5) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [];
  }
  if (Math.abs(maxValue - minValue) < 1e-6) {
    return [minValue];
  }
  const ticks = [];
  for (let index = 0; index < tickCount; index += 1) {
    ticks.push(minValue + ((maxValue - minValue) * index) / (tickCount - 1));
  }
  return ticks;
}

function moveProfileGuideLayersToFront(map) {
  if (!map) {
    return;
  }

  PROFILE_GUIDE_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

const Map = forwardRef(function Map(
  {
    mode,
    onHideLidarProfileCard = () => {},
    onViewportChange,
    layerVisibility,
    layerOpacities = {},
    lidarRenderSettings = DEFAULT_LIDAR_RENDER_SETTINGS,
    showLidarProfileCard = false,
  },
  ref
) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const profileHoverMarkerRef = useRef(null);
  const modernVisibilityRef = useRef(false);
  const pmtilesProtocolRef = useRef(null);
  const modeRef = useRef(mode);
  const onViewportChangeRef = useRef(onViewportChange);
  const lidarVisibleRef = useRef(Boolean(layerVisibility && layerVisibility.lidar));
  const profileToolActiveRef = useRef(false);
  const profileCutPointsRef = useRef([]);
  const profileBufferMetersRef = useRef(3);
  const profileComputationIdRef = useRef(0);
  const lastProfileRequestRef = useRef(null);
  const lidarUrlsRef = useRef([]);
  const syncStaticLayersRef = useRef(null);
  const syncLidarLayersRef = useRef(null);
  const applyViewModeRef = useRef(null);
  const computeProfileRef = useRef(null);
  const hillshadeSourceId = 'hillshade-dem-source';
  const hillshadeLayerId = 'terrain-hillshade-layer';
  const adminSectionsSourceId = 'admin-sections-source';
  const adminSectionsRasterLayerId = 'admin-sections-raster-layer';
  const modernMapSourceId = 'carte-moderne-source';
  const modernMapLayerId = 'carte-moderne-layer';
  const aerialSourceId = 'aerial-source';
  const aerialRasterLayerId = 'aerial-raster-layer';
  const aerial1952SourceId = 'aerial-1952-source';
  const aerial1952RasterLayerId = 'aerial-1952-raster-layer';
  const forestSourceId = 'forest-source';
  const forestRasterLayerId = 'forest-raster-layer';
  const mntSourceId = 'mnt-source';
  const mntRasterLayerId = 'mnt-raster-layer';
  const sardeSourceId = 'sarde-source';
  const sardeRasterLayerId = 'sarde-raster-layer';
  const napoSourceId = 'napo-source';
  const napoRasterLayerId = 'napo-raster-layer';
  const lidarBaseUrl = (() => {
    try {
      return new URL(PMTILES_REMOTE_URL, window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  })();
  const lidarUrls = (LIDAR_COPC_URLS.length ? LIDAR_COPC_URLS : DEFAULT_LIDAR_COPC_URLS)
    .map((url) => (/^https?:\/\//.test(url) ? url : new URL(url, lidarBaseUrl).href));
  const lidarTiles = lidarUrls.map((url, index) => ({
    url,
    layerId: LIDAR_LAYER_IDS[index] || `lidar-copc-layer-${index + 1}`,
    ...(DEFAULT_LIDAR_TILE_LAYOUT[index] || { quadrant: 'all' }),
  }));
  const isModernLayerVisible = Boolean(layerVisibility && layerVisibility.carte_moderne);
  const isAdminSectionsLayerVisible = Boolean(layerVisibility && layerVisibility.admin_sections);
  const isAerialLayerVisible = Boolean(layerVisibility && layerVisibility.aerial);
  const isAerial1952LayerVisible = Boolean(layerVisibility && layerVisibility.aerial_1952);
  const isForestLayerVisible = Boolean(layerVisibility && layerVisibility.forest);
  const isMntLayerVisible = Boolean(layerVisibility && layerVisibility.mnt);
  const isLidarLayerVisible = Boolean(layerVisibility && layerVisibility.lidar);
  const isSardeLayerVisible = Boolean(layerVisibility && layerVisibility.sarde);
  const isNapoLayerVisible = Boolean(layerVisibility && layerVisibility.napo);
  const sardeTilesUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/v4/${SARDE_TILESET_ID}/{z}/{x}/{y}.png?access_token=${MAPBOX_TOKEN}`
    : null;
  const napoTilesUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/v4/${NAPO_TILESET_ID}/{z}/{x}/{y}.png?access_token=${MAPBOX_TOKEN}`
    : null;
  const terrainTileJsonUrl = MAPTILER_KEY
    ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
    : null;
  const [profileToolActive, setProfileToolActive] = useState(false);
  const [profileCutPoints, setProfileCutPoints] = useState([]);
  const [profileBufferMeters, setProfileBufferMeters] = useState(3);
  const [profileResult, setProfileResult] = useState(null);
  const [profileMeasure, setProfileMeasure] = useState(null);

  useEffect(() => {
    lidarUrlsRef.current = lidarUrls;
  }, [lidarUrls]);

  const getLayerOpacity = useCallback((layerName, baseOpacity) => {
    const fallbackOpacity = typeof baseOpacity === 'number' ? baseOpacity : 1;
    const layerOpacity = layerOpacities[layerName];
    if (typeof layerOpacity !== 'number') {
      return fallbackOpacity;
    }
    return Math.max(0, Math.min(1, fallbackOpacity * layerOpacity));
  }, [layerOpacities]);

  const setBaseMapVisibility = useCallback((map, visible) => {
    const styleLayers = (map.getStyle() && map.getStyle().layers) || [];
    const appManagedLayerIds = new Set([
      modernMapLayerId,
      adminSectionsRasterLayerId,
      aerialRasterLayerId,
      aerial1952RasterLayerId,
      forestRasterLayerId,
      mntRasterLayerId,
      ...LIDAR_LAYER_IDS,
      sardeRasterLayerId,
      napoRasterLayerId,
      hillshadeLayerId,
      PROFILE_BUFFER_LAYER_ID,
      PROFILE_BUFFER_OUTLINE_LAYER_ID,
      PROFILE_LINE_HALO_LAYER_ID,
      PROFILE_LINE_LAYER_ID,
      PROFILE_POINT_LAYER_ID,
      PROFILE_HOVER_CROSSBAR_LAYER_ID,
      PROFILE_HOVER_POINT_LAYER_ID,
      'sky',
    ]);

    styleLayers.forEach((layer) => {
      if (appManagedLayerIds.has(layer.id)) {
        return;
      }
      if (map.getLayer(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }, []);

  const ensureRasterLayer = useCallback((map, config) => {
    if (!map.getSource(config.sourceId)) {
      map.addSource(config.sourceId, config.source);
    }

    if (!map.getLayer(config.layerId)) {
      map.addLayer({
        id: config.layerId,
        type: 'raster',
        source: config.sourceId,
        layout: {
          visibility: config.visible ? 'visible' : 'none',
        },
        paint: {
          'raster-opacity': config.opacity,
          'raster-resampling': 'nearest',
        },
      });
      return;
    }

    map.setLayoutProperty(config.layerId, 'visibility', config.visible ? 'visible' : 'none');
    map.setPaintProperty(config.layerId, 'raster-opacity', config.opacity);
    map.setPaintProperty(config.layerId, 'raster-resampling', 'nearest');
  }, []);

  const ensureHillshade = useCallback((map) => {
    if (!terrainTileJsonUrl) {
      return;
    }

    if (!map.getSource(hillshadeSourceId)) {
      map.addSource(hillshadeSourceId, {
        type: 'raster-dem',
        url: terrainTileJsonUrl,
        encoding: 'mapbox',
      });
    }

    if (!map.getLayer(hillshadeLayerId)) {
      map.addLayer({
        id: hillshadeLayerId,
        type: 'hillshade',
        source: hillshadeSourceId,
        layout: {
          visibility: mode === '3d' ? 'visible' : 'none',
        },
        paint: {
          'hillshade-exaggeration': 1,
          'hillshade-shadow-color': '#3f321f',
          'hillshade-highlight-color': '#faf2df',
          'hillshade-accent-color': '#5a4a2d',
        },
      });
      return;
    }

    map.setLayoutProperty(hillshadeLayerId, 'visibility', mode === '3d' ? 'visible' : 'none');
  }, [mode, terrainTileJsonUrl]);

  const applyTerrainMode = useCallback((map, nextMode) => {
    if (!map || !map.getSource(hillshadeSourceId)) {
      return;
    }

    try {
      if (nextMode === '3d') {
        map.setTerrain({
          source: hillshadeSourceId,
          exaggeration: 1.1,
        });
      } else {
        map.setTerrain(null);
      }
    } catch (error) {
      map.setTerrain(null);
    }
  }, []);

  const updateRasterLayer = useCallback((layerId, visible, opacity) => {
    const map = mapRef.current;
    if (!map || !map.getLayer(layerId)) {
      return;
    }

    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    if (typeof opacity === 'number') {
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, []);

  const addLidarLayer = useCallback((map, tiles) => {
    if (!map) {
      return;
    }

    tiles.forEach(({ url, layerId }) => {
      if (!url || map.getLayer(layerId)) {
        return;
      }

      map.addLayer(new CopcLayer(
        url,
        {
          colorMode: lidarRenderSettings.colorMode,
          pointSize: lidarRenderSettings.pointSize,
          sseThreshold: lidarRenderSettings.sseThreshold,
          maxCacheSize: 100,
          maxCacheMemory: 96 * 1024 * 1024,
          enableEDL: lidarRenderSettings.enableEDL,
          edlStrength: lidarRenderSettings.edlStrength,
          edlRadius: lidarRenderSettings.edlRadius,
          depthTest: true,
        },
        layerId
      ));
    });
  }, [lidarRenderSettings]);

  const getDesiredLidarTiles = useCallback((map) => {
    if (!map) {
      return [];
    }

    const zoom = map.getZoom();
    if (zoom < LIDAR_MIN_ZOOM) {
      return [];
    }

    const center = map.getCenter();
    const isEast = center.lng >= INITIAL_VIEW_STATE.longitude;
    const isNorth = center.lat >= INITIAL_VIEW_STATE.latitude;
    const primaryQuadrant = isNorth ? (isEast ? 'ne' : 'nw') : (isEast ? 'se' : 'sw');
    const fallbackOrder = {
      nw: ['nw', 'ne', 'sw', 'se'],
      ne: ['ne', 'nw', 'se', 'sw'],
      sw: ['sw', 'se', 'nw', 'ne'],
      se: ['se', 'sw', 'ne', 'nw'],
    };
    const maxTiles = zoom >= 16.2 ? 4 : zoom >= 15.7 ? 2 : 1;

    return (fallbackOrder[primaryQuadrant] || ['nw', 'ne', 'sw', 'se'])
      .map((quadrant) => lidarTiles.find((tile) => tile.quadrant === quadrant))
      .filter(Boolean)
      .slice(0, Math.min(maxTiles, lidarTiles.length));
  }, [lidarTiles]);

  const removeLidarLayer = useCallback((map) => {
    if (!map) {
      return;
    }

    LIDAR_LAYER_IDS.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });
  }, []);

  const syncLidarLayers = useCallback((map) => {
    if (!map) {
      return;
    }

    const desiredTiles = getDesiredLidarTiles(map);
    const desiredIds = new Set(desiredTiles.map(({ layerId }) => layerId));

    lidarTiles.forEach(({ layerId }) => {
      if (!desiredIds.has(layerId) && map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    addLidarLayer(map, desiredTiles);
    moveProfileGuideLayersToFront(map);
  }, [addLidarLayer, getDesiredLidarTiles, lidarTiles]);

  const syncLidarLayerSettings = useCallback((map) => {
    if (!map) {
      return;
    }

    LIDAR_LAYER_IDS.forEach((layerId) => {
      const layer = map.getLayer(layerId);
      if (!layer) {
        return;
      }
      if (typeof layer.setPointSize === 'function') {
        layer.setPointSize(lidarRenderSettings.pointSize);
      }
      if (typeof layer.setSseThreshold === 'function') {
        layer.setSseThreshold(lidarRenderSettings.sseThreshold);
      }
      if (typeof layer.setColorMode === 'function') {
        layer.setColorMode(lidarRenderSettings.colorMode);
      }
      if (typeof layer.setEDLEnabled === 'function') {
        layer.setEDLEnabled(lidarRenderSettings.enableEDL);
      }
      if (typeof layer.updateEDLParameters === 'function') {
        layer.updateEDLParameters({
          strength: lidarRenderSettings.edlStrength,
          radius: lidarRenderSettings.edlRadius,
        });
      }
    });
  }, [lidarRenderSettings]);

  const ensureProfileGuideLayers = useCallback((map) => {
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (!map.getSource(PROFILE_SOURCE_ID)) {
      map.addSource(PROFILE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(PROFILE_BUFFER_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_BUFFER_LAYER_ID,
        type: 'fill',
        source: PROFILE_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#2a9d8f',
          'fill-opacity': 0.18,
        },
      });
    }

    if (!map.getLayer(PROFILE_BUFFER_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_BUFFER_OUTLINE_LAYER_ID,
        type: 'line',
        source: PROFILE_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': '#1f7f73',
          'line-width': 2,
          'line-opacity': 0.65,
          'line-dasharray': [1, 1.5],
        },
      });
    }

    if (!map.getLayer(PROFILE_LINE_HALO_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_LINE_HALO_LAYER_ID,
        type: 'line',
        source: PROFILE_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#f8fbff',
          'line-width': 9,
          'line-opacity': 0.9,
        },
      });
    }

    if (!map.getLayer(PROFILE_LINE_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_LINE_LAYER_ID,
        type: 'line',
        source: PROFILE_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#0b6bdb',
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      });
    }

    if (!map.getLayer(PROFILE_POINT_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_POINT_LAYER_ID,
        type: 'circle',
        source: PROFILE_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'hoverMarker']]],
        paint: {
          'circle-color': '#ffffff',
          'circle-stroke-color': '#0b6bdb',
          'circle-stroke-width': 3,
          'circle-radius': 7,
        },
      });
    }

    if (!map.getLayer(PROFILE_HOVER_CROSSBAR_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_HOVER_CROSSBAR_LAYER_ID,
        type: 'line',
        source: PROFILE_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'hoverCrossbar'], true]],
        paint: {
          'line-color': '#d62828',
          'line-width': 3.5,
          'line-opacity': 0.95,
        },
      });
    }

    if (!map.getLayer(PROFILE_HOVER_POINT_LAYER_ID)) {
      map.addLayer({
        id: PROFILE_HOVER_POINT_LAYER_ID,
        type: 'circle',
        source: PROFILE_SOURCE_ID,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'hoverMarker'], true], ['!=', ['get', 'hidden'], true]],
        paint: {
          'circle-color': '#d62828',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-radius': 6.5,
        },
      });
    }

    moveProfileGuideLayersToFront(map);
  }, []);

  const updateProfileGuide = useCallback((map, points, bufferMeters, hoverDistance) => {
    if (!map || !map.getSource(PROFILE_SOURCE_ID)) {
      return;
    }

    const features = points.map((point, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: point,
      },
      properties: { index },
    }));

    if (points.length === 2) {
      const bufferPolygon = buildCutBufferPolygon(points, bufferMeters);
      if (bufferPolygon) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [bufferPolygon],
          },
          properties: {},
        });
      }
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points,
        },
        properties: {},
      });

      if (typeof hoverDistance === 'number') {
        const hoverPoint = interpolateCutPoint(points, hoverDistance);
        const hoverCrossbar = buildHoverCrossbar(points, hoverDistance, Math.max(4, bufferMeters));
        if (hoverCrossbar) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: hoverCrossbar,
            },
            properties: { hoverCrossbar: true },
          });
        }
        if (hoverPoint) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: hoverPoint,
            },
            properties: { hoverMarker: true, hidden: true },
          });
        }
      }
    }

    map.getSource(PROFILE_SOURCE_ID).setData({
      type: 'FeatureCollection',
      features,
    });
  }, []);

  const computeProfile = useCallback(async (cutPoints, bufferMeters) => {
    if (cutPoints.length !== 2) {
      lastProfileRequestRef.current = null;
      profileComputationIdRef.current += 1;
      return;
    }

    const requestSignature = JSON.stringify({
      cutPoints,
      bufferMeters,
      colorMode: lidarRenderSettings.colorMode,
    });
    if (lastProfileRequestRef.current === requestSignature) {
      return;
    }
    lastProfileRequestRef.current = requestSignature;

    const [start, end] = cutPoints;
    const startMeters = lngLatToMercatorMeters(start[0], start[1]);
    const endMeters = lngLatToMercatorMeters(end[0], end[1]);
    const length = Math.hypot(endMeters.x - startMeters.x, endMeters.y - startMeters.y);
    const requestId = profileComputationIdRef.current + 1;
    profileComputationIdRef.current = requestId;

    setProfileResult((current) => ({
      points: current?.points || [],
      totalPoints: current?.totalPoints || 0,
      displayedPoints: current?.displayedPoints || 0,
      length,
      minElevation: current?.minElevation || PROFILE_MIN_ELEVATION,
      maxElevation: current?.maxElevation || PROFILE_MAX_ELEVATION,
      bufferMeters,
      minFilterElevation: PROFILE_MIN_ELEVATION,
      maxFilterElevation: PROFILE_MAX_ELEVATION,
      selectedNodeCount: current?.selectedNodeCount || 0,
      processedNodeCount: current?.processedNodeCount || 0,
      isLoading: true,
      error: null,
    }));

    try {
      const result = await extractCopcProfile({
        urls: lidarUrlsRef.current,
        cutPoints,
        bufferMeters,
        colorMode: lidarRenderSettings.colorMode,
        minElevation: PROFILE_MIN_ELEVATION,
        maxElevation: PROFILE_MAX_ELEVATION,
        maxDisplayPoints: PROFILE_MAX_DISPLAY_POINTS,
      });

      if (profileComputationIdRef.current !== requestId) {
        return;
      }

      setProfileResult({
        ...result,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (profileComputationIdRef.current !== requestId) {
        return;
      }

      setProfileResult({
        points: [],
        totalPoints: 0,
        displayedPoints: 0,
        length,
        minElevation: PROFILE_MIN_ELEVATION,
        maxElevation: PROFILE_MAX_ELEVATION,
        bufferMeters,
        minFilterElevation: PROFILE_MIN_ELEVATION,
        maxFilterElevation: PROFILE_MAX_ELEVATION,
        selectedNodeCount: 0,
        processedNodeCount: 0,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [lidarRenderSettings.colorMode]);

  const syncStaticLayers = useCallback((map) => {
    ensureHillshade(map);
    ensureRasterLayer(map, {
      sourceId: modernMapSourceId,
      layerId: modernMapLayerId,
      source: {
        type: 'raster',
        url: `pmtiles://${PMTILES_REMOTE_URL}`,
        tileSize: 256,
      },
      visible: isModernLayerVisible,
      opacity: getLayerOpacity('carte_moderne', 1),
    });
    ensureRasterLayer(map, {
      sourceId: adminSectionsSourceId,
      layerId: adminSectionsRasterLayerId,
      source: { type: 'raster', tiles: [ADMIN_SECTIONS_WMTS_URL], tileSize: 256 },
      visible: isAdminSectionsLayerVisible,
      opacity: getLayerOpacity('admin_sections', 1),
    });
    ensureRasterLayer(map, {
      sourceId: aerialSourceId,
      layerId: aerialRasterLayerId,
      source: { type: 'raster', tiles: [AERIAL_WMTS_URL], tileSize: 256 },
      visible: isAerialLayerVisible,
      opacity: getLayerOpacity('aerial', 1),
    });
    ensureRasterLayer(map, {
      sourceId: aerial1952SourceId,
      layerId: aerial1952RasterLayerId,
      source: { type: 'raster', tiles: [AERIAL_1952_WMTS_URL], tileSize: 256 },
      visible: isAerial1952LayerVisible,
      opacity: getLayerOpacity('aerial_1952', 1),
    });
    ensureRasterLayer(map, {
      sourceId: forestSourceId,
      layerId: forestRasterLayerId,
      source: { type: 'raster', tiles: [FOREST_WMTS_URL], tileSize: 256 },
      visible: isForestLayerVisible,
      opacity: getLayerOpacity('forest', 1),
    });
    ensureRasterLayer(map, {
      sourceId: mntSourceId,
      layerId: mntRasterLayerId,
      source: { type: 'raster', tiles: [MNT_WMTS_URL], tileSize: 256 },
      visible: isMntLayerVisible,
      opacity: getLayerOpacity('mnt', 0.9),
    });

    if (sardeTilesUrl) {
      ensureRasterLayer(map, {
        sourceId: sardeSourceId,
        layerId: sardeRasterLayerId,
        source: { type: 'raster', tiles: [sardeTilesUrl], tileSize: 256 },
        visible: isSardeLayerVisible,
        opacity: getLayerOpacity('sarde', 0.85),
      });
    }

    if (napoTilesUrl) {
      ensureRasterLayer(map, {
        sourceId: napoSourceId,
        layerId: napoRasterLayerId,
        source: { type: 'raster', tiles: [napoTilesUrl], tileSize: 256 },
        visible: isNapoLayerVisible,
        opacity: getLayerOpacity('napo', 0.85),
      });
    }

    setBaseMapVisibility(map, !modernVisibilityRef.current);
  }, [
    ensureHillshade,
    ensureRasterLayer,
    getLayerOpacity,
    isAdminSectionsLayerVisible,
    isAerial1952LayerVisible,
    isAerialLayerVisible,
    isForestLayerVisible,
    isModernLayerVisible,
    isMntLayerVisible,
    isNapoLayerVisible,
    isSardeLayerVisible,
    napoTilesUrl,
    sardeTilesUrl,
    setBaseMapVisibility,
  ]);

  const applyViewMode = useCallback((nextMode) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (nextMode === '2d') {
      applyTerrainMode(map, '2d');
      if (map.getLayer(hillshadeLayerId)) {
        map.setLayoutProperty(hillshadeLayerId, 'visibility', 'none');
      }
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      return;
    }

    if (map.getLayer(hillshadeLayerId)) {
      map.setLayoutProperty(hillshadeLayerId, 'visibility', 'visible');
    }
    map.easeTo({ pitch: 58, bearing: 150, duration: 700 });
    map.once('moveend', () => applyTerrainMode(map, '3d'));
  }, [applyTerrainMode]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    locateUser: () => {
      const map = mapRef.current;
      if (!map || !navigator.geolocation) {
        return;
      }
      navigator.geolocation.getCurrentPosition((position) => {
        map.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
          speed: 0.8,
        });
      });
    },
  }));

  useEffect(() => {
    modernVisibilityRef.current = isModernLayerVisible;
  }, [isModernLayerVisible]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    lidarVisibleRef.current = isLidarLayerVisible;
  }, [isLidarLayerVisible]);

  useEffect(() => {
    profileToolActiveRef.current = profileToolActive;
  }, [profileToolActive]);

  useEffect(() => {
    profileCutPointsRef.current = profileCutPoints;
  }, [profileCutPoints]);

  useEffect(() => {
    profileBufferMetersRef.current = profileBufferMeters;
  }, [profileBufferMeters]);

  useEffect(() => {
    if (showLidarProfileCard) {
      return;
    }
    setProfileToolActive(false);
    setProfileMeasure(null);
    profileHoverMarkerRef.current?.remove();
    profileHoverMarkerRef.current = null;
  }, [showLidarProfileCard]);

  useEffect(() => {
    syncStaticLayersRef.current = syncStaticLayers;
    syncLidarLayersRef.current = syncLidarLayers;
    applyViewModeRef.current = applyViewMode;
    computeProfileRef.current = computeProfile;
  }, [applyViewMode, computeProfile, syncLidarLayers, syncStaticLayers]);

  useEffect(() => {
    const protocol = new Protocol();
    pmtilesProtocolRef.current = protocol;
    maplibregl.addProtocol('pmtiles', protocol.tile);
    return () => {
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json',
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: modeRef.current === '2d' ? 0 : 60,
      bearing: modeRef.current === '2d' ? 0 : 150,
      maxPitch: 85,
      attributionControl: true,
      customAttribution: MAP_ATTRIBUTIONS,
    });

    mapRef.current = map;

    const handleMove = () => {
      const center = map.getCenter();
      onViewportChangeRef.current({
        lng: center.lng.toFixed(4),
        lat: center.lat.toFixed(4),
        zoom: map.getZoom().toFixed(2),
        altitude: Math.max(650, Math.round(700 + map.getPitch() * 2.1)).toString(),
      });
    };

    const handleLoad = () => {
      ensureProfileGuideLayers(map);
      syncStaticLayersRef.current?.(map);
      if (lidarVisibleRef.current) {
        syncLidarLayersRef.current?.(map);
      }
      applyViewModeRef.current?.(modeRef.current);
      updateProfileGuide(map, profileCutPointsRef.current, profileBufferMetersRef.current, null);
      handleMove();
    };

    const handleMoveEnd = () => {
      if (lidarVisibleRef.current) {
        syncLidarLayersRef.current?.(map);
      }
    };

    const handleMapClick = (event) => {
      if (!profileToolActiveRef.current) {
        return;
      }
      const nextPoints = profileCutPointsRef.current.length === 2
        ? [[event.lngLat.lng, event.lngLat.lat]]
        : [...profileCutPointsRef.current, [event.lngLat.lng, event.lngLat.lat]];
      setProfileCutPoints(nextPoints);
    };

    map.on('load', handleLoad);
    map.on('move', handleMove);
    map.on('moveend', handleMoveEnd);
    map.on('click', handleMapClick);

    return () => {
      removeLidarLayer(map);
      profileHoverMarkerRef.current?.remove();
      profileHoverMarkerRef.current = null;
      map.off('load', handleLoad);
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [ensureProfileGuideLayers, removeLidarLayer, updateProfileGuide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    syncStaticLayers(map);
  }, [syncStaticLayers]);

  useEffect(() => {
    applyViewMode(mode);
  }, [applyViewMode, mode]);

  useEffect(() => {
    updateRasterLayer(modernMapLayerId, isModernLayerVisible, getLayerOpacity('carte_moderne', 1));
    if (mapRef.current) {
      setBaseMapVisibility(mapRef.current, !isModernLayerVisible);
    }
  }, [getLayerOpacity, isModernLayerVisible, setBaseMapVisibility, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(adminSectionsRasterLayerId, isAdminSectionsLayerVisible, getLayerOpacity('admin_sections', 1));
  }, [getLayerOpacity, isAdminSectionsLayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(aerialRasterLayerId, isAerialLayerVisible, getLayerOpacity('aerial', 1));
  }, [getLayerOpacity, isAerialLayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(aerial1952RasterLayerId, isAerial1952LayerVisible, getLayerOpacity('aerial_1952', 1));
  }, [getLayerOpacity, isAerial1952LayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(forestRasterLayerId, isForestLayerVisible, getLayerOpacity('forest', 1));
  }, [getLayerOpacity, isForestLayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(mntRasterLayerId, isMntLayerVisible, getLayerOpacity('mnt', 0.9));
  }, [getLayerOpacity, isMntLayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(sardeRasterLayerId, isSardeLayerVisible, getLayerOpacity('sarde', 0.85));
  }, [getLayerOpacity, isSardeLayerVisible, updateRasterLayer]);

  useEffect(() => {
    updateRasterLayer(napoRasterLayerId, isNapoLayerVisible, getLayerOpacity('napo', 0.85));
  }, [getLayerOpacity, isNapoLayerVisible, updateRasterLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (isLidarLayerVisible) {
      syncLidarLayers(map);
      return;
    }

    removeLidarLayer(map);
  }, [isLidarLayerVisible, removeLidarLayer, syncLidarLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && isLidarLayerVisible) {
      syncLidarLayerSettings(map);
    }
    if (profileCutPoints.length === 2) {
      computeProfile(profileCutPoints, profileBufferMeters);
    }
  }, [computeProfile, isLidarLayerVisible, profileBufferMeters, profileCutPoints, syncLidarLayerSettings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    const hoveredDistance = profileMeasure
      ? Math.max(0, Math.min(profileResult?.length || 0, profileMeasure.distance))
      : null;
    ensureProfileGuideLayers(map);
    updateProfileGuide(map, profileCutPoints, profileBufferMeters, hoveredDistance);
    if (profileCutPoints.length !== 2) {
      profileComputationIdRef.current += 1;
    }
  }, [ensureProfileGuideLayers, profileBufferMeters, profileCutPoints, profileMeasure, profileResult, updateProfileGuide]);

  useEffect(() => {
    const map = mapRef.current;
    const hoveredDistance = profileMeasure
      ? Math.max(0, Math.min(profileResult?.length || 0, profileMeasure.distance))
      : null;
    const hoverCoordinates = profileCutPoints.length === 2 && typeof hoveredDistance === 'number'
      ? interpolateCutPoint(profileCutPoints, hoveredDistance)
      : null;

    if (!map || !hoverCoordinates) {
      profileHoverMarkerRef.current?.remove();
      profileHoverMarkerRef.current = null;
      return;
    }

    if (!profileHoverMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'profile-hover-map-marker';
      profileHoverMarkerRef.current = new maplibregl.Marker({
        element,
        anchor: 'center',
      }).setLngLat(hoverCoordinates).addTo(map);
      return;
    }

    profileHoverMarkerRef.current.setLngLat(hoverCoordinates);
  }, [profileCutPoints, profileMeasure, profileResult]);

  const profileWidth = 620;
  const profileHeight = 280;
  const margin = { top: 18, right: 18, bottom: 34, left: 54 };
  const plotWidth = profileWidth - margin.left - margin.right;
  const plotHeight = profileHeight - margin.top - margin.bottom;
  const xRange = Math.max(profileResult?.length || 1, 1);
  const yRange = Math.max((profileResult?.maxElevation || 1) - (profileResult?.minElevation || 0), 1);
  const profilePointsSvg = profileResult && profileResult.points.length
    ? profileResult.points.map((point, index) => {
        const cx = margin.left + (point.distance / xRange) * plotWidth;
        const cy = margin.top + (1 - ((point.elevation - profileResult.minElevation) / yRange)) * plotHeight;
        return <circle cx={cx} cy={cy} fill={point.color} key={`${point.distance}-${point.elevation}-${index}`} r='1.4' />;
      })
    : null;
  const xTicks = profileResult ? buildAxisTicks(0, profileResult.length) : [];
  const yTicks = profileResult ? buildAxisTicks(profileResult.minElevation, profileResult.maxElevation) : [];
  const profileMeasureDistance = profileMeasure ? Math.max(0, Math.min(profileResult?.length || 0, profileMeasure.distance)) : null;
  const profileMeasureX = profileMeasureDistance === null ? null : margin.left + (profileMeasureDistance / xRange) * plotWidth;
  const profileMeasureTolerance = (xRange / Math.max(plotWidth, 1)) * 5;
  const profileMeasuredSlice = profileResult && profileMeasureDistance !== null && profileResult.points.length
    ? profileResult.points.reduce((accumulator, point) => {
        if (Math.abs(point.distance - profileMeasureDistance) > profileMeasureTolerance) {
          return accumulator;
        }
        if (!accumulator) {
          return { min: point, max: point };
        }
        return {
          min: point.elevation < accumulator.min.elevation ? point : accumulator.min,
          max: point.elevation > accumulator.max.elevation ? point : accumulator.max,
        };
      }, null)
    : null;
  const profileMeasureMinY = profileMeasuredSlice
    ? margin.top + (1 - ((profileMeasuredSlice.min.elevation - profileResult.minElevation) / yRange)) * plotHeight
    : null;
  const profileMeasureMaxY = profileMeasuredSlice
    ? margin.top + (1 - ((profileMeasuredSlice.max.elevation - profileResult.minElevation) / yRange)) * plotHeight
    : null;
  const profileMeasureHeight = profileMeasuredSlice
    ? profileMeasuredSlice.max.elevation - profileMeasuredSlice.min.elevation
    : null;

  return (
    <>
      <div className='map-container' ref={containerRef} />
      {showLidarProfileCard && (
        <div className='profile-tool-card vintage-texture'>
          <div className='profile-tool-header-row'>
            <div className='profile-tool-header'>Coupe LIDAR</div>
            <button
              aria-label='Masquer la coupe LIDAR'
              className='profile-tool-close'
              onClick={onHideLidarProfileCard}
              type='button'
            >
              ‹
            </button>
          </div>
          <button
            className={profileToolActive ? 'profile-tool-button active' : 'profile-tool-button'}
            onClick={() => setProfileToolActive((current) => !current)}
            type='button'
          >
            {profileToolActive ? 'Mode coupe actif' : 'Activer la coupe'}
          </button>
          <button
            className='profile-tool-button secondary'
            onClick={() => {
              lastProfileRequestRef.current = null;
              setProfileCutPoints([]);
              setProfileResult(null);
            }}
            type='button'
          >
            Réinitialiser
          </button>
          <label className='profile-buffer-field'>
            <span>largeur de la coupe</span>
            <div className='profile-buffer-inline'>
              <input
                max='20'
                min='0.5'
                onChange={(event) => setProfileBufferMeters(Number(event.target.value))}
                step='0.5'
                type='range'
                value={profileBufferMeters}
              />
              <strong>{profileBufferMeters.toFixed(1)} m</strong>
            </div>
          </label>
          <p className='profile-tool-help'>
            {profileCutPoints.length === 0 && 'Une fois le mode coupe activé, cliquez 2 fois sur la carte pour créer une ligne de coupe.'}
            {profileCutPoints.length === 1 && 'Clique une première extrémité sur la carte.'}
            {profileCutPoints.length === 2 && 'Clique la seconde extrémité pour calculer le profil.'}
          </p>
        </div>
      )}
      {showLidarProfileCard && profileCutPoints.length === 2 && (
        <div className='profile-panel vintage-texture'>
          <div className='profile-panel-header'>
            <div>
              <strong>Profil de coupe</strong>
              <span>
                {profileResult ? (profileResult.isLoading ? 'Calcul en cours' : `${profileResult.totalPoints} points croisés`) : 'Calcul en cours'}
              </span>
            </div>
            <div>
              <strong>{profileResult ? `${profileResult.length.toFixed(1)} m` : '...'}</strong>
              <span>Longueur</span>
            </div>
          </div>
          <div className='profile-measure-readout'>
            {profileMeasuredSlice
              ? `Hauteur locale: ${profileMeasureHeight.toFixed(1)} m`
              : 'Survole le profil pour mesurer la hauteur locale'}
          </div>
          <svg
            className='profile-chart'
            onMouseLeave={() => setProfileMeasure(null)}
            onMouseMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const localX = ((event.clientX - bounds.left) / bounds.width) * profileWidth;
              const clampedX = Math.max(margin.left, Math.min(margin.left + plotWidth, localX));
              const distance = ((clampedX - margin.left) / plotWidth) * xRange;
              setProfileMeasure({ distance });
            }}
            viewBox={`0 0 ${profileWidth} ${profileHeight}`}
          >
            <rect fill='rgba(255,255,255,0.45)' height={profileHeight} rx='14' width={profileWidth} x='0' y='0' />
            <line stroke='#243026' strokeWidth='1.2' x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} />
            <line stroke='#243026' strokeWidth='1.2' x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} />
            {xTicks.map((tick) => {
              const x = margin.left + (tick / Math.max(profileResult?.length || 1, 1)) * plotWidth;
              return (
                <g key={`x-${tick}`}>
                  <line stroke='rgba(36,48,38,0.18)' x1={x} x2={x} y1={margin.top} y2={margin.top + plotHeight} />
                  <text className='profile-axis-label' textAnchor='middle' x={x} y={profileHeight - 8}>{tick.toFixed(0)}</text>
                </g>
              );
            })}
            {yTicks.map((tick) => {
              const y = margin.top + (1 - ((tick - (profileResult?.minElevation || 0)) / Math.max((profileResult?.maxElevation || 1) - (profileResult?.minElevation || 0), 1))) * plotHeight;
              return (
                <g key={`y-${tick}`}>
                  <line stroke='rgba(36,48,38,0.18)' x1={margin.left} x2={margin.left + plotWidth} y1={y} y2={y} />
                  <text className='profile-axis-label' textAnchor='end' x={margin.left - 8} y={y + 4}>{tick.toFixed(0)}</text>
                </g>
              );
            })}
            <text className='profile-axis-title' textAnchor='middle' x={margin.left + plotWidth / 2} y={profileHeight - 2}>Distance (m)</text>
            <text className='profile-axis-title' textAnchor='middle' transform={`translate(16 ${margin.top + plotHeight / 2}) rotate(-90)`}>Altitude (m)</text>
            {profileMeasureX !== null && profileMeasuredSlice && (
              <g>
                <line className='profile-measure-guide' x1={profileMeasureX} x2={profileMeasureX} y1={margin.top} y2={margin.top + plotHeight} />
                <line className='profile-measure-line' x1={profileMeasureX} x2={profileMeasureX} y1={profileMeasureMaxY} y2={profileMeasureMinY} />
                <circle className='profile-measure-dot' cx={profileMeasureX} cy={profileMeasureMaxY} r='3.2' />
                <circle className='profile-measure-dot' cx={profileMeasureX} cy={profileMeasureMinY} r='3.2' />
              </g>
            )}
            {profilePointsSvg}
          </svg>
          {profileResult && (
            <div className='profile-panel-footer'>
              <span>Affichés: {profileResult.displayedPoints}</span>
              <span>Buffer: {profileResult.bufferMeters.toFixed(1)} m</span>
              <span>Altitude: {profileResult.minFilterElevation} m - {profileResult.maxFilterElevation} m</span>
              <span>Noeuds COPC: {profileResult.processedNodeCount}/{profileResult.selectedNodeCount}</span>
              <span>{profileResult.error ? `Erreur: ${profileResult.error}` : 'Couleurs conservées depuis le rendu courant'}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
});

export default Map;
