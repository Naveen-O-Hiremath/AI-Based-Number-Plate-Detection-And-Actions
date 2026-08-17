import { useEffect, useRef, useState } from 'react';

/**
 * Live WebSocket feed with automatic reconnect. Returns connection state plus
 * the latest events; `onEvent` fires for every message as it arrives.
 */
export function useSocket(onEvent) {
    const [connected, setConnected] = useState(false);
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    useEffect(() => {
        let socket;
        let retryTimer;
        let closed = false;
        let backoff = 1000;

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

            socket.onopen = () => { setConnected(true); backoff = 1000; };
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handlerRef.current?.(message);
                } catch { /* ignore malformed frame */ }
            };
            socket.onclose = () => {
                setConnected(false);
                if (closed) return;
                // Reconnect with backoff so a server restart recovers on its own.
                retryTimer = setTimeout(connect, backoff);
                backoff = Math.min(backoff * 2, 15000);
            };
            socket.onerror = () => socket.close();
        }

        connect();
        return () => {
            closed = true;
            clearTimeout(retryTimer);
            socket?.close();
        };
    }, []);

    return { connected };
}

/** Short attention-grabbing tone for a critical alert (no asset file needed). */
export function playAlertTone() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [0, 0.22, 0.44].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now + offset);
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.2);
        });
        setTimeout(() => ctx.close(), 1500);
    } catch { /* audio blocked until user interacts — banner still shows */ }
}
