const els = {};
const imageCache = new Map();
const DEFAULT_HF_CHAT_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_HF_MODEL = "Qwen/Qwen3-VL-8B-Instruct";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen3-vl:8b";
const LEGACY_DEFAULT_HF_MODELS = ["Qwen/Qwen2.5-VL-7B-Instruct"];
const LEGACY_DEFAULT_OLLAMA_URLS = ["http://localhost:11434"];
const LEGACY_DEFAULT_OLLAMA_MODELS = ["llama3.2", "llava", "llava:latest"];

const defaultState = {
  width: 1024,
  height: 1024,
  activeTool: "select",
  highLevel: "",
  background: "",
  styleMode: "none",
  aesthetics: "",
  lighting: "",
  medium: "",
  photo: "",
  artStyle: "",
  stylePalette: [],
  backgroundImage: null,
  backgroundBrightness: 70,
  elements: [],
  selectedId: null,
  llm: {
    provider: "ollama",
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaTextModel: DEFAULT_OLLAMA_MODEL,
    ollamaVisionModel: DEFAULT_OLLAMA_MODEL,
    hfEndpoint: DEFAULT_HF_CHAT_ENDPOINT,
    hfModel: DEFAULT_HF_MODEL,
    hfToken: ""
  }
};

let state = loadState();
let interaction = null;
let resizeObserver = null;
let inlineEditorOpen = false;
const canvasView = {
  baseScale: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
  minZoom: 0.2,
  maxZoom: 12,
  spaceDown: false
};
const sidebarState = loadSidebarState();

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindElements();
  applySidebarState(false);
  bindEvents();
  hydrateControls();
  updateStyleFields();
  updateProviderFields();
  ensureStarterElement();
  installAgentApi();
  const loadedAgentCommand = loadAgentCommandFromUrl();
  fitCanvasToShell();
  renderAll();
  setStatus(loadedAgentCommand ? "Agent command applied" : "Ready");
}

function bindElements() {
  [
    "workspace",
    "scenePanel",
    "inspectorPanel",
    "inlineBoxEditor",
    "inlineEditorTitle",
    "closeInlineEditor",
    "stage",
    "stageShell",
    "dropHint",
    "canvasWidth",
    "canvasHeight",
    "canvasReadout",
    "selectionReadout",
    "statusLine",
    "zoomOut",
    "zoomReadout",
    "zoomIn",
    "fitCanvas",
    "canvasLock",
    "toggleLeftSidebar",
    "toggleRightSidebar",
    "highLevel",
    "captureHighLevel",
    "background",
    "styleMode",
    "aesthetics",
    "lighting",
    "medium",
    "photo",
    "artStyle",
    "photoField",
    "artStyleField",
    "stylePalette",
    "addStyleColor",
    "chooseBackground",
    "clearBackground",
    "backgroundFile",
    "backgroundBrightness",
    "elementList",
    "addElement",
    "duplicateElement",
    "deleteElement",
    "elementSelector",
    "elementType",
    "elementTextField",
    "elementText",
    "elementDesc",
    "boxX",
    "boxY",
    "boxW",
    "boxH",
    "elementPalette",
    "addElementColor",
    "layerToBack",
    "layerBackward",
    "layerForward",
    "layerToFront",
    "llmProvider",
    "ollamaSettings",
    "ollamaUrl",
    "ollamaTextModel",
    "ollamaVisionModel",
    "testOllamaApi",
    "ollamaDiagnostics",
    "hfSettings",
    "hfEndpoint",
    "hfModel",
    "hfToken",
    "testHfApi",
    "llmDiagnostics",
    "enhancePrompt",
    "describeImage",
    "agentBrief",
    "designAgentLayout",
    "copyAgentLink",
    "agentCommand",
    "applyAgentCommand",
    "jsonOutput",
    "copyJson",
    "downloadJson",
    "importJson",
    "formatJson",
    "resetApp",
    "validationList"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.toggleLeftSidebar.addEventListener("click", () => toggleSidebar("left"));
  els.toggleRightSidebar.addEventListener("click", () => toggleSidebar("right"));

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  els.stage.addEventListener("pointerdown", onPointerDown);
  els.stage.addEventListener("pointermove", onPointerMove);
  els.stage.addEventListener("pointerup", onPointerUp);
  els.stage.addEventListener("pointercancel", onPointerUp);
  els.stage.addEventListener("dblclick", onStageDoubleClick);
  els.closeInlineEditor.addEventListener("click", closeInlineEditor);
  els.stageShell.addEventListener("wheel", onCanvasWheel, { passive: false });
  els.stageShell.addEventListener("pointerdown", onShellPointerDown);
  els.stageShell.addEventListener("pointermove", onShellPointerMove);
  els.stageShell.addEventListener("pointerup", onShellPointerUp);
  els.stageShell.addEventListener("pointercancel", onShellPointerUp);
  els.stageShell.addEventListener("keydown", onStageKeydown);
  els.stageShell.addEventListener("dragover", onDragOver);
  els.stageShell.addEventListener("dragleave", onDragLeave);
  els.stageShell.addEventListener("drop", onDropImage);
  window.addEventListener("keyup", onWindowKeyup);
  document.addEventListener("keydown", onDocumentKeydown);
  window.addEventListener("blur", () => {
    canvasView.spaceDown = false;
    updateHoverCursor();
  });

  resizeObserver = new ResizeObserver(fitCanvasToShell);
  resizeObserver.observe(els.stageShell);

  els.canvasWidth.addEventListener("change", () => updateCanvasDim("width", els.canvasWidth.value));
  els.canvasHeight.addEventListener("change", () => updateCanvasDim("height", els.canvasHeight.value));
  els.highLevel.addEventListener("input", () => updateField("highLevel", els.highLevel.value));
  els.captureHighLevel.addEventListener("click", captureHighLevelDescription);
  els.background.addEventListener("input", () => updateField("background", els.background.value));
  els.styleMode.addEventListener("change", () => {
    state.styleMode = els.styleMode.value;
    updateStyleFields();
    renderAll();
  });
  ["aesthetics", "lighting", "medium", "photo", "artStyle"].forEach((id) => {
    els[id].addEventListener("input", () => updateField(id, els[id].value));
  });

  els.addStyleColor.addEventListener("click", () => {
    state.stylePalette.push(nextPaletteColor(state.stylePalette.length));
    renderAll();
  });
  els.chooseBackground.addEventListener("click", () => els.backgroundFile.click());
  els.clearBackground.addEventListener("click", () => {
    state.backgroundImage = null;
    renderAll();
  });
  els.backgroundFile.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) readImageFile(file).then((image) => {
      state.backgroundImage = image;
      renderAll();
    });
    event.target.value = "";
  });
  els.backgroundBrightness.addEventListener("input", () => {
    state.backgroundBrightness = Number(els.backgroundBrightness.value);
    renderAll();
  });

  els.zoomOut.addEventListener("click", () => zoomCanvasBy(1 / 1.2));
  els.zoomIn.addEventListener("click", () => zoomCanvasBy(1.2));
  els.fitCanvas.addEventListener("click", () => {
    resetCanvasView();
    setStatus("Canvas fit");
  });
  els.canvasLock.addEventListener("click", toggleCanvasLock);

  els.addElement.addEventListener("click", () => {
    const element = createElement({
      x: 0.16,
      y: 0.16,
      w: 0.28,
      h: 0.22,
      type: state.activeTool === "text" ? "text" : "obj"
    });
    state.elements.push(element);
    state.selectedId = element.id;
    setTool("select");
    renderAll();
  });
  els.duplicateElement.addEventListener("click", duplicateSelected);
  els.deleteElement.addEventListener("click", deleteSelected);
  els.elementSelector.addEventListener("change", () => {
    state.selectedId = els.elementSelector.value || null;
    renderAll();
  });
  els.elementType.addEventListener("change", updateSelectedFromControls);
  els.elementText.addEventListener("input", updateSelectedFromControls);
  els.elementDesc.addEventListener("input", updateSelectedFromControls);
  ["boxX", "boxY", "boxW", "boxH"].forEach((id) => {
    els[id].addEventListener("change", updateSelectedBoxFromPixels);
  });
  els.addElementColor.addEventListener("click", () => {
    const selected = getSelectedElement();
    if (!selected) return;
    selected.palette.push(nextPaletteColor(selected.palette.length));
    renderAll();
  });
  els.layerToBack.addEventListener("click", () => moveSelectedLayer("back"));
  els.layerBackward.addEventListener("click", () => moveSelectedLayer("backward"));
  els.layerForward.addEventListener("click", () => moveSelectedLayer("forward"));
  els.layerToFront.addEventListener("click", () => moveSelectedLayer("front"));

  els.llmProvider.addEventListener("change", () => {
    state.llm.provider = els.llmProvider.value;
    updateProviderFields();
    saveState();
  });
  [
    "ollamaUrl",
    "ollamaTextModel",
    "ollamaVisionModel",
    "hfEndpoint",
    "hfModel",
    "hfToken"
  ].forEach((id) => {
    els[id].addEventListener("input", () => {
      state.llm[id] = els[id].value;
      saveState();
    });
  });
  els.enhancePrompt.addEventListener("click", enhancePrompt);
  els.describeImage.addEventListener("click", describeImage);
  els.testOllamaApi.addEventListener("click", testOllamaApi);
  els.testHfApi.addEventListener("click", testHuggingFaceApi);
  els.designAgentLayout.addEventListener("click", designAgentLayoutFromBrief);
  els.copyAgentLink.addEventListener("click", copyAgentLink);
  els.applyAgentCommand.addEventListener("click", () => {
    try {
      const command = JSON.parse(els.agentCommand.value);
      applyAgentCommand(command);
      setStatus("Agent command applied");
    } catch (error) {
      setStatus(error.message || "Agent command error");
    }
  });
  window.addEventListener("message", onAgentMessage);

  els.copyJson.addEventListener("click", copyJson);
  els.downloadJson.addEventListener("click", downloadJson);
  els.importJson.addEventListener("click", importJsonFromOutput);
  els.formatJson.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(els.jsonOutput.value);
      els.jsonOutput.value = JSON.stringify(parsed, null, 4);
      setStatus("Formatted JSON");
    } catch (error) {
      setStatus("JSON parse error");
    }
  });
  els.resetApp.addEventListener("click", resetApp);
}

function hydrateControls() {
  els.canvasWidth.value = state.width;
  els.canvasHeight.value = state.height;
  els.highLevel.value = state.highLevel;
  els.background.value = state.background;
  els.styleMode.value = state.styleMode;
  els.aesthetics.value = state.aesthetics;
  els.lighting.value = state.lighting;
  els.medium.value = state.medium;
  els.photo.value = state.photo;
  els.artStyle.value = state.artStyle;
  els.backgroundBrightness.value = state.backgroundBrightness;
  els.llmProvider.value = state.llm.provider;
  els.ollamaUrl.value = state.llm.ollamaUrl;
  els.ollamaTextModel.value = state.llm.ollamaTextModel;
  els.ollamaVisionModel.value = state.llm.ollamaVisionModel;
  els.hfEndpoint.value = state.llm.hfEndpoint;
  els.hfModel.value = state.llm.hfModel;
  els.hfToken.value = state.llm.hfToken;
  setTool(state.activeTool);
}

function ensureStarterElement() {
  if (state.elements.length) return;
  state.elements.push(createElement({
    x: 0.12,
    y: 0.16,
    w: 0.32,
    h: 0.28,
    desc: "main subject",
    palette: ["#147D75"]
  }));
  state.selectedId = state.elements[0].id;
}

