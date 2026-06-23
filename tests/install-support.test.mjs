import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  getPlatformDestinations,
  installSkill,
  parseInstallArgs,
} from "../scripts/install-support.mjs";

test("parseInstallArgs defaults to all platforms", () => {
  assert.deepEqual(parseInstallArgs([]), {
    platforms: ["claude", "codex", "cursor"],
    force: false,
    dryRun: false,
    help: false,
  });
});

test("parseInstallArgs accepts a single platform and flags", () => {
  assert.deepEqual(parseInstallArgs(["--platform", "cursor", "--force", "--dry-run"]), {
    platforms: ["cursor"],
    force: true,
    dryRun: true,
    help: false,
  });
});

test("getPlatformDestinations maps each platform to its user-level skill root", () => {
  const homeDir = "/tmp/example-home";

  assert.deepEqual(getPlatformDestinations(["claude", "codex", "cursor"], homeDir), [
    { platform: "claude", destination: "/tmp/example-home/.claude/skills/x-to-markdown" },
    { platform: "codex", destination: "/tmp/example-home/.agents/skills/x-to-markdown" },
    { platform: "cursor", destination: "/tmp/example-home/.cursor/skills/x-to-markdown" },
  ]);
});

test("installSkill copies a skill folder and refuses overwrite unless forced", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "x-to-markdown-install-test-"));
  const source = path.join(root, "source-skill");
  const destination = path.join(root, "dest-skill");
  await mkdir(path.join(source, "scripts"), { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "---\nname: x-to-markdown\n---\n");
  await writeFile(path.join(source, "scripts", "main.ts"), "console.log('ok');\n");

  const first = await installSkill({ source, destination, force: false, dryRun: false });
  assert.equal(first.action, "installed");
  assert.equal(await readFile(path.join(destination, "SKILL.md"), "utf8"), "---\nname: x-to-markdown\n---\n");

  await assert.rejects(
    installSkill({ source, destination, force: false, dryRun: false }),
    /already exists/
  );

  await writeFile(path.join(source, "SKILL.md"), "---\nname: x-to-markdown\ndescription: forced\n---\n");
  const forced = await installSkill({ source, destination, force: true, dryRun: false });
  assert.equal(forced.action, "updated");
  assert.match(await readFile(path.join(destination, "SKILL.md"), "utf8"), /description: forced/);
});
