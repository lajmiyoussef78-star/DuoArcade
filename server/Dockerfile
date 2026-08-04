# DuoArcade Socket.IO game relay — Fly.io
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Fly sets PORT at runtime; default matches fly.toml internal_port.
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/index.js"]
