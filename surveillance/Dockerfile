# ---------- stage 1: build the admin dashboard ----------
FROM node:22-alpine AS admin-build
WORKDIR /build

COPY admin/package*.json ./
RUN npm ci

COPY admin/ ./
RUN npm run build

# ---------- stage 2: server runtime ----------
FROM node:22-alpine
WORKDIR /app

# Only production deps for the server.
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/

# The server serves ../admin/dist when it exists, so one container hosts the
# API, the WebSocket hub, the dashboard, and the browser scanner.
COPY --from=admin-build /build/dist ./admin/dist

# Seeds on first boot only, then hands off to the server.
COPY surveillance-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production PORT=8000 HTTPS_PORT=8443
EXPOSE 8000 8443
VOLUME ["/app/server/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server/src/index.js"]
