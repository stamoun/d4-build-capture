import { buildShortcutLabel } from './shortcut';
import { findNextUncapturedSlot } from './session';
import './styles.css';
import {
  CHARACTER_CLASSES,
  getItemSlotLabel,
  getItemSlotGroup,
  getItemSlots,
  type AppConfig,
  type CharacterClass,
  type ItemSlot,
  type ItemSlotGroup,
  type SessionState,
} from './types';

const CLASS_ICONS: Record<CharacterClass, string> = {
  Barbarian: '🪓',
  Druid: '🐻',
  Necromancer: '💀',
  Rogue: '🗡️',
  Sorcerer: '✨',
  Spiritborn: '🐆',
  Paladin: '🛡️',
  Warlock: '🔥',
};

const SLOT_LABELS: Partial<Record<ItemSlot, string>> = {
  helmet: 'Helmet',
  chest: 'Chest',
  gloves: 'Gloves',
  pants: 'Pants',
  boots: 'Boots',
  amulet: 'Amulet',
  'ring-1': 'Ring 1',
  'ring-2': 'Ring 2',
  'charm-1': 'Charm 1',
  'charm-2': 'Charm 2',
  'charm-3': 'Charm 3',
  'charm-4': 'Charm 4',
  'charm-5': 'Charm 5',
  'charm-6': 'Charm 6',
  seal: 'Seal',
  'stats-1': 'Stats 1',
  'stats-2': 'Stats 2',
  'stats-3': 'Stats 3',
  'stats-4': 'Stats 4',
};

const SLOT_GROUPS: readonly { id: ItemSlotGroup; title: string }[] = [
  { id: 'equipment', title: 'Equipment' },
  { id: 'talisman', title: 'Talisman' },
  { id: 'stats', title: 'Stats' },
];

function slotLabel(slot: ItemSlot, characterClass: CharacterClass): string {
  return getItemSlotLabel(slot, characterClass) ?? SLOT_LABELS[slot] ?? slot;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

function getAppElement(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>('#app');
  if (!element) throw new Error('#app element not found.');
  return element;
}

const appElement = getAppElement();

const MAX_PREVIEW_ZOOM = 4;

function setPreviewZoom(newScale: number): void {
  previewScale = Math.min(Math.max(newScale, 1), MAX_PREVIEW_ZOOM);
}

function applyPreviewZoom(container: HTMLElement, focusX?: number, focusY?: number): void {
  const stage = container.querySelector<HTMLElement>('.preview-stage');
  const image = container.querySelector<HTMLImageElement>('#previewImage');
  const zoomLevel = document.querySelector<HTMLElement>('.preview-zoom-level');
  if (!stage || !image || image.naturalWidth === 0 || image.naturalHeight === 0) return;

  const oldWidth = image.clientWidth;
  const oldHeight = image.clientHeight;
  const availableWidth = container.clientWidth;
  const availableHeight = Math.min(600, window.innerHeight * 0.65);
  const fitScale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight, 1);
  const width = Math.round(image.naturalWidth * fitScale * previewScale);
  const height = Math.round(image.naturalHeight * fitScale * previewScale);
  const viewportHeight = Math.round(image.naturalHeight * fitScale);
  const anchorX = focusX ?? container.clientWidth / 2;
  const anchorY = focusY ?? container.clientHeight / 2;
  const imageX = oldWidth > 0 ? (container.scrollLeft + anchorX) / oldWidth : 0.5;
  const imageY = oldHeight > 0 ? (container.scrollTop + anchorY) / oldHeight : 0.5;

  container.style.height = `${viewportHeight}px`;
  stage.style.width = `${Math.max(width, availableWidth)}px`;
  stage.style.height = `${Math.max(height, viewportHeight)}px`;
  image.style.width = `${width}px`;
  image.style.height = `${height}px`;
  image.style.left = `${Math.max(0, (availableWidth - width) / 2)}px`;
  image.style.top = `${Math.max(0, (viewportHeight - height) / 2)}px`;
  container.scrollLeft = imageX * width - anchorX;
  container.scrollTop = imageY * height - anchorY;
  if (zoomLevel) zoomLevel.textContent = `${Math.round(previewScale * 100)}%`;
}

