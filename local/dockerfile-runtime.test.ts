import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const runnerStage = dockerfile.split("FROM node:22-alpine AS runner\n")[1];

describe("Docker runtime dependency boundary", () => {
  it("installs a lockfile-backed Prisma migration runtime in its own stage", () => {
    expect(dockerfile).toContain("FROM node:22-alpine AS migration-deps");
    expect(dockerfile).toContain("COPY local/prisma-runtime/package*.json ./");
    expect(dockerfile).toContain("RUN npm ci --omit=dev");
  });

  it("keeps the full build dependency tree out of the runner", () => {
    expect(runnerStage).toBeTruthy();
    expect(runnerStage).not.toContain("COPY --from=deps /package/local/node_modules");
    expect(runnerStage).toContain(
      "COPY --from=migration-deps /migration/node_modules /opt/prisma-runtime/node_modules"
    );
  });

  it("runs migrations before the standalone server with the isolated CLI", () => {
    expect(runnerStage).not.toContain("ENV NODE_PATH=");
    expect(runnerStage).toContain(
      "NODE_PATH=/opt/prisma-runtime/node_modules /opt/prisma-runtime/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js"
    );
  });
});
