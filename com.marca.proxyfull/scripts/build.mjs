import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const distRoot = path.join(extensionRoot, "dist");
const distTarget = path.join(distRoot, "com.marca.proxyfull");

async function clean() {
  await fs.remove(distTarget);
  await fs.ensureDir(distTarget);
}

function createFilter(root) {
  const exclusions = [
    "node_modules",
    "dist",
    ".git",
    ".DS_Store",
    "logs/runtime"
  ];
  return (src) => {
    const rel = path.relative(root, src);
    if (!rel) {
      return true;
    }
    if (exclusions.some((item) => rel === item || rel.startsWith(`${item}${path.sep}`))) {
      return false;
    }
    return true;
  };
}

async function copyToDist() {
  await fs.copy(extensionRoot, distTarget, {
    filter: createFilter(extensionRoot),
    overwrite: true,
    errorOnExist: false,
  });
}

async function copyToDeployTargets() {
  const destinations = [];
  if (process.env.CEP_EXTENSIONS_DIR) {
    destinations.push(process.env.CEP_EXTENSIONS_DIR);
  }
  if (process.env.PROXYFULL_DEPLOY) {
    destinations.push(process.env.PROXYFULL_DEPLOY);
  }
  if (destinations.length === 0) {
    return;
  }
  await Promise.all(
    destinations.map(async (destination) => {
      const target = path.join(destination, "com.marca.proxyfull");
      await fs.ensureDir(destination);
      await fs.remove(target);
      await fs.copy(distTarget, target, { overwrite: true });
      return target;
    })
  );
}

async function main() {
  await clean();
  await copyToDist();
  await copyToDeployTargets();
  console.log(`Built extension → ${distTarget}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
