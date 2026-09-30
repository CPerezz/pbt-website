---
owner: PbtVisual
status: final
---

# Reference board — visual/interaction grammar for the PBT 3D explainer

Two sources: (1) the airsup rocket-engine lab, explored live (not just the 3 pre-pulled video
frames), because it's the explicit stylistic target; (2) four external references chosen because
each teaches a *specific tree/DAG visualization trick* the airsup lab doesn't have, since airsup
explains a physical machine, not a data structure. All screenshots in `refs/` are mine, captured
2026-09-28 by driving the live site with the browser tool (drag-orbit, mode clicks, keyboard-scrub
on the throttle slider, chapter navigation). File `readme` fields cross-reference which screenshot
backs which claim below.

## 1. airsup lab — deepened grammar

### 1.0 Correction to the brief's summary

The brief (§3) describes the bottom pill as switching between two "chapters" of one page. Live
interaction shows it's bigger than that: `/lab/rocket-engine` is one page in a **lab of eight
separate machines** (Fusion reactor, Raptor 3, Turbopump, Production line, Drive unit, Cybertruck,
Humanoid, Black hole, Jet engine), each its own route (`airsup.ai/lab/<slug>`) with its **own
bespoke control schema** — not a shared generic HUD reused verbatim. Turbopump's HUD has
`Follow: All | Oxygen | Hot gas`, `Scenario: Running | Spin start | Cavitation`,
`Pump: Whole | Cutaway | Exploded`, and a bonus toggle with no rocket-engine equivalent:
`Strobe light — freeze the blades` (refs/airsup-07-chapter-turbopump.png,
refs/airsup-08-turbopump-cavitation-exploded.png). **The lesson for us:** don't design one generic
HUD schema and stamp it on every journey/zone. Design the *grammar* (position, chip style, pill
style, caption rewrite pattern) once, then give each journey/zone the 2-4 controls that are
actually interesting for it — J2 (deploy) needs a "Follow: bytecode / storage-write" toggle that
J7 (clear a slot) has no use for.

### 1.1 Confirmed interaction verbs (from `refs/airsup-09-help-overlay.png`, the in-app help card,
transcribed verbatim because it is the exact spec of the manipulation grammar):

> "Drag to orbit, scroll or pinch to zoom, right drag to pan. Pick a machine at the bottom, or
> press the house to see the whole lab and click any machine in it. Cutaway slices the engine in
> half so you can see every passage. Follow lights up one propellant from the tank to the flame.
> Throttle and altitude change the chamber pressure and the air outside, which is what shapes the
> plume and its shock diamonds."

Plus a **data-honesty footnote** in the same card: "The model is simplified from public photos and
diagrams. Thrust and specific impulse follow SpaceX's published Raptor 3 figures (280 tf, 350 s)
and mass flow follows from those two. Chamber pressure uses the 350 bar SpaceX has reached in
Raptor testing. Everything else is an estimate." **Steal this pattern outright**: a dismissible
help card with the manipulation grammar in plain verbs, closed with the honesty footnote about
what's real vs. estimated. Our equivalent footnote must say plainly that BLAKE3 is the reference
implementation's hash but the EIP's final hash choice is undecided (fact sheet §4) — same spirit,
different fact.

### 1.2 "Follow" is a highlight/isolate filter, not a camera tracker

Confirmed by driving it: clicking `Follow: Oxygen` does **not** move the camera to chase a fluid
particle. It desaturates every component *not* on the oxygen path to flat grey silhouette and
keeps the oxygen-path components in full color and labelled — a spotlight/isolate effect layered
on top of whatever Engine view (Whole/Cutaway/Exploded) is already active. See
refs/airsup-03-exploded-follow-oxygen.png (methane turbopump and the whole chamber/nozzle assembly
go grey while the oxygen turbopump stays lit) contrasted with
refs/airsup-04-cutaway-follow-methane.png (methane's regenerative-cooling loop around the outside
of the nozzle lights up orange, oxygen path goes grey). **Steal**: "Follow" = a material/opacity
filter over the existing camera state, cheap to implement, works in any Engine/Pump mode
combination. **For PBT**: our analogous control is "Follow: this account's path only" — desaturate
every node not on the root→target path, don't move the camera.

