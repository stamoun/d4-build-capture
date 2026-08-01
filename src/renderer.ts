import { buildShortcutLabel } from './shortcut';
import './styles.css';
import {
  CHARACTER_CLASSES,
  getItemSlots,
  type AppConfig,
  type CharacterClass,
  type ItemSlot,
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
  'stats-1': 'Stats 1',
  'stats-2': 'Stats 2',
  'stats-3': 'Stats 3',
  'stats-4': 'Stats 4',
};

function slotLabel(slot: ItemSlot, characterClass: CharacterClass): string {
  if (slot === 'weapon-1') return characterClass === 'Barbarian' ? 'Weapon 1' : 'Main Hand';
  if (slot === 'weapon-2') return characterClass === 'Barbarian' ? 'Weapon 2' : 'Off Hand';
  if (slot === 'weapon-3') return 'Weapon 3';
  if (slot === 'weapon-4') return 'Weapon 4';
  return SLOT_LABELS[slot] ?? slot;
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

function inputValue(id: string): string {
  return document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '';
}

function buildUrlIsValid(): boolean {
  const input = document.querySelector<HTMLInputElement>('#buildUrl');
  if (!input || input.checkValidity()) return true;
  input.reportValidity();
  return false;
}

function render(): void {
  const activeSlots = getItemSlots(config.characterClass);
  const completedCount = activeSlots.filter((slot) => session.captures[slot]).length;

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

      <section class="panel form-grid">
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

      <section class="slots">
        ${activeSlots
          .map(
            (slot, index) => `
          <button class="slot ${session.captures[slot] ? 'done' : ''}" data-slot="${slot}">
            <span>${session.captures[slot] ? '✓' : index + 1}</span>
            <strong>${slotLabel(slot, config.characterClass)}</strong>
          </button>
        `,
          )
          .join('')}
      </section>

      <section class="actions">
        <button id="resetSession" class="secondary">Clear</button>
        <button id="saveDetails">Save Details</button>
        <button id="exportSession" class="primary">Generate Build</button>
      </section>

      <footer>Shortcut: ${escapeHtml(config.shortcut)} captures the next incomplete slot.</footer>

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
      void window.diabloCapture.capture(button.dataset.slot as ItemSlot);
    });
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

  document.querySelector('#saveDetails')?.addEventListener('click', () => {
    if (!buildUrlIsValid()) return;
    void window.diabloCapture.saveConfig({
      ...config,
      characterClass: inputValue('characterClass') as CharacterClass,
      buildName: inputValue('buildName'),
      buildUrl: inputValue('buildUrl'),
    });
  });

  document.querySelector('#resetSession')?.addEventListener('click', () => {
    void window.diabloCapture.resetSession();
  });

  document.querySelector('#exportSession')?.addEventListener('click', () => {
    void window.diabloCapture.exportSession();
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
  render();
});

void window.diabloCapture.getState().then((state) => {
  config = state.config;
  session = state.session;
  render();
});
