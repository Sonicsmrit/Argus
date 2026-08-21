import React, { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import { useNavigate } from 'react-router-dom';
import { useInvestigator } from '../context/InvestigatorContext';

export default function GlobeWidget({ onSelectCountry }) {
  const mountRef = useRef(null);
  const globeRef = useRef(null);
  const navigate = useNavigate();
  const { profile } = useInvestigator();

  const [stats, setStats] = useState({});
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch country statistics
  useEffect(() => {
    fetch('/api/countries/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data?.stats) {
          setStats(data.stats);
        }
      })
      .catch((err) => console.error('Country stats error:', err));
  }, []);

  // 2. Initialize Globe in isolated mount container
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    let isMounted = true;
    let myGlobe = null;

    fetch('/countries.geojson')
      .then((res) => res.json())
      .then((countriesGeo) => {
        if (!isMounted || !mountRef.current) return;

        const width = mountEl.clientWidth || 700;
        const height = mountEl.clientHeight || 420;

        myGlobe = Globe()(mountEl)
          .width(width)
          .height(height)
          .backgroundColor('rgba(9, 13, 26, 1)')
          .showAtmosphere(true)
          .atmosphereColor('#2170e4')
          .atmosphereAltitude(0.25)
          .polygonsData(countriesGeo.features)
          .polygonAltitude((d) => {
            const code = (d.properties.ISO_A2 || d.properties.POSTAL || '').toLowerCase();
            if (code === 'ru') return 0.08;
            if (code === 'mx' || code === 'ir') return 0.06;
            return 0.015;
          })
          .polygonCapColor((d) => {
            const code = (d.properties.ISO_A2 || d.properties.POSTAL || '').toLowerCase();
            if (code === profile.homeCountry.toLowerCase()) {
              return 'rgba(33, 112, 228, 0.85)'; // Origin Home: Royal Blue
            }
            if (code === 'ru' || code === 'ir' || code === 'sy' || code === 'kp') {
              return 'rgba(186, 26, 26, 0.85)'; // Critical: Crimson Red
            }
            if (code === 'mx' || code === 'ae' || code === 'tr') {
              return 'rgba(254, 166, 25, 0.85)'; // Corroborated Adverse Media: Amber
            }
            if (code === 'cn' || code === 'by' || code === 've' || code === 'mm') {
              return 'rgba(96, 99, 238, 0.75)'; // Elevated / Sectoral: Violet
            }
            return 'rgba(26, 38, 66, 0.65)'; // Standard
          })
          .polygonSideColor(() => 'rgba(0, 0, 0, 0.35)')
          .polygonStrokeColor(() => '#3b82f6')
          .polygonLabel((d) => {
            const name = d.properties.NAME || d.properties.ADMIN;
            const code = (d.properties.ISO_A2 || d.properties.POSTAL || '').toUpperCase();
            return `
              <div style="background: rgba(19, 27, 46, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(114, 119, 133, 0.3); border-radius: 12px; padding: 10px 14px; font-family: 'Inter', sans-serif; color: #fff; font-size: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <div style="font-weight: 700; font-size: 14px; color: #adc6ff; margin-bottom: 4px;">${name} (${code})</div>
                <div style="color: #e2e7ff; font-family: monospace; font-size: 11px;">Dual-Layer Screened Jurisdiction</div>
                <div style="margin-top: 6px; font-size: 10px; color: #c2c6d6; text-transform: uppercase; font-family: monospace;">Click country to screen targets</div>
              </div>
            `;
          })
          .onPolygonHover((d) => {
            if (d && isMounted) {
              const code = (d.properties.ISO_A2 || d.properties.POSTAL || '').toLowerCase();
              setHoveredCountry({
                name: d.properties.NAME || d.properties.ADMIN,
                code: code.toUpperCase(),
              });
            } else if (isMounted) {
              setHoveredCountry(null);
            }
          })
          .onPolygonClick((d) => {
            const code = (d.properties.ISO_A2 || d.properties.POSTAL || '').toLowerCase();
            if (onSelectCountry) {
              onSelectCountry(code);
            } else {
              navigate(`/entity-intelligence?country=${code}`);
            }
          });

        // Corridors / Arcs
        const arcsData = [
          { startLat: 37.09, startLng: -95.71, endLat: 61.52, endLng: 105.31, color: ['#ba1a1a', '#fea619'] }, // US -> RU
          { startLat: 23.42, startLng: 53.84, endLat: 61.52, endLng: 105.31, color: ['#fea619', '#ba1a1a'] }, // UAE -> RU
          { startLat: 23.63, startLng: -102.55, endLat: 37.09, endLng: -95.71, color: ['#fea619', '#2170e4'] }, // MX -> US
          { startLat: 35.86, startLng: 104.19, endLat: 32.42, endLng: 53.68, color: ['#2170e4', '#ba1a1a'] }, // CN -> IR
          { startLat: 51.16, startLng: 10.45, endLat: 61.52, endLng: 105.31, color: ['#6063ee', '#ba1a1a'] }, // EU -> RU
        ];

        myGlobe
          .arcsData(arcsData)
          .arcColor('color')
          .arcDashLength(0.4)
          .arcDashGap(0.2)
          .arcDashAnimateTime(2000)
          .arcAltitude(0.25)
          .arcStroke(1.2);

        myGlobe.controls().autoRotate = true;
        myGlobe.controls().autoRotateSpeed = 0.6;
        myGlobe.controls().enableZoom = true;

        myGlobe.pointOfView({ lat: 25, lng: 20, altitude: 2.2 }, 1000);

        globeRef.current = myGlobe;
        if (isMounted) setLoading(false);

        const handleResize = () => {
          if (!mountRef.current || !myGlobe) return;
          myGlobe.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);
      })
      .catch((err) => {
        console.error('Failed to load globe GeoJSON:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (mountEl) {
        // Cleanly remove any canvas/DOM children appended by globe.gl
        while (mountEl.firstChild) {
          mountEl.removeChild(mountEl.firstChild);
        }
      }
    };
  }, [profile.homeCountry]);

  return (
    <div className="w-full h-full relative bg-[#090d1a] overflow-hidden rounded-2xl">
      {/* 
        ISOLATED MOUNT ELEMENT: 
        React will NEVER put any child JSX inside this div. 
        Only globe.gl will mount here, completely preventing React removeChild DOM conflicts.
      */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Sibling Overlay UI (managed purely by React) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090d1a] z-20 gap-3 text-on-surface">
            <span className="material-symbols-outlined text-[36px] animate-spin text-primary">progress_activity</span>
            <span className="font-mono text-xs text-outline font-semibold uppercase tracking-wider">
              Rendering 3D Global Polygons &amp; Corridors...
            </span>
          </div>
        )}

        {/* Top Header Pill */}
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest/85 backdrop-blur-md border border-outline-variant/30 text-[12px] text-on-surface shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono font-bold">GLOBAL MONITOR 3D</span>
            <span className="text-[11px] font-mono text-outline">&bull; 177 NATIONS</span>
          </div>

          {hoveredCountry && (
            <div className="mt-2 p-3.5 bg-inverse-surface/95 backdrop-blur-md rounded-2xl text-inverse-on-surface border border-outline/30 shadow-xl text-xs animate-[fade-in_0.2s_ease-out]">
              <div className="font-bold text-sm text-primary-fixed">{hoveredCountry.name} ({hoveredCountry.code})</div>
              <div className="text-[10px] text-outline-variant mt-1 font-mono">Click country to screen targets</div>
            </div>
          )}
        </div>

        {/* Interactive Corridor Buttons (pointer-events-auto) */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => navigate(`/threat-briefing?from=${profile.homeCountry}&to=RU`)}
            className="px-3.5 py-2 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 hover:bg-primary hover:text-white transition-all text-xs font-mono font-bold shadow-md text-on-surface"
          >
            {profile.homeCountry} &rarr; RU Corridor
          </button>
          <button
            onClick={() => navigate('/entity-intelligence?country=mx')}
            className="px-3.5 py-2 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 hover:bg-primary hover:text-white transition-all text-xs font-mono font-bold shadow-md text-on-surface"
          >
            Mexico (17 Hits)
          </button>
          <button
            onClick={() => navigate('/entity-intelligence?country=cn')}
            className="px-3.5 py-2 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 hover:bg-primary hover:text-white transition-all text-xs font-mono font-bold shadow-md text-on-surface"
          >
            China
          </button>
        </div>
      </div>
    </div>
  );
}