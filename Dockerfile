# ── Build React Frontend ──
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Production Server ──
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=frontend /app/frontend/build ./public
EXPOSE 3001
CMD ["node", "server.js"]
