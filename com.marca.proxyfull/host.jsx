#target illustrator
#include "./utils/pathMap.js"

var __proxyfullLastLog = null;

function __proxyfullStringify(value) {
  if (typeof JSON !== "undefined" && JSON.stringify) {
    return JSON.stringify(value);
  }
  function esc(str) {
    return '"' + String(str).replace(/[\\"\n\r\t\b\f]/g, function (ch) {
      switch (ch) {
        case "\\":
          return "\\\\";
        case '"':
          return '\\"';
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\t":
          return "\\t";
        case "\b":
          return "\\b";
        case "\f":
          return "\\f";
      }
      return ch;
    }) + '"';
  }
  function serialize(obj) {
    var type = typeof obj;
    if (obj === null) {
      return "null";
    }
    if (type === "number" || type === "boolean") {
      return String(obj);
    }
    if (type === "string") {
      return esc(obj);
    }
    if (obj instanceof Array) {
      var arr = [];
      for (var i = 0; i < obj.length; i++) {
        arr.push(serialize(obj[i]));
      }
      return "[" + arr.join(",") + "]";
    }
    var parts = [];
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue;
      }
      parts.push(esc(key) + ":" + serialize(obj[key]));
    }
    return "{" + parts.join(",") + "}";
  }
  return serialize(value);
}

function __proxyfullParse(json) {
  if (typeof JSON !== "undefined" && JSON.parse) {
    return JSON.parse(json);
  }
  return eval("(" + json + ")");
}

function __proxyfullOk(data) {
  return __proxyfullStringify({ ok: true, data: data });
}

function __proxyfullFail(message, details) {
  return __proxyfullStringify({ ok: false, message: message, details: details });
}

function __proxyfullNormalisePath(path) {
  if (!path) {
    return "";
  }
  return decodeURI(String(path)).replace(/\\\\/g, "/");
}

function __proxyfullPathExists(path) {
  if (!path) {
    return false;
  }
  var file = new File(path);
  return file.exists;
}

function __proxyfullEnsureDocument() {
  if (app.documents.length === 0) {
    throw new Error("No document is open.");
  }
  return app.activeDocument;
}

function __proxyfullDescribeItem(item) {
  var filePath = "";
  var exists = false;
  var isEmbedded = false;
  var linkStatus = "unknown";

  try {
    if (item.file) {
      filePath = item.file.fsName;
      exists = (new File(filePath)).exists;
    } else if (item.linkFilePath) {
      filePath = item.linkFilePath;
      exists = (new File(filePath)).exists;
    }
  } catch (ignored) {}

  if (item.typename === "PlacedItem") {
    try {
      isEmbedded = item.embedded === true;
    } catch (ignoredEmbed) {
      isEmbedded = !item.file;
    }
  }

  try {
    if (item.linkStatus) {
      linkStatus = String(item.linkStatus);
    }
  } catch (ignoredStatus) {}

  var displayName = item.name;
  if (!displayName && filePath) {
    var parts = filePath.split(/\\/).pop().split("/");
    displayName = parts[parts.length - 1];
  }

  return {
    id: String(item.id || item.uuid || item.name || item.index),
    typename: item.typename,
    name: displayName || "(Unnamed)",
    layer: item.layer ? item.layer.name : "",
    currentPath: __proxyfullNormalisePath(filePath),
    exists: exists,
    missing: !!filePath && !exists,
    isEmbedded: isEmbedded,
    linkStatus: linkStatus
  };
}

function getLinkedItems() {
  try {
    var doc = __proxyfullEnsureDocument();
    var items = [];
    var placed = doc.placedItems;
    for (var i = 0; i < placed.length; i++) {
      items.push(__proxyfullDescribeItem(placed[i]));
    }
    var rasters = doc.rasterItems;
    for (var r = 0; r < rasters.length; r++) {
      if (rasters[r].embedded) {
        var embedded = __proxyfullDescribeItem(rasters[r]);
        embedded.isEmbedded = true;
        embedded.currentPath = "";
        items.push(embedded);
      }
    }
    return __proxyfullOk({
      count: items.length,
      items: items,
      map: $.global.__proxyfullPathMap || null
    });
  } catch (error) {
    return __proxyfullFail(error.message, error);
  }
}

