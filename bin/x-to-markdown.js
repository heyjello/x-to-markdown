#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import {
  installForPlatforms,
  parseInstallArgs,
  printInstallUsage,
} from "../scripts/install-support.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args[0] === "install") {
  await runInstall(args.slice(1));
} else {
  runConverter(args);
}

async function runInstall(argv) {
  let options;
  try {
    options = parseInstallArgs(argv);
  } catch (error) {
    console.error(`[x-to-markdown] ${error.message}`);
    console.error("");
    console.error(printInstallUsage());
    process.exit(2);
  }

  if (options.help) {
    console.log(printInstallUsage());
    return;
  }

  try {
    const results = await installForPlatforms({
      packageRoot,
      homeDir: process.env.HOME ?? process.env.USERPROFILE,
      ...options,
    });

    for (const result of results) {
      console.log(`[x-to-markdown] ${result.action} ${result.platform}: ${result.destination}`);
    }
  } catch (error) {
    console.error(`[x-to-markdown] ${error.message}`);
    process.exit(1);
  }
}

function runConverter(argv) {
  const scriptPath = path.join(packageRoot, "scripts", "main.ts");
  const result = spawnSync("bun", [scriptPath, ...argv], { stdio: "inherit" });

  if (result.error?.code === "ENOENT") {
    console.error("[x-to-markdown] Bun is required to run the converter.");
    console.error("[x-to-markdown] Install Bun from https://bun.sh, or use `x-to-markdown install` to install the agent skill only.");
    process.exit(127);
  }

  if (result.error) {
    console.error(`[x-to-markdown] Failed to run converter: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}