### 1.3 Caption text is rewritten per selection, not a fixed paragraph

Every Follow/Altitude/Engine change rewrites the one caption card's full sentence, with bold
keywords colour-matched to the flow (oxygen=cyan, methane=orange). Two examples transcribed
verbatim, both physically precise, both ≤3 sentences:
- Methane follow (refs/airsup-04-cutaway-follow-methane.png): "Methane takes the long way. Its pump
  sends it down the outside of the nozzle and back up through channels in the wall, cooling the
  metal, then into its own preburner. That hot gas spins the turbine and flows into the injector."
- Turbopump cavitation (refs/airsup-08-turbopump-cavitation-exploded.png): "Starve the inlet and
  the oxygen starts to boil on the blades. Vapor bubbles form at the inducer and collapse further
  in, the pump loses its grip and pressure falls away. The inducer exists to stop exactly this."
Note the second one answers "why does this part exist" — a *pedagogical* caption, not just a
description. **Steal this pattern for our Why-PBT panels and A2-A5 zone atlas**: captions should
answer "why does this field/zone/rule exist," not just name it.

### 1.4 Exploded view = translate along one shared axis, labels follow their part

refs/airsup-02-exploded.png: parts separate along the engine's longitudinal centerline (not
scattered randomly); every pill label keeps its leader-dot attached to its part and repositions
with it; the caption rewrites to a part inventory ("Pulled apart: the gimbal, its preburner and
turbine, the methane turbopump beside them, the injector and the cooled chamber and nozzle.").
refs/airsup-08-turbopump-cavitation-exploded.png shows the same trick at a different scale: parts
sit on individual pedestal stands (a "museum display" visual cue that a part is now free-floating
rather than assembled), and a continuous shaft rod threads through every separated stage, visually
proving "one shaft, two jobs" even while exploded. **For PBT**: our "explode" is the reverse of
airsup's — instead of separating one rigid object's parts, we separate *tree regions* (zones) that
already look scattered; the equivalent trick is pulling one zone bucket forward/aside along the
tree's radial axis with the connecting edge staying drawn as a thin line back to its attachment
point, so the viewer never loses which subtree the isolated bucket came from.

### 1.5 Chapter switch = full route navigation with camera memory (not chapter memory)

Switching to `/lab/turbopump` and back changes URL, title, and the entire control schema for that
machine, but does **not** reset the user's manual orbit — clicking a chapter pill only re-triggers
if the destination *is* the current route (re-clicking "Raptor 3" while already on Raptor 3 did not
reframe the camera; confirmed by comparing refs/airsup-05-orbit-rotated.png,
refs/airsup-06-altitude-vacuum.png, taken after an orbit-drag and several control clicks — camera
never snapped back). Only navigating fresh to a lab's default state (first load) gives the
canonical framing (refs/airsup-01-whole-default.png). **For PBT**: our "select an action → the page
becomes a trip through the trie" transition must *always* trigger a fresh authored camera path on
journey entry, regardless of what the user was doing before — we cannot rely on "switching modes
resets the camera" the way airsup's own re-click behavior might suggest; be explicit about this in
the state machine (see experience-spec.md).

### 1.6 Metric chips are live physics readouts, not static labels

Thrust/Chamber/Burning chips update numerically and immediately with Throttle and Altitude:
100% throttle sea level = `280 tf / 350 bar / 800 kg/s`; scrubbing throttle to 40% via keyboard
(`ArrowLeft` on the focused slider) dropped it live to `118 tf / 141 bar / 321 kg/s`
(refs/airsup-10-throttle-low.png); switching Altitude to Vacuum at full throttle raised thrust to
`294 tf` with a caption explaining exactly why ("In vacuum nothing pushes back...",
refs/airsup-06-altitude-vacuum.png). **Steal**: the chips are not decoration, they are the same
numbers driving the render, always consistent with what's on screen. **For PBT**: our chip
equivalent (e.g. "Depth 24 · Hashes recomputed 6 · Bytes written 96") must likewise be read from
the *same* fixture data driving the animation, never a separately hand-typed caption number.

### 1.7 What to explicitly NOT imitate

- **Vocabulary.** Never reuse "Thrust," "Chamber," "Throttle," "Burning," rocket-part names, or
  the "?" copy verbatim — it's borrowed grammar, not borrowed domain. Our chips are protocol
  numbers (depth, hash count, bytes, chunk count), our pills are protocol states (zone name, bit
  prefix, hash algorithm), never rocket words.
- **Single hero object staged on a literal workbench.** airsup's whole set (dark studio, stand,
  sticker labels reading "airsup.ai/rocket-engine 1:4 scale") sells "this is a real physical thing
  photographed in a lab." A PBT trie is not a physical object and pretending otherwise (e.g.
  rendering the tree as if it sat on a workbench) would be a decorative lie the brief explicitly
  forbids (§8, "no decorative lies"). Keep the dark-studio *lighting/mood*, drop the
  workbench/photography staging conceit.
