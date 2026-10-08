# One Press

A browser learning game about the **ESP32**.

Someone presses a button; a lamp across the room lights. Between the two lie a few
milliseconds in which a dozen systems must each do their job. The game slows that
sliver of time until you can live inside it, and makes you do every job yourself.
Each job you master you replace with a part or a rule, which frees your hands and
exposes the next job. **You win by making yourself unnecessary:** in the last scene
you press the button and touch nothing else.

It is a real-time operation game that turns into an automation game — not a quiz.
Lessons are failures the player causes and then fixes with their own hands. The
board is the map: thirteen stations lie along the chain from button to lamp, and a
saved pulse shows how far you have built.

See [DESIGN.md](DESIGN.md) for the full design bible.

## Play

The build is plain static files. ES modules must be served over HTTP, so a simple
local server is enough:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open <http://localhost:8080>. Progress is saved in the browser's local storage.

> The engine loads Three.js and the Paper Mono typeface from a CDN, so the game
> needs a network connection on first load.

## Controls

| Action | Input |
|---|---|
| Continue dialogue | `Z`, `Enter`, `Space`, or tap |
| Turn the knob (time) | `Q` / `E`, or drag the knob |
| Look around | drag |
| Zoom | scroll, or pinch on touch |
| Notebook | `Tab` |
| Hint when stuck | `H` |
| Pause / menu | `Esc` |

## Tests

The two pure simulation models — the power rail and the one-core scheduler — run
under Node with no dependencies:

```bash
node test/sim.test.mjs
```

They assert real behaviour: the bare rail must fail at every gain, a larger
capacitor must forgive more gain than a smaller one, equal-priority tasks must miss
their deadlines, and priority inheritance must prevent a watchdog reset.

## Project layout

```
index.html          title, HUD markup, import map, engine entry point
style.css           all styling, the Paper Mono face, HUD panels
DESIGN.md           design bible (game, teaching rules, stations)
src/main.js         renderer, post-processing, input, game loop, station flow
src/core/           camera rig, HUD, audio, shared utilities
src/world/          bench, stage, deck, city, fly — the places you play in
src/sim/            pure models: rail.js (RC power rail), sched.js (scheduler)
src/chapters/       stations 00, 01, 05 (the guided chapters)
src/stations/       the other ten stations, plus kit.js
src/bot.js          development check that plays all stations (console: game.bot.all())
test/               node test/sim.test.mjs
```

## Credits

- Game and code: [Contributors](CONTRIBUTORS.md).
- [Three.js](https://threejs.org/) 0.170 (MIT) — 3D engine.
- **Paper Mono** by [Paper Design](https://github.com/paper-design/paper-mono)
  (SIL OFL 1.1) — the one typeface.
- [Strudel](https://strudel.cc/) `@strudel/web` 1.3.0 (AGPL-3.0-or-later) — the music.

## License

Licensed under the [Apache License 2.0](LICENSE).
