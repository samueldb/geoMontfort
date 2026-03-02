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
const PMTILES_REMOTE_URL =
  process.env.REACT_APP_PMTILES_URL ||
  'http://[2a01:e0a:c47:7be0:7ed5:ec0f:2230:689]:8080/jovet.pmtiles';

const Map = forwardRef(function Map(
  { mode, onViewChange, onViewportChange, layerVisibility },
  ref
) {
  const mapRef = useRef(null);
  const mapComponentRef = useRef(null);
  const modernVisibilityRef = useRef(false);
  const hillshadeSourceId = 'hillshade-dem-source';
  const hillshadeLayerId = 'terrain-hillshade-layer';
  const modernMapSourceId = 'carte-moderne-source';
  const modernMapLayerId = 'carte-moderne-layer';
  const isModernLayerVisible = Boolean(layerVisibility?.carte_moderne);
  const pmtilesProtocolRef = useRef(null);
  const pmtilesArchiveUrl = `pmtiles://${PMTILES_REMOTE_URL}`;
  const terrainTileJsonUrl = MAPTILER_KEY
    ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
    : null;

  const setBaseMapVisibility = (map, visible) => {
    const styleLayers = map.getStyle()?.layers || [];
    styleLayers.forEach((layer) => {
      if (
        layer.id === modernMapLayerId ||
        layer.id === 'sky' ||
        layer.id === hillshadeLayerId
      ) {
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
      attributionControl={false}
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
      <AttributionControl compact position='bottom-left' />

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
              'hillshade-exaggeration': 1.2,
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
            'raster-opacity': 1,
            'raster-resampling': 'nearest',
          }}
          type='raster'
        />
      </Source>
    </MapGL>
  );
});

export default Map;
