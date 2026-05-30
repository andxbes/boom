#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const buildsDir = path.join(root, "builds");
const profile = process.argv[2] || "preview";

function listLatestBuild() {
  const output = execSync(
    `npx eas-cli build:list -p android --status finished -e ${profile} --limit 1 --json --non-interactive`,
    { cwd: root, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
  );

  const builds = JSON.parse(output);
  if (!builds.length) {
    console.error(`No finished Android "${profile}" builds found.`);
    process.exit(1);
  }

  return builds[0];
}

async function main() {
  const build = listLatestBuild();
  const url = build.artifacts?.applicationArchiveUrl;

  if (!url) {
    console.error("Latest build has no downloadable APK artifact.");
    process.exit(1);
  }

  fs.mkdirSync(buildsDir, { recursive: true });

  const filename = `boom-${build.appVersion}-build${build.appBuildVersion}.apk`;
  const dest = path.join(buildsDir, filename);

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Download failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded: ${dest}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