function createElement(overrides = {}) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `box-${Date.now()}-${Math.random()}`,
    type: "obj",
    x: 0.1,
    y: 0.1,
    w: 0.25,
    h: 0.2,
    text: "",
    desc: "",
    palette: [],
    locked: false,
    imageDataUrl: "",
    imageName: "",
    ...overrides
  };
}

function loadSidebarState() {
  try {
    const saved = JSON.parse(localStorage.getItem("ideogram-json-studio-sidebars") || "null");
    return {
      left: Boolean(saved && saved.left),
      right: Boolean(saved && saved.right)
    };
  } catch (error) {
    return { left: false, right: false };
  }
}

function saveSidebarState() {
  try {
    localStorage.setItem("ideogram-json-studio-sidebars", JSON.stringify(sidebarState));
  } catch (error) {
    // Sidebar visibility is a convenience preference; ignore storage failures.
  }
}

function toggleSidebar(side) {
  sidebarState[side] = !sidebarState[side];
  applySidebarState(true);
  saveSidebarState();
}

function applySidebarState(refitCanvas = true) {
  const leftCollapsed = Boolean(sidebarState.left);
  const rightCollapsed = Boolean(sidebarState.right);

  els.workspace.classList.toggle("is-left-collapsed", leftCollapsed);
  els.workspace.classList.toggle("is-right-collapsed", rightCollapsed);
  els.scenePanel.hidden = leftCollapsed;
  els.inspectorPanel.hidden = rightCollapsed;

  updateSidebarToggle(
    els.toggleLeftSidebar,
    leftCollapsed,
    "scene controls"
  );
  updateSidebarToggle(
    els.toggleRightSidebar,
    rightCollapsed,
    "prompt and output controls"
  );

  if (refitCanvas) {
    requestAnimationFrame(() => fitCanvasToShell(false));
  }
}

function updateSidebarToggle(button, collapsed, label) {
  const action = collapsed ? "Expand" : "Collapse";
  button.classList.toggle("is-collapsed", collapsed);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  button.setAttribute("aria-label", `${action} ${label}`);
  button.title = `${action} ${label}`;
}

function openInlineEditor(element) {
  if (!element) return;
  state.selectedId = element.id;
  inlineEditorOpen = true;
  setTool("select");
  renderAll();
  setStatus(`Editing box ${elementIndexLabel(element)}`);
  requestAnimationFrame(() => {
    const selected = getSelectedElement();
    if (!selected || !inlineEditorOpen) return;
    const field = selected.type === "text" ? els.elementText : els.elementDesc;
    field.focus();
    if (field.select) field.select();
  });
}

function closeInlineEditor() {
  inlineEditorOpen = false;
  updateInlineBoxEditor();
}

function updateInlineBoxEditor() {
  const selected = getSelectedElement();
  const visible = Boolean(inlineEditorOpen && selected);
  els.inlineBoxEditor.classList.toggle("is-hidden", !visible);
  updateLayerControls(selected);
  if (!visible) return;

  els.inlineEditorTitle.textContent = `${elementIndexLabel(selected)}. ${selected.type === "text" ? "Text" : "Object"}`;
  els.elementTextField.classList.toggle("is-hidden", selected.type !== "text");
  positionInlineBoxEditor();
}

function positionInlineBoxEditor() {
  const selected = getSelectedElement();
  if (!inlineEditorOpen || !selected || els.inlineBoxEditor.classList.contains("is-hidden")) return;

  const shell = els.stageShell;
  const shellRect = shell.getBoundingClientRect();
  const stageRect = els.stage.getBoundingClientRect();
  const rect = rectPx(selected);
  const boxLeft = stageRect.left - shellRect.left + rect.x / state.width * stageRect.width;
  const boxTop = stageRect.top - shellRect.top + rect.y / state.height * stageRect.height;
  const boxWidth = rect.w / state.width * stageRect.width;

  const editorWidth = els.inlineBoxEditor.offsetWidth || 320;
  const editorHeight = els.inlineBoxEditor.offsetHeight || 240;
  const margin = 10;
  const toolbarClearance = 58;
  let left = boxLeft + boxWidth + 12;
  if (left + editorWidth > shell.clientWidth - margin) {
    left = boxLeft - editorWidth - 12;
  }
  left = clamp(left, margin, Math.max(margin, shell.clientWidth - editorWidth - margin));
  const top = clamp(boxTop, toolbarClearance, Math.max(toolbarClearance, shell.clientHeight - editorHeight - margin));

  els.inlineBoxEditor.style.left = `${Math.round(left)}px`;
  els.inlineBoxEditor.style.top = `${Math.round(top)}px`;
}

function updateLayerControls(selected = getSelectedElement()) {
  const index = selected ? state.elements.findIndex((element) => element.id === selected.id) : -1;
  const hasSelection = index >= 0;
  const atBack = !hasSelection || index === 0;
  const atFront = !hasSelection || index === state.elements.length - 1;
  els.layerToBack.disabled = atBack;
  els.layerBackward.disabled = atBack;
  els.layerForward.disabled = atFront;
  els.layerToFront.disabled = atFront;
}

function moveSelectedLayer(direction) {
  const selected = getSelectedElement();
  if (!selected) return;
  const from = state.elements.findIndex((element) => element.id === selected.id);
  if (from < 0) return;

  let to = from;
  if (direction === "back") to = 0;
  if (direction === "backward") to = Math.max(0, from - 1);
  if (direction === "forward") to = Math.min(state.elements.length - 1, from + 1);
  if (direction === "front") to = state.elements.length - 1;
  if (to === from) return;

  state.elements.splice(from, 1);
  state.elements.splice(to, 0, selected);
  renderAll();
  setStatus(`Layer ${elementIndexLabel(selected)} of ${state.elements.length}`);
}

function setTool(tool) {
  state.activeTool = tool;
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  updateHoverCursor();
  saveState();
}

function toggleCanvasLock() {
  const selected = getSelectedElement();
  if (!selected) {
    setStatus("Select a box first");
    return;
  }
  toggleElementLock(selected);
}

function updateCanvasLockUi() {
  if (!els.canvasLock) return;
  const selected = getSelectedElement();
  const locked = Boolean(selected && selected.locked);
  els.canvasLock.classList.toggle("is-active", locked);
  els.canvasLock.disabled = !selected;
  els.canvasLock.setAttribute("aria-pressed", locked ? "true" : "false");
  els.canvasLock.title = locked ? "Unlock selected box" : "Lock selected box";
  els.canvasLock.setAttribute("aria-label", locked ? "Unlock selected box" : "Lock selected box");
  els.stageShell.classList.toggle("has-locked-boxes", state.elements.some((element) => element.locked));
}

function updateField(key, value) {
  state[key] = value;
  renderAll();
}

function updateCanvasDim(key, value) {
  const normalized = clamp(roundToMultiple(Number(value) || 1024, 16), 64, 16384);
  state[key] = normalized;
  els[key === "width" ? "canvasWidth" : "canvasHeight"].value = normalized;
  fitCanvasToShell(true);
  renderAll();
}

function updateStyleFields() {
  els.photoField.classList.toggle("is-hidden", state.styleMode !== "photo");
  els.artStyleField.classList.toggle("is-hidden", state.styleMode !== "art_style");
}

function updateProviderFields() {
  els.ollamaSettings.classList.toggle("is-hidden", state.llm.provider !== "ollama");
  els.hfSettings.classList.toggle("is-hidden", state.llm.provider !== "huggingface");
}

function fitCanvasToShell(resetView = false) {
  const shell = els.stageShell;
  const maxW = Math.max(160, shell.clientWidth - 28);
  const maxH = Math.max(160, shell.clientHeight - 28);
  canvasView.baseScale = Math.min(maxW / state.width, maxH / state.height);
  els.stage.width = state.width;
  els.stage.height = state.height;
  if (resetView) {
    canvasView.zoom = 1;
    canvasView.panX = 0;
    canvasView.panY = 0;
  }
  clampCanvasPan();
  applyCanvasViewport();
  drawCanvas();
}

function resetCanvasView() {
  canvasView.zoom = 1;
  canvasView.panX = 0;
  canvasView.panY = 0;
  applyCanvasViewport();
}

function applyCanvasViewport() {
  const cssW = Math.max(1, state.width * canvasView.baseScale * canvasView.zoom);
  const cssH = Math.max(1, state.height * canvasView.baseScale * canvasView.zoom);
  els.stage.style.width = `${cssW}px`;
  els.stage.style.height = `${cssH}px`;
  els.stage.style.transform = `translate(-50%, -50%) translate(${canvasView.panX}px, ${canvasView.panY}px)`;
  updateZoomReadout();
  updateHoverCursor();
  positionInlineBoxEditor();
}

function updateZoomReadout() {
  if (!els.zoomReadout) return;
  els.zoomReadout.textContent = `${Math.round(canvasView.zoom * 100)}%`;
}

function zoomCanvasBy(factor, clientX, clientY) {
  const shellRect = els.stageShell.getBoundingClientRect();
  const anchorX = clientX == null ? shellRect.left + shellRect.width / 2 : clientX;
  const anchorY = clientY == null ? shellRect.top + shellRect.height / 2 : clientY;
  zoomCanvasAt(anchorX, anchorY, factor);
}

function zoomCanvasAt(clientX, clientY, factor) {
  const stageRect = els.stage.getBoundingClientRect();
  const shellRect = els.stageShell.getBoundingClientRect();
  const ratioX = stageRect.width ? clamp((clientX - stageRect.left) / stageRect.width, 0, 1) : 0.5;
  const ratioY = stageRect.height ? clamp((clientY - stageRect.top) / stageRect.height, 0, 1) : 0.5;
  const nextZoom = clamp(canvasView.zoom * factor, canvasView.minZoom, canvasView.maxZoom);
  if (Math.abs(nextZoom - canvasView.zoom) < 0.001) return;

  canvasView.zoom = nextZoom;
  const nextW = state.width * canvasView.baseScale * canvasView.zoom;
  const nextH = state.height * canvasView.baseScale * canvasView.zoom;
  const shellCenterX = shellRect.left + shellRect.width / 2;
  const shellCenterY = shellRect.top + shellRect.height / 2;
  canvasView.panX = clientX - shellCenterX - (ratioX - 0.5) * nextW;
  canvasView.panY = clientY - shellCenterY - (ratioY - 0.5) * nextH;
  clampCanvasPan();
  applyCanvasViewport();
}

function clampCanvasPan() {
  if (!els.stageShell) return;
  const shell = els.stageShell;
  const cssW = state.width * canvasView.baseScale * canvasView.zoom;
  const cssH = state.height * canvasView.baseScale * canvasView.zoom;
  const minVisible = Math.min(96, Math.max(32, Math.min(cssW, cssH) * 0.3));
  const maxX = Math.max(0, (cssW + shell.clientWidth) / 2 - minVisible);
  const maxY = Math.max(0, (cssH + shell.clientHeight) / 2 - minVisible);
  canvasView.panX = clamp(canvasView.panX, -maxX, maxX);
  canvasView.panY = clamp(canvasView.panY, -maxY, maxY);
}

function onCanvasWheel(event) {
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? els.stageShell.clientHeight : 1);
  const factor = Math.exp(-delta * 0.0015);
  zoomCanvasBy(factor, event.clientX, event.clientY);
}