function handlePreviewWheel(event: WheelEvent): void {
  const container = event.currentTarget as HTMLElement;
  if (!event.ctrlKey) return;

  event.preventDefault();
  const rect = container.getBoundingClientRect();
  setPreviewZoom(previewScale * (event.deltaY > 0 ? 0.9 : 1.1));
  applyPreviewZoom(container, event.clientX - rect.left, event.clientY - rect.top);
}

function handlePreviewMouseDown(event: MouseEvent): void {
  if (event.button !== 0) return; // Only left mouse button

  const container = event.currentTarget as HTMLElement;
  isDraggingPreview = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragOffsetX = container.scrollLeft;
  dragOffsetY = container.scrollTop;

  container.style.cursor = 'grabbing';
  container.style.userSelect = 'none';

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!isDraggingPreview) return;
    moveEvent.preventDefault();

    const dx = moveEvent.clientX - dragStartX;
    const dy = moveEvent.clientY - dragStartY;

    container.scrollLeft = dragOffsetX - dx;
    container.scrollTop = dragOffsetY - dy;
  };

  const handleMouseUp = () => {
    isDraggingPreview = false;
    container.style.cursor = '';
    container.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}
let config: AppConfig;
let session: SessionState;
let version: string;
let tempDirectory: string;
let selectedSlot: ItemSlot | null;
let capturingSlot: ItemSlot | null;
let buildDetailsOpen = false;
let screenshotPreview: string | null = null;
let previewScale = 1;
let isDraggingPreview = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;

function inputValue(id: string): string {
  return document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '';
}

function buildUrlIsValid(): boolean {
  const input = document.querySelector<HTMLInputElement>('#buildUrl');
  if (!input || input.checkValidity()) return true;
  input.reportValidity();
  return false;
}

async function saveBuildDetails(): Promise<boolean> {
  if (!buildUrlIsValid()) return false;
  const details = {
    buildName: inputValue('buildName'),
    buildUrl: inputValue('buildUrl'),
  };
  await window.diabloCapture.saveBuildDetails(details);
  config = { ...config, ...details };
  const summaryName = document.querySelector<HTMLElement>('#buildSummaryName');
  if (summaryName) summaryName.textContent = details.buildName;
  const buildLink = document.querySelector<HTMLButtonElement>('#openBuildUrl');
  if (buildLink) buildLink.disabled = !details.buildUrl;
  return true;
}

function initializePreviewIfNeeded(): void {
  if (!screenshotPreview || !selectedSlot) return;
  const previewImage = document.querySelector('#previewImage') as HTMLImageElement | null;
  const previewContainer = document.querySelector<HTMLElement>('#previewContainer');
  if (!previewImage || !previewContainer) return;
  const initialize = () => applyPreviewZoom(previewContainer);
  if (previewImage.complete) initialize();
  else previewImage.addEventListener('load', initialize, { once: true });
}

