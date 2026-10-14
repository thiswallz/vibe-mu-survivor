# Build from App (the npm workspace root). No original client or converters needed.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/ui/ apps/ui/
COPY packages/game/ packages/game/
COPY tests/ tests/
COPY apps/server/ apps/server/
RUN node --test tests/*.test.mjs && node apps/ui/build.mjs

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=:: PORT=8080 SERVE_UI=true
COPY --from=build --chown=node:node /app/apps/ui/dist/ apps/ui/dist/
COPY --from=build --chown=node:node /app/apps/server/ apps/server/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/src/index.mjs", "--production"]