function renderAll() {
  hydrateSelectedControls();
  renderPalettes();
  renderElementSelector();
  renderElementList();
  renderJson();
  drawCanvas();
  updateCanvasLockUi();
  updateInlineBoxEditor();
  saveState();
  broadcastAgentChange();
}

function drawCanvas() {
  const canvas = els.stage;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackground(ctx);
  state.elements.forEach((element, index) => drawElement(ctx, element, index));
  if (interaction && interaction.kind === "draw" && interaction.draft) {
    drawElement(ctx, interaction.draft, state.elements.length, true);
  }
  updateReadouts();
}

function drawBackground(ctx) {
  ctx.fillStyle = "#151A18";
  ctx.fillRect(0, 0, state.width, state.height);

  if (state.backgroundImage && state.backgroundImage.dataUrl) {
    const image = getCachedImage(state.backgroundImage.dataUrl);
    if (image.complete) {
      drawImageCover(ctx, image, 0, 0, state.width, state.height);
      const alpha = 1 - state.backgroundBrightness / 100;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }
  } else {
    drawGrid(ctx);
  }
}

function drawGrid(ctx) {
  const step = Math.max(32, Math.round(Math.min(state.width, state.height) / 16));
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let y = 0; y <= state.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawElement(ctx, element, index, isDraft = false) {
  const rect = rectPx(element);
  const color = normalizeHex(element.palette[0]) || (element.type === "text" ? "#E35C3F" : "#147D75");
  const selected = element.id === state.selectedId && !isDraft;
  const label = `${String(index + 1).padStart(2, "0")} ${element.type === "text" ? "TXT" : "OBJ"}`;

  ctx.save();
  if (element.imageDataUrl) {
    const image = getCachedImage(element.imageDataUrl);
    if (image.complete) {
      ctx.save();
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
      ctx.clip();
      ctx.globalAlpha = 0.5;
      drawImageCover(ctx, image, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = isDraft ? "#F0B84A" : color;
  ctx.setLineDash(isDraft ? [10, 6] : []);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([]);

  if (element.palette.length) {
    drawPaletteStrip(ctx, element.palette, rect);
  }

  drawBoxLock(ctx, element, rect, color);

  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, Math.min(74, rect.w), 24);
  ctx.fillStyle = readableTextColor(color);
  ctx.font = `${Math.max(12, Math.round(state.height / 78))}px ${getUiFont()}`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + 6, rect.y + 12, Math.max(40, rect.w - 12));

  const body = element.type === "text" && element.text
    ? `"${element.text}" ${element.desc || ""}`.trim()
    : element.desc;
  if (body && rect.w > 36 && rect.h > 42) {
    ctx.fillStyle = selected ? "#FFFFFF" : tintForCanvas(color);
    ctx.font = `${Math.max(12, Math.round(state.height / 70))}px ${getUiFont()}`;
    drawWrappedText(ctx, body, rect.x + 8, rect.y + 34, rect.w - 16, rect.h - 40);
  }

  if (selected && !element.locked) {
    drawHandles(ctx, rect, color);
  }
  ctx.restore();
}

function drawBoxLock(ctx, element, rect, color) {
  const lock = getLockRect(rect);
  const locked = Boolean(element.locked);
  ctx.save();
  ctx.fillStyle = locked ? "rgba(31, 37, 35, 0.94)" : "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = locked ? "#FFFFFF" : color;
  ctx.lineWidth = Math.max(1.5, lock.size / 12);
  roundedRect(ctx, lock.x, lock.y, lock.size, lock.size, Math.max(3, lock.size / 5));
  ctx.fill();
  ctx.stroke();

  const cx = lock.x + lock.size / 2;
  const bodyW = lock.size * 0.46;
  const bodyH = lock.size * 0.33;
  const bodyX = cx - bodyW / 2;
  const bodyY = lock.y + lock.size * 0.48;
  ctx.strokeStyle = locked ? "#FFFFFF" : "#1F2523";
  ctx.fillStyle = locked ? "#FFFFFF" : "#1F2523";
  ctx.lineWidth = Math.max(1.6, lock.size / 11);
  ctx.strokeRect(bodyX, bodyY, bodyW, bodyH);

  ctx.beginPath();
  const shackleTop = lock.y + lock.size * 0.27;
  const shackleBottom = lock.y + lock.size * 0.52;
  const shackleHalfW = lock.size * 0.18;
  if (locked) {
    ctx.moveTo(cx - shackleHalfW, shackleBottom);
    ctx.lineTo(cx - shackleHalfW, shackleTop + lock.size * 0.08);
    ctx.quadraticCurveTo(cx, shackleTop - lock.size * 0.04, cx + shackleHalfW, shackleTop + lock.size * 0.08);
    ctx.lineTo(cx + shackleHalfW, shackleBottom);
  } else {
    ctx.moveTo(cx - shackleHalfW, shackleBottom);
    ctx.lineTo(cx - shackleHalfW, shackleTop + lock.size * 0.08);
    ctx.quadraticCurveTo(cx - lock.size * 0.02, shackleTop - lock.size * 0.04, cx + shackleHalfW, shackleTop + lock.size * 0.08);
    ctx.lineTo(cx + shackleHalfW + lock.size * 0.13, shackleBottom - lock.size * 0.04);
  }
  ctx.stroke();

  if (locked) {
    ctx.beginPath();
    ctx.arc(cx, bodyY + bodyH * 0.55, Math.max(1.2, lock.size * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPaletteStrip(ctx, palette, rect) {
  const colors = palette.map(normalizeHex).filter(Boolean).slice(0, 5);
  if (!colors.length) return;
  const h = Math.max(7, Math.round(state.height / 120));
  const w = rect.w / colors.length;
  colors.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(rect.x + index * w, rect.y, Math.ceil(w), h);
  });
}

function drawHandles(ctx, rect, color) {
  const handles = getHandles(rect);
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  Object.values(handles).forEach((point) => {
    ctx.beginPath();
    ctx.rect(point.x - point.size / 2, point.y - point.size / 2, point.size, point.size);
    ctx.fill();
    ctx.stroke();
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, maxHeight) {
  const words = text.split(/\s+/).filter(Boolean);
  const lineHeight = Math.max(14, Math.round(state.height / 58));
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY, maxWidth);
      cursorY += lineHeight;
      line = word;
      if (cursorY > y + maxHeight) return;
    } else {
      line = next;
    }
  }
  if (line && cursorY <= y + maxHeight) {
    ctx.fillText(line, x, cursorY, maxWidth);
  }
}

function onStageDoubleClick(event) {
  event.preventDefault();
  const hit = hitElement(canvasPoint(event), { includeLocked: true });
  if (!hit) {
    closeInlineEditor();
    return;
  }
  openInlineEditor(hit);
}

function onPointerDown(event) {
  els.stageShell.focus();
  if (shouldStartCanvasPan(event)) {
    closeInlineEditor();
    startCanvasPan(event);
    return;
  }
  if (event.button !== 0) return;

  closeInlineEditor();
  els.stage.setPointerCapture(event.pointerId);
  const point = canvasPoint(event);
  const lockHit = hitLockControl(point);
  if (lockHit) {
    toggleElementLock(lockHit.element);
    if (els.stage.hasPointerCapture && els.stage.hasPointerCapture(event.pointerId)) {
      els.stage.releasePointerCapture(event.pointerId);
    }
    return;
  }

  const selected = getSelectedElement();

  if (state.activeTool !== "select") {
    interaction = {
      kind: "draw",
      start: point,
      draft: createElement({
        id: "draft",
        type: state.activeTool === "text" ? "text" : "obj",
        x: point.x / state.width,
        y: point.y / state.height,
        w: 0,
        h: 0,
        palette: [state.activeTool === "text" ? "#E35C3F" : "#147D75"]
      })
    };
    drawCanvas();
    return;
  }

  if (selected && !selected.locked) {
    const handle = hitHandle(point, rectPx(selected));
    if (handle) {
      interaction = { kind: "resize", id: selected.id, handle, startRect: { ...selected }, start: point };
      return;
    }
  }

  const hit = hitElement(point, { includeLocked: false });
  if (hit) {
    inlineEditorOpen = false;
    state.selectedId = hit.id;
    interaction = { kind: "move", id: hit.id, startRect: { ...hit }, start: point };
    renderAll();
  } else {
    inlineEditorOpen = false;
    state.selectedId = null;
    interaction = null;
    renderAll();
  }
}

function onPointerMove(event) {
  if (interaction && interaction.kind === "pan") {
    updateCanvasPan(event);
    return;
  }
  const point = canvasPoint(event);
  if (!interaction) {
    updateHoverCursor(point);
    return;
  }

  if (interaction.kind === "draw") {
    const x = Math.min(interaction.start.x, point.x);
    const y = Math.min(interaction.start.y, point.y);
    const w = Math.abs(point.x - interaction.start.x);
    const h = Math.abs(point.y - interaction.start.y);
    Object.assign(interaction.draft, normalizeRect({ x, y, w, h }));
    drawCanvas();
    return;
  }

  const element = state.elements.find((item) => item.id === interaction.id);
  if (!element) return;
  if (element.locked) return;
  const dx = (point.x - interaction.start.x) / state.width;
  const dy = (point.y - interaction.start.y) / state.height;

  if (interaction.kind === "move") {
    element.x = clamp(interaction.startRect.x + dx, 0, 1 - Math.abs(element.w));
    element.y = clamp(interaction.startRect.y + dy, 0, 1 - Math.abs(element.h));
  }

  if (interaction.kind === "resize") {
    resizeElement(element, interaction.startRect, interaction.handle, dx, dy);
  }
  drawCanvas();
  hydrateSelectedControls();
  renderJson();
}

function onPointerUp(event) {
  if (interaction && interaction.kind === "pan") {
    finishCanvasPan(event);
    return;
  }
  if (els.stage.hasPointerCapture && els.stage.hasPointerCapture(event.pointerId)) {
    els.stage.releasePointerCapture(event.pointerId);
  }
  if (interaction && interaction.kind === "draw") {
    const rect = interaction.draft;
    if (Math.abs(rect.w) * state.width > 10 && Math.abs(rect.h) * state.height > 10) {
      rect.id = crypto.randomUUID ? crypto.randomUUID() : `box-${Date.now()}`;
      state.elements.push(rect);
      state.selectedId = rect.id;
      setTool("select");
    }
  }
  interaction = null;
  renderAll();
}

function onStageKeydown(event) {
  if (event.target !== els.stageShell) return;
  if (event.key === " ") {
    event.preventDefault();
    canvasView.spaceDown = true;
    updateHoverCursor();
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomCanvasBy(1.2);
    return;
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    zoomCanvasBy(1 / 1.2);
    return;
  }
  if (event.key === "0") {
    event.preventDefault();
    resetCanvasView();
    setStatus("Canvas fit");
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelected();
  }
  if (event.key === "Escape") {
    if (inlineEditorOpen) {
      closeInlineEditor();
      return;
    }
    state.selectedId = null;
    interaction = null;
    renderAll();
  }
}

function onWindowKeyup(event) {
  if (event.key !== " ") return;
  canvasView.spaceDown = false;
  updateHoverCursor();
}

function onDocumentKeydown(event) {
  if (event.key !== "Escape" || !inlineEditorOpen) return;
  if (!els.inlineBoxEditor.contains(event.target)) return;
  closeInlineEditor();
  els.stageShell.focus();
}

function shouldStartCanvasPan(event) {
  return event.button === 1 || (event.button === 0 && canvasView.spaceDown);
}

function onShellPointerDown(event) {
  if (event.target !== els.stageShell && event.target !== els.dropHint) return;
  if (event.button !== 0 && event.button !== 1) return;
  startCanvasPan(event);
}

function onShellPointerMove(event) {
  if (!interaction || interaction.kind !== "pan" || interaction.captureTarget !== els.stageShell) return;
  updateCanvasPan(event);
}

function onShellPointerUp(event) {
  if (!interaction || interaction.kind !== "pan" || interaction.captureTarget !== els.stageShell) return;
  finishCanvasPan(event);
}

function startCanvasPan(event) {
  event.preventDefault();
  const captureTarget = event.currentTarget || els.stageShell;
  if (captureTarget.setPointerCapture) {
    captureTarget.setPointerCapture(event.pointerId);
  }
  interaction = {
    kind: "pan",
    captureTarget,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: canvasView.panX,
    startPanY: canvasView.panY
  };
  setCanvasCursor("grabbing");
}

function updateCanvasPan(event) {
  canvasView.panX = interaction.startPanX + event.clientX - interaction.startClientX;
  canvasView.panY = interaction.startPanY + event.clientY - interaction.startClientY;
  clampCanvasPan();
  applyCanvasViewport();
}

function finishCanvasPan(event) {
  const captureTarget = interaction.captureTarget;
  if (captureTarget && captureTarget.hasPointerCapture && captureTarget.hasPointerCapture(event.pointerId)) {
    captureTarget.releasePointerCapture(event.pointerId);
  }
  interaction = null;
  updateHoverCursor();
}

function setCanvasCursor(cursor) {
  els.stage.style.cursor = cursor;
  els.stageShell.style.cursor = cursor;
}

function updateHoverCursor(point) {
  if (interaction && interaction.kind === "pan") {
    setCanvasCursor("grabbing");
    return;
  }
  if (canvasView.spaceDown) {
    setCanvasCursor("grab");
    return;
  }
  if (point && hitLockControl(point)) {
    setCanvasCursor("pointer");
    return;
  }
  if (state.activeTool !== "select") {
    setCanvasCursor("crosshair");
    return;
  }
  if (!point) {
    setCanvasCursor("default");
    return;
  }
  const selected = getSelectedElement();
  if (selected && !selected.locked) {
    const handle = hitHandle(point, rectPx(selected));
    if (handle) {
      setCanvasCursor(cursorForHandle(handle));
      return;
    }
  }
  if (hitElement(point, { includeLocked: false })) {
    setCanvasCursor("move");
    return;
  }
  setCanvasCursor(hitElement(point, { onlyLocked: true }) ? "not-allowed" : "default");
}

function onDragOver(event) {
  event.preventDefault();
  els.stageShell.classList.add("is-dropping");
}

function onDragLeave() {
  els.stageShell.classList.remove("is-dropping");
}

async function onDropImage(event) {
  event.preventDefault();
  els.stageShell.classList.remove("is-dropping");
  const file = Array.from(event.dataTransfer.files || []).find((item) => item.type.startsWith("image/"));
  if (!file) return;
  const image = await readImageFile(file);
  const point = canvasPoint(event);
  const aspect = image.width && image.height ? image.width / image.height : 1;
  const baseW = state.width * 0.32;
  const baseH = baseW / aspect;
  const size = fitRectInCanvas(baseW, baseH);
  const element = createElement({
    x: clamp((point.x - size.w / 2) / state.width, 0, 1 - size.w / state.width),
    y: clamp((point.y - size.h / 2) / state.height, 0, 1 - size.h / state.height),
    w: size.w / state.width,
    h: size.h / state.height,
    imageDataUrl: image.dataUrl,
    imageName: image.name,
    desc: stripExtension(image.name),
    palette: []
  });
  state.elements.push(element);
  state.selectedId = element.id;
  setTool("select");
  renderAll();
  setStatus(`Dropped ${image.name}`);
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({
        dataUrl,
        name: file.name,
        type: file.type,
        width: image.naturalWidth,
        height: image.naturalHeight
      });
      image.onerror = reject;
      image.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function hitElement(point, options = {}) {
  const includeLocked = options.includeLocked !== false;
  const onlyLocked = Boolean(options.onlyLocked);
  for (let index = state.elements.length - 1; index >= 0; index -= 1) {
    const element = state.elements[index];
    if (onlyLocked && !element.locked) continue;
    if (!includeLocked && element.locked) continue;
    const rect = rectPx(element);
    if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
      return element;
    }
  }
  return null;
}

function hitLockControl(point) {
  for (let index = state.elements.length - 1; index >= 0; index -= 1) {
    const element = state.elements[index];
    const rect = getLockRect(rectPx(element));
    if (point.x >= rect.x && point.x <= rect.x + rect.size && point.y >= rect.y && point.y <= rect.y + rect.size) {
      return { element, index };
    }
  }
  return null;
}

function toggleElementLock(element) {
  element.locked = !element.locked;
  state.selectedId = element.id;
  interaction = null;
  renderAll();
  setStatus(element.locked ? `Locked box ${elementIndexLabel(element)}` : `Unlocked box ${elementIndexLabel(element)}`);
}

function elementIndexLabel(element) {
  const index = state.elements.findIndex((item) => item.id === element.id);
  return index >= 0 ? index + 1 : "";
}

function hitHandle(point, rect) {
  const handles = getHandles(rect);
  for (const [name, handle] of Object.entries(handles)) {
    const half = handle.size * 0.75;
    if (Math.abs(point.x - handle.x) <= half && Math.abs(point.y - handle.y) <= half) {
      return name;
    }
  }
  return "";
}

function getHandles(rect) {
  const size = Math.max(9, Math.min(state.width, state.height) / 90);
  const midX = rect.x + rect.w / 2;
  const midY = rect.y + rect.h / 2;
  return {
    nw: { x: rect.x, y: rect.y, size },
    n: { x: midX, y: rect.y, size },
    ne: { x: rect.x + rect.w, y: rect.y, size },
    e: { x: rect.x + rect.w, y: midY, size },
    se: { x: rect.x + rect.w, y: rect.y + rect.h, size },
    s: { x: midX, y: rect.y + rect.h, size },
    sw: { x: rect.x, y: rect.y + rect.h, size },
    w: { x: rect.x, y: midY, size }
  };
}

function getLockRect(rect) {
  const size = Math.max(18, Math.min(30, Math.min(state.width, state.height) / 42));
  const inset = Math.max(4, size / 5);
  return {
    x: clamp(rect.x + rect.w - size - inset, rect.x + inset, rect.x + Math.max(inset, rect.w - size - inset)),
    y: rect.y + inset,
    size
  };
}

function cursorForHandle(handle) {
  return {
    nw: "nwse-resize",
    se: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize"
  }[handle] || "default";
}

function resizeElement(element, start, handle, dx, dy) {
  let x1 = start.x;
  let y1 = start.y;
  let x2 = start.x + start.w;
  let y2 = start.y + start.h;
  if (handle.includes("w")) x1 += dx;
  if (handle.includes("e")) x2 += dx;
  if (handle.includes("n")) y1 += dy;
  if (handle.includes("s")) y2 += dy;
  const minW = 12 / state.width;
  const minH = 12 / state.height;
  x1 = clamp(x1, 0, 1);
  y1 = clamp(y1, 0, 1);
  x2 = clamp(x2, 0, 1);
  y2 = clamp(y2, 0, 1);
  if (Math.abs(x2 - x1) < minW) x2 = x1 + Math.sign(x2 - x1 || 1) * minW;
  if (Math.abs(y2 - y1) < minH) y2 = y1 + Math.sign(y2 - y1 || 1) * minH;
  element.x = Math.min(x1, x2);
  element.y = Math.min(y1, y2);
  element.w = Math.abs(x2 - x1);
  element.h = Math.abs(y2 - y1);
}

function normalizeRect(rect) {
  return {
    x: clamp(rect.x / state.width, 0, 1),
    y: clamp(rect.y / state.height, 0, 1),
    w: clamp(rect.w / state.width, 0, 1),
    h: clamp(rect.h / state.height, 0, 1)
  };
}

function rectPx(element) {
  return {
    x: element.x * state.width,
    y: element.y * state.height,
    w: element.w * state.width,
    h: element.h * state.height
  };
}

function canvasPoint(event) {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width * state.width, 0, state.width),
    y: clamp((event.clientY - rect.top) / rect.height * state.height, 0, state.height)
  };
}

function hydrateSelectedControls() {
  const selected = getSelectedElement();
  const disabled = !selected;
  [
    "elementType",
    "elementText",
    "elementDesc",
    "boxX",
    "boxY",
    "boxW",
    "boxH",
    "addElementColor"
  ].forEach((id) => {
    els[id].disabled = disabled;
  });

  if (!selected) {
    els.elementType.value = "obj";
    els.elementText.value = "";
    els.elementDesc.value = "";
    els.boxX.value = "";
    els.boxY.value = "";
    els.boxW.value = "";
    els.boxH.value = "";
    return;
  }

  const rect = rectPx(selected);
  els.elementType.value = selected.type;
  els.elementText.value = selected.text || "";
  els.elementText.disabled = selected.type !== "text";
  els.elementDesc.value = selected.desc || "";
  els.boxX.value = Math.round(rect.x);
  els.boxY.value = Math.round(rect.y);
  els.boxW.value = Math.round(rect.w);
  els.boxH.value = Math.round(rect.h);
}

function updateSelectedFromControls() {
  const selected = getSelectedElement();
  if (!selected) return;
  selected.type = els.elementType.value;
  selected.text = els.elementText.value;
  selected.desc = els.elementDesc.value;
  renderAll();
}

function updateSelectedBoxFromPixels() {
  const selected = getSelectedElement();
  if (!selected) return;
  const x = clamp(Number(els.boxX.value) || 0, 0, state.width - 1);
  const y = clamp(Number(els.boxY.value) || 0, 0, state.height - 1);
  const w = clamp(Number(els.boxW.value) || 1, 1, state.width - x);
  const h = clamp(Number(els.boxH.value) || 1, 1, state.height - y);
  Object.assign(selected, {
    x: x / state.width,
    y: y / state.height,
    w: w / state.width,
    h: h / state.height
  });
  renderAll();
}

function renderPalettes() {
  renderPalette(els.stylePalette, state.stylePalette, (palette) => {
    state.stylePalette = palette;
    renderAll();
  });
  const selected = getSelectedElement();
  renderPalette(els.elementPalette, selected ? selected.palette : [], (palette) => {
    if (!selected) return;
    selected.palette = palette;
    renderAll();
  }, !selected);
}

function renderPalette(container, palette, onChange, disabled = false) {
  container.innerHTML = "";
  const colors = palette.map((color) => normalizeHex(color) || "#147D75");
  if (!colors.length) {
    const empty = document.createElement("span");
    empty.className = "field-label";
    empty.textContent = disabled ? "No selection" : "No colors";
    container.appendChild(empty);
    return;
  }
  colors.forEach((color, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "swatch";
    wrapper.style.background = color;
    const input = document.createElement("input");
    input.type = "color";
    input.value = color;
    input.disabled = disabled;
    input.title = color;
    input.addEventListener("input", () => {
      const next = [...colors];
      next[index] = normalizeHex(input.value) || input.value;
      onChange(next);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.title = "Remove color";
    remove.disabled = disabled;
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = colors.filter((_, colorIndex) => colorIndex !== index);
      onChange(next);
    });
    wrapper.append(input, remove);
    container.appendChild(wrapper);
  });
}

function renderElementSelector() {
  const current = state.selectedId || "";
  els.elementSelector.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = state.elements.length ? "No box selected" : "No boxes";
  els.elementSelector.appendChild(empty);

  state.elements.forEach((element, index) => {
    const option = document.createElement("option");
    option.value = element.id;
    option.textContent = elementOptionLabel(element, index);
    els.elementSelector.appendChild(option);
  });
  els.elementSelector.value = state.elements.some((element) => element.id === current) ? current : "";
}

function elementOptionLabel(element, index) {
  const label = element.type === "text" ? "Text" : "Object";
  const content = element.type === "text" && element.text ? element.text : element.desc || element.imageName || "empty";
  return `${index + 1}. ${element.locked ? "Locked " : ""}${label} - ${truncateText(content, 44)}`;
}

function renderElementList() {
  els.elementList.innerHTML = "";
  state.elements.forEach((element, index) => {
    const chip = document.createElement("div");
    chip.className = `element-chip${element.id === state.selectedId ? " is-selected" : ""}${element.locked ? " is-locked" : ""}`;
    chip.setAttribute("role", "button");
    chip.tabIndex = 0;
    chip.addEventListener("click", () => {
      state.selectedId = element.id;
      renderAll();
    });
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        state.selectedId = element.id;
        renderAll();
      }
    });

    const color = document.createElement("span");
    color.className = "chip-color";
    color.style.background = normalizeHex(element.palette[0]) || (element.type === "text" ? "#E35C3F" : "#147D75");

    const title = document.createElement("span");
    title.className = "chip-title";
    const strong = document.createElement("strong");
    strong.textContent = `${index + 1}. ${element.locked ? "Locked " : ""}${element.type === "text" ? "Text" : "Object"}`;
    const desc = document.createElement("span");
    desc.textContent = element.type === "text" && element.text ? element.text : element.desc || element.imageName || "empty";
    title.append(strong, desc);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "chip-delete";
    del.textContent = "x";
    del.title = "Delete";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      state.elements = state.elements.filter((item) => item.id !== element.id);
      if (state.selectedId === element.id) {
        state.selectedId = state.elements[0] ? state.elements[0].id : null;
      }
      renderAll();
    });

    chip.append(color, title, del);
    els.elementList.appendChild(chip);
  });
}

