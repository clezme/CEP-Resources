import chokidar from "chokidar";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildScript = path.join(__dirname, "build.mjs");
const watchRoot = path.resolve(__dirname, "..");

let running = false;
let queued = false;

function runBuild() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  const child = spawn(process.execPath, [buildScript], {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    running = false;
    if (queued) {
      queued = false;
      runBuild();
    }
    if (code !== 0) {
      console.error(`Build script exited with code ${code}`);
    }
  });
}

console.log("Watching for changes. Press Ctrl+C to exit.");
runBuild();

const watcher = chokidar.watch(watchRoot, {
  ignoreInitial: true,
  ignored: [
    /(^|[/\\])\../,
    /node_modules/,
    /dist/,
    /logs[/\\]runtime/
  ],
});

watcher.on("all", (event, changedPath) => {
  console.log(`[${event}] ${path.relative(watchRoot, changedPath)}`);
  runBuild();
});

process.on("SIGINT", () => {
  watcher.close();
  process.exit(0);
});
