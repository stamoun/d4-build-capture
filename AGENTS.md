# AGENTS.md

## Mission

Build a local Windows tool that manually captures Diablo IV tooltips, assembles
them, and exports a portable snapshot that is easy to analyze in Markdown tools and Codex.

## Principles

- Never automate interactions with Diablo IV.
- Never read the game process memory.
- Never inject code or create an overlay inside the game process.
- Keep captures and data entirely local.
- Prioritize a reliable workflow before OCR.
- Maintain strict separation between main, preload, and renderer.

## Architecture

- `src/main.ts`: Electron lifecycle, IPC, and global shortcuts.
- `src/preload.ts`: minimal API exposed to the renderer.
- `src/renderer.ts`: user interface without Node access.
- `src/capture.ts`: screen capture and cropping.
- `src/exporter.ts`: Markdown, JSON, and image export.
- `src/config.ts`: configuration validation and persistence.

## Code Constraints

- Strict TypeScript.
- Short, testable functions.
- Zod validation at boundaries.
- No `any`.
- No runtime network dependency.
- No telemetry.
- Error messages in English in the user interface.
- Code identifiers in English.
- Commit messages must follow the Conventional Commits specification.

## Definition of Done

A feature is complete when:

1. it works on Windows 11;
2. it handles errors without crashing the application;
3. it preserves `contextIsolation: true`;
4. it adds no game automation;
5. it has at least one business behavior test when relevant.

## Priorities

1. Capture reliability.
2. Workflow speed.
3. Export readability.
4. Snapshot comparison.
5. Optional OCR.
