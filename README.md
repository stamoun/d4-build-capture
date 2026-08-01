# Diablo Build Capture

A small local Electron tool for capturing Diablo IV build tooltips and generating
a portable Markdown + PNG build snapshot.

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

1. Select an output directory.
2. Choose a class, enter a build name, and optionally paste a planner URL.
3. Open Settings to configure the capture region or keyboard shortcut.
4. Hover over an item in Diablo IV.
5. Press Ctrl+Shift+Space to capture the next slot, or use a slot button to retake it.
6. Click **Generate Build**.

## Default Shortcut

| Shortcut | Action |
|---|---|
| ctrl-shift-space | Capture the next incomplete slot |

## MVP Limitations

- The capture region defaults to the primary display and can be configured manually.
- No OCR.
- No overlay in Diablo IV.
- No automated game controls.
- Character stats are shown as a four-capture overview in the generated Markdown.

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

## Draft Releases

Run the **Build Windows release** workflow manually from GitHub Actions and provide
a release tag such as `v0.1.0`. The workflow validates the project, builds the
Windows installer, and creates a draft GitHub release with generated release notes
and the installer attached. Review and publish the draft from the Releases page.

## Suggested First Codex Prompt

```text
Read AGENTS.md, README.md, and docs/ROADMAP.md.
Install the dependencies, run the typecheck, then fix only the errors that
prevent the MVP from starting. Preserve the secure Electron architecture and
do not add any game automation.
```
