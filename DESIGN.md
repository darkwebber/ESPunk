# ONE PRESS — design bible, v2

A learning game about the ESP32, played in a browser (Three.js). There is no video or tour mode.
The linear film in `esp32-explainer/` is untouched and separate.

## 1. The game in one paragraph

Someone presses a button; a lamp across the room lights. Between the two lie a few milliseconds in which a dozen systems
must each do their job. The game slows that sliver of time until you can live inside it, and makes you do every job
yourself. Each job you master you replace with a part or a rule, which frees your hands and exposes the next job.
**You win by making yourself unnecessary:** in the last scene you press the button and touch nothing else.

## 2. What kind of game this is

A real-time operation game that turns into an automation game. Closest relatives: the hand-crank-then-automate arc of
factory games, and the one-resource pressure of a short-order kitchen. It is not a quiz: nothing asks a question, and
nothing is solved by picking an answer. Every lesson is a failure the player causes and then fixes with their own hands.

### The three verbs

| Verb | Input | Meaning in every station |
|---|---|---|
| **Hold** | cursor position, or press and hold | Your hand is the scarce resource. Whatever you hold is served: current to the rail, the core to a task, the antenna to a radio. One hand, so one thing at a time, which is the constraint every station is about. |
| **Turn time** | the knob on the instrument, `Q` `E` | Slow enough and anything can be done by hand. The chip cannot slow time, so nothing counts until it works at full speed with your hands off. |
| **Fit** | drag a part or a chip into the board | Parts and rule chips are how you stop holding. They have real trade-offs, and a bad fit fails in a specific, visible way. |

### The station loop

1. **Shift.** Do the job by hand at slowed time. It is playable and gets faster.
2. **Break.** At speed it breaks in the true way (brown-out, missed deadline, watchdog reset), and the instrument shows why.
3. **Fit.** Slot the part or rule that does your job, tune it, and pass at full speed, hands off.
4. **Sign off.** A notebook page records what you built and what you now know.

You can always reach back in and hold something yourself, even after fitting a rule. Several problems are solved by
doing exactly that, and the game recognises it: rescue the starving task by hand and the rule chip for it appears.

### Progress

The board is the map. Thirteen stations lie along the chain from button to lamp. At the bench, pressing the button sends
a pulse along the chain; it dies at the first station you have not built, and says which one. The distance the press
travels is the progress bar.

## 3. Screens

| Screen | What it is |
|---|---|
| Title | The words, and one round key marked *press*. You press it. Nothing happens: the board is dead. That is the first lesson and the start of the game. |
| Bench | The board on a dark desk, the lamp far off. Free camera. Press the button to see how far a press gets; click a district to enter its station. |
| Station | The camera moves into a district (or dives inside the chip). Live play with the three verbs. |
| Notebook | Every fact earned, with its source. Opened from the slip or with `Tab`. |
| Sign-off page | End of a station: your build in numbers and the facts gained. |
| Pause | A plain list. Stations can be replayed. |

## 4. Interface

One typeface, **Paper Mono** (SIL OFL 1.1). The look is a repair bench on a high floor of a wet neon city.

- **Three signal colours.** Yellow is the game speaking (work order, dialogue, station card). Cyan is the chip
  (instrument, hints, callouts). Magenta is radio. Amber stays for power on the board.
- **Panels** are black with one corner cut off and a hairline edge; no rounded boxes, no glass, no drop shadows.
- **Work order** at top-left: a yellow header naming the station, three or four goals, hints as `//` lines that
  escalate with idle time to an offer to do the step.
- **Instrument** at bottom-right: one screen and one knob, which is time.
- **The game's voice** is one line in a strip at bottom-left; it waits for the player.
- **Labels in the world** are name plates on a leader. Names only.
- **Places.** The bench looks out through glazing at towers, signs, traffic and rain (`world/city.js`). Stations set
  inside the chip stand on a grid of low blocks running to the horizon.
- **Cuts.** Moving between places slams twelve shutters across and tears the picture; arriving at a station flashes its
  number and name. A reset tears the picture harder.
- **Finishing shader:** grain, vignette, scanlines, an indigo grade in the shadows, lens fringing, and the tear.

Libraries considered: OpenShaders has no shader catalogue published yet, so shaders are written here. react-bits is
React-only and this is a plain Three.js page, so nothing is imported from it. daisyUI would pull the HUD toward a web
dashboard, the opposite of the aim, so it is not used.

## 5. Teaching rules

The player is assumed to know nothing: not what an ESP32 is, not what an antenna, a volt or a capacitor is.

1. **The goal comes first and never changes:** press here, lamp lights there, no wire. Every station is the next
   thing standing between the press and the lamp.
2. **Start where a beginner starts.** The first station ends with the smallest complete thing a computer does: you
   press the button and the board's own light answers. Radio appears only when the lamp turns out to be out of reach.
3. **No word before its need.** A part or term appears only after the player has met the problem it solves. It is
   named first in plain words ("a small tank of charge beside the chip"), then by its real name ("a capacitor").
   This applies to the instruments too: the oscilloscope is introduced, and its axes explained, the first time
   something happens too fast to see.