function renderJson() {
  const caption = buildCaption();
  els.jsonOutput.value = JSON.stringify(caption, null, 4);
  renderValidation(caption);
}

function buildCaption() {
  const caption = {};
  if (state.highLevel.trim()) {
    caption.high_level_description = state.highLevel.trim();
  }

  if (state.styleMode !== "none") {
    const style = {
      aesthetics: state.aesthetics,
      lighting: state.lighting
    };
    if (state.styleMode === "photo") {
      style.photo = state.photo;
      style.medium = state.medium;
    } else {
      style.medium = state.medium;
      style.art_style = state.artStyle;
    }
    const palette = cleanPalette(state.stylePalette);
    if (palette.length) {
      style.color_palette = palette;
    }
    caption.style_description = style;
  }

  caption.compositional_deconstruction = {
    background: state.background,
    elements: state.elements.map((element) => {
      const item = { type: element.type === "text" ? "text" : "obj" };
      item.bbox = normalizedBbox(element);
      if (item.type === "text") {
        item.text = element.text || "";
      }
      item.desc = element.desc || "";
      const palette = cleanPalette(element.palette).slice(0, 5);
      if (palette.length) {
        item.color_palette = palette;
      }
      return item;
    })
  };

  return caption;
}

function normalizedBbox(element) {
  const ymin = clamp(Math.round(element.y * 1000), 0, 1000);
  const xmin = clamp(Math.round(element.x * 1000), 0, 1000);
  const ymax = clamp(Math.round((element.y + element.h) * 1000), 0, 1000);
  const xmax = clamp(Math.round((element.x + element.w) * 1000), 0, 1000);
  return [Math.min(ymin, ymax), Math.min(xmin, xmax), Math.max(ymin, ymax), Math.max(xmin, xmax)];
}

