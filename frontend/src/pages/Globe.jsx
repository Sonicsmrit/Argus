import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeGL from 'globe.gl';
import Navbar from '../components/Navbar';
import { COUNTRY_NAMES } from '../data/bilateralRules';
import { 
  ShieldAlert, ArrowRight, RotateCcw, Search, Sparkles, 
  MapPin, CheckCircle2, AlertTriangle, Layers, Navigation 
} from 'lucide-react';

export default function Globe() {
  const navigate = useNavigate();
  const globeContainerRef = useRef(null);
  const globeInstanceRef = useRef(null);

  const [fromCountry, setFromCountry] = useState('US');
  const [toCountry, setToCountry] = useState('RU');
  const [hoverCountry, setHoverCountry] = useState(null);
  
  const [countryStats, setCountryStats] = useState({});
  const [countriesGeoJson, setCountriesGeoJson] = useState(null);
  const [step, setStep] = useState(2); // 1: pick origin, 2: pick destination, ready

  // Fetch Country Stats from backend
  useEffect(() => {
    fetch('/api/countries/stats')
      .then(res => res.json())
      .then(data => {
        setCountryStats(data.stats || {});
      })
      .catch(err => console.error('Failed to load stats:', err));

    // Fetch GeoJSON
    fetch('/countries.geojson')
      .then(res => res.json())
      .then(geo => {
        setCountriesGeoJson(geo);
      })
      .catch(err => console.error('Failed to load geojson:', err));
  }, []);

  // Initialize Globe
  useEffect(() => {
    if (!globeContainerRef.current || !countriesGeoJson) return;

    const width = globeContainerRef.current.clientWidth;
    const height = globeContainerRef.current.clientHeight;

    const globe = GlobeGL()(globeContainerRef.current)
      .width(width)
      .height(height)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .polygonAltitude(0.01)
      .polygonCapColor(feat => {
        const iso = (feat.properties.ISO_A2 || feat.properties.ISO_A2_EH || feat.properties.postal || '').toUpperCase();
        if (iso === fromCountry) return 'rgba(56, 189, 248, 0.7)'; // Bright Blue for Origin
        if (iso === toCountry) return 'rgba(239, 68, 68, 0.75)';   // Bright Red for Destination
        if (iso === hoverCountry) return 'rgba(255, 255, 255, 0.3)';
        return 'rgba(22, 30, 49, 0.5)';
      })
      .polygonSideColor(() => 'rgba(35, 46, 71, 0.4)')
      .polygonStrokeColor(() => 'rgba(56, 189, 248, 0.3)')
      .polygonLabel(({ properties: d }) => {
        const iso = (d.ISO_A2 || d.ISO_A2_EH || d.postal || '').toUpperCase();
        const name = d.NAME || COUNTRY_NAMES[iso] || iso;
        const stat = countryStats[iso.toLowerCase()];
        const count = stat ? stat.entityCount : 0;
        const hits = stat ? stat.mediaHitEntities : 0;
        return `
          <div style="background: rgba(17, 23, 38, 0.95); border: 1px solid #364668; padding: 10px 14px; border-radius: 8px; font-family: sans-serif; font-size: 12px; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #38bdf8;">${name} (${iso})</div>
            <div style="color: #94a3b8;">Sanctioned Targets: <strong style="color: #fff;">${count.toLocaleString()}</strong></div>
            <div style="color: #f87171;">Adverse Press Hits: <strong style="color: #f87171;">${hits.toLocaleString()}</strong></div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Click to select as ${step === 1 ? 'Origin (Country A)' : 'Destination (Country B)'}</div>
          </div>
        `;
      })
      .onPolygonHover(hover => {
        const iso = hover ? (hover.properties.ISO_A2 || hover.properties.ISO_A2_EH || hover.properties.postal || '').toUpperCase() : null;
        setHoverCountry(iso);
      })
      .onPolygonClick(feat => {
        const iso = (feat.properties.ISO_A2 || feat.properties.ISO_A2_EH || feat.properties.postal || '').toUpperCase();
        if (!iso || iso === '-99') return;

        if (step === 1) {
          setFromCountry(iso);
          setStep(2);
        } else {
          setToCountry(iso);
        }
      });

    // Add bilateral arc between fromCountry and toCountry
    globe.polygonsData(countriesGeoJson.features);
    globeInstanceRef.current = globe;

    // Adjust camera view
    globe.pointOfView({ lat: 25, lng: 30, altitude: 2.2 });

    const handleResize = () => {
      if (globeContainerRef.current && globe) {
        globe.width(globeContainerRef.current.clientWidth);
        globe.height(globeContainerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [countriesGeoJson]);

  // Update polygon colors and arcs on selection change
  useEffect(() => {
    if (!globeInstanceRef.current || !countriesGeoJson) return;

    // Update polygons styling
    globeInstanceRef.current.polygonCapColor(feat => {
      const iso = (feat.properties.ISO_A2 || feat.properties.ISO_A2_EH || feat.properties.postal || '').toUpperCase();
      if (iso === fromCountry) return 'rgba(56, 189, 248, 0.8)';
      if (iso === toCountry) return 'rgba(239, 68, 68, 0.85)';
      if (iso === hoverCountry) return 'rgba(255, 255, 255, 0.3)';
      return 'rgba(22, 30, 49, 0.5)';
    });

    // Create bilateral arc if both countries exist in geojson
    if (fromCountry && toCountry && fromCountry !== toCountry) {
      const fromFeat = countriesGeoJson.features.find(f => (f.properties.ISO_A2 || f.properties.ISO_A2_EH || f.properties.postal || '').toUpperCase() === fromCountry);
      const toFeat = countriesGeoJson.features.find(f => (f.properties.ISO_A2 || f.properties.ISO_A2_EH || f.properties.postal || '').toUpperCase() === toCountry);

      if (fromFeat && toFeat) {
        const getCentroid = (feat) => {
          const coords = feat.geometry.coordinates;
          if (feat.geometry.type === 'Polygon') {
            return coords[0][0]; // approximate
          } else if (feat.geometry.type === 'MultiPolygon') {
            return coords[0][0][0];
          }
          return [0, 0];
        };

        const fromCoord = getCentroid(fromFeat);
        const toCoord = getCentroid(toFeat);

        globeInstanceRef.current.arcsData([{
          startLat: fromCoord[1],
          startLng: fromCoord[0],
          endLat: toCoord[1],
          endLng: toCoord[0],
          color: ['#38bdf8', '#ef4444']
        }])
        .arcColor('color')
        .arcAltitude(0.3)
        .arcStroke(1.5)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(2000);
      }
    } else {
      globeInstanceRef.current.arcsData([]);
    }
  }, [fromCountry, toCountry, hoverCountry, countriesGeoJson]);

  const handleLaunchRiskEngine = () => {
    if (!fromCountry || !toCountry) return;
    navigate(`/risk/${fromCountry}/${toCountry}`);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <Navbar />

      {/* Main interactive area with globe and floating HUD */}
      <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%' }}>
        {/* 3D Globe Container */}
        <div ref={globeContainerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

        {/* Floating Top Product Pitch Header */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '820px',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          <div className="glass-panel" style={{ padding: '16px 24px', textAlign: 'center', pointerEvents: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>
                <Sparkles size={11} /> Denied-Party & Counterparty Screening
              </span>
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em', marginBottom: '4px' }}>
              Screen your shipments and trade partners against global sanctions lists.
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Catch counterparties heading toward sanctions before it costs you a shipment. Select origin and target countries on the 3D globe or via the control deck below.
            </p>
          </div>
        </div>

        {/* Floating Control Deck / Country Selector Panel */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '920px',
          zIndex: 10
        }}>
          <div className="glass-panel" style={{ padding: '20px 28px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)', border: '1px solid var(--border-bright)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              
              {/* Origin Country Picker (Country A) */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-blue)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  1. Origin Country (Your Jurisdiction)
                </label>
                <select
                  value={fromCountry}
                  onChange={e => setFromCountry(e.target.value)}
                  className="select"
                  style={{ width: '100%', fontWeight: '600' }}
                >
                  {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Trade Route Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', marginTop: '16px' }}>
                <ArrowRight size={24} color="var(--accent-cyan)" />
              </div>

              {/* Destination Country Picker (Country B) */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--risk-critical)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  2. Trade Partner (Destination)
                </label>
                <select
                  value={toCountry}
                  onChange={e => setToCountry(e.target.value)}
                  className="select"
                  style={{ width: '100%', fontWeight: '600' }}
                >
                  {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary Action Button */}
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={handleLaunchRiskEngine}
                  className="btn btn-primary"
                  style={{ padding: '12px 28px', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                  <ShieldAlert size={16} />
                  Check Compliance Risk
                </button>
              </div>
            </div>

            {/* Quick Helper Subtext */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                <span>Origin: <strong>{COUNTRY_NAMES[fromCountry] || fromCountry}</strong></span>
                <span style={{ margin: '0 4px' }}>•</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--risk-critical)' }} />
                <span>Destination: <strong>{COUNTRY_NAMES[toCountry] || toCountry}</strong></span>
              </div>
              <div>
                Click countries directly on 3D globe to switch route
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
