FROM node:25-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --fund=false && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DISABLE_KEYTAR=1

COPY --chown=nonroot:nonroot --from=deps /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot package.json package-lock.json ./
COPY --chown=nonroot:nonroot index.js ./
COPY --chown=nonroot:nonroot src ./src
COPY --chown=nonroot:nonroot automation ./automation
COPY --chown=nonroot:nonroot artifacts ./artifacts

EXPOSE 3000

CMD ["index.js"]