function renderValidation(caption) {
  const messages = [];
  if (!caption.compositional_deconstruction.background.trim()) {
    messages.push("Background is empty.");
  }
  if (!state.elements.length) {
    messages.push("No elements are defined.");
  }
  if (state.styleMode !== "none" && !state.medium.trim()) {
    messages.push("Style mode is active but medium is empty.");
  }
  const overlapCount = countTextOverlaps();
  if (overlapCount) {
    messages.push(`${overlapCount} overlapping text box pair detected.`);
  }
  const invalidColors = findInvalidColors();
  if (invalidColors.length) {
    messages.push(`Invalid color values: ${invalidColors.join(", ")}.`);
  }

  els.validationList.innerHTML = "";
  if (!messages.length) {
    const ok = document.createElement("div");
    ok.className = "validation-item ok";
    ok.textContent = `${state.elements.length} elements, ${JSON.stringify(caption).length} JSON chars.`;
    els.validationList.appendChild(ok);
    return;
  }
  messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = "validation-item";
    item.textContent = message;
    els.validationList.appendChild(item);
  });
}

function countTextOverlaps() {
  const textElements = state.elements.filter((element) => element.type === "text");
  let count = 0;
  for (let i = 0; i < textElements.length; i += 1) {
    for (let j = i + 1; j < textElements.length; j += 1) {
      if (rectsOverlap(textElements[i], textElements[j])) count += 1;
    }
  }
  return count;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function findInvalidColors() {
  return [...state.stylePalette, ...state.elements.flatMap((element) => element.palette)]
    .filter((color) => color && !normalizeHex(color));
}

function importJsonFromOutput() {
  try {
    importCaption(JSON.parse(els.jsonOutput.value));
    setStatus("Imported JSON");
  } catch (error) {
    setStatus("JSON parse error");
  }
}

function importCaption(caption) {
  const style = caption.style_description || {};
  const comp = caption.compositional_deconstruction || {};
  state.highLevel = caption.high_level_description || "";
  state.background = comp.background || "";
  state.styleMode = style.photo !== undefined ? "photo" : style.art_style !== undefined ? "art_style" : "none";
  state.aesthetics = style.aesthetics || "";
  state.lighting = style.lighting || "";
  state.medium = style.medium || "";
  state.photo = style.photo || "";
  state.artStyle = style.art_style || "";
  state.stylePalette = cleanPalette(style.color_palette || []);
  state.elements = Array.isArray(comp.elements)
    ? comp.elements.map((item, index) => elementFromCaptionItem(item, index))
    : [];
  state.selectedId = state.elements[0] ? state.elements[0].id : null;
  hydrateControls();
  updateStyleFields();
  renderAll();
}

function elementFromCaptionItem(item, index) {
  const bbox = Array.isArray(item.bbox) && item.bbox.length === 4
    ? item.bbox
    : [50 + index * 25, 50 + index * 25, 240 + index * 25, 300 + index * 25];
  const [ymin, xmin, ymax, xmax] = bbox.map((value) => clamp(Number(value) || 0, 0, 1000));
  return createElement({
    type: item.type === "text" ? "text" : "obj",
    x: Math.min(xmin, xmax) / 1000,
    y: Math.min(ymin, ymax) / 1000,
    w: Math.max(0.01, Math.abs(xmax - xmin) / 1000),
    h: Math.max(0.01, Math.abs(ymax - ymin) / 1000),
    text: item.text || "",
    desc: item.desc || "",
    palette: cleanPalette(item.color_palette || [])
  });
}

function installAgentApi() {
  window.IdeogramStudioAgent = {
    version: "1.0.0",
    applyCommand: applyAgentCommand,
    applyLayout: applyAgentLayout,
    importCaption: (caption) => applyAgentLayout({ caption }),
    addElement: addAgentElement,
    clearElements: () => applyAgentCommand({ action: "clear" }),
    designLayout: (brief, options = {}) => {
      const layout = getAgentCore().createHeuristicLayout(brief, {
        width: state.width,
        height: state.height,
        ...options
      });
      applyAgentLayout(layout);
      return buildCaption();
    },
    getCaption: () => structuredClone(buildCaption()),
    getState: getAgentState
  };
}

function getAgentCore() {
  if (!window.IdeogramAgentCore) {
    throw new Error("Agent layout core is unavailable.");
  }
  return window.IdeogramAgentCore;
}

function loadAgentCommandFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("agent");
  if (!encoded) return false;
  try {
    const command = getAgentCore().decodeCommand(encoded);
    if (els.agentCommand) {
      els.agentCommand.value = JSON.stringify(command, null, 2);
    }
    applyAgentCommand(command);
    return true;
  } catch (error) {
    setStatus("Agent URL error");
    return false;
  }
}

function applyAgentCommand(command) {
  const payload = typeof command === "string" ? JSON.parse(command) : command;
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent command must be an object.");
  }
  const action = payload.action || (payload.layout || payload.caption ? "apply_layout" : "apply_layout");

  if (action === "design_layout") {
    const layout = getAgentCore().createHeuristicLayout(payload.brief || payload.prompt || "", {
      width: payload.width || state.width,
      height: payload.height || state.height,
      ...(payload.options || {})
    });
    return applyAgentLayout(layout);
  }

  if (action === "apply_layout" || action === "import_caption") {
    return applyAgentLayout(payload.layout || payload.caption || payload);
  }

  if (action === "set_scene") {
    setSceneFromAgent(payload);
    renderAll();
    return buildCaption();
  }

  if (action === "add_element") {
    return addAgentElement(payload.element || payload);
  }

  if (action === "replace_elements") {
    state.elements = (payload.elements || [])
      .map((item) => getAgentCore().normalizeElement(item))
      .filter(Boolean)
      .map((item, index) => elementFromCaptionItem(item, index));
    state.selectedId = state.elements[0] ? state.elements[0].id : null;
    renderAll();
    return buildCaption();
  }

  if (action === "clear") {
    state.elements = [];
    state.selectedId = null;
    renderAll();
    return buildCaption();
  }

  throw new Error(`Unknown agent action: ${action}`);
}

function applyAgentLayout(layout) {
  const core = getAgentCore();
  const normalized = core.normalizeLayout(layout || {});
  if (normalized.width) {
    state.width = clamp(roundToMultiple(Number(normalized.width), 16), 64, 16384);
  }
  if (normalized.height) {
    state.height = clamp(roundToMultiple(Number(normalized.height), 16), 64, 16384);
  }
  importCaption(core.captionFromLayout(normalized));
  hydrateControls();
  fitCanvasToShell(true);
  renderAll();
  return buildCaption();
}

function setSceneFromAgent(payload) {
  if (payload.width) state.width = clamp(roundToMultiple(Number(payload.width), 16), 64, 16384);
  if (payload.height) state.height = clamp(roundToMultiple(Number(payload.height), 16), 64, 16384);
  if (Object.prototype.hasOwnProperty.call(payload, "high_level_description")) {
    state.highLevel = payload.high_level_description || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "highLevel")) {
    state.highLevel = payload.highLevel || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "background")) {
    state.background = payload.background || "";
  }
  const style = payload.style_description || payload.styleDescription;
  if (style && typeof style === "object") {
    state.styleMode = Object.prototype.hasOwnProperty.call(style, "photo")
      ? "photo"
      : Object.prototype.hasOwnProperty.call(style, "art_style") || Object.prototype.hasOwnProperty.call(style, "artStyle")
        ? "art_style"
        : "none";
    state.aesthetics = style.aesthetics || "";
    state.lighting = style.lighting || "";
    state.medium = style.medium || "";
    state.photo = style.photo || "";
    state.artStyle = style.art_style || style.artStyle || "";
    state.stylePalette = cleanPalette(style.color_palette || style.colorPalette || []);
  }
  hydrateControls();
  updateStyleFields();
  fitCanvasToShell(true);
}

