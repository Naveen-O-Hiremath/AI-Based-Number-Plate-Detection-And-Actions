import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ConfigScreen from './src/ConfigScreen';
import ScannerScreen from './src/ScannerScreen';
import { loadConfig } from './src/api';

export default function App() {
    const [config, setConfig] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        loadConfig().then(setConfig);
    }, []);

    if (!config) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color="#facc15" size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar style="light" />
            {connected ? (
                <ScannerScreen config={config} onReconfigure={() => setConnected(false)} />
            ) : (
                <ConfigScreen
                    initial={config}
                    onConnected={(next) => { setConfig(next); setConnected(true); }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#0a0f1c',
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
    loading: { flex: 1, backgroundColor: '#0a0f1c', alignItems: 'center', justifyContent: 'center' },
});
