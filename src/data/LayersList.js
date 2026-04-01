export const adminLayers = [
    {name: 'admin_sections', displayable_name : 'Sections cadastrales', categorie: 'admin'},
    {name: 'admin_dvf', displayable_name : 'Valeurs foncières', categorie: 'admin'},
]

export const landscapesLayers = [
    {name: 'hydro', displayable_name: 'Hydrologie', categorie: 'landscapes'},
    {name: 'forest', displayable_name: 'Carte forestière', categorie: 'landscapes'},
    {name: 'mnt', displayable_name: 'Modèle de Terrain (MNT)', categorie: 'landscapes'},
    {name: 'lidar', displayable_name: 'LIDAR (COPC)', categorie: 'landscapes'},
    {name: 'bati_3d', displayable_name: 'Batiments 3D', categorie: 'landscapes'},
    {name: 'carte_moderne', displayable_name: 'Carte moderne', categorie: 'landscapes'}
]

export const historicalLayers = [
    {name: 'sarde', displayable_name: 'Mappe Sarde', categorie: 'historical'},
    {name: 'napo', displayable_name: 'cadastre Napoléonien', categorie: 'historical'},
    {name: 'aerial_1952', displayable_name: 'Photos aériennes 1952', categorie: 'historical'},
    {name: 'aerial', displayable_name: 'Photos aériennes', categorie: 'historical'},
]

export const allLayers = adminLayers.concat(historicalLayers, landscapesLayers)