- **The "share screenshot" and "Follow on X" affordances** are social-growth features for a viral
  demo, orthogonal to a teaching tool; skip unless the design agent is separately asked for
  shareability.
- **Camera behavior on re-selecting the current mode** (§1.5 above) — that's an accidental gap in
  airsup's own UX, not a pattern to copy; our journeys need deterministic camera resets on entry.

## 2. External references — tree/DAG/exploded-diagram tricks worth stealing

### 2.1 Iden3 — "Merkle trees: a visual introduction" (blog.iden3.io, Sacha Saint-Leger, 2020)
<https://blog.iden3.io/merkle-trees-visual-introduction.html>

A static-image essay, zero WebGL, that still out-teaches most interactive demos through pure
sequencing. Two tricks worth stealing:
- **Tamper cascade as a strict one-frame-at-a-time reveal**: leaf tampered → its parent's stored
  hash now mismatches (shown as one image swap) → *that* parent's parent mismatches → ... → root
  mismatches. Each step is its own frame/still, never animated as one continuous blur. **Use for**:
  our "state transition rule" (writing 32 zero bytes deletes a key) and for teaching "one hash
  changes, everything on its path to root recomputes" (W3, one tree no storage roots) — do it as a
  discrete beat-by-beat bottom-up highlight, one node lighting up per beat, not a single
  all-at-once flash.
- **Proof-of-membership sequencing**: show the full tree once, then progressively *grey out*
  everything except the target leaf's path-to-root plus its siblings, then re-derive the root by
  visibly re-hashing pairs bottom-up and comparing to the stored root. **Use for**: J9 (prove it)
  and our witness encoding — this is the single cleanest reference for "witness = path + siblings,
  everything else is greyed and irrelevant."

### 2.2 Vitalik Buterin — "Verkle trees" (vitalik.eth.limo, 2021-06-18)
<https://vitalik.eth.limo/general/2021/06/18/verkle.html>

