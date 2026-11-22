# Demo video tooling

How `docs/demo/passbch-demo.mp4` was made (no video editor needed):

1. `voice.ps1` writes the voiceover WAV files with the Windows "Microsoft David" voice (System.Speech).
2. A real two-terminal session against the live site is recorded (`rec.json`: your terminal plus a friend's terminal joining with `npx passbch race <code>`).
3. `compose.html` draws every scene on a 1280×720 canvas (VS Code "waiting for Claude" opening, how BCH earns, the terminal replay, split screen for the friend race, web for non-developers, end card) and mixes the voice with Web Audio.
4. `render.cjs` serves the folder, runs `compose.html` in headless Edge, records canvas + audio with MediaRecorder and saves the MP4; ffmpeg `-c copy -movflags +faststart` then fixes the container so players show the right length.

Assets it expects in the same folder: the WAV files, `rec.json`, `intro.mp4`, `logo-192.png` and three web screenshots.
