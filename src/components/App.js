import React, { useMemo, useRef, useState } from 'react';
import Map from './Map';
import Menu from './Menu';
import { allLayers } from '../data/LayersList';
import sigLogoMontfort from '../assets/images/logo_GeoMontfort.png';
import '../styles/App.css';

const FOREST_LEGEND_URL =
  'https://data.geopf.fr/annexes/ressources/legendes/LANDCOVER.FORESTINVENTORY.V2-legend.png';

const DEFAULT_LIDAR_RENDER_SETTINGS = {
  pointSize: 20,
  colorMode: 'classification',
  sseThreshold: 2,
  enableEDL: true,
  edlStrength: 0.45,
  edlRadius: 1.2,
};

const LIDAR_RENDER_PRESETS = {
  demo: {
    pointSize: 2,
    colorMode: 'classification',
    sseThreshold: 8,
    enableEDL: true,
    edlStrength: 0.35,
    edlRadius: 1,
  },
  dense: DEFAULT_LIDAR_RENDER_SETTINGS,
};

function App() {
  const mapRef = useRef(null);
  const [viewMode, setViewMode] = useState('2d');
  const [showWorkPopup, setShowWorkPopup] = useState(false);
  const [showLidarProfileCard, setShowLidarProfileCard] = useState(false);
  const [showForestLegend, setShowForestLegend] = useState(false);
  const [coords, setCoords] = useState({
    lng: '6.5680',
    lat: '45.4890',
    zoom: '15.30',
    altitude: '812',
  });

  const initialLayerState = useMemo(
    () =>
      allLayers.reduce((acc, layer) => {
        acc[layer.name] = layer.name === 'carte_moderne';
        return acc;
      }, {}),
    []
  );

  const [layerVisibility, setLayerVisibility] = useState(initialLayerState);
  const [layerOpacities, setLayerOpacities] = useState(() =>
    allLayers.reduce((acc, layer) => {
      acc[layer.name] = 1;
      return acc;
    }, {})
  );
  const [lidarRenderSettings, setLidarRenderSettings] = useState(DEFAULT_LIDAR_RENDER_SETTINGS);

  const toggleLayer = (layerName) => {
    setLayerVisibility((current) => ({
      ...current,
      [layerName]: !current[layerName],
    }));
  };

  const setLayerOpacity = (layerName, opacity) => {
    setLayerOpacities((current) => ({
      ...current,
      [layerName]: opacity,
    }));
  };

  const setLidarRenderSetting = (key, value) => {
    setLidarRenderSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyLidarPreset = (presetName) => {
    const preset = LIDAR_RENDER_PRESETS[presetName];
    if (!preset) {
      return;
    }
    setLidarRenderSettings(preset);
  };

  const openWorkPopup = () => setShowWorkPopup(true);

  return (
    <div className='websig-shell'>
      <header className='websig-header vintage-texture'>
        <div className='brand-block'>
          <div className='brand-icon'>
            <img alt='Logo SIG' className='sig-logo' src={sigLogoMontfort} />
          </div>
          <div>
            <h1>Geo Montfort</h1>
            <p>SYSTEME D'INTÉRÊT GEOGRAPHIQUE LOCAL</p>
          </div>
        </div>

        <div className='search-wrap'>
          <input
            aria-label='Rechercher un lieu'
            className='search-input'
            onClick={openWorkPopup}
            placeholder='Rechercher une parcelle, une adresse ou un sommet...'
            type='text'
          />
        </div>

        <img alt='Logo SIG' className='sig-logo' src={sigLogoMontfort} />
      </header>

      <div className='websig-body'>
        <aside className='websig-sidebar vintage-texture'>
          <Menu
            allLayers={allLayers}
            layerOpacities={layerOpacities}
            layerVisibility={layerVisibility}
            lidarRenderSettings={lidarRenderSettings}
            onLayerOpacityChange={setLayerOpacity}
            onApplyLidarPreset={applyLidarPreset}
            onLidarRenderSettingChange={setLidarRenderSetting}
            onShowLidarProfileCard={() => setShowLidarProfileCard(true)}
            onShowWorkPopup={openWorkPopup}
            onToggleForestLegend={() => setShowForestLegend((current) => !current)}
            onToggleLayer={toggleLayer}
          />

          <div className='sidebar-footer'>
            <p>
              Donnees géographiques réutilisées depuis les fournisseurs francais officiels et mises en forme par mes soins.
            </p>
            <button onClick={openWorkPopup} type='button'>Telecharger les SIG</button>
          </div>
        </aside>

        <main className='websig-map-main'>
          <Map
            ref={mapRef}
            layerVisibility={layerVisibility}
            layerOpacities={layerOpacities}
            lidarRenderSettings={lidarRenderSettings}
            mode={viewMode}
            onViewChange={setViewMode}
            onHideLidarProfileCard={() => setShowLidarProfileCard(false)}
            onViewportChange={setCoords}
            showLidarProfileCard={showLidarProfileCard}
          />

          <div className='floating-controls'>
            <div className='control-stack'>
              <button onClick={() => mapRef.current?.zoomIn()} type='button'>
                +
              </button>
              <button onClick={() => mapRef.current?.zoomOut()} type='button'>
                -
              </button>
            </div>
            <button
              className='locate-button'
              onClick={() => mapRef.current?.locateUser()}
              type='button'
            >
              Localiser
            </button>
            <div className='view-toggle'>
              <button
                className={viewMode === '3d' ? 'active' : ''}
                onClick={() => setViewMode('3d')}
                type='button'
              >
                3D
              </button>
              <button
                className={viewMode === '2d' ? 'active' : ''}
                onClick={() => setViewMode('2d')}
                type='button'
              >
                2D
              </button>
            </div>
            {showForestLegend && (
              <div className='floating-legend-panel vintage-texture'>
                <img alt='Légende carte forestière' src={FOREST_LEGEND_URL} />
              </div>
            )}
          </div>

          <div className='coord-badge vintage-texture'>
            <span>EPSG:2154</span>
            <span>X: {coords.lng}</span>
            <span>Y: {coords.lat}</span>
            <span>Z: {coords.altitude}m</span>
            <span>Zoom: {coords.zoom}</span>
          </div>

          <article className='parcel-card vintage-texture'>
            <h3>Parcelle ndeg128-B</h3>
            <p>Quartier des Bionnassay, 74170 Saint-Gervais</p>
            <div className='parcel-grid'>
              <div>
                <small>Superficie</small>
                <strong>1,450 m2</strong>
              </div>
              <div>
                <small>Pente Moy.</small>
                <strong>12%</strong>
              </div>
            </div>
            <button type='button'>Consulter le PLU</button>
          </article>
        </main>
      </div>

      {showWorkPopup && (
        <div
          className='work-popin-backdrop'
          onClick={() => setShowWorkPopup(false)}
          role='presentation'
        >
          <div
            aria-labelledby='work-popin-title'
            aria-modal='true'
            className='work-popin-card vintage-texture'
            onClick={(event) => event.stopPropagation()}
            role='dialog'
          >
            <h4 id='work-popin-title'>Travaux en cours</h4>
            <p>Cette fonctionnalite sera disponible prochainement.</p>
            <button onClick={() => setShowWorkPopup(false)} type='button'>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