function addAgentElement(input) {
  const normalized = getAgentCore().normalizeElement(input);
  if (!normalized) throw new Error("Agent element is invalid.");
  const element = elementFromCaptionItem(normalized, state.elements.length);
  state.elements.push(element);
  state.selectedId = element.id;
  renderAll();
  return buildCaption();
}

function designAgentLayoutFromBrief() {
  try {
    const brief = els.agentBrief.value.trim() || state.highLevel || "structured Ideogram composition";
    const layout = getAgentCore().createHeuristicLayout(brief, {
      width: state.width,
      height: state.height,
      background: state.background || undefined,
      styleMode: state.styleMode === "none" ? "art_style" : state.styleMode,
      aesthetics: state.aesthetics || undefined,
      lighting: state.lighting || undefined,
      medium: state.medium || undefined,
      photo: state.photo || undefined,
      artStyle: state.artStyle || undefined,
      palette: state.stylePalette.length ? state.stylePalette : undefined
    });
    const command = getAgentCore().commandFromLayout(layout);
    els.agentCommand.value = JSON.stringify(command, null, 2);
    applyAgentLayout(layout);
    setStatus("Agent layout designed");
  } catch (error) {
    setStatus(error.message || "Layout design error");
  }
}

async function copyAgentLink() {
  try {
    const command = getAgentCore().commandFromLayout(exportAgentLayout());
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("agent", getAgentCore().encodeCommand(command));
    await navigator.clipboard.writeText(url.toString());
    els.agentCommand.value = JSON.stringify(command, null, 2);
    setStatus("Copied agent link");
  } catch (error) {
    setStatus(error.message || "Agent link error");
  }
}

function exportAgentLayout() {
  const caption = buildCaption();
  return {
    version: 1,
    width: state.width,
    height: state.height,
    high_level_description: caption.high_level_description || "",
    style_description: caption.style_description || null,
    compositional_deconstruction: caption.compositional_deconstruction
  };
}

function getAgentState() {
  return {
    ...structuredClone(state),
    llm: {
      ...state.llm,
      hfToken: state.llm.hfToken ? "__redacted__" : ""
    },
    caption: buildCaption()
  };
}

function onAgentMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.source && data.source !== "ideogram-agent") return;
  if (!data.action && !data.command && !data.layout && !data.caption) return;
  try {
    const result = applyAgentCommand(data.command || data);
    if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage({
        source: "ideogram-studio",
        id: data.id || null,
        ok: true,
        caption: result
      }, event.origin || "*");
    }
    setStatus("Agent command applied");
  } catch (error) {
    if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage({
        source: "ideogram-studio",
        id: data.id || null,
        ok: false,
        error: error.message || "Agent command error"
      }, event.origin || "*");
    }
    setStatus(error.message || "Agent command error");
  }
}

function broadcastAgentChange() {
  document.dispatchEvent(new CustomEvent("ideogram-studio:changed", {
    detail: {
      caption: buildCaption(),
      selectedId: state.selectedId,
      elementCount: state.elements.length
    }
  }));
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(els.jsonOutput.value);
    setStatus("Copied JSON");
  } catch (error) {
    els.jsonOutput.select();
    document.execCommand("copy");
    setStatus("Copied JSON");
  }
}

function downloadJson() {
  const blob = new Blob([els.jsonOutput.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ideogram4-caption.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded JSON");
}

function resetApp() {
  inlineEditorOpen = false;
  state = structuredClone(defaultState);
  localStorage.removeItem("ideogram-json-studio");
  imageCache.clear();
  hydrateControls();
  updateStyleFields();
  updateProviderFields();
  ensureStarterElement();
  fitCanvasToShell(true);
  renderAll();
  setStatus("Reset document");
}

function duplicateSelected() {
  const selected = getSelectedElement();
  if (!selected) return;
  const copy = createElement({
    ...structuredClone(selected),
    id: crypto.randomUUID ? crypto.randomUUID() : `box-${Date.now()}`,
    x: clamp(selected.x + 0.035, 0, 1 - selected.w),
    y: clamp(selected.y + 0.035, 0, 1 - selected.h)
  });
  state.elements.push(copy);
  state.selectedId = copy.id;
  renderAll();
}

function deleteSelected() {
  const selected = getSelectedElement();
  if (!selected) return;
  inlineEditorOpen = false;
  state.elements = state.elements.filter((element) => element.id !== selected.id);
  state.selectedId = state.elements[0] ? state.elements[0].id : null;
  renderAll();
}

async function enhancePrompt() {
  try {
    setBusy(true, "Enhancing prompt");
    const targets = getCheckedValues("enhanceTarget");
    const rewrite = getRewriteOptions();
    if (!targets.length) throw new Error("Choose at least one Enhance option.");

    if (targets.includes("selected")) {
      await enhanceSelectedElement(rewrite);
    }
    if (targets.includes("background")) {
      const response = await callTextLlm(buildEnhancePlainPrompt("background", state.background));
      state.background = cleanLlmText(response);
      els.background.value = state.background;
    }
    if (targets.includes("highLevel")) {
      const response = await callTextLlm(buildEnhancePlainPrompt("high-level image overview", state.highLevel));
      state.highLevel = cleanLlmText(response);
      els.highLevel.value = state.highLevel;
    }
    if (targets.includes("fullJson")) {
      const response = await callTextLlm(buildFullJsonPrompt(rewrite));
      const parsed = extractJson(response);
      importCaption(parsed);
    }
    renderAll();
    setStatus("Prompt updated");
  } catch (error) {
    setStatus(error.message || "LLM request failed");
  } finally {
    setBusy(false);
  }
}

async function enhanceSelectedElement(rewrite) {
  const selected = getSelectedElement();
  if (!selected) throw new Error("Select a box first.");
  if (!rewrite.desc && !rewrite.text && !rewrite.palette) {
    throw new Error("Choose at least one Rewrite option.");
  }
  if (selected.type !== "text" && rewrite.text && !rewrite.desc && !rewrite.palette) {
    throw new Error("Text rewrite only applies to text boxes.");
  }
  if (rewrite.desc && !rewrite.text && !rewrite.palette) {
    const response = await callTextLlm(buildEnhanceElementPrompt(selected, rewrite));
    selected.desc = cleanLlmText(response);
    return;
  }
  const response = await callTextLlm(buildEnhanceElementPrompt(selected, rewrite));
  applyElementRewrite(selected, extractJson(response));
}

async function captureHighLevelDescription() {
  try {
    setBusy(true, "Capturing high level");
    const imageSources = collectCanvasImageSources();
    if (!imageSources.length && !state.background.trim() && !state.highLevel.trim()) {
      throw new Error("Drop or load an image, or add a background description first.");
    }
    const prompt = buildHighLevelCapturePrompt(imageSources);
    const response = imageSources.length
      ? await callVisionLlmWithImages(imageSources.map((source) => source.dataUrl), prompt)
      : await callTextLlm(prompt);
    state.highLevel = cleanLlmText(response);
    els.highLevel.value = state.highLevel;
    renderAll();
    setStatus("High level captured");
  } catch (error) {
    setStatus(error.message || "High level capture failed");
  } finally {
    setBusy(false);
  }
}

async function describeImage() {
  try {
    setBusy(true, "Describing image");
    const focuses = getVisionFocuses();
    const rewrite = getRewriteOptions();
    const selected = getSelectedElement();
    const source = await getVisionSource(selected);
    if (!source) throw new Error("Drop or load an image first.");
    const response = await callVisionLlm(source, buildVisionPrompt(focuses, selected, rewrite));
    const text = cleanLlmText(response);
    if (focuses.length === 1 && focuses[0] === "background only") {
      state.background = text;
      els.background.value = text;
    } else if (selected) {
      if (!rewrite.desc && !rewrite.text && !rewrite.palette) {
        throw new Error("Choose at least one Rewrite option.");
      }
      if (selected.type !== "text" && rewrite.text && !rewrite.desc && !rewrite.palette) {
        throw new Error("Text rewrite only applies to text boxes.");
      }
      if (rewrite.desc && !rewrite.text && !rewrite.palette) {
        selected.desc = text;
      } else {
        applyElementRewrite(selected, extractJson(text));
      }
    } else {
      state.highLevel = text;
      els.highLevel.value = text;
    }
    renderAll();
    setStatus("Image description added");
  } catch (error) {
    setStatus(error.message || "Vision request failed");
  } finally {
    setBusy(false);
  }
}

function collectCanvasImageSources() {
  const sources = [];
  if (state.backgroundImage && state.backgroundImage.dataUrl) {
    sources.push({
      label: "background reference image",
      dataUrl: state.backgroundImage.dataUrl
    });
  }
  state.elements.forEach((element, index) => {
    if (!element.imageDataUrl) return;
    const rect = rectPx(element);
    sources.push({
      label: [
        `box ${index + 1}`,
        `${element.type === "text" ? "text" : "object"} element`,
        `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)}x${Math.round(rect.h)}`,
        element.text ? `text "${truncateText(element.text, 80)}"` : "",
        element.desc ? `description "${truncateText(element.desc, 120)}"` : ""
      ].filter(Boolean).join(" - "),
      dataUrl: element.imageDataUrl
    });
  });
  return sources;
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map((input) => input.value);
}

function defaultRewriteOptions() {
  return { desc: true, text: false, palette: false };
}

function getRewriteOptions() {
  const values = getCheckedValues("rewriteTarget");
  return {
    desc: values.includes("desc"),
    text: values.includes("text"),
    palette: values.includes("palette")
  };
}

function getVisionFocuses() {
  const values = getCheckedValues("visionFocus");
  return values.length ? values : ["whole image"];
}

function applyElementRewrite(element, payload) {
  if (!payload || typeof payload !== "object") return;
  if (typeof payload.desc === "string") {
    element.desc = cleanLlmText(payload.desc);
  }
  if (element.type === "text" && typeof payload.text === "string") {
    element.text = cleanLlmText(payload.text);
  }
  const palette = payload.color_palette || payload.palette;
  if (Array.isArray(palette)) {
    element.palette = cleanPalette(palette).slice(0, 5);
  }
}

function humanJoin(values) {
  const items = values.filter(Boolean);
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildEnhanceElementPrompt(element, rewrite = defaultRewriteOptions()) {
  if (rewrite.desc && !rewrite.text && !rewrite.palette) {
    return [
      "Rewrite this Ideogram 4 JSON element description.",
      "Return only one concise visual description, no markdown and no JSON.",
      "Keep concrete visual facts. Do not add impossible layout instructions.",
      `Element type: ${element.type}`,
      element.type === "text" ? `Literal rendered text: ${element.text || "(blank)"}` : "",
      `Current description: ${element.desc || "(blank)"}`,
      `Canvas background: ${state.background || "(blank)"}`
    ].filter(Boolean).join("\n");
  }
  const keys = [];
  if (rewrite.desc) keys.push('"desc": string');
  if (rewrite.text && element.type === "text") keys.push('"text": string');
  if (rewrite.palette) keys.push('"color_palette": ["#RRGGBB"]');
  return [
    "Rewrite selected fields for this Ideogram 4 JSON element.",
    `Return only valid JSON with these keys: ${keys.join(", ") || '"desc": string'}.`,
    "Do not include markdown fences or comments.",
    "Preserve any fields that are not requested.",
    "Keep concrete visual facts. Do not add impossible layout instructions.",
    "Use uppercase #RRGGBB colors for palettes.",
    `Element type: ${element.type}`,
    element.type === "text" ? `Literal rendered text: ${element.text || "(blank)"}` : "",
    `Current description: ${element.desc || "(blank)"}`,
    `Current palette: ${JSON.stringify(cleanPalette(element.palette))}`,
    `Canvas background: ${state.background || "(blank)"}`
  ].filter(Boolean).join("\n");
}

function buildEnhancePlainPrompt(label, value) {
  return [
    `Rewrite this Ideogram 4 ${label} for stronger image generation.`,
    "Return one concise prompt-ready phrase or sentence, no markdown and no JSON.",
    `Current value: ${value || "(blank)"}`
  ].join("\n");
}

function buildHighLevelCapturePrompt(imageSources) {
  const imageList = imageSources.length
    ? imageSources.map((source, index) => `${index + 1}. ${source.label}`).join("\n")
    : "(none; rely on the text fields)";
  return [
    "Rewrite the high_level_description for an Ideogram 4 JSON caption.",
    "Use all provided canvas images together with the background description.",
    "Return one concise prompt-ready sentence only, no markdown and no JSON.",
    "Describe the complete intended composition: main subject, setting, mood, materials, colors, and visual relationships when visible.",
    "Do not mention JSON, bounding boxes, screenshots, uploaded images, or that you are viewing images.",
    `Existing high level: ${state.highLevel || "(blank)"}`,
    `Background description: ${state.background || "(blank)"}`,
    "Canvas image references:",
    imageList
  ].join("\n");
}

function buildFullJsonPrompt(rewrite = defaultRewriteOptions()) {
  return [
    "Improve this Ideogram 4 JSON caption for ComfyUI.",
    "Return only valid JSON with the same schema.",
    "Preserve every bbox exactly.",
    rewrite.desc
      ? "You may improve high_level_description, background, and element desc fields."
      : "Preserve high_level_description, background, and element desc fields exactly.",
    rewrite.text
      ? "You may improve text strings for text elements while keeping them short and renderable."
      : "Preserve text strings exactly.",
    rewrite.palette
      ? "You may improve or add color_palette arrays using uppercase #RRGGBB colors."
      : "Preserve color_palette arrays exactly; do not add new palette colors.",
    "Do not include comments or markdown fences.",
    JSON.stringify(buildCaption(), null, 2)
  ].join("\n");
}

function buildVisionPrompt(focuses, selected, rewrite = defaultRewriteOptions()) {
  const focusLabel = humanJoin(focuses && focuses.length ? focuses : ["whole image"]);
  const target = selected
    ? `${selected.type} element inside the selected bounding box`
    : "image";
  if (selected && (rewrite.text || rewrite.palette)) {
    const keys = [];
    if (rewrite.desc) keys.push('"desc": string');
    if (rewrite.text && selected.type === "text") keys.push('"text": string');
    if (rewrite.palette) keys.push('"color_palette": ["#RRGGBB"]');
    return [
      `Analyze the ${focusLabel} in this ${target} for an Ideogram 4 JSON prompt.`,
      `Return only valid JSON with these keys: ${keys.join(", ") || '"desc": string'}.`,
      "Do not include markdown fences or comments.",
      "Mention visible subject, material, posture, color, style, and relationship to the frame when relevant.",
      selected.type === "text" ? `Current rendered text: ${selected.text || "(blank)"}` : "",
      `Current description: ${selected.desc || "(blank)"}`,
      `Current palette: ${JSON.stringify(cleanPalette(selected.palette))}`
    ].filter(Boolean).join("\n");
  }
  return [
    `Describe the ${focusLabel} in this ${target} for an Ideogram 4 JSON prompt.`,
    "Return only a concise visual description, no markdown.",
    "Mention visible subject, material, posture, color, style, and relationship to the frame when relevant.",
    "Do not say that this is an image or screenshot."
  ].join("\n");
}

async function callTextLlm(prompt) {
  if (state.llm.provider === "ollama") {
    return callOllamaGenerate(state.llm.ollamaTextModel, prompt);
  }
  return callHuggingFaceChat([{ role: "user", content: prompt }]);
}

async function callVisionLlm(imageDataUrl, prompt) {
  return callVisionLlmWithImages([imageDataUrl], prompt);
}

async function callVisionLlmWithImages(imageDataUrls, prompt) {
  const images = imageDataUrls.filter(Boolean);
  if (!images.length) return callTextLlm(prompt);
  if (state.llm.provider === "ollama") {
    return callOllamaGenerate(state.llm.ollamaVisionModel, prompt, images.map(dataUrlBase64));
  }
  return callHuggingFaceChat([{
    role: "user",
    content: [
      { type: "text", text: prompt },
      ...images.map((imageDataUrl) => ({ type: "image_url", image_url: { url: imageDataUrl } }))
    ]
  }]);
}

async function callOllamaGenerate(model, prompt, images = []) {
  const modelName = String(model || "").trim();
  if (!modelName) throw new Error("Ollama model is empty.");
  const base = normalizeOllamaBaseUrl(state.llm.ollamaUrl);
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false,
      images,
      options: { temperature: 0.35 }
    })
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
  const payload = await response.json();
  return payload.response || "";
}

async function testOllamaApi() {
  try {
    setBusy(true, "Testing Ollama");
    renderLlmDiagnostics({
      status: "pending",
      title: "Testing Ollama...",
      details: [
        `Endpoint: ${safeOllamaEndpointLabel()}`,
        `Text model: ${state.llm.ollamaTextModel.trim() || "(empty)"}`,
        `Vision model: ${state.llm.ollamaVisionModel.trim() || "(empty)"}`
      ]
    }, els.ollamaDiagnostics);
    const result = await runOllamaHealthCheck();
    renderLlmDiagnostics(result, els.ollamaDiagnostics);
    setStatus(result.status === "ok" ? "Ollama OK" : "Ollama test failed");
  } catch (error) {
    const result = diagnosticFromOllamaFetchError(error);
    renderLlmDiagnostics(result, els.ollamaDiagnostics);
    setStatus("Ollama test failed");
  } finally {
    setBusy(false);
  }
}

async function runOllamaHealthCheck() {
  const configError = validateOllamaConfig();
  if (configError) return configError;
  const base = normalizeOllamaBaseUrl(state.llm.ollamaUrl);
  const model = state.llm.ollamaTextModel.trim();
  const startedAt = performance.now();
  const response = await fetchWithTimeout(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "Reply with exactly OK.",
      stream: false,
      options: { temperature: 0 }
    })
  }, 45000);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const body = await readResponseBody(response);

  if (!response.ok) {
    return {
      status: "error",
      title: `Ollama responded with HTTP ${response.status}`,
      details: [
        `Endpoint: ${base}/api/generate`,
        `Model: ${model}`,
        `Elapsed: ${elapsedMs} ms`,
        `Likely cause: ${ollamaStatusHint(response.status, body)}`
      ],
      raw: body
    };
  }

  return {
    status: "ok",
    title: "Ollama generate succeeded",
    details: [
      `Endpoint: ${base}/api/generate`,
      `Model: ${model}`,
      `Elapsed: ${elapsedMs} ms`,
      `Reply: ${String(body && body.response || "").trim() || "(empty response)"}`
    ],
    raw: summarizeOllamaResponse(body)
  };
}

