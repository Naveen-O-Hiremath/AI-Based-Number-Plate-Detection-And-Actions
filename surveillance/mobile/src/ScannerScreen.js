import { useEffect, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Switch, Vibration, TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { sendDetection, STATUS_COLORS } from './api';

const AUTO_INTERVAL_MS = 2000;

export default function ScannerScreen({ config, onReconfigure }) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [autoMode, setAutoMode] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [manualPlate, setManualPlate] = useState('');

    // Guards against overlapping captures — the pipeline can take a few seconds.
    const inFlight = useRef(false);

    async function capture(plateOverride) {
        if (inFlight.current) return;
        inFlight.current = true;
        setScanning(true);
        setError('');

        try {
            let base64Image = null;
            if (!plateOverride) {
                if (!cameraRef.current) throw new Error('Camera not ready');
                const photo = await cameraRef.current.takePictureAsync({
                    base64: true, quality: 0.7, skipProcessing: true,
                });
                base64Image = photo.base64;
            }

            const data = await sendDetection({
                serverUrl: config.serverUrl,
                nodeId: config.nodeId,
                base64Image,
                plateNumber: plateOverride,
            });

            setResult(data);
            if (data.plate_number) {
                setHistory((prev) => [
                    { plate: data.plate_number, status: data.status, at: new Date() },
                    ...prev,
                ].slice(0, 25));
            }
            // Haptic warning for a wanted vehicle so the officer feels it.
            if (data.status === 'WANTED_CRIMINAL') Vibration.vibrate([0, 400, 150, 400]);
        } catch (err) {
            setError(err.name === 'AbortError' ? 'Request timed out — is the server reachable?' : err.message);
        } finally {
            inFlight.current = false;
            setScanning(false);
        }
    }

    // Continuous auto-detect loop.
    useEffect(() => {
        if (!autoMode) return;
        const timer = setInterval(() => { capture(); }, AUTO_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [autoMode, config]);

    if (!permission) {
        return <View style={styles.center}><ActivityIndicator color="#facc15" /></View>;
    }
    if (!permission.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.permTitle}>Camera access needed</Text>
                <Text style={styles.permText}>
                    This device acts as an ANPR edge camera and needs the camera to scan plates.
                </Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant camera permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const palette = result ? (STATUS_COLORS[result.status] || STATUS_COLORS.UNREGISTERED) : null;

    return (
        <View style={styles.flex}>
            <View style={styles.cameraWrap}>
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
                {/* Alignment guide — helps frame a small model-car plate. */}
                <View style={styles.guide} pointerEvents="none">
                    <Text style={styles.guideText}>ALIGN PLATE HERE</Text>
                </View>
                <View style={styles.nodeBadge}>
                    <Text style={styles.nodeBadgeText}>{config.nodeId}</Text>
                </View>
                {scanning && (
                    <View style={styles.scanningBadge}>
                        <ActivityIndicator size="small" color="#0a0f1c" />
                        <Text style={styles.scanningText}>Reading plate…</Text>
                    </View>
                )}
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.captureBtn, scanning && styles.buttonDisabled]}
                    onPress={() => capture()}
                    disabled={scanning}
                >
                    <Text style={styles.captureBtnText}>{scanning ? 'Scanning…' : 'Capture & Scan'}</Text>
                </TouchableOpacity>
                <View style={styles.autoRow}>
                    <Text style={styles.autoLabel}>Auto every 2s</Text>
                    <Switch
                        value={autoMode}
                        onValueChange={setAutoMode}
                        trackColor={{ true: '#facc15', false: '#334155' }}
                        thumbColor="#f1f5f9"
                    />
                </View>
            </View>

            <ScrollView style={styles.results} contentContainerStyle={{ paddingBottom: 28 }}>
                {error !== '' && (
                    <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
                )}

                {result && (
                    <View style={[styles.resultCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <Text style={[styles.resultStatus, { color: palette.text }]}>{palette.label}</Text>
                        <Text style={styles.resultPlate}>{result.plate_number || '— no plate found —'}</Text>

                        {result.plate_found === false && (
                            <Text style={styles.resultMuted}>{result.message}</Text>
                        )}

                        {result.matched && result.vehicle && (
                            <View style={styles.detailBlock}>
                                <Row label="Owner" value={result.vehicle.owner_name} />
                                <Row label="Vehicle" value={`${result.vehicle.vehicle_model}${result.vehicle.vehicle_color ? ` · ${result.vehicle.vehicle_color}` : ''}`} />
                                <Row label="Registered" value={result.vehicle.registration_date} />
                                {result.vehicle.owner_phone && <Row label="Phone" value={result.vehicle.owner_phone} />}
                                {result.vehicle.status_reason && (
                                    <Row label="Reason" value={result.vehicle.status_reason} />
                                )}
                            </View>
                        )}

                        {result.fines && result.fines.total_unpaid > 0 && (
                            <View style={styles.finesBox}>
                                <Text style={styles.finesTitle}>
                                    {result.fines.total_unpaid} unpaid fine{result.fines.total_unpaid > 1 ? 's' : ''} · ₹{result.fines.amount_due.toLocaleString('en-IN')}
                                </Text>
                                {result.fines.items.filter((f) => f.paid_status === 'UNPAID').slice(0, 4).map((f) => (
                                    <Text key={f.id} style={styles.fineLine}>
                                        • {f.violation_type} — ₹{f.amount} ({f.date_issued})
                                    </Text>
                                ))}
                            </View>
                        )}

                        {result.alert && (
                            <View style={styles.alertBox}>
                                <Text style={styles.alertText}>⚠ ALERT DISPATCHED TO CONTROL ROOM</Text>
                            </View>
                        )}

                        {result.suggestions && result.suggestions.length > 0 && (
                            <View style={styles.detailBlock}>
                                <Text style={styles.resultMuted}>Closest registered plates:</Text>
                                {result.suggestions.map((s) => (
                                    <TouchableOpacity key={s.plate} onPress={() => capture(s.plate)}>
                                        <Text style={styles.suggestion}>
                                            {s.plate} — {s.owner_name} ({s.status})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <Text style={styles.meta}>
                            {result.vision_source} · {Math.round((result.confidence || 0) * 100)}% confidence
                            {result.elapsed_ms ? ` · ${result.elapsed_ms}ms` : ''}
                        </Text>
                    </View>
                )}

                <View style={styles.manualBox}>
                    <Text style={styles.manualLabel}>Or enter a plate manually</Text>
                    <View style={styles.manualRow}>
                        <TextInput
                            style={styles.manualInput}
                            value={manualPlate}
                            onChangeText={setManualPlate}
                            placeholder="KL07B1234"
                            placeholderTextColor="#64748b"
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.manualBtn}
                            onPress={() => { if (manualPlate.trim()) capture(manualPlate.trim().toUpperCase()); }}
                        >
                            <Text style={styles.manualBtnText}>Scan</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {history.length > 0 && (
                    <View style={styles.historyBox}>
                        <Text style={styles.historyTitle}>Recent scans from this device</Text>
                        {history.map((h, i) => (
                            <View key={`${h.plate}-${i}`} style={styles.historyRow}>
                                <Text style={styles.historyPlate}>{h.plate}</Text>
                                <Text style={[styles.historyStatus, { color: (STATUS_COLORS[h.status] || STATUS_COLORS.UNREGISTERED).border }]}>
                                    {h.status}
                                </Text>
                                <Text style={styles.historyTime}>{h.at.toLocaleTimeString()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.reconfigure} onPress={onReconfigure}>
                    <Text style={styles.reconfigureText}>
                        Connected to {config.serverUrl} — change server
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

function Row({ label, value }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: '#0a0f1c' },
    center: { flex: 1, backgroundColor: '#0a0f1c', alignItems: 'center', justifyContent: 'center', padding: 28 },
    permTitle: { color: '#f1f5f9', fontSize: 19, fontWeight: '700', marginBottom: 8 },
    permText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 22, lineHeight: 20 },

    cameraWrap: { height: '42%', backgroundColor: '#000', position: 'relative' },
    guide: {
        position: 'absolute', left: '10%', right: '10%', top: '32%', bottom: '32%',
        borderWidth: 2, borderColor: '#facc15', borderStyle: 'dashed', borderRadius: 8,
        alignItems: 'center', justifyContent: 'flex-start',
    },
    guideText: {
        color: '#facc15', fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
        marginTop: -18, backgroundColor: 'rgba(10,15,28,0.7)', paddingHorizontal: 6,
    },
    nodeBadge: {
        position: 'absolute', top: 12, left: 12,
        backgroundColor: 'rgba(10,15,28,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    },
    nodeBadgeText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
    scanningBadge: {
        position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
        gap: 8, backgroundColor: '#facc15', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    scanningText: { color: '#0a0f1c', fontWeight: '700', fontSize: 12.5 },

    controls: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#223049',
    },
    captureBtn: { flex: 1, backgroundColor: '#facc15', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    captureBtnText: { color: '#0a0f1c', fontWeight: '800', fontSize: 15 },
    buttonDisabled: { opacity: 0.6 },
    autoRow: { alignItems: 'center' },
    autoLabel: { color: '#94a3b8', fontSize: 10.5, marginBottom: 2 },

    results: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#7f1d1d',
        borderRadius: 10, padding: 12, marginBottom: 12,
    },
    errorText: { color: '#fca5a5', fontSize: 12.5 },

    resultCard: { borderRadius: 14, borderWidth: 2, padding: 16, marginBottom: 14 },
    resultStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginBottom: 4 },
    resultPlate: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
    resultMuted: { color: '#cbd5e1', fontSize: 13, lineHeight: 19 },
    detailBlock: { marginTop: 10, gap: 4 },
    row: { flexDirection: 'row' },
    rowLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, width: 82 },
    rowValue: { color: '#fff', fontSize: 12.5, flex: 1, fontWeight: '500' },
    finesBox: {
        marginTop: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10,
    },
    finesTitle: { color: '#fde68a', fontWeight: '700', fontSize: 13, marginBottom: 4 },
    fineLine: { color: '#e2e8f0', fontSize: 11.5, lineHeight: 17 },
    alertBox: {
        marginTop: 12, backgroundColor: '#ef4444', borderRadius: 8, paddingVertical: 9, alignItems: 'center',
    },
    alertText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.6 },
    suggestion: { color: '#93c5fd', fontSize: 13, marginTop: 5, textDecorationLine: 'underline' },
    meta: { color: 'rgba(255,255,255,0.45)', fontSize: 10.5, marginTop: 12 },

    manualBox: {
        backgroundColor: '#111a2c', borderWidth: 1, borderColor: '#223049',
        borderRadius: 12, padding: 12, marginBottom: 14,
    },
    manualLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
    manualRow: { flexDirection: 'row', gap: 8 },
    manualInput: {
        flex: 1, backgroundColor: '#0a0f1c', borderWidth: 1, borderColor: '#223049',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 15,
    },
    manualBtn: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
    manualBtnText: { color: '#f1f5f9', fontWeight: '700', fontSize: 13 },

    historyBox: {
        backgroundColor: '#111a2c', borderWidth: 1, borderColor: '#223049', borderRadius: 12, padding: 12,
    },
    historyTitle: { color: '#94a3b8', fontSize: 12, marginBottom: 8, fontWeight: '600' },
    historyRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
        borderTopWidth: 1, borderTopColor: 'rgba(34,48,73,0.6)',
    },
    historyPlate: { color: '#f1f5f9', fontSize: 13, fontWeight: '700', flex: 1 },
    historyStatus: { fontSize: 10, fontWeight: '800', marginRight: 10 },
    historyTime: { color: '#64748b', fontSize: 10.5 },

    button: { backgroundColor: '#facc15', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 26 },
    buttonText: { color: '#0a0f1c', fontWeight: '800', fontSize: 15 },
    reconfigure: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
    reconfigureText: { color: '#64748b', fontSize: 11.5 },
});
