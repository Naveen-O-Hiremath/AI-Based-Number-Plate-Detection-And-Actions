import { WebSocketServer, WebSocket } from 'ws';

let wss = null;

export function attachWebSocket(httpServer) {
    wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (socket) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });
        socket.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));
    });

    // Drop sockets that stop responding, so broadcasts don't queue on dead peers.
    const interval = setInterval(() => {
        for (const socket of wss.clients) {
            if (!socket.isAlive) { socket.terminate(); continue; }
            socket.isAlive = false;
            socket.ping();
        }
    }, 30000);
    wss.on('close', () => clearInterval(interval));

    return wss;
}

/** Push an event to every connected admin dashboard. */
export function broadcast(type, payload) {
    if (!wss) return 0;
    const message = JSON.stringify({ type, payload, at: new Date().toISOString() });
    let sent = 0;
    for (const socket of wss.clients) {
        if (socket.readyState === WebSocket.OPEN) { socket.send(message); sent++; }
    }
    return sent;
}

export function clientCount() {
    return wss ? wss.clients.size : 0;
}
