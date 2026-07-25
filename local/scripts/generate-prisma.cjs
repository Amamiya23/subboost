const { execFileSync } = require("node:child_process");

const schema = process.env.SUBBOOST_RUNTIME === "workers" ? "prisma/schema-d1.prisma" : "prisma/schema.prisma";
const command = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(command, ["prisma", "generate", "--schema", schema], { stdio: "inherit" });
