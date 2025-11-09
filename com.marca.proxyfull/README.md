# Proxy → Full (Illustrator CEP extension)

The **Proxy → Full** extension accelerates relinking Illustrator documents that were assembled with low-resolution proxy assets. The panel inspects every placed item, tests configurable mapping rules (folder, filename suffix, or both), and relinks only the assets you confirm. All work happens asynchronously so Illustrator stays responsive even on large documents.

## Features

- CEP panel compatible with Illustrator CC 2019–2025 (CEP 10–12).
- Dry-run mode that resolves proxy paths without applying changes.
- One-click relink once the panel finds valid full-resolution counterparts.
- Desktop logging in both CSV and JSON formats for auditing.
- Configurable folder and suffix mappings via `utils/pathMap.js`.
- Works on both macOS (Intel + Apple Silicon under Rosetta/Native) and Windows.

## Prerequisites

- Illustrator CC 2019 or newer.
- CEP runtime debugging enabled (see below).
- Node.js 18+ for running the helper build/watch scripts (optional but recommended during development).

## Installation

1. Clone or copy the `com.marca.proxyfull` folder into your CEP extensions directory.
   - **macOS:** `~/Library/Application Support/Adobe/CEP/extensions`
   - **Windows:** `%APPDATA%/Adobe/CEP/extensions`
2. Ensure the folder name remains `com.marca.proxyfull`.
3. Start Illustrator and enable the panel from `Window → Extensions (Legacy) → Proxy → Full`.

> **Tip:** You can use `npm run build` to create a ready-to-install copy inside `dist/com.marca.proxyfull`. Point the CEP extensions directory to this folder (or copy it manually).

## Enabling CEP debug mode

Illustrator only loads unsigned panels when debug mode is on.

### macOS

1. Quit Illustrator.
2. Run in Terminal:
   ```bash
   defaults write com.adobe.CSXS.10 PlayerDebugMode 1
   defaults write com.adobe.CSXS.11 PlayerDebugMode 1
   defaults write com.adobe.CSXS.12 PlayerDebugMode 1
   ```
3. Relaunch Illustrator.

### Windows

1. Quit Illustrator.
2. Create (or edit) the registry values in `HKEY_CURRENT_USER/Software/Adobe/CSXS.10` (and `.11`, `.12`).
3. For each key, set `PlayerDebugMode` (String) to `1`.
4. Restart Illustrator.

## Development workflow

```bash
cd com.marca.proxyfull
npm install
npm run dev
```

- `npm run dev` watches the extension directory and rebuilds into `dist/com.marca.proxyfull`. Set the environment variable `CEP_EXTENSIONS_DIR` (and/or `PROXYFULL_DEPLOY`) to copy every build straight into Illustrator’s extensions folder for instant reloads.
- `npm run build` performs a single copy into `dist/com.marca.proxyfull` and optionally deploys to any paths supplied through the same environment variables.

Example (macOS):
```bash
export CEP_EXTENSIONS_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
npm run build
```

Example (Windows PowerShell):
```powershell
$env:CEP_EXTENSIONS_DIR = "$env:APPDATA/Adobe/CEP/extensions"
npm run build
```

## Configuration (`utils/pathMap.js`)

Edit `utils/pathMap.js` to describe how proxy locations map to production assets. You can combine folder-based rules with filename suffix replacements:

```js
folders: [
  { source: "/Volumes/PROXY", target: "/Volumes/FULL" },
  { source: "Z:/Projects/Proxy", target: "Z:/Projects/Full" }
],
suffixes: [
  { suffix: "_proxy", replacement: "_full" },
  { suffix: "-proxy", replacement: "" }
]
```

Set `defaultMode` to `mixed`, `folder`, or `suffix`. The panel reflects the default at load and lets you switch per dry-run.

## Using the panel

1. Open a document that contains linked proxy assets.
2. Launch the panel (`Window → Extensions (Legacy) → Proxy → Full`).
3. Click **Refresh Links** to list all placed items. Embedded content is detected automatically.
4. Choose a resolution mode (folder/suffix/mixed) and run **Dry run**. The panel evaluates rules asynchronously and displays proposed paths.
5. Review the table. The **Auto-select missing links** toggle selects missing items for faster dry-runs.
6. When the status reads **Ready**, press **Relink selected**. Only rows with confirmed, existing targets are processed.
7. Click **Open latest log** to view CSV/JSON summaries saved to `Desktop/ProxyFull Logs`.

## Sample document structure

A typical proxy project might look like:

```
/Volumes/PROXY/Project/
├─ layout.ai (links proxy files)
├─ imagery/
│  ├─ hero_proxy.psd
│  ├─ pattern_proxy.jpg
└─ vectors/
   └─ logo_proxy.svg

/Volumes/FULL/Project/
├─ imagery/
│  ├─ hero_full.psd
│  ├─ pattern_full.jpg
└─ vectors/
   └─ logo_full.svg
```

With the folder rule `/Volumes/PROXY → /Volumes/FULL` and suffix rule `_proxy → _full`, the panel resolves paths automatically.

## Testing and verification

- Confirm the panel loads under Illustrator CC 2019, 2020, 2021, 2022, 2023, 2024, and 2025 (CEP 10–12). The manifest targets host `ILST` with runtime compatibility `[10,12]`.
- Test on macOS (Intel + Apple Silicon) and Windows. The build scripts support both platforms via environment variables.
- Large documents: operations run through async host calls so Illustrator UI stays responsive. Dry-runs only compute suggestions; relink operations are executed in small batches to avoid blocking.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Panel does not appear in Illustrator | Ensure `PlayerDebugMode` is set for CSXS 10–12 and the extension folder sits inside the CEP extensions directory. Restart Illustrator. |
| Buttons disabled with “CEP runtime unavailable” | The panel must run inside Illustrator (or another CEP host). Launch Illustrator and reopen the panel. |
| Dry run returns “No path map configured” | Edit `utils/pathMap.js` and reload the panel so the ExtendScript host picks up new rules. |
| Relink fails even though files exist | Verify the target filesystem is mounted. Check the generated CSV/JSON log for the exact paths attempted. |
| Apple Silicon reports CEP incompatibility | Illustrator 2021+ ships a Universal CEP runtime. Ensure Illustrator runs natively; otherwise launch in Rosetta and install the extension again. |

## Logging

Each dry run and relink writes both CSV and JSON files to `~/Desktop/ProxyFull Logs` (macOS) or `%USERPROFILE%/Desktop/ProxyFull Logs` (Windows). Use the **Open latest log** button to jump to the folder.

## Uninstallation

Delete the `com.marca.proxyfull` folder from the CEP extensions directory and restart Illustrator.
