FROM node:22-alpine AS deps
WORKDIR /package
RUN apk add --no-cache openssl

COPY packages/core packages/core
COPY packages/server-core packages/server-core
COPY packages/ui packages/ui
COPY packages/config packages/config
COPY local/package*.json local/

WORKDIR /package/local
RUN npm install

FROM node:22-alpine AS migration-deps
WORKDIR /migration
COPY local/prisma-runtime/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /package
RUN apk add --no-cache openssl

ARG APP_RELEASE_VERSION=
ARG APP_BUILD_SHA=
ARG APP_VERSION=
ARG APP_VERSION_TOKEN=
ENV APP_RELEASE_VERSION=${APP_RELEASE_VERSION}
ENV APP_BUILD_SHA=${APP_BUILD_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV APP_VERSION_TOKEN=${APP_VERSION_TOKEN}

COPY --from=deps /package/local/node_modules local/node_modules
RUN ln -s local/node_modules node_modules
COPY packages/core packages/core
COPY packages/server-core packages/server-core
COPY packages/ui packages/ui
COPY packages/config packages/config
COPY local local

WORKDIR /package/local
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG APP_RELEASE_VERSION=
ARG APP_BUILD_SHA=
ARG APP_VERSION=
ARG APP_VERSION_TOKEN=
ENV APP_RELEASE_VERSION=${APP_RELEASE_VERSION}
ENV APP_BUILD_SHA=${APP_BUILD_SHA}
ENV APP_VERSION=${APP_VERSION}
ENV APP_VERSION_TOKEN=${APP_VERSION_TOKEN}
RUN apk add --no-cache openssl

COPY --from=builder /package/local/.next/standalone ./
COPY --from=migration-deps /migration/node_modules /opt/prisma-runtime/node_modules
COPY --from=builder /package/local/.next/static local/.next/static
COPY --from=builder /package/local/public local/public
COPY --from=builder /package/local/prisma.config.ts local/prisma.config.ts
COPY --from=builder /package/local/prisma local/prisma
RUN if [ ! -e node_modules ] && [ -d local/node_modules ]; then ln -s local/node_modules node_modules; fi

WORKDIR /app/local
EXPOSE 3000
CMD ["sh", "-c", "NODE_PATH=/opt/prisma-runtime/node_modules /opt/prisma-runtime/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js"]
