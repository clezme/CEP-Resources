const state = {
  items: [],
  selection: new Set(),
  map: null,
  lastDryRun: null,
  hasCEP: typeof window.__adobe_cep__ !== "undefined",
  cs: null,
};

const elements = {
  docStatus: document.getElementById("docStatus"),
  mapSummary: document.getElementById("mapSummary"),
  modeSelect: document.getElementById("modeSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  dryRunBtn: document.getElementById("dryRunBtn"),
  relinkBtn: document.getElementById("relinkBtn"),
  selectMissing: document.getElementById("selectMissing"),
  toggleAllBtn: document.getElementById("toggleAllBtn"),
  openLogBtn: document.getElementById("openLogBtn"),
  tbody: document.getElementById("itemsTbody"),
  spinner: document.getElementById("spinner"),
  toastContainer: document.getElementById("toastContainer"),
};

function createCSInterface() {
  try {
    if (typeof CSInterface !== "undefined") {
      return new CSInterface();
    }
  } catch (err) {
    console.warn("Unable to instantiate CSInterface", err);
  }

  const cep = window.__adobe_cep__;
  if (!cep) {
    return null;
  }

  const safeCall = (fn, fallback) => {
    try {
      return fn();
    } catch (error) {
      console.error(error);
      if (typeof fallback === "function") {
        return fallback(error);
      }
      return fallback;
    }
  };

  return {
    evalScript(script, callback) {
      safeCall(
        () => {
          cep.evalScript(script, (result) => {
            if (typeof callback === "function") {
              callback(result);
            }
          });
        },
        () => {
          if (typeof callback === "function") {
            callback("EvalScript error.");
          }
        }
      );
    },
    openURLInDefaultBrowser(url) {
      safeCall(() => cep.openURLInDefaultBrowser(url));
    },
    addEventListener(name, handler) {
      safeCall(() => cep.addEventListener(name, handler));
    },
    removeEventListener(name, handler) {
      safeCall(() => cep.removeEventListener(name, handler));
    },
  };
}

function initialiseInterface() {
  state.cs = createCSInterface();

  if (!state.cs || !state.hasCEP) {
    elements.docStatus.textContent = "CEP runtime unavailable. Use Illustrator to run this panel.";
    disableControls(true);
    return;
  }

  disableControls(false);
  attachListeners();
  refreshLinks();
}

function disableControls(flag) {
  const disabled = !!flag;
  [
    elements.refreshBtn,
    elements.dryRunBtn,
    elements.relinkBtn,
    elements.toggleAllBtn,
    elements.openLogBtn,
    elements.modeSelect,
    elements.selectMissing,
  ].forEach((el) => {
    if (el) {
      el.disabled = disabled;
    }
  });
}

function attachListeners() {
  elements.refreshBtn.addEventListener("click", () => refreshLinks());
  elements.dryRunBtn.addEventListener("click", () => runDry());
  elements.relinkBtn.addEventListener("click", () => applyRelink());
  elements.toggleAllBtn.addEventListener("click", toggleAllSelection);
  elements.selectMissing.addEventListener("change", handleAutoSelectMissing);
  elements.openLogBtn.addEventListener("click", openLogFolder);
  elements.modeSelect.addEventListener("change", () => {
    if (state.lastDryRun) {
      runDry();
    }
  });
}

async function refreshLinks() {
  await withSpinner(async () => {
    const response = await callHost("getLinkedItems");
    if (!response.ok) {
      throw new Error(response.message || "Unable to read document links");
    }
    const data = response.data || {};
    state.items = Array.isArray(data.items) ? data.items : [];
    state.map = data.map || null;
    state.selection.clear();
    state.lastDryRun = null;
    elements.openLogBtn.disabled = true;
    updateModeFromMap();
    renderMapSummary();
    renderDocumentStatus();
    renderTable();
    toast(`Loaded ${state.items.length} linked item${state.items.length === 1 ? "" : "s"}.`, "success");
  });
}

function updateModeFromMap() {
  if (!state.map || !state.map.defaultMode) {
    return;
  }
  const option = String(state.map.defaultMode).toLowerCase();
  const valid = ["mixed", "folder", "suffix"];
  if (valid.indexOf(option) !== -1) {
    elements.modeSelect.value = option;
  }
}

function renderMapSummary() {
  if (!state.map) {
    elements.mapSummary.textContent = "Edit utils/pathMap.js to provide folder/suffix mappings.";
    return;
  }
  const parts = [];
  if (Array.isArray(state.map.folders) && state.map.folders.length) {
    parts.push(`${state.map.folders.length} folder rule${state.map.folders.length === 1 ? "" : "s"}`);
  }
  if (Array.isArray(state.map.suffixes) && state.map.suffixes.length) {
    parts.push(`${state.map.suffixes.length} suffix rule${state.map.suffixes.length === 1 ? "" : "s"}`);
  }
  if (!parts.length) {
    parts.push("No rules configured");
  }
  elements.mapSummary.textContent = `${parts.join(", ")} (${elements.modeSelect.value})`;
}

function renderDocumentStatus() {
  if (!state.items.length) {
    elements.docStatus.textContent = "No linked items detected in the active document.";
  } else {
    const missing = state.items.filter((item) => item.missing).length;
    const embedded = state.items.filter((item) => item.isEmbedded).length;
    const missingBadge = missing
      ? ` · Missing: ${missing}`
      : "";
    const embeddedBadge = embedded
      ? ` · Embedded: ${embedded}`
      : "";
    elements.docStatus.textContent = `${state.items.length} linked item${state.items.length === 1 ? "" : "s"}${missingBadge}${embeddedBadge}`;
  }
}

function renderTable() {
  const tbody = elements.tbody;
  tbody.innerHTML = "";
  if (!state.items.length) {
    const row = document.createElement("tr");
    row.className = "empty";
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Open a document with linked artwork to begin.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement("tr");
    row.dataset.id = item.id;
    if (state.selection.has(item.id)) {
      row.classList.add("selected");
    }

    const selectCell = document.createElement("td");
    selectCell.className = "col-select";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selection.has(item.id);
    checkbox.addEventListener("change", () => toggleRowSelection(item.id, checkbox.checked));
    selectCell.appendChild(checkbox);

    const nameCell = document.createElement("td");
    nameCell.textContent = item.name || "(Unnamed)";
    if (item.layer) {
      const note = document.createElement("div");
      note.className = "pf-note";
      note.textContent = `Layer: ${item.layer}`;
      nameCell.appendChild(note);
    }

    const currentCell = document.createElement("td");
    currentCell.textContent = item.currentPath || (item.isEmbedded ? "Embedded asset" : "(Not linked)");

    const proposedCell = document.createElement("td");
    if (item.resolvedPath) {
      proposedCell.textContent = item.resolvedPath;
    } else if (item.status === "embedded") {
      proposedCell.textContent = "Embedded – no relink";
    } else {
      proposedCell.textContent = "Run a dry run to see suggestions.";
      proposedCell.classList.add("pf-note");
    }

    const statusCell = document.createElement("td");
    let statusText = item.status || (item.missing ? "Missing" : "Linked");
    let statusClass = "status-good";
    if (statusText === "candidate-found") {
      statusText = "Ready";
      statusClass = "status-good";
    } else if (statusText === "candidate-missing") {
      statusText = "Suggestion missing";
      statusClass = "status-warn";
    } else if (statusText === "embedded") {
      statusText = "Embedded";
      statusClass = "status-warn";
    } else if (statusText === "no-match") {
      statusText = "No rule match";
      statusClass = "status-bad";
    } else if (item.missing) {
      statusClass = "status-bad";
    }
    statusCell.textContent = statusText;
    statusCell.classList.add(statusClass);

    row.appendChild(selectCell);
    row.appendChild(nameCell);
    row.appendChild(currentCell);
    row.appendChild(proposedCell);
    row.appendChild(statusCell);

    row.addEventListener("click", (evt) => {
      if (evt.target instanceof HTMLInputElement) {
        return;
      }
      const currentlySelected = state.selection.has(item.id);
      toggleRowSelection(item.id, !currentlySelected);
      checkbox.checked = state.selection.has(item.id);
    });

    tbody.appendChild(row);
  });
}

