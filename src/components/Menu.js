function Menu({
  allLayers,
  layerVisibility,
  layerOpacities,
  lidarRenderSettings,
  onApplyLidarPreset,
  onLayerOpacityChange,
  onLidarRenderSettingChange,
  onShowLidarProfileCard,
  onToggleForestLegend,
  onToggleLayer,
  onShowWorkPopup,
}) {
  const interactiveLayers = new Set([
    'admin_sections',
    'carte_moderne',
    'aerial',
    'aerial_1952',
    'forest',
    'mnt',
    'lidar',
    'sarde',
    'napo',
  ]);
  const opacityEnabledLayers = new Set([
    'admin_sections',
    'carte_moderne',
    'aerial',
    'aerial_1952',
    'forest',
    'mnt',
    'sarde',
    'napo',
  ]);
  const groupedLayers = allLayers.reduce((acc, layer) => {
    if (!acc[layer.categorie]) {
      acc[layer.categorie] = [];
    }
    acc[layer.categorie].push(layer);
    return acc;
  }, {});

  const categoryLabels = {
    admin: 'Cadastre',
    historical: 'Cartes historiques',
    landscapes: 'Paysages',
  };

  return (
    <div className='layers-panel'>
      <h2>Gestion Des Couches</h2>

      {Object.entries(groupedLayers).map(([category, layers]) => (
        <section className='layer-group' key={category}>
          <h3>{categoryLabels[category] || category}</h3>
          <ul>
            {layers.map((layer) => {
              const isVisible = Boolean(layerVisibility[layer.name]);
              const isInteractiveLayer = interactiveLayers.has(layer.name);
              const hasOpacityControl = opacityEnabledLayers.has(layer.name);
              const isUnavailable = !isInteractiveLayer && !isVisible;
              const handleLayerClick = () => {
                if (!isVisible && !isInteractiveLayer) {
                  onShowWorkPopup();
                  return;
                }
                onToggleLayer(layer.name);
              };
              const layerItemClassName = [
                'layer-item',
                isVisible ? 'active' : '',
                isUnavailable ? 'unavailable' : '',
              ].filter(Boolean).join(' ');
              return (
                <li key={layer.name}>
                  <button
                    className={layerItemClassName}
                    onClick={handleLayerClick}
                    type='button'
                  >
                    <span className='layer-label'>
                      {layer.displayable_name}
                      {layer.name === 'forest' && (
                        <span className='layer-info-wrap'>
                          <span
                            aria-label='Afficher la légende forestière'
                            className='layer-info-icon'
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') {
                                return;
                              }
                              event.preventDefault();
                              event.stopPropagation();
                              onToggleForestLegend();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onToggleForestLegend();
                            }}
                            role='button'
                            tabIndex={0}
                          >
                            i
                          </span>
                        </span>
                      )}
                    </span>
                    <span className='visibility-pill'>
                      {isVisible ? 'Visible' : 'Activer'}
                    </span>
                  </button>
                  {isInteractiveLayer && hasOpacityControl && isVisible && (
                    <div className='layer-opacity-row'>
                      <span>Opacité</span>
                      <input
                        aria-label={`Opacité ${layer.displayable_name}`}
                        max='100'
                        min='0'
                        onChange={(event) =>
                          onLayerOpacityChange(layer.name, Number(event.target.value) / 100)
                        }
                        type='range'
                        value={Math.round(((typeof layerOpacities[layer.name] === 'number' ? layerOpacities[layer.name] : 1)) * 100)}
                      />
                      <strong>{Math.round(((typeof layerOpacities[layer.name] === 'number' ? layerOpacities[layer.name] : 1)) * 100)}%</strong>
                    </div>
                  )}
                  {layer.name === 'lidar' && isVisible && (
                    <div className='lidar-settings-panel'>
                      <div className='lidar-settings-header'>Rendu LIDAR</div>
                      <div className='lidar-preset-row'>
                        <button onClick={() => onApplyLidarPreset('demo')} type='button'>Démo</button>
                        <button onClick={() => onApplyLidarPreset('dense')} type='button'>Dense</button>
                      </div>
                      <label className='lidar-setting-field'>
                        <span>Colorisation</span>
                        <select
                          onChange={(event) => onLidarRenderSettingChange('colorMode', event.target.value)}
                          value={lidarRenderSettings.colorMode}
                        >
                          <option value='height'>Hauteur</option>
                          <option value='intensity'>Intensité</option>
                          <option value='classification'>Classification</option>
                        </select>
                      </label>
                      <label className='lidar-setting-field'>
                        <span>Taille des points</span>
                        <div className='lidar-setting-inline'>
                          <input
                            max='20'
                            min='1'
                            onChange={(event) => onLidarRenderSettingChange('pointSize', Number(event.target.value))}
                            step='0.5'
                            type='range'
                            value={lidarRenderSettings.pointSize}
                          />
                          <strong>{lidarRenderSettings.pointSize.toFixed(1)}</strong>
                        </div>
                      </label>
                      <label className='lidar-setting-field'>
                        <span>SSE threshold</span>
                        <div className='lidar-setting-inline'>
                          <input
                            max='24'
                            min='2'
                            onChange={(event) => onLidarRenderSettingChange('sseThreshold', Number(event.target.value))}
                            step='1'
                            type='range'
                            value={lidarRenderSettings.sseThreshold}
                          />
                          <strong>{lidarRenderSettings.sseThreshold}</strong>
                        </div>
                      </label>
                      <label className='lidar-checkbox-row'>
                        <input
                          checked={lidarRenderSettings.enableEDL}
                          onChange={(event) => onLidarRenderSettingChange('enableEDL', event.target.checked)}
                          type='checkbox'
                        />
                        <span>EDL activé</span>
                      </label>
                      {lidarRenderSettings.enableEDL && (
                        <>
                          <label className='lidar-setting-field'>
                            <span>EDL strength</span>
                            <div className='lidar-setting-inline'>
                              <input
                                max='2'
                                min='0.1'
                                onChange={(event) => onLidarRenderSettingChange('edlStrength', Number(event.target.value))}
                                step='0.05'
                                type='range'
                                value={lidarRenderSettings.edlStrength}
                              />
                              <strong>{lidarRenderSettings.edlStrength.toFixed(2)}</strong>
                            </div>
                          </label>
                          <label className='lidar-setting-field'>
                            <span>EDL radius</span>
                            <div className='lidar-setting-inline'>
                              <input
                                max='3'
                                min='0.5'
                                onChange={(event) => onLidarRenderSettingChange('edlRadius', Number(event.target.value))}
                                step='0.1'
                                type='range'
                                value={lidarRenderSettings.edlRadius}
                              />
                              <strong>{lidarRenderSettings.edlRadius.toFixed(1)}</strong>
                            </div>
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className='tools-grid'>
        <button onClick={onShowLidarProfileCard} type='button'>Mesurer</button>
        <button onClick={onShowWorkPopup} type='button'>Exporter</button>
      </section>
    </div>
  );
}

export default Menu;
