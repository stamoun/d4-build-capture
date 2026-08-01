import './styles.css';
import { ITEM_SLOTS, type AppConfig, type SessionState } from './types';

function getAppElement(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>('#app');
  if (!element) {
    throw new Error('#app element not found.');
  }
  return element;
}

const appElement = getAppElement();

let config: AppConfig;
let session: SessionState;

function render(): void {
  appElement.innerHTML = `
    <main>
      <header>
        <div>
          <p class="eyebrow">DIABLO IV</p>
          <h1>Build Capture</h1>
          <p>Capture tooltips, then generate an Obsidian snapshot.</p>
        </div>
        <span class="badge">${Object.keys(session.captures).length}/${ITEM_SLOTS.length}</span>
      </header>

      <section class="panel form-grid">
        <label>
          Class
          <input id="characterClass" value="${config.characterClass}" />
        </label>
        <label>
          Build
          <input id="buildName" value="${config.buildName}" />
        </label>
        <label class="wide">
          Obsidian Vault
          <div class="inline">
            <input id="vaultPath" value="${config.vaultPath}" readonly />
            <button id="chooseVault">Choose</button>
          </div>
        </label>
        <label>
          Region X
          <input id="regionX" type="number" value="${config.captureRegion.x}" />
        </label>
        <label>
          Region Y
          <input id="regionY" type="number" value="${config.captureRegion.y}" />
        </label>
        <label>
          Width
          <input id="regionWidth" type="number" value="${config.captureRegion.width}" />
        </label>
        <label>
          Height
          <input id="regionHeight" type="number" value="${config.captureRegion.height}" />
        </label>
      </section>

      <section class="slots">
        ${ITEM_SLOTS.map((slot, index) => `
          <button class="slot ${session.captures[slot] ? 'done' : ''}" data-slot="${slot}">
            <span>${session.captures[slot] ? '✓' : index + 1}</span>
            <strong>${slot}</strong>
          </button>
        `).join('')}
      </section>

      <section class="actions">
        <button id="saveConfig">Save</button>
        <button id="resetSession" class="secondary">New Session</button>
        <button id="exportSession" class="primary">Generate Build</button>
      </section>

      <footer>
        Shortcut: Ctrl+Shift+Space captures the next incomplete slot.
      </footer>
    </main>
  `;

  document.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      void window.diabloCapture.capture(button.dataset.slot as typeof ITEM_SLOTS[number]);
    });
  });

  document.querySelector('#chooseVault')?.addEventListener('click', () => {
    void window.diabloCapture.chooseVault();
  });

  document.querySelector('#saveConfig')?.addEventListener('click', () => {
    const read = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';

    const nextConfig: AppConfig = {
      ...config,
      characterClass: read('characterClass'),
      buildName: read('buildName'),
      captureRegion: {
        x: Number(read('regionX')),
        y: Number(read('regionY')),
        width: Number(read('regionWidth')),
        height: Number(read('regionHeight'))
      }
    };

    void window.diabloCapture.saveConfig(nextConfig);
  });

  document.querySelector('#resetSession')?.addEventListener('click', () => {
    void window.diabloCapture.resetSession();
  });

  document.querySelector('#exportSession')?.addEventListener('click', () => {
    void window.diabloCapture.exportSession();
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
