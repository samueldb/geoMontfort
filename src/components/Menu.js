function Menu({
  allLayers,
  layerVisibility,
  layerOpacities,
  onLayerOpacityChange,
  onToggleForestLegend,
  onToggleLayer,
  onShowWorkPopup,
}) {
  const interactiveLayers = new Set(['admin_sections', 'carte_moderne', 'aerial', 'aerial_1952', 'forest', 'mnt', 'sarde', 'napo']);
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
                  {isInteractiveLayer && isVisible && (
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
                        value={Math.round((layerOpacities[layer.name] ?? 1) * 100)}
                      />
                      <strong>{Math.round((layerOpacities[layer.name] ?? 1) * 100)}%</strong>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className='tools-grid'>
        <button onClick={onShowWorkPopup} type='button'>Mesurer</button>
        <button onClick={onShowWorkPopup} type='button'>Exporter</button>
      </section>
    </div>
  );
}

export default Menu;
