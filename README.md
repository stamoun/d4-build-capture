# Diablo Build Capture

A small local Electron tool for capturing Diablo IV build tooltips and generating
a Markdown + PNG snapshot in an Obsidian vault.

## Getting Started

Prerequisites:

- Node.js 22+
- npm
- Windows 11
- Diablo IV in borderless windowed mode (recommended)

```bash
npm install
npm start
```

## Usage

1. Select your Obsidian vault.
2. Configure the tooltip region.
3. Hover over an item in Diablo IV.
4. Press Ctrl+Shift+Space to capture the next slot, or use a slot button to retake it.
5. Click **Generate Build**.

## Default Shortcut

| Shortcut | Action |
|---|---|
| Ctrl+Shift+Space | Capture the next incomplete slot |

## MVP Limitations

- The capture region is configured manually.
- No OCR.
- No overlay in Diablo IV.
- No automated game controls.
- The collage uses a fixed grid.

## Suggested Next Issues

1. Add a visual region selector.
2. Preview the latest capture.
3. Add explicit multi-monitor support.
4. Add a guided capture mode.
5. Add OCR as an optional process.
6. Compare two snapshots.
7. Automatically detect black tooltip margins.

## Security

The renderer has no direct Node access. Every system operation goes through a
limited preload and explicit IPC handlers.

## Suggested First Codex Prompt

```text
Read AGENTS.md, README.md, and docs/ROADMAP.md.
Install the dependencies, run the typecheck, then fix only the errors that
prevent the MVP from starting. Preserve the secure Electron architecture and
do not add any game automation.
```