Directly useful for two diagrams:
- **Sister-node highlighting in red** for a Merkle proof (his `4ce` example): every node needed for
  verification that is *not* on the direct path is drawn in red, so the eye immediately separates
  "path" (black/normal) from "proof overhead" (red). **Use for**: our witness/proof beat (J9) —
  path nodes get the "active" tree color, sibling nodes get a distinct highlight color, everything
  else fades. This is the single most load-bearing diagram convention for the whole Why-PBT / W1
  proof-size story, because PBT's binary width (k=2) is exactly the "more sibling overhead per
  level, but no per-level width-1 cost" case Vitalik's own width-vs-proof-size table (§4 fact sheet
  numbers) argues against Verkle's wide branching — **do not** let our tree-widening visuals
  accidentally make PBT's narrow branching look like a disadvantage; frame the highlighted-sibling
  count honestly (k=2 has more highlighted siblings than a wide Verkle node, and that's the honest
  trade PBT is making for hash-only crypto — say so, don't hide it).
- **"Not final form" framing**: Vitalik explicitly labels one mid-argument diagram "not final form"
  before improving on it. **Use for**: our hash-algorithm-undecided disclosure (BLAKE3 vs Keccak vs
  Poseidon2, fact sheet §4) — a small "not final" or "candidate" tag on the hash-lab visualization
  is a precedent for flagging genuine protocol uncertainty inline without a wall of caveat text.

### 2.3 Whitebox — "Ethereum's execution layer, made transparent" (AnkushinDaniil/whitebox, GitHub)
<https://github.com/AnkushinDaniil/whitebox>

Not WebGL (Astro + React + SVG/d3-hierarchy), but the closest sibling project to ours in *intent*:
an interactive explorable-explanation site whose flagship page is a live Merkle-Patricia-Trie
visualizer, and whose component names independently validate the vocabulary we're about to publish
in `pbt-visual-encodings.md` — they built a `HashMachine.tsx`, a `MptDerivation.tsx`, a
`NodeInspector.tsx`, a `ScrollyTrie.tsx` (scroll-driven trie walkthrough), a `TrieControls.tsx`, and
critically a `StructureCompare.tsx` that contrasts MPT vs. Verkle vs. Binary tree structure
side-by-side. Two tricks worth stealing:
- **Depth layering as an explicit, reusable framework primitive**: every explorable is composed as
  `intuition → mechanism → spec & code → go deeper` (their `DepthLayer` component), so a reader can
  stop at "I get the idea" or go all the way to reading the exact spec excerpt inline
  (`SpecExcerpt.astro`). **Use for**: our Zone Atlas (A0-A5) and Why-PBT panels — each panel should
  have the same depth ladder (one-line intuition visible by default; formula/spec-excerpt behind a
  "go deeper" affordance), matching the brief's "minimal text... detail on demand" (§8).
  Concretely: don't inline the full `encode_bit_prefix` byte layout in the caption; put the
  one-liner in the caption and the exact byte layout behind a "go deeper" expand.
  A structural side-by-side comparison view is the right container for our own "why not MPT"
  panel (W1/W3): mirror their `StructureCompare` idea as an MPT-vs-PBT split-screen showing the
  same account under both trees, not just prose asserting PBT is smaller.

### 2.4 Learn Git Branching (pcottle/learnGitBranching, 34k★ GitHub)
<https://learngitbranching.js.org/>

The most widely used interactive DAG visualizer for a non-blockchain audience, and structurally the
closest thing to our Key Forge sandbox (X1). Tricks worth stealing:
- **Command in, tree mutates live, no camera choreography needed.** Every git command
  (`commit`, `branch`, `merge`, `rebase`) is typed into a real input, and the commit DAG redraws
  incrementally in response — no cinematic camera move, just a diff-highlighted graph update.
  **Use for**: X1 Key Forge — typing an address/slot/bytecode should re-derive the key live and drop
  a new leaf into the demo tree the same way, with the *new* node visually distinguished (e.g.
  a brief highlight-then-settle), no camera flight required for every keystroke.
- **`undo` / `reset` and shareable permalinks that replay a command sequence.** Both are cheap,
  high-value affordances for a technical audience that wants to try something and back out.
  **Use for**: X1 should have an explicit "reset to demo tree" action, and ideally a
  copy-permalink-that-replays-this-derivation affordance for sharing a specific "look what this key
  looks like" state with a colleague.
- **Levels vs. sandbox as two clearly separated modes** — the same underlying visualizer serves a
  guided-challenge mode and a free-play mode. **Use for**: distinguishing our guided journeys (J1-J11,
  fixed beats, camera-directed) from the Key Forge (free play, no fixed beats, no imposed camera).

### 2.5 iyO — "selling the world's first audio computer" (Awwwards case study, Matteo Donini/Federico
Valla, 2026) <https://www.awwwards.com/iyo-case-study-selling-the-worlds-first-audio-computer.html>