function toggleRowSelection(id, checked) {
  if (checked) {
    state.selection.add(id);
  } else {
    state.selection.delete(id);
  }
  renderTable();
}

function toggleAllSelection() {
  const shouldSelectAll = state.selection.size !== state.items.length;
  state.selection.clear();
  if (shouldSelectAll) {
    state.items.forEach((item) => state.selection.add(item.id));
  }
  renderTable();
}

function handleAutoSelectMissing() {
  if (!elements.selectMissing.checked) {
    return;
  }
  state.selection.clear();
  state.items.forEach((item) => {
    if (item.missing || item.status === "candidate-found") {
      state.selection.add(item.id);
    }
  });
  renderTable();
}

async function runDry() {
  if (!state.selection.size) {
    state.selection.clear();
    state.items.forEach((item) => {
      if (item.missing) {
        state.selection.add(item.id);
      }
    });
  }
  const ids = Array.from(state.selection);
  const mode = elements.modeSelect.value;
  if (!ids.length) {
    toast("Select at least one linked item to analyse.", "error");
    return;
  }
  await withSpinner(async () => {
    const payload = { ids, mode };
    const response = await callHost("dryRunResolve", payload);
    if (!response.ok) {
      throw new Error(response.message || "Dry run failed");
    }
    const entries = response.data.entries || [];
    state.lastDryRun = entries;
    const byId = new Map();
    entries.forEach((entry) => {
      byId.set(entry.id, entry);
    });
    state.items = state.items.map((item) => {
      const entry = byId.get(item.id);
      return entry ? Object.assign({}, item, entry) : item;
    });
    renderTable();
    renderDocumentStatus();
    toast(`Dry run completed for ${entries.length} item${entries.length === 1 ? "" : "s"}.`, "success");
    if (response.data.log && response.data.log.json) {
      elements.openLogBtn.disabled = false;
    }
  });
}

