export const adminLayers = [
    {name: 'admin_sections', displayable_name : 'Sections cadastrales', categorie: 'admin'},
    {name: 'admin_parcelles', displayable_name : 'Parcelles cadastrales', categorie: 'admin'},
]

export const landscapesLayers = [
    {name: 'hydro', displayable_name: 'Hydrologie', categorie: 'landscapes'},
    {name: 'bati_3d', displayable_name: 'Batiments 3D', categorie: 'landscapes'},
    {name: 'carte_moderne', displayable_name: 'Carte moderne', categorie: 'landscapes'}
]

export const allLayers = adminLayers.concat(landscapesLayers)

