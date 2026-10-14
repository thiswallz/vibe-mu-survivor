FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/game/package.json packages/game/package.json
COPY packages/models/package.json packages/models/package.json
COPY packages/sdk/package.json packages/sdk/package.json
RUN npm ci
COPY tsconfig*.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY tests/ tests/
RUN npm run build && npm test

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=:: PORT=8080 SERVE_UI=true
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/apps/ui/dist/ apps/ui/dist/
COPY --from=build --chown=node:node /app/apps/server/dist/ apps/server/dist/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js", "--production"]
