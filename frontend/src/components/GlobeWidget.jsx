import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getShortName } from '../data/bilateralRules';
import { useInvestigator } from '../context/InvestigatorContext';

// Approximate capitals/centroids for corridor endpoints (ISO2 -> [lat, lng])
const COUNTRY_COORDS = {
  us: [37.09, -95.71], ca: [56.13, -106.35], mx: [23.63, -102.55], br: [-14.24, -51.93],
  gb: [54.0, -2.0], de: [51.17, 10.45], fr: [46.6, 2.35], it: [41.87, 12.57], es: [40.46, -3.75],
  nl: [52.13, 5.29], se: [60.13, 18.64], pl: [52.23, 21.01], ch: [46.82, 8.23],
  jp: [36.2, 138.25], kr: [35.91, 127.77], au: [-25.27, 133.78], sg: [1.35, 103.82],
  in: [20.59, 78.96], ae: [23.42, 53.84], tr: [38.96, 35.24], za: [-30.56, 22.94],
  ru: [61.52, 105.31], cn: [35.86, 104.19], ir: [32.42, 53.68], kp: [40.34, 127.51],
  sy: [34.8, 39.0], by: [53.71, 27.95], cu: [21.52, -77.78], ve: [6.42, -66.59],
  mm: [21.92, 95.96], af: [33.94, 67.71], sd: [12.86, 30.22], ni: [12.87, -85.21],
};

// Diplomatic-risk tiering used to pick corridor destinations for the globe.
// Adversarial: highest-sanctions-pressure jurisdictions first.
// Allied: low-risk cooperative partners first.
const ADVERSARIAL_PRIORITY = ['ru', 'kp', 'ir', 'sy', 'by', 'cu', 've', 'mm', 'af'];
const ALLIED_PRIORITY = ['gb', 'de', 'fr', 'jp', 'ca', 'au', 'kr', 'nl', 'it', 'es', 'sg', 'se'];