The single closest sibling to airsup's own exploded-view mechanic (same trick, different industry),
and the source with hard, citable performance numbers instead of vibes:
- **Scroll-driven exploded view with hover-float-and-hotspot**: parts separate along the Z-axis as
  the user scrolls (not as a button toggle); hovering a component floats it slightly further
  forward and shows a hotspot naming it. "The more parts a product has, the further it comes
  apart" — explosion *distance* scales with part count, not a fixed offset. **Use for**: our zone
  "explode" affordance (§1.4) — scrub/scroll-driven rather than a single instant toggle, and the
  separation distance between zone buckets should scale with how many groups/leaves are in that
  bucket, which doubles as a free visual encoding of "this zone/bucket is bigger."
- **Concrete, reusable performance numbers** for the design/perf-guidance section of
  `experience-spec.md`: retina screens rendered at a *slightly reduced pixel ratio* cut shader cost
  ~44% with no visible quality loss; CAD-heavy source geometry was retopologized and Draco-compressed
  to glTF for web delivery; particle-system counts are tiered down on lower-end devices to hold 60fps
  at every tier; single-page-app navigation (no full reloads) with explicit per-scene listener
  cleanup keeps memory flat across navigation instead of creeping up. **Use for**: cite these as
  concrete precedent numbers in experience-spec.md's performance section (device-scale-factor
  clamping, LOD tiering by device class, explicit teardown on journey-to-journey transitions).

## 3. Screenshot manifest (refs/)

| File | State captured | Backs claim in |
|---|---|---|
| `airsup-01-whole-default.png` | Raptor 3, Whole engine, All follow, Sea level, throttle 100% (fresh load) | §1.5, §1.6 |
| `airsup-02-exploded.png` | Raptor 3, Exploded, All follow | §1.4 |
| `airsup-03-exploded-follow-oxygen.png` | Raptor 3, Exploded, Follow: Oxygen | §1.2 |
| `airsup-04-cutaway-follow-methane.png` | Raptor 3, Cutaway, Follow: Methane | §1.2, §1.3, §1.6 |
| `airsup-05-orbit-rotated.png` | Raptor 3, after a manual drag-orbit past the nozzle | §1.5 |
| `airsup-06-altitude-vacuum.png` | Raptor 3, Whole, Altitude: Vacuum | §1.5, §1.6 |
| `airsup-07-chapter-turbopump.png` | Turbopump route, default state, distinct HUD schema | §1.0 |
| `airsup-08-turbopump-cavitation-exploded.png` | Turbopump, Scenario: Cavitation, Exploded | §1.0, §1.3, §1.4 |
| `airsup-09-help-overlay.png` | Raptor 3, "How to use" modal open | §1.1 |
| `airsup-10-throttle-low.png` | Raptor 3, throttle scrubbed to 40% via keyboard | §1.6 |

Pre-pulled frames already read (not duplicated here): `sources/raw/2026-09-28--airsup-raptor3-demo.mp4`
at `:6s` (Cutaway, All follow, sea level — establishing shot with in-scene pill labels and the
"airsov.ai/rocket-engine 1:4 scale" sticker), `:16s` (Cutaway, Follow: Fire — flame path lit,
chamber/throat/exit pills visible), `:31s` (Turbopump route, Cutaway, a different HUD schema
already hinting at §1.0 before I confirmed it live).
