import React, { useEffect, useRef } from 'react';

export default function MerchantMap({
  userLat = 18.5204,
  userLng = 73.8567,
  merchants = [],
  onSelectMerchant,
  isPinDropMode = false,
  onPinDropped
}) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject Leaflet JS script dynamically
    const loadLeaflet = () => {
      if (window.L) {
        initMap();
        return;
      }

      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => initMap();
        document.body.appendChild(script);
      }
    };

    const initMap = () => {
      if (!mapRef.current || leafletInstance.current) return;

      const L = window.L;
      const map = L.map(mapRef.current).setView([userLat, userLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      leafletInstance.current = map;

      // Customer Location Marker (Blue Pulsing Icon)
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div style="background: #4f46e5; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 12px rgba(79, 70, 229, 0.8);"></div>`,
        iconSize: [24, 24]
      });

      L.marker([userLat, userLng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>📍 Your Current Location</b>');

      if (isPinDropMode) {
        let pinMarker = L.marker([userLat, userLng], { draggable: true }).addTo(map);
        pinMarker.bindPopup('Drag pin to set exact shop location').openPopup();

        pinMarker.on('dragend', (e) => {
          const coord = e.target.getLatLng();
          if (onPinDropped) {
            onPinDropped(coord.lat, coord.lng);
          }
        });

        map.on('click', (e) => {
          pinMarker.setLatLng(e.latlng);
          if (onPinDropped) {
            onPinDropped(e.latlng.lat, e.latlng.lng);
          }
        });
      } else {
        // Render Merchant Markers
        renderMerchantMarkers(L, map);
      }
    };

    const renderMerchantMarkers = (L, map) => {
      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      merchants.forEach(m => {
        const lat = m.latitude || 18.5204;
        const lng = m.longitude || 73.8567;

        const shopIcon = L.divIcon({
          className: 'custom-shop-marker',
          html: `<div style="background: #10b981; color: white; padding: 4px 8px; border-radius: 12px; font-weight: 800; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px;">🏪 ${m.name}</div>`,
          iconSize: [100, 30]
        });

        const marker = L.marker([lat, lng], { icon: shopIcon }).addTo(map);

        const popupContent = `
          <div style="font-family: system-ui; max-width: 200px;">
            <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 14px;">${m.name}</h4>
            <p style="margin: 0 0 6px 0; color: #64748b; font-size: 11px;">${m.category} • ${m.distance_km || 0.8} km away</p>
            <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; margin-bottom: 8px;">10% Reward Eligible</span>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (onSelectMerchant) onSelectMerchant(m);
        });

        markersRef.current.push(marker);
      });
    };

    loadLeaflet();
  }, [userLat, userLng, merchants, isPinDropMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '380px' }} />
    </div>
  );
}
