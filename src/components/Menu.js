function Menu({ allLayers, layerVisibility, onToggleLayer, onShowWorkPopup }) {
  const groupedLayers = allLayers.reduce((acc, layer) => {
    if (!acc[layer.categorie]) {
      acc[layer.categorie] = [];
    }
    acc[layer.categorie].push(layer);
    return acc;
  }, {});

  const categoryLabels = {
    admin: 'Cadastre',
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
              const isModernLayer = layer.name === 'carte_moderne';
              const handleLayerClick = () => {
                if (!isVisible && !isModernLayer) {
                  onShowWorkPopup();
                  return;
                }
                onToggleLayer(layer.name);
              };
              return (
                <li key={layer.name}>
                  <button
                    className={isVisible ? 'layer-item active' : 'layer-item'}
                    onClick={handleLayerClick}
                    type='button'
                  >
                    <span>{layer.displayable_name}</span>
                    <span className='visibility-pill'>
                      {isVisible ? 'Visible' : 'Activer'}
                    </span>
                  </button>
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