function __proxyfullEnsureMap() {
  var map = $.global.__proxyfullPathMap;
  if (!map) {
    throw new Error("No path map configured. Edit utils/pathMap.js.");
  }
  if (!map.folders) {
    map.folders = [];
  }
  if (!map.suffixes) {
    map.suffixes = [];
  }
  return map;
}

function __proxyfullResolveCandidate(originalPath, mode, map) {
  if (!originalPath) {
    return null;
  }
  var candidates = [];
  var normal = __proxyfullNormalisePath(originalPath);
  var i;

  if (mode === "folder" || mode === "mixed") {
    for (i = 0; i < map.folders.length; i++) {
      var rule = map.folders[i];
      if (!rule.source || !rule.target) {
        continue;
      }
      var normalSource = __proxyfullNormalisePath(rule.source);
      if (normal.toLowerCase().indexOf(normalSource.toLowerCase()) === 0) {
        var candidate = rule.target + normal.substring(normalSource.length);
        candidates.push({
          rule: "folder",
          description: rule.source + " → " + rule.target,
          path: candidate
        });
      }
    }
  }

  if (mode === "suffix" || mode === "mixed") {
    var slashIndex = normal.lastIndexOf("/");
    var dir = slashIndex >= 0 ? normal.substring(0, slashIndex + 1) : "";
    var filename = slashIndex >= 0 ? normal.substring(slashIndex + 1) : normal;
    for (i = 0; i < map.suffixes.length; i++) {
      var sRule = map.suffixes[i];
      if (!sRule || !sRule.suffix) {
        continue;
      }
      if (filename.toLowerCase().indexOf(sRule.suffix.toLowerCase(), filename.length - sRule.suffix.length) !== -1) {
        var replacement = sRule.replacement || "";
        var newName = filename.substring(0, filename.length - sRule.suffix.length) + replacement;
        candidates.push({
          rule: "suffix",
          description: filename + " → " + newName,
          path: dir + newName
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  for (i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (__proxyfullPathExists(c.path)) {
      c.exists = true;
      return c;
    }
  }

  var first = candidates[0];
  first.exists = false;
  return first;
}

function __proxyfullWriteLog(entries, mode, action) {
  try {
    var folder = new Folder(Folder.desktop.fsName + "/ProxyFull Logs");
    if (!folder.exists) {
      folder.create();
    }
    var timestamp = new Date();
    var stamp = timestamp.getFullYear() + "-" + ("0" + (timestamp.getMonth() + 1)).slice(-2) + "-" + ("0" + timestamp.getDate()).slice(-2) + "_" + ("0" + timestamp.getHours()).slice(-2) + ("0" + timestamp.getMinutes()).slice(-2) + ("0" + timestamp.getSeconds()).slice(-2);
    var base = folder.fsName + "/" + action + "_" + stamp;

    var jsonFile = new File(base + ".json");
    jsonFile.encoding = "UTF-8";
    jsonFile.open("w");
    jsonFile.write(__proxyfullStringify({
      action: action,
      mode: mode,
      entries: entries
    }));
    jsonFile.close();

    var csvFile = new File(base + ".csv");
    csvFile.encoding = "UTF-8";
    csvFile.open("w");
    csvFile.write("\"Name\",\"Current Path\",\"Resolved Path\",\"Result\"\n");
    for (var i = 0; i < entries.length; i++) {
      var row = entries[i];
      var nameValue = row.name ? String(row.name) : "";
      var statusValue = row.status ? String(row.status) : "";
      var csv = '\"' + nameValue.replace(/"/g, '""') + '\",\"' + (row.currentPath || "").replace(/"/g, '""') + '\",\"' + (row.resolvedPath || "").replace(/"/g, '""') + '\",\"' + statusValue.replace(/"/g, '""') + '\"\n';
      csvFile.write(csv);
    }
    csvFile.close();

    __proxyfullLastLog = {
      json: jsonFile.fsName,
      csv: csvFile.fsName,
      folder: folder.fsName
    };

    return __proxyfullLastLog;
  } catch (logError) {
    __proxyfullLastLog = null;
    return null;
  }
}

function dryRunResolve(payload) {
  try {
    var request = payload ? __proxyfullParse(payload) : {};
    var ids = request.ids || [];
    var mode = request.mode || "mixed";
    var doc = __proxyfullEnsureDocument();
    var map = __proxyfullEnsureMap();
    var result = [];
    var i;

    if (ids.length === 0) {
      for (i = 0; i < doc.placedItems.length; i++) {
        ids.push(String(doc.placedItems[i].id));
      }
    }

    for (i = 0; i < doc.placedItems.length; i++) {
      var item = doc.placedItems[i];
      var id = String(item.id);
      if (ids.indexOf(id) === -1) {
        continue;
      }
      var described = __proxyfullDescribeItem(item);
      if (!described.currentPath) {
        described.status = "embedded";
        described.resolvedPath = "";
        result.push(described);
        continue;
      }
      var candidate = __proxyfullResolveCandidate(described.currentPath, mode, map);
      if (!candidate) {
        described.status = "no-match";
        described.resolvedPath = "";
      } else {
        described.resolvedPath = __proxyfullNormalisePath(candidate.path);
        if (candidate.exists) {
          described.status = "candidate-found";
        } else {
          described.status = "candidate-missing";
        }
        described.rule = candidate.description;
      }
      result.push(described);
    }

    __proxyfullWriteLog(result, mode, "dry-run");

    return __proxyfullOk({
      mode: mode,
      entries: result,
      log: __proxyfullLastLog
    });
  } catch (error) {
    return __proxyfullFail(error.message, error);
  }
}

function applyRelink(payload) {
  try {
    var request = payload ? __proxyfullParse(payload) : {};
    var entries = request.entries || [];
    var mode = request.mode || "mixed";
    var doc = __proxyfullEnsureDocument();
    var successes = 0;
    var failures = [];

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || !entry.id || !entry.resolvedPath) {
        continue;
      }
      if (!__proxyfullPathExists(entry.resolvedPath)) {
        entry.status = "missing-target";
        failures.push({
          id: entry.id,
          name: entry.name,
          reason: "Resolved path not found",
          pathTried: entry.resolvedPath
        });
        continue;
      }
      var file = new File(entry.resolvedPath);
      var linked = null;
      for (var p = 0; p < doc.placedItems.length; p++) {
        var candidate = doc.placedItems[p];
        if (String(candidate.id) === String(entry.id)) {
          linked = candidate;
          break;
        }
      }
      if (!linked) {
        entry.status = "not-found";
        failures.push({
          id: entry.id,
          name: entry.name,
          reason: "Unable to locate placed item in document"
        });
        continue;
      }
      try {
        linked.relink(file);
        linked.update();
        entry.status = "relinked";
        successes++;
      } catch (relinkError) {
        entry.status = "failed";
        failures.push({
          id: entry.id,
          name: entry.name,
          reason: relinkError.message || "Relink failed",
          pathTried: entry.resolvedPath
        });
      }
    }

    var report = {
      mode: mode,
      processed: entries.length,
      relinked: successes,
      failures: failures
    };

    __proxyfullWriteLog(entries, mode, "relink");

    return __proxyfullOk(report);
  } catch (error) {
    return __proxyfullFail(error.message, error);
  }
}

function toDesktopLog() {
  try {
    var folder;
    if (__proxyfullLastLog && __proxyfullLastLog.folder) {
      folder = __proxyfullLastLog.folder;
    } else {
      folder = Folder.desktop.fsName + "/ProxyFull Logs";
    }
    var file = new File(folder);
    if (!file.exists) {
      file = new Folder(folder);
      if (!file.exists) {
        file.create();
      }
    }
    return __proxyfullOk({
      path: folder
    });
  } catch (error) {
    return __proxyfullFail(error.message, error);
  }
}
