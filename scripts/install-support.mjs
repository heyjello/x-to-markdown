import { access, cp, rm } from "node:fs/promises";
import path from "node:path";

export const SUPPORTED_PLATFORMS = ["claude", "codex", "cursor"];

const PLATFORM_DESTINATIONS = {
  claude: [".claude", "skills", "x-to-markdown"],
  codex: [".agents", "skills", "x-to-markdown"],
  cursor: [".cursor", "skills", "x-to-markdown"],
};

export function parseInstallArgs(argv) {
  const options = {
    platforms: [...SUPPORTED_PLATFORMS],
    force: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--force" || arg === "-f") {
      options.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--platform" || arg === "-p") {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      options.platforms = parsePlatforms(value);
      continue;
    }
    if (arg.startsWith("--platform=")) {
      options.platforms = parsePlatforms(arg.slice("--platform=".length));
      continue;
    }
    throw new Error(`Unknown install option: ${arg}`);
  }

  return options;
}

function parsePlatforms(value) {
  const rawPlatforms = value.split(",").map((item) => item.trim()).filter(Boolean);
  const platforms = rawPlatforms.includes("all") ? SUPPORTED_PLATFORMS : rawPlatforms;
  const unsupported = platforms.filter((platform) => !SUPPORTED_PLATFORMS.includes(platform));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported platform: ${unsupported.join(", ")}. Use claude, codex, cursor, or all.`
    );
  }
  return [...new Set(platforms)];
}

export function getPlatformDestinations(platforms, homeDir) {
  return platforms.map((platform) => ({
    platform,
    destination: path.join(homeDir, ...PLATFORM_DESTINATIONS[platform]),
  }));
}

export async function installSkill({ source, destination, force, dryRun }) {
  const exists = await pathExists(destination);

  if (dryRun) {
    return { action: exists ? "would-update" : "would-install", destination };
  }

  if (exists && !force) {
    throw new Error(`${destination} already exists. Re-run with --force to replace it.`);
  }

  if (exists) {
    await rm(destination, { recursive: true, force: true });
  }

  await cp(source, destination, { recursive: true });
  return { action: exists ? "updated" : "installed", destination };
}

export async function installForPlatforms({ packageRoot, homeDir, platforms, force, dryRun }) {
  const source = path.join(packageRoot, "skills", "x-to-markdown");
  const results = [];

  for (const { platform, destination } of getPlatformDestinations(platforms, homeDir)) {
    const result = await installSkill({ source, destination, force, dryRun });
    results.push({ platform, ...result });
  }

  return results;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function printInstallUsage() {
  return `Install x-to-markdown as an agent skill

Usage:
  x-to-markdown install [options]

Options:
  --platform <name>   claude, codex, cursor, or all. Default: all
  --force, -f         Replace an existing installed skill folder
  --dry-run           Show what would be installed without writing files
  --help, -h

Examples:
  x-to-markdown install --platform claude
  x-to-markdown install --platform codex,cursor
  x-to-markdown install --platform all --force
`;
}
