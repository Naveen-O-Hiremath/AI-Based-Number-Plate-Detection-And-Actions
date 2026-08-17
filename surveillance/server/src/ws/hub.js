import { WebSocketServer, WebSocket } from 'ws';

// The app listens on both HTTP and HTTPS, so more than one WebSocketServer can
// be attached. Broadcasts must reach clients on every one of them.
const servers = [];

export function attachWebSocket(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

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

    servers.push(wss);
    return wss;
}

/** Push an event to every connected admin dashboard, across all listeners. */
export function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload, at: new Date().toISOString() });
    let sent = 0;
    for (const wss of servers) {
        for (const socket of wss.clients) {
            if (socket.readyState === WebSocket.OPEN) { socket.send(message); sent++; }
        }
    }
    return sent;
}

export function clientCount() {
    return servers.reduce((total, wss) => total + wss.clients.size, 0);
}
