function getRemoteGeoJson(url){
    return fetch(url).then(function(res){
        if (res.ok){
            return res.json();
        }
        else{
            console.log("Impossible de récupérer les données demandées : " + response.status);
        }
    })
}

function getLocalGeoJson(path){
    return fetch(path).then(function(res){
        if (res.ok){
            return res.json();
        }
        else{
            console.log("Impossible de récupérer les données demandées : " + response.status);
        }
    })
}


function getCadastreLayerFromStMarcel(layerName, codeCommune){
    var communesToGet = [codeCommune];
    return Promise.all(communesToGet.map(function(communeToGet){
        return getRemoteGeoJson('https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/'+codeCommune+'/geojson/'+layerName)
    })).then(function(featureCollections){
        return {
            type: 'FeatureCollection',
            features: featureCollections.reduce(function (acc, featureCollection) {
                if (featureCollection && featureCollection.features) {
                    return acc.concat(featureCollection.features)
                }

                return acc
            }, [])
        }
    })
}


function getSections(codeCommune){
    return getCadastreLayerFromStMarcel('sections', codeCommune).then(function(featureCollections){
        var features = featureCollections.features;
        var hasMultiplePrefixes = features.some(function(f){
            return f.properties.commune !== codeCommune || f.properties.prefixe !== '000'
        });
        features.forEach(function (f) {
            if (!hasMultiplePrefixes) {
                f.properties.label = f.properties.code
                return
            }

            var labelPrefix = f.properties.commune === codeCommune ? f.properties.prefixe : f.properties.commune.substr(2)
            f.properties.label = `${labelPrefix} ${f.properties.code}`
        });
        return {type: 'FeatureCollection', features: sortByLabel(features)}
    })
}

function getParcelles(codeCommune, idSection){
    return getCadastreLayerFromStMarcel('parcelles', codeCommune).then(function(featureCollection){
        return {
            type: 'FeatureCollection',
            features: _.chain(featureCollection.features)
                // .filter(function(f){
                //     return f.id.startsWith(idSection)
                // })
                .sortBy('id')
                .value()
        }
    })
}

function getHydrographie(){
    return getRemoteGeoJson('https://public.opendatasoft.com/api/records/1.0/search/?' +
                                    'dataset=hydrographie-cours-deau&q=' +
                                    '&clusterprecision=17' +
                                    '&rows=200' +
                                    '&facet=artif&facet=fictif&facet=franchisst&facet=nom&facet=pos_sol&facet=regime&facet=commune&facet=epci_name&facet=dep_name&facet=reg_name' +
        '&geofilter.polygon=(45.477,6.551),(45.477,6.609),(45.505, 6.609),(45.505,6.551),(45.477,6.551)'
    )
        .then(function(returnFeatures){
            var acc = returnFeatures.records.reduce(function (acc, feature) {
                    acc.push(
                        {
                            type:"Feature",
                            id: feature.fields.id,
                            geometry: feature.fields.geo_shape,
                            properties:{
                                pos_sol: feature.fields.pos_sol,
                                franchisst:feature.fields.franchisst,
                                fictif:feature.fields.fictif,
                                regime:feature.fields.regime,
                                nom:feature.fields.nom
                            }
                        }
                    )
                    return acc
                }, []);
            return {
                type: 'FeatureCollection',
                features: _.chain(acc)
                    // .filter(function(f){
                    //     return f.id.startsWith(idSection)
                    // })
                    .value()
            }
    })
}

function getBati3D(){
    return getLocalGeoJson('assets/data/bati_montfort.geojson')
}

function sortByLabel(features) {
    return _.sortBy(features, function (f) { return f.properties.label })
}