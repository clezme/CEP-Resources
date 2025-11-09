/*
 * Proxy → Full path mapping configuration.
 *
 * Configure the rules that transform proxy asset locations into
 * production/full-resolution equivalents. The rules support three modes:
 *
 *  - "folder": replace leading folder segments (e.g. /Volumes/proxy → /Volumes/full).
 *  - "suffix": replace file-name suffixes (e.g. _PROXY.tif → _FULL.tif).
 *  - "mixed": try folder first, then suffix rules, and keep searching for
 *              the first existing file on disk.
 */
(function () {
  var map = {
    defaultMode: "mixed",
    notes: "Edit this file and reload the extension to adjust mappings.",
    folders: [
      {
        source: "/Volumes/PROXY",
        target: "/Volumes/FULL"
      },
      {
        source: "Z:/Projects/Proxy",
        target: "Z:/Projects/Full"
      }
    ],
    suffixes: [
      {
        suffix: "_proxy",
        replacement: "_full"
      },
      {
        suffix: "-proxy",
        replacement: ""
      }
    ]
  };

  function normaliseSlashes(value) {
    return value ? String(value).replace(/\\/g, "/") : "";
  }

  for (var i = 0; i < map.folders.length; i++) {
    map.folders[i].source = normaliseSlashes(map.folders[i].source);
    map.folders[i].target = normaliseSlashes(map.folders[i].target);
  }

  if (typeof map.defaultMode !== "string") {
    map.defaultMode = "mixed";
  }

  if (typeof $.global !== "undefined") {
    $.global.__proxyfullPathMap = map;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = map;
  }
})();
