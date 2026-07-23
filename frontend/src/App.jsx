import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Thermometer,
  AlertTriangle,
  MessageSquare,
  History,
  Cpu,
  Settings as SettingsIcon,
  Upload,
  CheckCircle2,
  ChevronRight,
  Activity,
  Battery,
  Wifi,
  ShieldAlert,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  fetchDevices,
  fetchLatestTelemetry,
  fetchTelemetryHistory,
  fetchHistoryLogs,
  fetchAlerts,
  uploadAndDiagnose
} from './api';

// ============================================================================
// 1. HELPER COMPONENTS
// ============================================================================

// Premium Custom SVG Line Chart to visualize real-time sensor history
const TelemetryChart = ({ data, dataKey, color, unit }) => {
  if (!data || data.length === 0) return <div className="text-muted text-sm text-center py-8">No historical data</div>;
  
  const width = 500;
  const height = 150;
  const padding = 20;
  
  const values = data.map(d => d[dataKey]);
  const minVal = Math.min(...values) - 2;
  const maxVal = Math.max(...values) + 2;
  const valRange = maxVal - minVal || 1;

  const points = data.map((d, index) => {
    const x = padding + (index * (width - 2 * padding)) / (data.length - 1);
    const y = height - padding - ((d[dataKey] - minVal) * (height - 2 * padding)) / valRange;
    return { x, y, value: d[dataKey], label: d.timestamp };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  // Area under line path for gradient fill
  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` 
    : "";

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Horizontal gridlines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = padding + ratio * (height - 2 * padding);
          const val = Math.round((maxVal - ratio * valRange) * 10) / 10;
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
              <text x={0} y={y + 4} fill="#9ca3af" fontSize="9" fontWeight="bold">{val}{unit}</text>
            </g>
          );
        })}

        {/* Gradient fill */}
        <path d={areaD} fill={`url(#grad-${dataKey})`} />

        {/* Core Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

        {/* Data points markers */}
        {points.map((p, idx) => (
          <g key={idx} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="4" fill="#0b0f19" stroke={color} strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="8" fill={color} opacity="0" className="hover:opacity-20 transition-opacity" />
            
            {/* Timestamp text */}
            {idx % 2 === 0 && (
              <text x={p.x} y={height - 2} fill="#9ca3af" fontSize="9" textAnchor="middle">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

// Simple Gauge for plant risk scoring
const RiskGauge = ({ score }) => {
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = "var(--primary)"; // Cyber Lime
  if (score >= 80) color = "var(--danger)"; // Soft Red
  else if (score >= 55) color = "var(--warning)"; // Alert Amber
  else if (score >= 25) color = "var(--secondary)"; // Sage Blue

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
          <circle 
            cx="60" cy="60" r={radius} 
            fill="transparent" 
            stroke={color} 
            strokeWidth={strokeWidth} 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 800 }}>{score}</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>score</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. PAGES
// ============================================================================

// Overview Dashboard Page
// Overview Dashboard Page
const OverviewPage = ({ setActivePage, latestReport, telemetry, devices, alerts }) => {
  const onlineCount = devices.filter(d => d.status === "online").length;
  const [hoveredNode, setHoveredNode] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Map coordinates and metrics for the nodes
  const nodeInfo = {
    "ESP32-001": { x: "30%", y: "30%", name: "Paddy Bed Alpha (North Zone)", id: "ESP32-001", status: "ONLINE", battery: "92%", temp: "28.5°C", hum: "82.1%", moist: "40.2%" },
    "ESP32-002": { x: "70%", y: "45%", name: "Paddy Bed Beta (Dry Zone)", id: "ESP32-002", status: "ONLINE", battery: "78%", temp: "35.0°C", hum: "40.0%", moist: "25.0%" },
    "ESP32-003": { x: "45%", y: "75%", name: "Paddy Bed Gamma (West Zone)", id: "ESP32-003", status: "OFFLINE", battery: "12%", temp: "24.5°C", hum: "55.0%", moist: "50.0%" }
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Academic Project Header Banner */}
      <div className="academic-banner">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <span className="academic-badge">Academic Project Ingress</span>
          <h2 style={{ fontSize: 24, color: '#fff', margin: '4px 0 0 0', fontWeight: 800 }}>PlantShield AI: Command Center</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, marginTop: 4 }}>
            An advanced IoT and AI-driven leaf disease classification and agronomy advisory gateway.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Developer</p>
          <p style={{ fontSize: 16, color: '#fff', fontWeight: 700 }}>Siddhartha Toodi</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sathyabama Institute of Science and Technology</p>
        </div>
      </div>

      {/* Control command row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: 12 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block' }}>Operational Command</span>
          <h2 style={{ fontSize: 28, color: '#fff', margin: '2px 0 0 0', fontWeight: 700 }}>Telemetry Ingress Engine</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setActivePage('diagnose')}>
          <ImageIcon className="nav-icon" /> Run AI Diagnosis
        </button>
      </div>

      {/* High-Fidelity 12-Column Grid system */}
      <div className="grid-cols-12">
        {/* Left Column (8/12) - Cinematic Stream / Leaf Diagnostic Image view */}
        <div className="col-span-8 glass-card" style={{ height: 430, padding: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div className="cyber-scanline" />
          
          {/* Diagnostic Feed Banner */}
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'var(--bg-base)', border: '1px solid rgba(210,240,0,0.3)', padding: '4px 8px', borderRadius: 2 }}>
              LIDAR & MULTISPECTRAL: STREAMING
            </span>
          </div>

          {/* Leaf Diagnostic Image or Visual placeholder */}
          <div style={{ flex: 1, overflow: 'hidden', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {latestReport ? (
              <img 
                src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800" 
                alt="Field analysis stream" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65, mixBlendMode: 'screen' }} 
              />
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.4 }}>
                <ImageIcon style={{ width: 64, height: 64, color: 'var(--primary)', marginBottom: 12 }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>CAMERA RELAY: FIELD FEED STANDBY</p>
              </div>
            )}
          </div>

          {/* Overlay Diagnostics summary box */}
          <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ maxWidth: '60%' }}>
              <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 6 }}>Real-time Terrain Synthesis</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {latestReport ? `Latest analysis on node ${latestReport.deviceId} flagged ${latestReport.disease.replace("_", " ")} symptoms.` : "Operational gateway monitoring live sensor parameters from multiple crop beds."}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="glass-card" style={{ padding: '8px 16px', minWidth: 100, textAlign: 'center', background: 'rgba(17,20,19,0.8)' }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Confidence</span>
                <span style={{ fontSize: 18, color: 'var(--primary)', fontWeight: 800 }}>{latestReport ? `${Math.round(latestReport.confidence * 100)}%` : "N/A"}</span>
              </div>
              <div className="glass-card" style={{ padding: '8px 16px', minWidth: 100, textAlign: 'center', background: 'rgba(17,20,19,0.8)', borderLeft: '2px solid var(--primary)' }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>CROP AGE</span>
                <span style={{ fontSize: 18, color: '#fff', fontWeight: 800 }}>{latestReport?.estimatedAge ? `${Math.round(latestReport.estimatedAge)} D` : "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4/12) - Environmental progress gauges and Dotted map */}
        <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Panel 1: Environmental levels progress trackers */}
          <div className="glass-card" style={{ flex: 1, padding: 20 }}>
            <h4 style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <Activity className="nav-icon" style={{ color: 'var(--primary)' }} /> Live Bed Microclimate
            </h4>
            
            <div className="progress-container">
              <div className="progress-bar-label">
                <span>Soil Moisture</span>
                <span>{telemetry ? `${telemetry.soilMoisture}%` : "55%"}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: telemetry ? `${telemetry.soilMoisture}%` : "55%" }} />
              </div>
            </div>

            <div className="progress-container">
              <div className="progress-bar-label">
                <span>Relative Humidity</span>
                <span>{telemetry ? `${telemetry.humidity}%` : "60%"}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: telemetry ? `${telemetry.humidity}%` : "60%" }} />
              </div>
            </div>

            <div className="progress-container" style={{ marginBottom: 0 }}>
              <div className="progress-bar-label">
                <span>Temperature</span>
                <span>{telemetry ? `${telemetry.temperature}°C` : "26.5°C"}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: telemetry ? `${(telemetry.temperature / 50) * 100}%` : "53%" }} />
              </div>
            </div>
          </div>

          {/* Panel 2: Field Gateway Interactive Map */}
          <div className="glass-card" style={{ flex: 1, padding: 20 }}>
            <h4 style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <Cpu className="nav-icon" style={{ color: 'var(--primary)' }} /> Field Gateway Mapping
            </h4>

            {/* Dotted farm map */}
            <div className="field-grid-map" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredNode(null)}>
              {/* Interactive Crosshairs */}
              <div className="map-crosshair-y" style={{ left: cursorPos.x }} />
              <div className="map-crosshair-x" style={{ top: cursorPos.y }} />

              {/* Node markers */}
              {Object.keys(nodeInfo).map((key) => {
                const node = nodeInfo[key];
                const isOnline = node.status === "ONLINE";
                return (
                  <div 
                    key={key} 
                    className={`map-node ${isOnline ? 'map-node-active status-pulse' : 'map-node-offline'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseEnter={() => setHoveredNode(node)}
                  />
                );
              })}

              {/* Hover popover details */}
              {hoveredNode ? (
                <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(17,20,19,0.95)', border: '1px solid rgba(210,240,0,0.3)', padding: 8, borderRadius: 4, zIndex: 20, minWidth: 150, pointerEvents: 'none' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--primary)', margin: 0 }}>{hoveredNode.id}</p>
                  <p style={{ fontSize: 10, fontWeight: 'bold', color: '#fff', margin: '2px 0 4px 0' }}>{hoveredNode.name}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 8, color: 'var(--text-muted)' }}>
                    <span>TEMP: {hoveredNode.temp}</span>
                    <span>HUM: {hoveredNode.hum}</span>
                    <span>MOIST: {hoveredNode.moist}</span>
                    <span>BAT: {hoveredNode.battery}</span>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  HOVER NODES FOR METRICS
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operational status tiles */}
      <div className="grid-cols-4">
        <div className="glass-card border-left-accent" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Activity className="nav-icon" style={{ color: 'var(--primary)' }} />
            <h5 style={{ fontSize: 12, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sensor Ingress</h5>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Local calibration offset: 0.002mm delta synched.</p>
        </div>

        <div className="glass-card border-left-muted" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Cpu className="nav-icon" style={{ color: 'var(--text-muted)' }} />
            <h5 style={{ fontSize: 12, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inference Core</h5>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>FastAPI Paddy Doctor ResNet-18 pipeline operational.</p>
        </div>

        <div className="glass-card border-left-muted" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <History className="nav-icon" style={{ color: 'var(--text-muted)' }} />
            <h5 style={{ fontSize: 12, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Ledger</h5>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Rolling JSON historical database cache online.</p>
        </div>

        <div className="glass-card border-left-muted" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <ShieldAlert className="nav-icon" style={{ color: 'var(--text-muted)' }} />
            <h5 style={{ fontSize: 12, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tunnel Security</h5>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>AWS IoT Core credential handshake active.</p>
        </div>
      </div>

      {/* Log history tabular layout */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, color: '#fff', margin: 0 }}>System Telemetry Logs</h3>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>LEDGER: ACTIVE</span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="log-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '12px 24px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamp</th>
                <th style={{ padding: '12px 24px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gateway Node</th>
                <th style={{ padding: '12px 24px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition Diagnosis</th>
                <th style={{ padding: '12px 24px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Rating</th>
                <th style={{ padding: '12px 24px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Handshake</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length > 0 ? (
                alerts.map((alert, idx) => {
                  const isDanger = alert.type === 'danger';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{alert.time}</td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{alert.deviceId}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span className={`badge ${isDanger ? 'badge-danger' : 'badge-warning'}`}>
                          {alert.message.replace("flagged ", "")}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ color: isDanger ? 'var(--danger)' : 'var(--warning)', fontWeight: 'bold' }}>
                          {isDanger ? 'HIGH RISK' : 'STRESS WARNING'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--primary)' }}>SUCCESS</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No system anomalies. Telemetry channels operating within thresholds.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Leaf Image Upload and Analysis Page
const DiagnosisPage = ({ latestReport, setLatestReport, setActivePage, devices }) => {
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || "");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUploadSubmit = async () => {
    if (!imageFile) return;
    setLoading(true);
    try {
      const result = await uploadAndDiagnose(imageFile, selectedDevice);
      setLatestReport(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Leaf Disease Diagnostics</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Upload high-resolution leaf photos to get classifications, confidence rankings, and crop age.
      </p>

      <div className="grid-cols-2">
        {/* Left Card: Upload panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label>Monitor Node Area Mapping</label>
            <select className="input-field" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
              ))}
            </select>
          </div>

          {!imagePreview ? (
            <label className="upload-zone">
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              <Upload className="upload-zone-icon" />
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Select Plant Image</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Supports JPEG, PNG up to 10MB</p>
            </label>
          ) : (
            <div>
              <div className="preview-img-container">
                <img src={imagePreview} className="preview-img" alt="Leaf preview" />
                {loading && (
                  <>
                    <div className="scanner-grid-3d" />
                    <div className="scanner-overlay" />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label className="btn btn-secondary" style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  Replace
                </label>
                <button className="btn btn-primary" onClick={handleUploadSubmit} style={{ flex: 2 }} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="nav-icon animate-spin" /> Classifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="nav-icon" /> Run AI Diagnostic
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Results display */}
        <div className="glass-card">
          <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 16 }}>Classification Response</h3>
          {latestReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <span className="badge badge-danger">
                  {latestReport.disease.replace("_", " ")}
                </span>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                  Detected with <strong>{Math.round(latestReport.confidence * 100)}%</strong> confidence.
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 3 Predicted Candidates</span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {latestReport.top3_diseases.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.class_name.replace("_", " ")}</span>
                      <strong>{Math.round(d.confidence * 100)}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rice Variety</span>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff', marginTop: 4 }}>{latestReport.variety || "Unclassified"}</p>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated Age</span>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#fff', marginTop: 4 }}>
                    {latestReport.estimatedAge ? `${Math.round(latestReport.estimatedAge)} Days` : "N/A"}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-primary w-full" onClick={() => setActivePage('advisory')}>
                  <MessageSquare className="nav-icon" /> Read Gemini Advisory
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', py: 24 }}>
              <ImageIcon style={{ width: 40, height: 40, opacity: 0.15, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>Waiting for image upload...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sensors and Telemetry History View Page
const SensorsPage = ({ devices }) => {
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || "");
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchTelemetryHistory(selectedDevice);
      setTelemetryHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDevice) loadHistory();
  }, [selectedDevice]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Telemetry Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Inspect historical logs and trend charts generated by field sensors.</p>
        </div>
        <select className="input-field" style={{ width: 220 }} value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted">
          <Loader2 className="nav-icon animate-spin mx-auto mb-2" /> Loading charts...
        </div>
      ) : (
        <div className="grid-cols-2">
          {/* Temperature card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Thermometer className="nav-icon" style={{ color: '#ef4444' }} /> Temperature History
              </h3>
              <span style={{ fontSize: 13, color: '#f87171', fontWeight: 'bold' }}>Optimal: 25-32°C</span>
            </div>
            <TelemetryChart data={telemetryHistory} dataKey="temperature" color="#ef4444" unit="°C" />
          </div>

          {/* Humidity card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity className="nav-icon" style={{ color: '#3b82f6' }} /> Relative Air Humidity
              </h3>
              <span style={{ fontSize: 13, color: '#60a5fa', fontWeight: 'bold' }}>Critical: &gt;80%</span>
            </div>
            <TelemetryChart data={telemetryHistory} dataKey="humidity" color="#3b82f6" unit="%" />
          </div>

          {/* Soil Moisture card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity className="nav-icon" style={{ color: 'var(--primary)' }} /> Soil Moisture Trend
              </h3>
              <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 'bold' }}>Threshold: 35-80%</span>
            </div>
            <TelemetryChart data={telemetryHistory} dataKey="soilMoisture" color="var(--primary)" unit="%" />
          </div>
        </div>
      )}
    </div>
  );
};

// Risk and Alerts Page
const RiskAlertsPage = ({ latestReport, alerts }) => {
  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Threat & Risk Evaluation</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Aggregated crop risk calculations combined from visual signs and ambient environmental stress parameters.
      </p>

      {latestReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="grid-cols-2" style={{ margin: 0 }}>
            {/* Risk Meter Gauge */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <h3 style={{ fontSize: 16, color: '#fff', width: '100%', textAlign: 'left' }}>Risk Rating Scale</h3>
              <RiskGauge score={latestReport.riskScore} />
              <span className={`badge ${
                latestReport.riskLevel === 'Critical' ? 'badge-danger' : 
                latestReport.riskLevel === 'High' ? 'badge-warning' : 
                'badge-success'
              }`} style={{ padding: '6px 16px', fontSize: 14 }}>
                {latestReport.riskLevel} Risk Level
              </span>
            </div>

            {/* Risk Score details */}
            <div className="glass-card">
              <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 14 }}>Aggregated Formula Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Visual Disease Component (60%):</span>
                  <strong>{Math.round(latestReport.riskScore * 0.6 * 10)/10} pts</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sensors Stress Component (40%):</span>
                  <strong>{Math.round(latestReport.riskScore * 0.4 * 10)/10} pts</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Score:</span>
                  <strong style={{ color: 'var(--primary)' }}>{latestReport.riskScore} / 100</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Reasons */}
          <div className="glass-card">
            <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 14 }}>Active Risk Reasonings</h3>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              {latestReport.riskReasons && latestReport.riskReasons.length > 0 ? (
                latestReport.riskReasons.map((r, i) => (
                  <li key={i} style={{ color: 'var(--text-main)' }}>{r}</li>
                ))
              ) : (
                <li style={{ color: 'var(--text-muted)', listStyle: 'none' }}>No risks flagged. Crop conditions are normal.</li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="glass-card text-center py-20 text-muted">
          <ShieldAlert style={{ width: 40, height: 40, opacity: 0.15, margin: '0 auto 12px' }} />
          <p>No diagnostics logs loaded. Please perform a leaf image analysis first.</p>
        </div>
      )}
    </div>
  );
};

// AI Advisory Page
const AdvisoryPage = ({ latestReport }) => {
  // Simple custom Markdown parser wrapper for basic list and header renders
  const renderAdvisoryMarkdown = (mdText) => {
    if (!mdText) return null;
    return mdText.split('\n').map((line, idx) => {
      if (line.startsWith('###')) {
        return <h3 key={idx}>{line.replace('###', '').trim()}</h3>;
      }
      if (line.startsWith('*') || line.startsWith('-')) {
        return <li key={idx} style={{ marginLeft: 20, listStyle: 'square' }}>{line.substring(1).trim()}</li>;
      }
      if (line.trim() === "") return <br key={idx} />;
      return <p key={idx}>{line}</p>;
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Gemini Agronomic Advisory</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Contextual agronomic advisories generated dynamically by the Gemini LLM based on visual predictions and microclimate sensors.
      </p>

      {latestReport ? (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-glass)', paddingBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Target Disease: <strong style={{ color: '#fff' }}>{latestReport.disease}</strong></span>
            {latestReport.metadata && latestReport.metadata.advisory_mode === 'gemini_api' ? (
              <span className="badge badge-success">Gemini Live API</span>
            ) : (
              <span className="badge badge-warning">Static Fallback (Offline)</span>
            )}
          </div>
          
          <div className="advisory-output text-main">
            {renderAdvisoryMarkdown(latestReport.advisory)}
          </div>
        </div>
      ) : (
        <div className="glass-card text-center py-20 text-muted">
          <MessageSquare style={{ width: 40, height: 40, opacity: 0.15, margin: '0 auto 12px' }} />
          <p>No advisory generated yet. Run a leaf diagnostic to query Gemini advice.</p>
        </div>
      )}
    </div>
  );
};

// History Page
const HistoryPage = ({ historyLogs }) => {
  return (
    <div>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Diagnostic Logs History</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Review a comprehensive trace log of all previous visual predictions and evaluations.</p>

      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Device Bed</th>
              <th>Diagnosis Classification</th>
              <th>AI Conf.</th>
              <th>Rice Variety</th>
              <th>Crop Age</th>
              <th>Threat Level</th>
            </tr>
          </thead>
          <tbody>
            {historyLogs.map(log => (
              <tr key={log.id}>
                <td style={{ color: '#fff', fontWeight: 500 }}>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.deviceId}</td>
                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{log.disease.replace("_", " ")}</td>
                <td>{Math.round(log.confidence * 100)}%</td>
                <td>{log.variety}</td>
                <td>{log.estimatedAge ? `${Math.round(log.estimatedAge)} Days` : "N/A"}</td>
                <td>
                  <span className={`badge ${
                    log.riskLevel === 'Critical' ? 'badge-danger' : 
                    log.riskLevel === 'High' ? 'badge-warning' : 
                    'badge-success'
                  }`}>
                    {log.riskLevel} ({log.riskScore})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Devices Monitor Page
const DevicesPage = ({ devices }) => {
  return (
    <div>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>Ingestion Gateways Status</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Monitor battery levels, WiFi signal strengths, and active telemetry logs from ESP32 nodes.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {devices.map(dev => (
          <div key={dev.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, color: '#fff' }}>{dev.name}</h3>
              <span className={`badge ${dev.status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                {dev.status}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Device ID:</span>
                <strong style={{ color: '#fff' }}>{dev.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Physical Location:</span>
                <strong style={{ color: '#fff' }}>{dev.location}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Battery Level:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Battery className="nav-icon" style={{ color: dev.battery > 20 ? 'var(--primary)' : 'var(--danger)' }} />
                  <strong style={{ color: '#fff' }}>{dev.battery}%</strong>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Signal strength:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wifi className="nav-icon" style={{ color: dev.signal === 'excellent' || dev.signal === 'good' ? 'var(--primary)' : 'var(--warning)' }} />
                  <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{dev.signal}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const [fastApiUrl, setFastApiUrl] = useState("");
  const [awsApiGatewayUrl, setAwsApiGatewayUrl] = useState("");
  const [geminiMockEnabled, setGeminiMockEnabled] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    const config = getSettings();
    setFastApiUrl(config.fastApiUrl);
    setAwsApiGatewayUrl(config.awsApiGatewayUrl || "");
    setGeminiMockEnabled(config.geminiMockEnabled);
  }, []);

  const handleSave = () => {
    saveSettings({ fastApiUrl, awsApiGatewayUrl, geminiMockEnabled });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 6 }}>System Settings</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Configure external endpoint bindings to switch between local mock data and live servers.</p>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="form-group">
          <label>Orchestrator Backend URL (FastAPI Backend - Port 5000)</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g., http://127.0.0.1:5000" 
            value={fastApiUrl}
            onChange={(e) => setFastApiUrl(e.target.value)}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Point this to your running local Backend Orchestration service on Port 5000. This handles AI, AWS, and Gemini.
          </p>
        </div>

        <div className="form-group">
          <label>AWS API Gateway Endpoint (CDK Ingress)</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g., https://api-id.execute-api.region.amazonaws.com/prod" 
            value={awsApiGatewayUrl}
            onChange={(e) => setAwsApiGatewayUrl(e.target.value)}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Point this to your deployed AWS CDK API Gateway to fetch active telemetry live from DynamoDB.
          </p>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input 
            type="checkbox" 
            id="gemini-mock" 
            style={{ width: 18, height: 18, cursor: 'pointer' }}
            checked={geminiMockEnabled}
            onChange={(e) => setGeminiMockEnabled(e.target.checked)}
          />
          <label htmlFor="gemini-mock" style={{ margin: 0, cursor: 'pointer' }}>Use local static templates if Gemini API key is missing</label>
        </div>

        <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginTop: 8 }}>
          Save Configuration
        </button>

        {savedMsg && (
          <div style={{ textAlign: 'center', color: 'var(--primary)', fontSize: 14, fontWeight: 'bold' }}>
            ✓ Configuration saved successfully!
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. MAIN COMPONENT (App Router & layout)
// ============================================================================

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  
  // States holding shared values loaded from Mock API service layer
  const [latestReport, setLatestReport] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);

  const loadDashboardData = async () => {
    try {
      const devList = await fetchDevices();
      setDevices(devList);
      
      const logs = await fetchHistoryLogs();
      setHistoryLogs(logs);
      if (logs.length > 0) {
        // Hydrate the dashboard with the latest history run diagnostic
        const latest = await uploadAndDiagnose(null, logs[0].deviceId); // fetches diagnostic
        setLatestReport(latest);
      }

      const activeAlerts = await fetchAlerts();
      setAlerts(activeAlerts);
      
      const liveSensors = await fetchLatestTelemetry("ESP32-001");
      setTelemetry(liveSensors);

    } catch (e) {
      console.error("Dashboard initial hydration failed:", e);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Update history items when a new diagnosis is performed
  useEffect(() => {
    if (latestReport) {
      fetchHistoryLogs().then(logs => setHistoryLogs(logs));
    }
  }, [latestReport]);

  const renderContent = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewPage setActivePage={setActivePage} latestReport={latestReport} telemetry={telemetry} devices={devices} alerts={alerts} />;
      case 'diagnose':
        return <DiagnosisPage latestReport={latestReport} setLatestReport={setLatestReport} setActivePage={setActivePage} devices={devices} />;
      case 'sensors':
        return <SensorsPage devices={devices} />;
      case 'risk':
        return <RiskAlertsPage latestReport={latestReport} alerts={alerts} />;
      case 'advisory':
        return <AdvisoryPage latestReport={latestReport} />;
      case 'history':
        return <HistoryPage historyLogs={historyLogs} />;
      case 'devices':
        return <DevicesPage devices={devices} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage setActivePage={setActivePage} latestReport={latestReport} telemetry={telemetry} devices={devices} alerts={alerts} />;
    }
  };

  return (
    <div className="app-container">
      {/* Floating 3D Ambient Blobs */}
      <div className="ambient-blobs">
        <div className="blob blob-primary" />
        <div className="blob blob-secondary" />
      </div>

      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="logo-section">
          <ShieldAlert style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <span className="logo-text font-display">PlantShield AI</span>
        </div>

        <ul className="nav-list">
          <li className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => setActivePage('overview')}>
            <LayoutDashboard className="nav-icon" /> Overview
          </li>
          <li className={`nav-item ${activePage === 'diagnose' ? 'active' : ''}`} onClick={() => setActivePage('diagnose')}>
            <ImageIcon className="nav-icon" /> Image Analysis
          </li>
          <li className={`nav-item ${activePage === 'sensors' ? 'active' : ''}`} onClick={() => setActivePage('sensors')}>
            <Thermometer className="nav-icon" /> Sensors History
          </li>
          <li className={`nav-item ${activePage === 'risk' ? 'active' : ''}`} onClick={() => setActivePage('risk')}>
            <AlertTriangle className="nav-icon" /> Threat & Risk
          </li>
          <li className={`nav-item ${activePage === 'advisory' ? 'active' : ''}`} onClick={() => setActivePage('advisory')}>
            <MessageSquare className="nav-icon" /> AI Advisory
          </li>
          <li className={`nav-item ${activePage === 'history' ? 'active' : ''}`} onClick={() => setActivePage('history')}>
            <History className="nav-icon" /> Log History
          </li>
          <li className={`nav-item ${activePage === 'devices' ? 'active' : ''}`} onClick={() => setActivePage('devices')}>
            <Cpu className="nav-icon" /> Gateways Status
          </li>
          <li style={{ marginTop: 'auto', listStyle: 'none' }}>
            <li className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => setActivePage('settings')}>
              <SettingsIcon className="nav-icon" /> Settings
            </li>
          </li>
        </ul>

        {/* Developer Profile Section */}
        <div className="dev-profile-card" style={{ marginTop: 16 }}>
          <div className="avatar-initials">ST</div>
          <div className="dev-info">
            <span className="dev-name">Siddhartha Toodi</span>
            <span className="dev-college" title="Sathyabama Institute of Science and Technology">Sathyabama Inst.</span>
          </div>
        </div>
      </nav>

      {/* Main Panel wrapper */}
      <div className="main-wrapper">
        <header className="header">
          <h1 style={{ fontSize: 20, color: '#fff' }}>
            {activePage.toUpperCase()} PANEL
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border-glass)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              <span className="status-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />
              <span>ORCHESTRATOR: ACTIVE</span>
            </div>
          </div>
        </header>

        <main className="content-body">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
