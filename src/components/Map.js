import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import MapGL, {
  AttributionControl,
  Layer,
  Source,
} from 'react-map-gl/maplibre';
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
  '© SDB'
];

const Map = forwardRef(function Map(
  { mode, onViewChange, onViewportChange, layerVisibility, layerOpacities = {} },
  ref
) {
  const mapRef = useRef(null);
  const mapComponentRef = useRef(null);
  const modernVisibilityRef = useRef(false);
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
  const isModernLayerVisible = Boolean(layerVisibility?.carte_moderne);
  const isAdminSectionsLayerVisible = Boolean(layerVisibility?.admin_sections);
  const isAerialLayerVisible = Boolean(layerVisibility?.aerial);
  const isAerial1952LayerVisible = Boolean(layerVisibility?.aerial_1952);
  const isForestLayerVisible = Boolean(layerVisibility?.forest);
  const isMntLayerVisible = Boolean(layerVisibility?.mnt);
  const isSardeLayerVisible = Boolean(layerVisibility?.sarde);
  const isNapoLayerVisible = Boolean(layerVisibility?.napo);
  const pmtilesProtocolRef = useRef(null);
  const pmtilesArchiveUrl = `pmtiles://${PMTILES_REMOTE_URL}`;
  const sardeTilesUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/v4/${SARDE_TILESET_ID}/{z}/{x}/{y}.png?access_token=${MAPBOX_TOKEN}`
    : null;
  const napoTilesUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/v4/${NAPO_TILESET_ID}/{z}/{x}/{y}.png?access_token=${MAPBOX_TOKEN}`
    : null;
  const terrainTileJsonUrl = MAPTILER_KEY
    ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
    : null;
  const getLayerOpacity = (layerName, baseOpacity = 1) => {
    const layerOpacity = layerOpacities[layerName];
    if (typeof layerOpacity !== 'number') {
      return baseOpacity;
    }
    return Math.max(0, Math.min(1, baseOpacity * layerOpacity));
  };

  const setBaseMapVisibility = (map, visible) => {
    const styleLayers = map.getStyle()?.layers || [];
    const appManagedLayerIds = new Set([
      modernMapLayerId,
      adminSectionsRasterLayerId,
      aerialRasterLayerId,
      aerial1952RasterLayerId,
      forestRasterLayerId,
      mntRasterLayerId,
      sardeRasterLayerId,
      napoRasterLayerId,
      hillshadeLayerId,
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
  };

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
      // Keep navigation usable even if terrain source fails.
      map.setTerrain(null);
    }
  }, []);

  const applyViewMode = useCallback((nextMode) => {
    const map = mapComponentRef.current?.getMap();
    if (!map) {
      return;
    }

    if (nextMode === '2d') {
      applyTerrainMode(map, '2d');
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      return;
    }

    map.easeTo({ pitch: 58, bearing: 150, duration: 700 });
    map.once('moveend', () => applyTerrainMode(map, '3d'));
  }, [applyTerrainMode]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapComponentRef.current?.getMap()?.zoomIn(),
    zoomOut: () => mapComponentRef.current?.getMap()?.zoomOut(),
    locateUser: () => {
      const map = mapComponentRef.current?.getMap();
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
    const protocol = new Protocol();
    pmtilesProtocolRef.current = protocol;
    maplibregl.addProtocol('pmtiles', protocol.tile);

    return () => {
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  useEffect(() => {
    applyViewMode(mode);
  }, [mode, applyViewMode]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(modernMapLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      modernMapLayerId,
      'visibility',
      isModernLayerVisible ? 'visible' : 'none'
    );

    setBaseMapVisibility(mapRef.current, !isModernLayerVisible);
  }, [isModernLayerVisible, modernMapLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(adminSectionsRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      adminSectionsRasterLayerId,
      'visibility',
      isAdminSectionsLayerVisible ? 'visible' : 'none'
    );
  }, [isAdminSectionsLayerVisible, adminSectionsRasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(aerialRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      aerialRasterLayerId,
      'visibility',
      isAerialLayerVisible ? 'visible' : 'none'
    );
  }, [isAerialLayerVisible, aerialRasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(aerial1952RasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      aerial1952RasterLayerId,
      'visibility',
      isAerial1952LayerVisible ? 'visible' : 'none'
    );
  }, [isAerial1952LayerVisible, aerial1952RasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(forestRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      forestRasterLayerId,
      'visibility',
      isForestLayerVisible ? 'visible' : 'none'
    );
  }, [isForestLayerVisible, forestRasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(mntRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      mntRasterLayerId,
      'visibility',
      isMntLayerVisible ? 'visible' : 'none'
    );
  }, [isMntLayerVisible, mntRasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(sardeRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      sardeRasterLayerId,
      'visibility',
      isSardeLayerVisible ? 'visible' : 'none'
    );
  }, [isSardeLayerVisible, sardeRasterLayerId]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer(napoRasterLayerId)) {
      return;
    }

    mapRef.current.setLayoutProperty(
      napoRasterLayerId,
      'visibility',
      isNapoLayerVisible ? 'visible' : 'none'
    );
  }, [isNapoLayerVisible, napoRasterLayerId]);

  const handleMapLoad = (event) => {
    const map = event.target;
    mapRef.current = map;
    setBaseMapVisibility(map, !modernVisibilityRef.current);

    if (map.getSource(hillshadeSourceId)) {
      applyTerrainMode(map, mode);
      return;
    }

    const onSourceData = (sourceEvent) => {
      if (sourceEvent.sourceId !== hillshadeSourceId || !map.getSource(hillshadeSourceId)) {
        return;
      }
      map.off('sourcedata', onSourceData);
      applyTerrainMode(map, mode);
    };

    map.on('sourcedata', onSourceData);
  };

  const handleMove = (event) => {
    const { viewState } = event;
    onViewportChange({
      lng: viewState.longitude.toFixed(4),
      lat: viewState.latitude.toFixed(4),
      zoom: viewState.zoom.toFixed(2),
      altitude: Math.max(650, Math.round(700 + viewState.pitch * 2.1)).toString(),
    });
  };

  return (
    <MapGL
      attributionControl={true}
      initialViewState={{
        longitude: 6.568,
        latitude: 45.489,
        zoom: 15.3,
        pitch: mode === '2d' ? 0 : 60,
        bearing: mode === '2d' ? 0 : 150,
      }}
      mapStyle='https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json'
      maxPitch={85}
      onLoad={handleMapLoad}
      onMove={handleMove}
      ref={mapComponentRef}
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl customAttribution={MAP_ATTRIBUTIONS} position='bottom-right' />

      {terrainTileJsonUrl && (
        <Source
          id={hillshadeSourceId}
          encoding='mapbox'
          url={terrainTileJsonUrl}
          type='raster-dem'
        >
          <Layer
            id={hillshadeLayerId}
            layout={{
              visibility: mode === '3d' ? 'visible' : 'none',
            }}
            paint={{
              'hillshade-exaggeration': 1,
              'hillshade-shadow-color': '#3f321f',
              'hillshade-highlight-color': '#faf2df',
              'hillshade-accent-color': '#5a4a2d',
            }}
            type='hillshade'
          />
        </Source>
      )}

      <Source
        id={modernMapSourceId}
        url={pmtilesArchiveUrl}
        type='raster'
        tileSize={256}
      >
        <Layer
          id={modernMapLayerId}
          layout={{
            visibility: isModernLayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('carte_moderne', 1),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      <Source
        id={adminSectionsSourceId}
        tiles={[ADMIN_SECTIONS_WMTS_URL]}
        tileSize={256}
        type='raster'
      >
        <Layer
          id={adminSectionsRasterLayerId}
          layout={{
            visibility: isAdminSectionsLayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('admin_sections', 1),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      <Source
        id={aerialSourceId}
        tiles={[AERIAL_WMTS_URL]}
        tileSize={256}
        type='raster'
      >
        <Layer
          id={aerialRasterLayerId}
          layout={{
            visibility: isAerialLayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('aerial', 1),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      <Source
        id={aerial1952SourceId}
        tiles={[AERIAL_1952_WMTS_URL]}
        tileSize={256}
        type='raster'
      >
        <Layer
          id={aerial1952RasterLayerId}
          layout={{
            visibility: isAerial1952LayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('aerial_1952', 1),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      <Source
        id={forestSourceId}
        tiles={[FOREST_WMTS_URL]}
        tileSize={256}
        type='raster'
      >
        <Layer
          id={forestRasterLayerId}
          layout={{
            visibility: isForestLayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('forest', 1),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      <Source
        id={mntSourceId}
        tiles={[MNT_WMTS_URL]}
        tileSize={256}
        type='raster'
      >
        <Layer
          id={mntRasterLayerId}
          layout={{
            visibility: isMntLayerVisible ? 'visible' : 'none',
          }}
          paint={{
            'raster-opacity': getLayerOpacity('mnt', 0.9),
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>

      {sardeTilesUrl && (
        <Source
          id={sardeSourceId}
          tiles={[sardeTilesUrl]}
          tileSize={256}
          type='raster'
        >
          <Layer
            id={sardeRasterLayerId}
            layout={{
              visibility: isSardeLayerVisible ? 'visible' : 'none',
            }}
            paint={{
              'raster-opacity': getLayerOpacity('sarde', 0.85),
              'raster-resampling': 'nearest',
            }}
            type='raster'
          />
        </Source>
      )}

      {napoTilesUrl && (
        <Source
          id={napoSourceId}
          tiles={[napoTilesUrl]}
          tileSize={256}
          type='raster'
        >
          <Layer
            id={napoRasterLayerId}
            layout={{
              visibility: isNapoLayerVisible ? 'visible' : 'none',
            }}
            paint={{
              'raster-opacity': getLayerOpacity('napo', 0.85),
              'raster-resampling': 'nearest',
            }}
            type='raster'
          />
        </Source>
      )}
    </MapGL>
  );
});

export default Map;
