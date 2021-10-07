import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import '../styles/Map.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const Map = () => {
  const mapContainerRef = useRef(null);

  const [lng, setLng] = useState(6.568);
  const [lat, setLat] = useState(45.489);
  const [zoom, setZoom] = useState(15.3);
  const [pitch, setPitch] = useState(60); // centrage
  const [bearing, setBearing] = useState(150); // rotation

  // Initialize map when component mounts
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      // style: 'mapbox://styles/mapbox/streets-v11',
      style:  'https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json', //Fond de carte
      center: [lng, lat],
      zoom: zoom,
      pitch: pitch,
      bearing: bearing
    });

    map.on('load', function(){
      map.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
      });
      // add the DEM source as a terrain layer with exaggerated height
      map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

      // add a sky layer that will show when the map is highly pitched
      map.addLayer({
          'id': 'sky',
          'type': 'sky',
          'paint': {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15
          }
      });
    });

    // Add navigation control (the +/- zoom buttons)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('move', () => {
      setLng(map.getCenter().lng.toFixed(4));
      setLat(map.getCenter().lat.toFixed(4));
      setZoom(map.getZoom().toFixed(2));
      setPitch(map.getPitch().toFixed(2));
      setBearing(map.getBearing().toFixed(2));
    });

    // Clean up on unmount
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
      <div className='map-container' ref={mapContainerRef} />
  );
};

export default Map;