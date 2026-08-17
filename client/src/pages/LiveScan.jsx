import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

const COMPLIANCE_LABEL = { insurance: 'Insurance', permit: 'Permit', puc: 'PUC' };

export default function LiveScan() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [cameraError, setCameraError] = useState('');
    const [cameraReady, setCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState('environment');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [editablePlate, setEditablePlate] = useState('');
    const [manualPlate, setManualPlate] = useState('');
    const [history, setHistory] = useState([]);
    const [connectInfo, setConnectInfo] = useState(null);
    const [showConnect, setShowConnect] = useState(false);

    const isSecure = window.isSecureContext;

    useEffect(() => {
        let cancelled = false;
        async function startCamera() {
            setCameraReady(false);
            setCameraError('');
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError(isSecure
                    ? 'This browser does not support camera access. You can still enter a plate manually below.'
                    : 'Camera is blocked because this page is not HTTPS. Use the "Scan from your phone" link/QR below (https), or enter a plate manually.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setCameraReady(true);
            } catch (err) {
                setCameraError(err.message || 'Could not access camera. You can still enter a plate manually below.');
            }
        }
        startCamera();
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [facingMode]);

    useEffect(() => {
        api.get('/scan/connect-info').then(setConnectInfo).catch(() => {});
    }, []);

    function flipCamera() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
    }

    // The guide box shown over the video — only this region is sent for OCR,
    // so background scenery can't pollute the read. Fractions of video size.
    const GUIDE = { w: 0.72, h: 0.38 };

    function captureFrame() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return null;

        const sw = video.videoWidth * GUIDE.w;
        const sh = video.videoHeight * GUIDE.h;
        const sx = (video.videoWidth - sw) / 2;
        const sy = (video.videoHeight - sh) / 2;

        // Upscale 2x and boost contrast/grayscale — small, low-contrast crops
        // are the main cause of bad OCR reads.
        canvas.width = sw * 2;
        canvas.height = sh * 2;
        const ctx = canvas.getContext('2d');
        ctx.filter = 'grayscale(1) contrast(1.5)';
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    async function submitScan(body) {
        setScanning(true);
        setError('');
        try {
            const res = await api.post('/scan/plate', body);
            setResult(res);
            setEditablePlate(res.plateNumber || '');
            loadHistory();
        } catch (err) {
            setError(err.message);
        } finally {
            setScanning(false);
        }
    }

    function handleCaptureAndScan() {
        const frame = captureFrame();
        if (!frame) {
            setError('No camera frame available — use manual entry instead.');
            return;
        }
        submitScan({ image: frame });
    }

    function handleConfirmPlate() {
        if (!editablePlate.trim()) return;
        submitScan({ manualPlate: editablePlate.trim().toUpperCase() });
    }

    function handleManualSubmit(e) {
        e.preventDefault();
        if (!manualPlate.trim()) return;
        submitScan({ manualPlate: manualPlate.trim().toUpperCase() });
    }

    function loadHistory() {
        api.get('/scan/recent').then((res) => setHistory(res.data)).catch(() => {});
    }

    useEffect(loadHistory, []);

    return (
        <>
            <PageHeader title="Live Camera Scan" subtitle="Use this device's camera as a field endpoint — captures a frame, runs AI/OCR on the server, and matches it against the vehicle registry in real time" />
            <div className="content">
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20 }}>
                    <div className="card">
                        {cameraError ? (
                            <div className="error-banner">{cameraError}</div>
                        ) : (
                            <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                                <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
                                {cameraReady && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '14%', right: '14%', top: '31%', bottom: '31%',
                                        border: '2px dashed var(--yellow, #facc15)',
                                        borderRadius: 6,
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                                        pointerEvents: 'none',
                                    }}>
                                        <span style={{
                                            position: 'absolute', top: -24, left: 0,
                                            fontSize: 11, color: 'var(--yellow, #facc15)',
                                            letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>Align plate inside this box</span>
                                    </div>
                                )}
                                {!cameraReady && <div className="empty-state">Requesting camera access…</div>}
                            </div>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                            <button className="btn" disabled={!cameraReady || scanning} onClick={handleCaptureAndScan}>
                                {scanning ? 'Analyzing… (multi-pass OCR)' : '📷 Capture & scan'}
                            </button>
                            {cameraReady && (
                                <button className="btn secondary" onClick={flipCamera} title="Switch between front and back camera">
                                    🔄 Flip camera
                                </button>
                            )}
                            {scanning && (
                                <span style={{ fontSize: 12, color: 'var(--text-faint)', alignSelf: 'center' }}>
                                    Trying several image enhancements — this can take a few seconds.
                                </span>
                            )}
                        </div>

                        <div className="section-title" style={{ fontSize: 13 }}>Or test with a known plate</div>
                        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
                            <input
                                style={{ flex: 1 }}
                                placeholder="e.g. a plate from the seeded demo data, KA05AI2026"
                                value={manualPlate}
                                onChange={(e) => setManualPlate(e.target.value)}
                            />
                            <button className="btn secondary" disabled={scanning}>Scan</button>
                        </form>

                        {connectInfo?.urls?.length > 0 && (
                            <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                <button
                                    className="btn secondary small"
                                    onClick={() => setShowConnect((s) => !s)}
                                >
                                    📱 Scan from your phone {showConnect ? '▴' : '▾'}
                                </button>
                                {showConnect && (
                                    <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                        {connectInfo.qrDataUrl && (
                                            <img src={connectInfo.qrDataUrl} alt="QR code to open Live Scan on your phone" width="150" height="150" style={{ borderRadius: 8 }} />
                                        )}
                                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', maxWidth: 320, lineHeight: 1.7 }}>
                                            <strong style={{ color: 'var(--text)' }}>On the same Wi-Fi as this PC:</strong><br />
                                            1. Scan the QR (or open{' '}
                                            {connectInfo.urls.map((u, i) => (
                                                <span key={u} style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                                                    {i > 0 && ' or '}{u}
                                                </span>
                                            ))}
                                            ).<br />
                                            2. The browser shows a certificate warning once — tap Advanced → Proceed. That's expected for this demo's self-signed certificate.<br />
                                            3. Log in, allow camera access, and point the back camera at a plate.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        {error && <div className="error-banner">{error}</div>}
                        {!result && !error && (
                            <div className="empty-state">Capture a frame or enter a plate to see the match result here.</div>
                        )}
                        {result && result.plateFound === false && (
                            <div>
                                <div className="badge amber" style={{ fontSize: 12, padding: '4px 10px', marginBottom: 12 }}>
                                    NO NUMBER PLATE DETECTED
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{result.message}</p>
                                <details style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                                    <summary style={{ cursor: 'pointer' }}>What the OCR saw in the frame</summary>
                                    <div style={{ fontFamily: 'var(--mono)', marginTop: 6, wordBreak: 'break-all' }}>
                                        "{result.ocrRawText || '(nothing readable)'}"
                                    </div>
                                </details>
                            </div>
                        )}
                        {result && result.plateFound !== false && (
                            <div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>
                                    OCR read: "{result.ocrRawText}" {result.ocrConfidence != null && `(${Math.round(result.ocrConfidence * 100)}% confidence)`}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 16px' }}>
                                    <input
                                        style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, flex: 1 }}
                                        value={editablePlate}
                                        onChange={(e) => setEditablePlate(e.target.value.toUpperCase())}
                                    />
                                    <button className="btn secondary small" onClick={handleConfirmPlate} disabled={scanning}>Re-check</button>
                                </div>

                                {result.matched ? (
                                    <div className="badge green" style={{ fontSize: 12, padding: '4px 10px', marginBottom: 14 }}>● MATCHED — OWNER FOUND</div>
                                ) : (
                                    <div className="badge grey" style={{ fontSize: 12, padding: '4px 10px', marginBottom: 14 }}>NO MATCH IN REGISTRY</div>
                                )}

                                {result.onWatchlist && (
                                    <div className="error-banner">⚠ ON ROGUE-PLATE WATCHLIST — {result.onWatchlist.reason} (alert logged)</div>
                                )}

                                {result.vehicle && (
                                    <p style={{ fontSize: 13.5 }}>
                                        <strong>{result.vehicle.owner_name}</strong><br />
                                        {result.vehicle.color} {result.vehicle.make} {result.vehicle.model} ({result.vehicle.vehicle_type})<br />
                                        {result.vehicle.owner_phone}
                                    </p>
                                )}

                                {result.compliance?.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                        {result.compliance.map((c) => (
                                            <div key={c.type} className="badge amber" style={{ alignSelf: 'flex-start' }}>
                                                {COMPLIANCE_LABEL[c.type]} {c.status === 'expired' ? 'expired' : 'expiring soon'} · {c.expiry}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {result.corridorGranted && (
                                    <div className="badge green" style={{ marginBottom: 10 }}>
                                        ✚ Emergency vehicle on duty — green corridor granted ({result.signalId})
                                    </div>
                                )}

                                {result.otherPlates?.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div className="section-title" style={{ fontSize: 13 }}>Other plates in this frame</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {result.otherPlates.map((p) => (
                                                <button
                                                    key={p.plate}
                                                    className="btn secondary small"
                                                    style={{ fontFamily: 'var(--mono)' }}
                                                    onClick={() => { setEditablePlate(p.plate); submitScan({ manualPlate: p.plate }); }}
                                                >
                                                    {p.plate}{p.matched ? ` — ${p.ownerName}` : ''}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!result.matched && result.suggestions?.length > 0 && (
                                    <div>
                                        <div className="section-title" style={{ fontSize: 13 }}>Did you mean…</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {result.suggestions.map((s) => (
                                                <button
                                                    key={s.plate}
                                                    className="btn secondary small"
                                                    style={{ justifyContent: 'flex-start' }}
                                                    onClick={() => { setEditablePlate(s.plate); submitScan({ manualPlate: s.plate }); }}
                                                >
                                                    {s.plate} — {s.ownerName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="section-title">Recent scans from this device</div>
                <div className="card">
                    <table>
                        <thead>
                            <tr><th>Plate</th><th>Owner</th><th>Matched</th><th>Time</th></tr>
                        </thead>
                        <tbody>
                            {history.map((h) => (
                                <tr key={h.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{h.plate_number}</td>
                                    <td>{h.owner_name || '—'}</td>
                                    <td><span className={`badge ${h.matched ? 'green' : 'grey'}`}>{h.matched ? 'Matched' : 'No match'}</span></td>
                                    <td>{h.captured_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {history.length === 0 && <div className="empty-state">No scans yet from this device.</div>}
                </div>
            </div>
        </>
    );
}
