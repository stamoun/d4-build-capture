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
let config: AppConfig;
let session: SessionState;
let version: string;
let selectedSlot: ItemSlot | null;
let capturingSlot: ItemSlot | null;
let buildDetailsOpen = false;

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

function render(): void {
  const activeSlots = getItemSlots(config.characterClass);
  const completedCount = activeSlots.filter((slot) => session.captures[slot]).length;
  const nextSlot = findNextUncapturedSlot(session.captures, activeSlots);
  const activeSlot = selectedSlot && activeSlots.includes(selectedSlot) ? selectedSlot : nextSlot;
  const nextSlotGroup = activeSlot ? getItemSlotGroup(activeSlot) : null;

  appElement.innerHTML = `
    <main>
      <header>
        <div>
          <p class="eyebrow">DIABLO IV</p>
          <h1>Build Capture</h1>
          <p>Capture tooltips, then generate a Markdown build snapshot.</p>
        </div>
        <div class="header-actions">
          <span class="badge">${completedCount}/${activeSlots.length}</span>
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
              <button id="chooseOutputDirectory">Choose</button>
            </div>
          </label>
        </section>
      </details>

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
                  const slotIndex = activeSlots.indexOf(slot);
                  return `
                <button class="slot ${session.captures[slot] ? 'done' : ''} ${activeSlot === slot ? 'next' : ''} ${selectedSlot === slot ? 'selected' : ''} ${capturingSlot === slot ? 'capturing' : ''}" data-slot="${slot}" aria-pressed="${selectedSlot === slot}" ${capturingSlot ? 'disabled' : ''}>
                  <span>${capturingSlot === slot ? '<i class="spinner" aria-hidden="true"></i>' : session.captures[slot] ? '✓' : slotIndex + 1}</span>
                  <strong>${slotLabel(slot, config.characterClass)}</strong>
                </button>`;
                })
                .join('')}
            </div>
          </details>`;
        }).join('')}
      </section>

      <section class="actions">
        <button id="resetSession" class="secondary">Clear</button>
        <button id="exportSession" class="primary">Generate</button>
      </section>

      <footer>
        <span>Shortcut: ${escapeHtml(config.shortcut)} captures the selected slot, or the next incomplete slot.</span>
        <span>v${escapeHtml(version)}</span>
      </footer>

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
            <label class="wide checkbox-label">
              <input id="captureFullScreen" type="checkbox" ${config.captureFullScreen ? 'checked' : ''} />
              Capture full screen
            </label>
            <label>Region X<input class="region-input" id="regionX" type="number" min="0" value="${config.captureRegion.x}" ${config.captureFullScreen ? 'disabled' : ''} /></label>
            <label>Region Y<input class="region-input" id="regionY" type="number" min="0" value="${config.captureRegion.y}" ${config.captureFullScreen ? 'disabled' : ''} /></label>
            <label>Width<input class="region-input" id="regionWidth" type="number" min="1" value="${config.captureRegion.width}" ${config.captureFullScreen ? 'disabled' : ''} /></label>
            <label>Height<input class="region-input" id="regionHeight" type="number" min="1" value="${config.captureRegion.height}" ${config.captureFullScreen ? 'disabled' : ''} /></label>
            <label class="wide">
              Capture shortcut
              <input id="shortcut" value="${escapeHtml(config.shortcut)}" placeholder="ctrl-shift-space" readonly />
              <small>Focus the field, then press the new key combination.</small>
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

  document.querySelector('#chooseOutputDirectory')?.addEventListener('click', () => {
    void window.diabloCapture.chooseOutputDirectory();
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

  const fullScreenInput = document.querySelector<HTMLInputElement>('#captureFullScreen');
  fullScreenInput?.addEventListener('change', () => {
    document.querySelectorAll<HTMLInputElement>('.region-input').forEach((input) => {
      input.disabled = fullScreenInput.checked;
    });
  });

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
        captureRegion: {
          x: Number(inputValue('regionX')),
          y: Number(inputValue('regionY')),
          width: Number(inputValue('regionWidth')),
          height: Number(inputValue('regionHeight')),
        },
        captureFullScreen: fullScreenInput?.checked ?? false,
        shortcut: inputValue('shortcut'),
      })
      .then(() => settingsDialog?.close());
  });
}

window.diabloCapture.onStateChanged((state) => {
  config = state.config;
  session = state.session;
  version = state.version;
  selectedSlot = state.selectedSlot;
  capturingSlot = state.capturingSlot;
  render();
});

void window.diabloCapture.getState().then((state) => {
  config = state.config;
  session = state.session;
  version = state.version;
  selectedSlot = state.selectedSlot;
  capturingSlot = state.capturingSlot;
  render();
});
