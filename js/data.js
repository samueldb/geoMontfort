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

function sortByLabel(features) {
    return _.sortBy(features, function (f) { return f.properties.label })
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
                .filter(function(f){
                    return f.id.startsWith(idSection)
                })
                .sortBy('id')
                .value()
        }
    })
}
