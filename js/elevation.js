function addElevationLayerFromIGN() {
    var elevationSource = new itowns.WMTSSource({
        url: 'http://wxs.ign.fr/3ht7xcw6f7nciopo16etuqp2/geoportail/wmts',
        crs: 'EPSG:4326',
        name: 'ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES',
        tileMatrixSet: 'WGS84G',
        format: 'image/x-bil;bits=32',
        tileMatrixSetLimits: {
            11: {
                minTileRow: 442,
                maxTileRow: 1267,
                minTileCol: 1344,
                maxTileCol: 2683
            },
            12: {
                minTileRow: 885,
                maxTileRow: 2343,
                minTileCol: 3978,
                maxTileCol: 5126
            },
            13: {
                minTileRow: 1770,
                maxTileRow: 4687,
                minTileCol: 7957,
                maxTileCol: 10253
            },
            14: {
                minTileRow: 3540,
                maxTileRow: 9375,
                minTileCol: 15914,
                maxTileCol: 20507
            }
        }
    });

    var elevationLayer = new itowns.ElevationLayer('MNT_WORLD', {
        source: elevationSource,
    });

    view.addLayer(elevationLayer);

};

function setExtrusion(properties) {
    return properties.hauteur;
}

function setAltitude(properties) {
    return -properties.hauteur;
}

function setColor(properties) {
    return new itowns.THREE.Color(0xaaaaaa);
}

function addColorLayer(layerName, layerSource, layerColor) {
    var addedLayer = new itowns.ColorLayer(layerName, {
        name: layerName,
        transparent: true,
        style: {
            fill: layerColor,
            fillOpacity: 0.5,
            stroke: 'white',
        },
        source: layerSource,
    });

    view.addLayer(addedLayer);
}