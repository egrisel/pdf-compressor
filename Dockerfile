FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/runtime \
  && chown -R node:node /app

COPY --chown=node:node package*.json ./

FROM base AS dev
RUN npm install && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 3350
CMD ["node", "server/index.js"]

FROM base AS build
RUN npm install
COPY --chown=node:node . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
RUN npm install --omit=dev && chown -R node:node /app
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node server ./server
USER node
EXPOSE 3351
CMD ["node", "server/index.js"]