export default function GlobeWidget({ onSelectCountry }) {
  const mountRef = useRef(null);
  const globeRef = useRef(null);
  const navigate = useNavigate();
  const { profile } = useInvestigator();

  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  // Corridor destinations for the investigator's home jurisdiction:
  // red = top adversarial/sanctioned partners, blue = allied low-risk partners
  const homeCode = profile.homeCountry.toLowerCase();
  const homeCoords = COUNTRY_COORDS[homeCode];
  const redTargets = ADVERSARIAL_PRIORITY.filter((c) => c !== homeCode && COUNTRY_COORDS[c]).slice(0, 2);
  const bluePartners = ALLIED_PRIORITY.filter((c) => c !== homeCode && COUNTRY_COORDS[c]).slice(0, 2);
  const corridorsVisible = Boolean(homeCoords);

  // Cached GeoJSON: never refetches, so remounting this widget after a tab switch is instant
  const { data: countriesGeo } = useQuery({
    queryKey: ['countries-geojson'],
    queryFn: () => fetch('/countries.geojson').then((res) => res.json()),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: countryStats } = useQuery({
    queryKey: ['countries-stats'],
    queryFn: () => fetch('/api/countries/stats').then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });

  // Hotspot jurisdictions ranked live by corroborated adverse-media volume;
  // drives the corridor shortcut buttons (home country excluded).
  const homeUpper = profile.homeCountry.toUpperCase();
  const hotspots = useMemo(() => {
    const s = countryStats?.stats;
    if (!s) return null;
    return Object.entries(s)
      .map(([code, v]) => ({
        code: code.toUpperCase(),
        name: getShortName(code),
        hits: v.mediaHitCount,
        entities: v.entityCount,
      }))
      .filter((c) => c.code !== homeUpper && c.hits > 0)
      .sort((a, b) => b.hits - a.hits || b.entities - a.entities);
  }, [countryStats, homeUpper]);

  // Fallbacks preserve the previous layout while stats load on first paint
  const corridorTarget = hotspots?.[0] || { code: 'RU', name: 'Russia', hits: 176 };
  const screenTargets = hotspots
    ? hotspots.slice(1, 3)
    : [
        { code: 'MX', name: 'Mexico', hits: 63 },
        { code: 'CN', name: 'China', hits: 63 },
      ];

  // Initialize Globe in isolated mount container once GeoJSON is available
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl || !countriesGeo) return;

    let isMounted = true;
    let myGlobe = null;
    let resizeHandler = null;

    // Defer the expensive polygon-mesh build one beat past first paint so
    // page load and route transitions don't stutter.
    const initTimer = setTimeout(() => {
    if (!isMounted) return;

    const width = mountEl.clientWidth || 700;
    const height = mountEl.clientHeight || 420;

    myGlobe = Globe()(mountEl)
      .width(width)
      .height(height)
      .backgroundColor('rgba(9, 13, 26, 1)')
      .showAtmosphere(true)
      .atmosphereColor('#2170e4')
      .atmosphereAltitude(0.15)
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

    // Cap render resolution � full-retina DPR triples GPU cost with no
    // visible benefit at this viewport size.
    if (myGlobe.renderer && myGlobe.renderer()) {
      myGlobe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    }

    // Corridors from the investigator's home jurisdiction
    const arcsData = homeCoords
      ? [
          ...redTargets.map((code) => ({
            startLat: homeCoords[0],
            startLng: homeCoords[1],
            endLat: COUNTRY_COORDS[code][0],
            endLng: COUNTRY_COORDS[code][1],
            color: ['#ba1a1a', '#ba1a1a'],
          })),
          ...bluePartners.map((code) => ({
            startLat: homeCoords[0],
            startLng: homeCoords[1],
            endLat: COUNTRY_COORDS[code][0],
            endLng: COUNTRY_COORDS[code][1],
            color: ['#2170e4', '#2170e4'],
          })),
        ]
      : [];

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
    resizeHandler = handleResize;
    window.addEventListener('resize', resizeHandler);
    }, 60);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (mountEl) {
        // Cleanly remove any canvas/DOM children appended by globe.gl
        while (mountEl.firstChild) {
          mountEl.removeChild(mountEl.firstChild);
        }
      }
    };
  }, [countriesGeo, profile.homeCountry]);

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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 border border-outline-variant/30 text-[12px] text-on-surface shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono font-bold">GLOBAL MONITOR 3D</span>
            <span className="text-[11px] font-mono text-outline">&bull; 177 NATIONS</span>
          </div>

          {/* Corridor legend */}
          {corridorsVisible && (
            <div className="mt-1 px-3 py-2 rounded-2xl bg-surface-container-lowest/95 border border-outline-variant/30 shadow-sm flex flex-col gap-1 w-max">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-on-surface">
                <span className="w-4 h-0.5 bg-error rounded-full"></span>
                HIGH-RISK SANCTIONED CORRIDOR
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-on-surface">
                <span className="w-4 h-0.5 bg-primary rounded-full"></span>
                ALLIED LOW-RISK CORRIDOR
              </div>
            </div>
          )}

          {hoveredCountry && (
            <div className="mt-2 p-3.5 bg-inverse-surface rounded-2xl text-inverse-on-surface border border-outline/30 shadow-xl text-xs animate-[fade-in_0.2s_ease-out]">
              <div className="font-bold text-sm text-primary-fixed">{hoveredCountry.name} ({hoveredCountry.code})</div>
              <div className="text-[10px] text-outline-variant mt-1 font-mono">Click country to screen targets</div>
            </div>
          )}
        </div>

        {/* Interactive Corridor Buttons (pointer-events-auto) � targets from live media-hit ranking */}
        <div className="absolute bottom-4 right-4 left-4 flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
          <button
            onClick={() => navigate(`/threat-briefing?from=${profile.homeCountry}&to=${corridorTarget.code}`)}
            className="px-3.5 py-2 rounded-xl bg-surface-container-lowest/95 border border-outline-variant/30 hover:bg-primary hover:text-white transition-all text-xs font-mono font-bold shadow-md text-on-surface"
          >
            {profile.homeCountry} &rarr; {corridorTarget.code} Corridor
          </button>
          {screenTargets.map((t) => (
            <button
              key={t.code}
              onClick={() => navigate(`/entity-intelligence?country=${t.code.toLowerCase()}`)}
              className="px-3.5 py-2 rounded-xl bg-surface-container-lowest/95 border border-outline-variant/30 hover:bg-primary hover:text-white transition-all text-xs font-mono font-bold shadow-md text-on-surface"
            >
              {t.name} ({t.hits} Hits)
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