function validateOllamaConfig() {
  if (!state.llm.ollamaTextModel.trim()) {
    return {
      status: "error",
      title: "Ollama text model is empty",
      details: ["Enter a local Ollama model, for example qwen3-vl:8b."]
    };
  }
  try {
    normalizeOllamaBaseUrl(state.llm.ollamaUrl);
  } catch (error) {
    return {
      status: "error",
      title: "Ollama URL is invalid",
      details: ["Use http://127.0.0.1:11434 for the local Ollama server."]
    };
  }
  return null;
}

function safeOllamaEndpointLabel() {
  try {
    return `${normalizeOllamaBaseUrl(state.llm.ollamaUrl)}/api/generate`;
  } catch (error) {
    return `${state.llm.ollamaUrl || "(empty)"} (invalid)`;
  }
}

async function testHuggingFaceApi() {
  try {
    setBusy(true, "Testing Hugging Face");
    renderLlmDiagnostics({
      status: "pending",
      title: "Testing Hugging Face...",
      details: [
        `Endpoint: ${safeHuggingFaceEndpointLabel()}`,
        `Model: ${state.llm.hfModel.trim() || "(empty)"}`,
        `Token: ${state.llm.hfToken.trim() ? "present" : "missing"}`
      ]
    });
    const result = await runHuggingFaceHealthCheck();
    renderLlmDiagnostics(result);
    setStatus(result.status === "ok" ? "Hugging Face OK" : "Hugging Face test failed");
  } catch (error) {
    const result = diagnosticFromFetchError(error);
    renderLlmDiagnostics(result);
    setStatus("Hugging Face test failed");
  } finally {
    setBusy(false);
  }
}

async function runHuggingFaceHealthCheck() {
  const configError = validateHuggingFaceConfig();
  if (configError) return configError;
  const endpoint = normalizeChatEndpoint(state.llm.hfEndpoint);
  const startedAt = performance.now();
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.llm.hfToken.trim()}`
    },
    body: JSON.stringify({
      model: state.llm.hfModel.trim(),
      messages: [
        {
          role: "user",
          content: "Reply with exactly OK."
        }
      ],
      max_tokens: 8,
      temperature: 0,
      stream: false
    })
  }, 45000);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const body = await readResponseBody(response);
  const provider = body && typeof body === "object" ? body.provider || body.provider_name || "" : "";

  if (!response.ok) {
    return {
      status: "error",
      title: `HF responded with HTTP ${response.status}`,
      details: [
        `Endpoint: ${endpoint}`,
        `Model: ${state.llm.hfModel.trim()}`,
        `Elapsed: ${elapsedMs} ms`,
        `Likely cause: ${huggingFaceStatusHint(response.status, body)}`
      ],
      raw: body
    };
  }

  const content = extractChatContent(body);
  return {
    status: "ok",
    title: "HF chat completion succeeded",
    details: [
      `Endpoint: ${endpoint}`,
      `Model: ${state.llm.hfModel.trim()}`,
      provider ? `Provider: ${provider}` : "",
      `Elapsed: ${elapsedMs} ms`,
      `Reply: ${content || "(empty response)"}`
    ].filter(Boolean),
    raw: summarizeResponseBody(body)
  };
}

function validateHuggingFaceConfig() {
  if (!state.llm.hfToken.trim()) {
    return {
      status: "error",
      title: "HF token is missing",
      details: [
        "Create a Hugging Face token with Inference Providers permission.",
        "Paste it into API token, then run Test HF again."
      ]
    };
  }
  if (!state.llm.hfModel.trim()) {
    return {
      status: "error",
      title: "HF model is empty",
      details: ["Enter a chat completion model, for example openai/gpt-oss-120b:fastest."]
    };
  }
  try {
    const url = new URL(normalizeChatEndpoint(state.llm.hfEndpoint));
    if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported protocol");
  } catch (error) {
    return {
      status: "error",
      title: "HF endpoint URL is invalid",
      details: ["Use https://router.huggingface.co/v1/chat/completions or https://router.huggingface.co/v1."]
    };
  }
  return null;
}

function safeHuggingFaceEndpointLabel() {
  try {
    return normalizeChatEndpoint(state.llm.hfEndpoint);
  } catch (error) {
    return `${state.llm.hfEndpoint || "(empty)"} (invalid)`;
  }
}

async function callHuggingFaceChat(messages) {
  if (!state.llm.hfToken.trim()) throw new Error("Hugging Face token is empty.");
  if (!state.llm.hfModel.trim()) throw new Error("Hugging Face model is empty.");
  const endpoint = normalizeChatEndpoint(state.llm.hfEndpoint);
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.llm.hfToken.trim()}`
    },
    body: JSON.stringify({
      model: state.llm.hfModel.trim(),
      messages: [
        {
          role: "system",
          content: "You write concise Ideogram 4 prompt text and valid JSON when requested."
        },
        ...messages
      ],
      temperature: 0.35,
      max_tokens: 700
    })
  }, 90000);
  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(`Hugging Face returned ${response.status}: ${extractErrorMessage(payload) || huggingFaceStatusHint(response.status, payload)}.`);
  }
  return payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : "";
}