async function applyRelink() {
  if (!state.lastDryRun) {
    toast("Run a dry run before relinking.", "error");
    return;
  }
  const ready = state.lastDryRun.filter((entry) => entry.status === "candidate-found");
  if (!ready.length) {
    toast("No ready-to-relink items found. Confirm dry run suggestions first.", "error");
    return;
  }
  await withSpinner(async () => {
    const response = await callHost("applyRelink", {
      mode: elements.modeSelect.value,
      entries: ready,
    });
    if (!response.ok) {
      throw new Error(response.message || "Relink failed");
    }
    const data = response.data;
    toast(`Relinked ${data.relinked} of ${data.processed} item${data.processed === 1 ? "" : "s"}.`, data.failures && data.failures.length ? "error" : "success");
    if (Array.isArray(data.failures) && data.failures.length) {
      console.warn("Relink failures", data.failures);
    }
    await refreshLinks();
  });
}

async function openLogFolder() {
  if (!state.cs) {
    toast("CEP runtime unavailable.", "error");
    return;
  }
  try {
    const response = await callHost("toDesktopLog");
    if (!response.ok) {
      throw new Error(response.message || "Unable to locate log folder");
    }
    const path = response.data.path;
    if (!path) {
      throw new Error("No log folder path returned");
    }
    state.cs.openURLInDefaultBrowser(`file://${path}`);
  } catch (error) {
    toast(error.message || String(error), "error");
  }
}

function callHost(functionName, payload) {
  return new Promise((resolve, reject) => {
    if (!state.cs) {
      reject(new Error("CSInterface is not available."));
      return;
    }
    let command = `${functionName}(`;
    if (typeof payload !== "undefined") {
      const json = JSON.stringify(payload);
      command += JSON.stringify(json);
    }
    command += ")";
    state.cs.evalScript(command, (result) => {
      if (!result || result === "undefined" || result === "EvalScript error.") {
        resolve({ ok: false, message: "Empty response from host" });
        return;
      }
      try {
        const parsed = JSON.parse(result);
        resolve(parsed);
      } catch (parseError) {
        resolve({ ok: false, message: "Failed to parse host response", raw: result });
      }
    });
  });
}

async function withSpinner(task) {
  try {
    showSpinner(true);
    await task();
  } catch (error) {
    console.error(error);
    toast(error.message || String(error), "error");
  } finally {
    showSpinner(false);
  }
}

function showSpinner(show) {
  if (!elements.spinner) return;
  elements.spinner.hidden = !show;
}

let toastCounter = 0;
function toast(message, type = "success", duration = 4000) {
  if (!elements.toastContainer) {
    return;
  }
  toastCounter += 1;
  const id = `toast-${toastCounter}`;
  const toastEl = document.createElement("div");
  toastEl.id = id;
  toastEl.className = `pf-toast pf-toast-${type}`;
  toastEl.textContent = message;
  elements.toastContainer.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(-8px)";
    setTimeout(() => toastEl.remove(), 220);
  }, duration);
}

initialiseInterface();
