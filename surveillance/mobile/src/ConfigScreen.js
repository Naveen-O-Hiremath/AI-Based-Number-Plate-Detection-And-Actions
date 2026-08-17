import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { pingServer, saveConfig, normalizeServerUrl } from './api';

/** First screen: point the edge node at the local backend before connecting. */
export default function ConfigScreen({ initial, onConnected }) {
    const [serverUrl, setServerUrl] = useState(initial.serverUrl || 'http://192.168.1.5:8000');
    const [nodeId, setNodeId] = useState(initial.nodeId);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function connect() {
        setBusy(true); setError(''); setStatus(null);
        try {
            const health = await pingServer(serverUrl);
            const normalized = normalizeServerUrl(serverUrl);
            setStatus(health);
            await saveConfig({ serverUrl: normalized, nodeId });
            setTimeout(() => onConnected({ serverUrl: normalized, nodeId }), 600);
        } catch (err) {
            setError(
                `${err.message}\n\nCheck that:\n• The phone is on the same Wi-Fi as the server\n• The IP and port are correct\n• Windows Firewall allows inbound TCP on that port`
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.badge}><Text style={styles.badgeText}>AI</Text></View>
                <Text style={styles.title}>ANPR Edge Camera</Text>
                <Text style={styles.subtitle}>Connect this device to your local surveillance server.</Text>

                <Text style={styles.label}>Backend server address</Text>
                <TextInput
                    style={styles.input}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    placeholder="http://192.168.1.50:8000"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                />
                <Text style={styles.hint}>
                    The server prints this address on startup. Use the LAN IP, not localhost.
                </Text>

                <Text style={styles.label}>Camera node ID</Text>
                <TextInput
                    style={styles.input}
                    value={nodeId}
                    onChangeText={setNodeId}
                    placeholder="MOBILE-01"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
                <Text style={styles.hint}>Identifies this device in movement logs and alerts.</Text>

                {error !== '' && (
                    <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
                )}
                {status && (
                    <View style={styles.okBox}>
                        <Text style={styles.okTitle}>Connected</Text>
                        <Text style={styles.okText}>Vision engine: {status.vision}</Text>
                        <Text style={styles.okText}>Dashboards online: {status.dashboards_connected}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.button, busy && styles.buttonDisabled]}
                    onPress={connect}
                    disabled={busy || !serverUrl}
                >
                    {busy
                        ? <ActivityIndicator color="#0a0f1c" />
                        : <Text style={styles.buttonText}>Connect</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: '#0a0f1c' },
    container: { padding: 24, paddingTop: 72 },
    badge: {
        width: 52, height: 52, borderRadius: 14, backgroundColor: '#facc15',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    badgeText: { color: '#0a0f1c', fontWeight: '900', fontSize: 18 },
    title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800' },
    subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 6, marginBottom: 28 },
    label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
    input: {
        backgroundColor: '#111a2c', borderWidth: 1, borderColor: '#223049', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, color: '#f1f5f9', fontSize: 15,
    },
    hint: { color: '#64748b', fontSize: 11.5, marginTop: 6 },
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#7f1d1d',
        borderRadius: 10, padding: 12, marginTop: 20,
    },
    errorText: { color: '#fca5a5', fontSize: 12.5, lineHeight: 19 },
    okBox: {
        backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#166534',
        borderRadius: 10, padding: 12, marginTop: 20,
    },
    okTitle: { color: '#86efac', fontWeight: '700', marginBottom: 4 },
    okText: { color: '#bbf7d0', fontSize: 12 },
    button: {
        backgroundColor: '#facc15', borderRadius: 12, paddingVertical: 15,
        alignItems: 'center', marginTop: 28,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#0a0f1c', fontWeight: '800', fontSize: 16 },
});