function render(): void {
  const activeSlots = getItemSlots(config.characterClass);
  const completedCount = activeSlots.filter((slot) => session.captures[slot]).length;
  const nextSlot = findNextUncapturedSlot(session.captures, activeSlots);
  const activeSlot = selectedSlot && activeSlots.includes(selectedSlot) ? selectedSlot : nextSlot;
  const nextSlotGroup = activeSlot ? getItemSlotGroup(activeSlot) : null;
  const captureGuidance = activeSlot
    ? `Hover your <strong>${escapeHtml(slotLabel(activeSlot, config.characterClass))}</strong> in Diablo IV, then press <kbd>${escapeHtml(config.shortcut)}</kbd>.`
    : '<strong>All captures complete.</strong> Review the captured images or export the snapshot.';

  appElement.innerHTML = `
    <main>
      <header>
        <div>
          <p class="eyebrow">DIABLO IV</p>
          <h1><a id="openProjectUrl" class="title-link" href="https://github.com/stamoun/d4-build-capture">Build Capture <span>v${escapeHtml(version)}</span></a></h1>
        </div>
        <div class="header-actions">
          <button id="openSettings" class="icon-button" aria-label="Open settings" title="Settings">⚙</button>
        </div>
      </header>

      <details id="buildDetails" class="panel build-details" ${buildDetailsOpen ? 'open' : ''}>
        <summary>
          <span class="build-summary-value">
            <small>Class</small>
            <strong>${CLASS_ICONS[config.characterClass]} ${config.characterClass}</strong>
          </span>
          <span class="build-summary-value">
            <small>Build</small>
            <strong id="buildSummaryName">${escapeHtml(config.buildName)}</strong>
          </span>
          <span class="build-summary-actions">
            <button id="openBuildUrl" class="summary-link" ${config.buildUrl ? '' : 'disabled'}>Build</button>
            <button id="openOutputDirectory" class="summary-folder" aria-label="Open output directory" title="Output Directory" ${config.outputDirectory ? '' : 'disabled'}>📁</button>
          </span>
        </summary>
        <section class="form-grid build-details-form">
          <label>
            Class
            <select id="characterClass">
              ${CHARACTER_CLASSES.map(
                (characterClass) => `
                <option value="${characterClass}" ${characterClass === config.characterClass ? 'selected' : ''}>
                  ${CLASS_ICONS[characterClass]} ${characterClass}
                </option>
              `,
              ).join('')}
            </select>
          </label>
          <label>
            Build
            <input id="buildName" value="${escapeHtml(config.buildName)}" />
          </label>
          <label class="wide">
            Build URL
            <input id="buildUrl" type="url" value="${escapeHtml(config.buildUrl)}" placeholder="https://..." />
          </label>
          <label class="wide">
            Output Directory
            <div class="inline">
              <input id="outputDirectory" value="${escapeHtml(config.outputDirectory)}" readonly />
              <button id="chooseOutputDirectory" class="icon-button" aria-label="Choose output directory" title="Choose Output Directory">📁</button>
            </div>
          </label>
        </section>
      </details>

      <section class="capture-guidance" aria-live="polite">${captureGuidance}</section>

      <div class="capture-workspace ${screenshotPreview && selectedSlot ? 'has-preview' : ''}">
      ${screenshotPreview && selectedSlot ? `
      <section class="panel screenshot-preview">
        <div class="preview-header">
          <div class="preview-title">
            <strong>Preview: ${escapeHtml(slotLabel(selectedSlot, config.characterClass))}</strong>
            <span class="preview-zoom-level">${Math.round(previewScale * 100)}%</span>
          </div>
          <div class="preview-actions">
            <button id="zoomInPreview" class="icon-button" aria-label="Zoom in" title="Zoom In (Ctrl+Scroll)">+</button>
            <button id="zoomOutPreview" class="icon-button" aria-label="Zoom out" title="Zoom Out (Ctrl+Scroll)">−</button>
            <button id="resetPreviewZoom" class="icon-button" aria-label="Reset zoom" title="Reset Zoom">↻</button>
            <button id="closePreview" class="icon-button" aria-label="Close preview" title="Close Preview">×</button>
          </div>
        </div>
        <div class="preview-container" id="previewContainer">
          <div class="preview-stage"><img src="data:image/png;base64,${escapeHtml(screenshotPreview)}" alt="Screenshot preview for ${escapeHtml(slotLabel(selectedSlot, config.characterClass))}" class="preview-image" id="previewImage" /></div>
        </div>
      </section>
      ` : ''}

      <section class="slot-accordion">
        ${SLOT_GROUPS.map(({ id, title }) => {
          const groupSlots = activeSlots.filter((slot) => getItemSlotGroup(slot) === id);
          const groupCompletedCount = groupSlots.filter((slot) => session.captures[slot]).length;
          return `
          <details class="panel slot-section" name="capture-slots" ${nextSlotGroup === id ? 'open' : ''}>
            <summary>
              <strong>${title}</strong>
              <span>${groupCompletedCount}/${groupSlots.length}</span>
            </summary>
            <div class="slots">
              ${groupSlots
                .map((slot) => {
                  const slotState = capturingSlot === slot
                    ? '<i class="spinner" aria-label="Capturing"></i>'
                    : selectedSlot === slot
                      ? '<small class="slot-state">SELECTED</small>'
                      : activeSlot === slot
                        ? '<small class="slot-state">NEXT</small>'
                        : session.captures[slot]
                          ? '<small class="slot-state">CAPTURED</small>'
                          : '';
                  return `
                <button class="slot ${session.captures[slot] ? 'done' : ''} ${activeSlot === slot ? 'next' : ''} ${selectedSlot === slot ? 'selected' : ''} ${capturingSlot === slot ? 'capturing' : ''}" data-slot="${slot}" aria-pressed="${selectedSlot === slot}" ${capturingSlot ? 'disabled' : ''}>
                  <strong>${slotLabel(slot, config.characterClass)}</strong>
                  ${slotState}
                </button>`;
                })
                .join('')}
            </div>
          </details>`;
        }).join('')}
      </section>
      </div>

      <section class="actions panel">
        <div class="export-progress">
          <strong>${completedCount} of ${activeSlots.length} captured</strong>
          <span>${activeSlots.length - completedCount} remaining</span>
        </div>
        <button id="resetSession" class="danger-secondary">Clear</button>
        <button id="exportSession" class="primary">Export</button>
      </section>

      <dialog id="settingsDialog">
        <form method="dialog">
          <div class="dialog-heading">
            <div>
              <p class="eyebrow">SETTINGS</p>
              <h2>Capture</h2>
            </div>
            <button value="cancel" class="icon-button" aria-label="Close settings">×</button>
          </div>
          <section class="settings-grid">
            <label class="wide">
              Capture shortcut
              <input id="shortcut" value="${escapeHtml(config.shortcut)}" placeholder="ctrl-shift-space" readonly />
              <small>Focus the field, then press the new key combination.</small>
            </label>
            <label class="wide">
              Temporary Screenshots
              <div class="inline">
                <input id="tempDirectory" value="${escapeHtml(tempDirectory)}" readonly />
                <span class="icon-buttons">
                  <button id="openTempDirectory" type="button" class="icon-button" aria-label="Open temporary folder" title="Open Temporary Folder">📁</button>
                  <button id="clearTempDirectory" type="button" class="icon-button danger-icon" aria-label="Clear temporary screenshots" title="Clear Temporary Screenshots">🗑</button>
                </span>
              </div>
              <small>Captured images are stored here until the session is exported or cleared.</small>
            </label>
          </section>
          <div class="dialog-actions">
            <button value="cancel">Cancel</button>
            <button id="saveSettings" value="default" class="primary">Save Settings</button>
          </div>
        </form>
      </dialog>
    </main>
  `;

  document.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      void window.diabloCapture.selectSlot(button.dataset.slot as ItemSlot);
    });
  });

  document.querySelector('#closePreview')?.addEventListener('click', () => {
    screenshotPreview = null;
    previewScale = 1;
    render();
  });

  document.querySelector('#zoomInPreview')?.addEventListener('click', () => {
    setPreviewZoom(previewScale * 1.25);
    if (previewContainer) applyPreviewZoom(previewContainer);
  });

  document.querySelector('#zoomOutPreview')?.addEventListener('click', () => {
    setPreviewZoom(previewScale / 1.25);
    if (previewContainer) applyPreviewZoom(previewContainer);
  });

  document.querySelector('#resetPreviewZoom')?.addEventListener('click', () => {
    setPreviewZoom(1);
    if (previewContainer) applyPreviewZoom(previewContainer);
  });

  const previewContainer = document.querySelector<HTMLElement>('#previewContainer');
  if (previewContainer) {
    previewContainer.addEventListener('wheel', handlePreviewWheel as EventListener, { passive: false });
    previewContainer.addEventListener('mousedown', handlePreviewMouseDown as EventListener);
  }

  document.querySelector<HTMLDetailsElement>('#buildDetails')?.addEventListener('toggle', (event) => {
    buildDetailsOpen = (event.currentTarget as HTMLDetailsElement).open;
  });

  document.querySelector('#openBuildUrl')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void window.diabloCapture.openBuildUrl();
  });

  document.querySelector('#openOutputDirectory')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void window.diabloCapture.openOutputDirectory();
  });

  document.querySelector('#openProjectUrl')?.addEventListener('click', (event) => {
    event.preventDefault();
    void window.diabloCapture.openProjectUrl();
  });

  document.querySelector('#chooseOutputDirectory')?.addEventListener('click', () => {
    void window.diabloCapture.chooseOutputDirectory();
  });

  document.querySelector('#openTempDirectory')?.addEventListener('click', () => {
    void window.diabloCapture.openTempDirectory();
  });

  document.querySelector('#clearTempDirectory')?.addEventListener('click', () => {
    if (confirm('Clear all temporary screenshots? This cannot be undone.')) {
      void window.diabloCapture.clearTempDirectory();
    }
  });

  document.querySelector('#characterClass')?.addEventListener('change', () => {
    if (!buildUrlIsValid()) return;
    void window.diabloCapture.saveConfig({
      ...config,
      characterClass: inputValue('characterClass') as CharacterClass,
      buildName: inputValue('buildName'),
      buildUrl: inputValue('buildUrl'),
    });
  });

  document.querySelector('#buildName')?.addEventListener('change', () => {
    void saveBuildDetails();
  });

  document.querySelector('#buildUrl')?.addEventListener('change', () => {
    void saveBuildDetails();
  });

  document.querySelector('#resetSession')?.addEventListener('click', () => {
    void window.diabloCapture.resetSession();
  });

  document.querySelector('#exportSession')?.addEventListener('click', () => {
    void saveBuildDetails().then((saved) => {
      if (saved) return window.diabloCapture.exportSession();
      return undefined;
    });
  });

  const settingsDialog = document.querySelector<HTMLDialogElement>('#settingsDialog');
  document.querySelector('#openSettings')?.addEventListener('click', () => settingsDialog?.showModal());

  const shortcutInput = document.querySelector<HTMLInputElement>('#shortcut');
  shortcutInput?.addEventListener('keydown', (event) => {
    event.preventDefault();
    const modifiers = new Set<string>();
    if (event.ctrlKey) modifiers.add('ctrl');
    if (event.altKey) modifiers.add('alt');
    if (event.shiftKey) modifiers.add('shift');
    if (event.metaKey) modifiers.add('meta');
    const shortcut = buildShortcutLabel(modifiers, event.key);
    if (shortcut) shortcutInput.value = shortcut;
  });

  document.querySelector('#saveSettings')?.addEventListener('click', (event) => {
    event.preventDefault();
    void window.diabloCapture
      .saveConfig({
        ...config,
        shortcut: inputValue('shortcut'),
      })
      .then(() => settingsDialog?.close());
  });

  initializePreviewIfNeeded();
}

async function loadPreviewIfNeeded(): Promise<void> {
  if (!selectedSlot || !session.captures[selectedSlot]) {
    screenshotPreview = null;
    return;
  }

  try {
    screenshotPreview = await window.diabloCapture.getScreenshotPreview(selectedSlot);
    // Reset zoom/pan when loading a new preview
    previewScale = 1;
  } catch {
    screenshotPreview = null;
  }
}

window.diabloCapture.onStateChanged(async (state) => {
  config = state.config;
  session = state.session;
  version = state.version;
  tempDirectory = state.tempDirectory;
  selectedSlot = state.selectedSlot;
  capturingSlot = state.capturingSlot;
  await loadPreviewIfNeeded();
  render();
});

void window.diabloCapture.getState().then(async (state) => {
  config = state.config;
  session = state.session;
  version = state.version;
  tempDirectory = state.tempDirectory;
  selectedSlot = state.selectedSlot;
  capturingSlot = state.capturingSlot;
  await loadPreviewIfNeeded();
  render();
});