4. **Failure before explanation,** and caused by the player: they turn the shout up themselves until the board blacks out.
5. **The player sets the pace.** Story is told in a dialogue strip that waits for Z, Enter, Space or a tap on every
   line. Nothing advances on a timer. Remarks about what just happened stay until dismissed.
6. **Labels in the world are names only.** Explanations live in the strip. A layout pass keeps labels off each other
   and off the HUD at any camera angle.
7. **Consequences are stated in lamp terms:** a late button job is a lamp that lights late; a restart is a press lost.

## 5b. Stations, in the order the device needs them

All thirteen stations are built and play in this order. The bench always offers the next unbuilt one; the menu replays any built one.
*verify* = not yet checked against the datasheet.

| # | The wall you hit | Station | What you do | What you fit or learn |
|---|---|---|---|---|
| 00 | You do not know what this board is, and it is dead | **Wake it** ✔ | Tour five parts; plug in; find that an awake chip does nothing; drag the button to the light | Volts, the regulator, pins, a first instruction. Ends: press, and the light answers |
| 01 | The lamp is across the room and there is no wire | **A voice** ✔ | Turn the shout up yourself until the board blacks out; watch it on the oscilloscope; be the regulator by hand | What radio is and why loud costs power; brown-out; a capacitor; how hard the regulator reacts |
| 02 | A shout is not a message | The air | Shape the wave so a 1 and a 0 look different through noise | A modulation that survives the room |
| 03 | Nothing at the lamp is listening | A listener | Power a second board, address it, send | Pairing, the delivery callback. **The lamp lights here** |
| 04 | One press sometimes counts as five | Clean presses | Catch a bouncing contact by hand | Pull-ups, debounce, interrupts |
| 05 | You add a status light and a log, and the lamp lights late | **One core** ✔ | Hold each job on the core as the clock speeds up; rank them; rescue a starving job by hand | Priorities, a shared baton, the watchdog, priority inheritance |
| 06 | Three jobs are too many for one worker | Two cores | Split jobs across two cores; a shared count goes wrong | A lock |
| 07 | You want a display and a sensor | Buses | Clock bits out by hand: UART, I²C, SPI | Baud, address, mode |
| 08 | You want to switch it from a phone | Wi-Fi | Take turns on a crowded channel; exchange the handshake | Backoff; why this path is slower than station 03 |
| 09 | The phone is not on that network | Bluetooth | Hop channels while Wi-Fi blocks some | Channel map, sharing one antenna, a GATT table |
| 10 | You cut the cable and the battery dies in a day | Sleep | Switch districts off and watch the microamps | A duty cycle and a wake source |
| 11 | Someone reads your Wi-Fi password off the chip | The fuse | Dump an unprotected flash | eFuses, burned once, permanent in your save |
| 12 | Nothing is left | One press | Press the button and ride the signal through everything you built | — |

## 5c. Desktop and phone

One build serves both. Pointer events drive mouse and touch alike: drag to look, pinch or scroll to zoom, press and
hold, drag parts. Below 720 px the slip shows only the current goal, the dialogue strip stacks above a full-width
instrument, key legends disappear and "click" becomes "tap". Wrapping this build as installable apps (for example
with Capacitor) is a later packaging step, not a second codebase.

## 6. Feel

- **Failure is physical.** A reset tears the picture, cuts the lights, and reboots. It costs seconds, never progress.
- **Music is written in Strudel** (`@strudel/web` 1.3.0 from a CDN, AGPL-3.0-or-later; synth voices only). One
  four-bar progression in D minor and one tune run through the whole game. Each station has a scene whose lead voice
  plays its idea: a byte keyed as a rhythm (02), call and answer in opposite ears (03), notes that bounce (04), three
  voices that never overlap (05), one line per ear (06), a strict clock (07), a line that only speaks in gaps (08), a
  line that hops (09), a chord that breathes (10), a wrong semitone and crushed bits (11). Voices join as goals on the
  work order are ticked. The tune's first note is the press; the bell that answers it is not heard until the lamp is lit.
  Slowing time takes the drums out. If Strudel cannot load, a small built-in score plays. Unheard by its author; levels
  were checked with an analyser only.
- **Sound effects** are plain WebAudio.
- **Mastery is optional and in engineering terms:** margin over brown-out, smallest capacitor that passes, jobs late.

## 7. Build

- Three.js 0.170 and the font load from a CDN; vendoring both locally is an open step.
- `src/sim/` pure models with tests (`node test/sim.test.mjs`): the rail as a tank with a lagged proportional loop, and a
  one-core scheduler with a mutex, inheritance and a watchdog. Wrong answers fail because the model fails.
- `src/chapters/` stations 00, 01 and 05; `src/stations/` the other ten, plus `kit.js`. `src/world/deck.js` is the lane table shared by the timing stations (02, 06, 08, 09).
- Every station is one async function. `src/core/` camera rig, HUD, audio. `src/world/` bench and stage.
- `src/bot.js` is a development check, not a mode: it plays all thirteen stations through the player's own actions, fails on a
  soft-lock and reports HUD overlaps. Run `await game.bot.all()` in the console.

## 8. Open

- Whether holding the rail by cursor height feels good is a question for a human hand; the numbers were tuned by a
  simulated player with a 0.3 s reaction delay.
- Touch input is built but has only been checked in an emulated phone viewport, not on a real phone.
- Datasheet verification of every *verify* number.