async function getVisionSource(selected) {
  if (selected && selected.imageDataUrl) return selected.imageDataUrl;
  if (selected && state.backgroundImage && state.backgroundImage.dataUrl) {
    return cropBackgroundToElement(selected);
  }
  if (state.backgroundImage && state.backgroundImage.dataUrl) return state.backgroundImage.dataUrl;
  return "";
}

async function cropBackgroundToElement(element) {
  const image = await loadImage(state.backgroundImage.dataUrl);
  const cover = coverSourceRect(image.naturalWidth, image.naturalHeight, state.width, state.height);
  const rect = rectPx(element);
  const sx = cover.sx + rect.x / state.width * cover.sw;
  const sy = cover.sy + rect.y / state.height * cover.sh;
  const sw = rect.w / state.width * cover.sw;
  const sh = rect.h / state.height * cover.sh;
  const out = document.createElement("canvas");
  out.width = Math.max(64, Math.round(rect.w));
  out.height = Math.max(64, Math.round(rect.h));
  const ctx = out.getContext("2d");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function extractJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw error;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function extractChatContent(payload) {
  return payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? String(payload.choices[0].message.content || "").trim()
    : "";
}

function extractErrorMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.slice(0, 500);
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error.message === "string") return payload.error.message;
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.detail)) {
    return payload.detail.map((item) => item.msg || item.message || String(item)).join("; ");
  }
  if (typeof payload.detail === "string") return payload.detail;
  return "";
}

function huggingFaceStatusHint(status, payload) {
  const message = extractErrorMessage(payload).toLowerCase();
  if (status === 400) return "request payload or model/provider selection is not accepted";
  if (status === 401) return "token is invalid, expired, missing, or lacks Inference Providers permission";
  if (status === 402) return "billing or credits are unavailable for the selected provider/model";
  if (status === 403) return "token does not have permission for this model/provider";
  if (status === 404) return "endpoint or model was not found; check the model id and endpoint";
  if (status === 408) return "provider timed out before returning a response";
  if (status === 409) return "provider/model is temporarily unavailable or warming";
  if (status === 422) return "model does not support this chat request shape";
  if (status === 429) return "rate limit or quota was reached";
  if (status >= 500) return "Hugging Face router or selected provider had a server-side failure";
  if (message.includes("cors")) return "browser CORS blocked the request";
  return "see raw response below";
}

function ollamaStatusHint(status, payload) {
  const message = extractErrorMessage(payload).toLowerCase();
  if (status === 400) return "request payload is not accepted by this Ollama model";
  if (status === 404) return "model or endpoint was not found; run ollama list and check the model name";
  if (status === 500 && message.includes("model")) return "Ollama could not load the selected model";
  if (status >= 500) return "Ollama had a local server-side failure";
  return "see raw response below";
}

function diagnosticFromFetchError(error) {
  const message = error && error.message ? error.message : "Network request failed.";
  const likely = message.toLowerCase().includes("failed to fetch")
    ? "browser blocked the request, the network is unavailable, DNS failed, or CORS rejected the call"
    : "request did not complete";
  return {
    status: "error",
    title: "HF request did not reach a usable response",
    details: [
      `Error: ${message}`,
      `Likely cause: ${likely}`,
      "Try the same token/model with the curl command in the README or use a local proxy if the browser is blocked."
    ]
  };
}

function diagnosticFromOllamaFetchError(error) {
  const message = error && error.message ? error.message : "Network request failed.";
  const likely = message.toLowerCase().includes("failed to fetch")
    ? "the browser could not reach Ollama, the Ollama server is stopped, or CORS rejected the call"
    : "request did not complete";
  return {
    status: "error",
    title: "Ollama request did not reach a usable response",
    details: [
      `Endpoint: ${safeOllamaEndpointLabel()}`,
      `Error: ${message}`,
      `Likely cause: ${likely}`,
      "Use http://127.0.0.1:11434 and make sure Ollama allows this app origin."
    ]
  };
}

function summarizeResponseBody(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    id: payload.id || "",
    model: payload.model || "",
    provider: payload.provider || payload.provider_name || "",
    choices: Array.isArray(payload.choices) ? payload.choices.length : 0,
    usage: payload.usage || null
  };
}

function summarizeOllamaResponse(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    model: payload.model || "",
    done: Boolean(payload.done),
    total_duration: payload.total_duration || null,
    load_duration: payload.load_duration || null,
    prompt_eval_count: payload.prompt_eval_count || null,
    eval_count: payload.eval_count || null
  };
}

function renderLlmDiagnostics(result, box = els.llmDiagnostics) {
  if (!box) return;
  box.className = `diagnostics ${result.status === "ok" ? "ok" : result.status === "pending" ? "pending" : "error"}`;
  box.innerHTML = "";

  const title = document.createElement("strong");
  title.textContent = result.title || "Diagnostic result";
  box.appendChild(title);

  const list = document.createElement("ul");
  (result.details || []).forEach((detail) => {
    const item = document.createElement("li");
    item.textContent = detail;
    list.appendChild(item);
  });
  if (list.children.length) box.appendChild(list);

  if (result.raw !== undefined) {
    const summary = document.createElement("details");
    const label = document.createElement("summary");
    label.textContent = "Raw response";
    const pre = document.createElement("pre");
    pre.textContent = typeof result.raw === "string" ? result.raw : JSON.stringify(result.raw, null, 2);
    summary.append(label, pre);
    box.appendChild(summary);
  }
}

function cleanLlmText(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:text|json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function setBusy(isBusy, message = "") {
  [els.captureHighLevel, els.enhancePrompt, els.describeImage, els.testOllamaApi, els.testHfApi].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
  });
  if (message) setStatus(message);
}

function updateReadouts() {
  els.canvasReadout.textContent = `${state.width} x ${state.height}`;
  const selected = getSelectedElement();
  if (!selected) {
    els.selectionReadout.textContent = "No box selected";
    return;
  }
  const rect = rectPx(selected);
  els.selectionReadout.textContent = `${selected.type.toUpperCase()} ${Math.round(rect.x)}, ${Math.round(rect.y)}, ${Math.round(rect.w)} x ${Math.round(rect.h)}`;
}

function setStatus(message) {
  els.statusLine.textContent = message;
}

function getSelectedElement() {
  return state.elements.find((element) => element.id === state.selectedId) || null;
}

function getCachedImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const image = new Image();
  image.onload = drawCanvas;
  image.src = src;
  imageCache.set(src, image);
  return image;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, w, h) {
  const source = coverSourceRect(image.naturalWidth, image.naturalHeight, w, h);
  ctx.drawImage(image, source.sx, source.sy, source.sw, source.sh, x, y, w, h);
}

function coverSourceRect(sourceW, sourceH, targetW, targetH) {
  const sourceRatio = sourceW / sourceH;
  const targetRatio = targetW / targetH;
  let sw = sourceW;
  let sh = sourceH;
  let sx = 0;
  let sy = 0;
  if (sourceRatio > targetRatio) {
    sw = sourceH * targetRatio;
    sx = (sourceW - sw) / 2;
  } else {
    sh = sourceW / targetRatio;
    sy = (sourceH - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cleanPalette(palette) {
  if (!Array.isArray(palette)) return [];
  return palette.map(normalizeHex).filter(Boolean);
}

function normalizeHex(color) {
  if (!color) return "";
  const value = String(color).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return "";
}

function readableTextColor(color) {
  const [r, g, b] = hexToRgb(color);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 145 ? "#111715" : "#FFFFFF";
}

function tintForCanvas(color) {
  const [r, g, b] = hexToRgb(color);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 150) return color;
  const mix = 0.42;
  return `rgb(${Math.round(r + (255 - r) * mix)}, ${Math.round(g + (255 - g) * mix)}, ${Math.round(b + (255 - b) * mix)})`;
}

function hexToRgb(color) {
  const hex = normalizeHex(color) || "#147D75";
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

function nextPaletteColor(index) {
  return ["#147D75", "#E35C3F", "#F0B84A", "#31403B", "#FFFFFF"][index % 5];
}

function stripExtension(name) {
  return String(name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

function truncateText(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function fitRectInCanvas(w, h) {
  const maxW = state.width * 0.58;
  const maxH = state.height * 0.58;
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(80, w * scale), h: Math.max(80, h * scale) };
}

function dataUrlBase64(dataUrl) {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

function normalizeOllamaBaseUrl(value) {
  const raw = String(value || "").trim() || DEFAULT_OLLAMA_URL;
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported Ollama URL protocol");
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeChatEndpoint(endpoint) {
  const value = String(endpoint || "").trim() || DEFAULT_HF_CHAT_ENDPOINT;
  const url = new URL(value);
  if (!url.pathname.endsWith("/chat/completions")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  }
  return url.toString();
}

function getUiFont() {
  return "Inter, system-ui, sans-serif";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToMultiple(value, multiple) {
  return Math.round(value / multiple) * multiple;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("ideogram-json-studio") || "null");
    return saved ? mergeState(structuredClone(defaultState), saved) : structuredClone(defaultState);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function mergeState(base, saved) {
  const source = { ...(saved || {}) };
  delete source["prompt" + "Library"];
  const llm = { ...base.llm, ...(source.llm || {}) };
  if (!llm.ollamaUrl || isLegacyOllamaUrl(llm.ollamaUrl)) {
    llm.ollamaUrl = DEFAULT_OLLAMA_URL;
  }
  if (!llm.ollamaTextModel || LEGACY_DEFAULT_OLLAMA_MODELS.includes(llm.ollamaTextModel)) {
    llm.ollamaTextModel = DEFAULT_OLLAMA_MODEL;
  }
  if (!llm.ollamaVisionModel || LEGACY_DEFAULT_OLLAMA_MODELS.includes(llm.ollamaVisionModel)) {
    llm.ollamaVisionModel = DEFAULT_OLLAMA_MODEL;
  }
  if (!llm.hfModel || LEGACY_DEFAULT_HF_MODELS.includes(llm.hfModel)) {
    llm.hfModel = DEFAULT_HF_MODEL;
  }
  return {
    ...base,
    ...source,
    llm,
    elements: Array.isArray(source.elements) ? source.elements : []
  };
}

function isLegacyOllamaUrl(value) {
  try {
    return LEGACY_DEFAULT_OLLAMA_URLS.includes(normalizeOllamaBaseUrl(value));
  } catch (error) {
    return false;
  }
}

function saveState() {
  try {
    localStorage.setItem("ideogram-json-studio", JSON.stringify(state));
  } catch (error) {
    // Large dropped images can exceed localStorage. The app still works in memory.
  }
}
