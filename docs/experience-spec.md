---
owner: PbtVisual
status: complete — §7's 84-row beat table verified 1:1 against PbtTruth's FINAL scenario-bible.md (exact set-diff, 84=84, zero missing/extra)
---

# Experience spec — PBT 3D explainer

Companion files: `reference-board.md` (visual references + screenshots), `local://pbt-visual-encodings.md`
(every encoding's fact-justification, IDs `E1`-`E15`, cross-referenced below rather than re-derived).
Ground truth: `EIPS/EIPS/eip-8297.md` and `local://pbt-explainer-brief.md` §4 (fact sheet). This file
stands alone — a design agent implementing it needs no other file to build the experience, though it
should also read the two above for the *why* behind each rule here.

## 1. Information architecture

```
HERO  →  ACTION PICKER  →─┬─→ JOURNEY (J1…J11, guided camera trip)  →  JOURNEY SUMMARY ─┐
                           │                                                              │
                           ├─→ ZONE ATLAS (A0…A5, explore one zone/mechanic at a time)    │
                           │                                                              │
                           ├─→ WHY PBT (W1…W7, mostly comparison panels, minimal 3D)      │
                           │                                                              │
                           └─→ KEY FORGE (X1, free-play sandbox)                          │
                                        ↑____________________________________ any of the above ← summary/atlas/why can return here
```

- **HERO.** Full-bleed dark scene, one ambient wide shot of the demo tree slowly auto-orbiting
  (never user-controlled here — this is a "poster shot," not an interaction). One sentence: what
  PBT is, in the same register as the airsup lede ("Ethereum's new state tree, in 3D. Follow your
  own transaction through it."). One CTA: "Start a trip." No metric chips yet — nothing has
  happened, there's nothing to measure.
- **ACTION PICKER.** A grid of cards, one per journey (J1-J11), each showing: title, the
  scenario-bible's one-line "Teaches:" hook, and a recommended-order number (brief §5 order is the
  default sort, not alphabetical or by ID). Three always-visible secondary entries below the grid,
  visually demoted (smaller, no card chrome): "Revisit the zones" (→ Zone Atlas), "Why PBT at all"
  (→ Why panels), "Forge your own key" (→ Key Forge). The picker is reachable from anywhere via the
  persistent home icon (mirrors airsup's house icon, reference-board.md §1.1).
- **JOURNEY.** The guided camera trip through beats `J<n>.B1…B<k>`. See §3 state machine, §7 beat
  table.
- **JOURNEY SUMMARY.** Non-3D-camera-move panel (camera holds its last beat pose): root-before vs
  root-after hash chips, a list of every key touched (created/updated/deleted, from the beat
  schema's "End state" block), and 1-3 contextual links ("This touched the storage zone — see
  `A4`," "This is why PBT dedups code — see `W5`"). Exit to picker or to a linked Atlas/Why panel.
- **ZONE ATLAS.** A0-A5 (brief §5). Free orbit, no fixed beats, no forced camera flights — the user
  picks a sub-mechanic (e.g. inside A3, "live chunker" vs "groups" vs "dedup") and the scene
  reconfigures under their control. Text is a caption + one "go deeper" expand per panel (Whitebox
  depth-layering pattern, reference-board.md §2.3), never a paragraph.
- **WHY PBT.** W1-W7 (brief §5). Mostly 2D/HUD-depth comparison panels (MPT-vs-PBT split screen,
  big monospace numbers from the fact sheet's "Why PBT" figures), with a small always-visible 3D
  witness-path shot for W1/W6 only (the two claims that are actually about tree shape, not just
  numbers).
- **KEY FORGE (X1).** Free-play. Type an address / storage slot / paste bytecode; the derivation
  diagram (E11) animates live, and the resulting key drops into a small demo tree with an
  insert-split animation (E13). No camera choreography, no beats — modeled on Learn Git Branching's
  "command in, tree mutates, no cinematic camera" pattern (reference-board.md §2.4).

## 2. HUD / control-panel spec (adapted from airsup's grammar, restyled for this domain)

Position and chrome are borrowed from airsup (reference-board.md §1); **every label, unit, and
control is our own domain's vocabulary — never a rocket noun.** Layout, all states:

```
┌─ top-left ─────────────────────┐         ┌─ top-right ──────────────────────────────┐
│ wordmark                       │         │ Follow: [Whole tree|This path|This zone]  │
│ two-line state title           │         │ Zoom:   [Tree|Zone|Node]        (1..4)    │
│ 1-2 sentence lede              │         │ ▶ ⏸  ?                                     │
│ metric chips (label + mono val)│         └────────────────────────────────────────────┘
│ ONE caption card, rewritten    │
│ per beat, bold keywords tinted │
│ to the concept's zone color    │
└─────────────────────────────────┘
                                 ┌─ bottom-center: beat scrubber (journeys only) ─┐
                                 │  ● ── ● ── ○ ── ○ ── ○     "Beat 3 of 7"        │
                                 └──────────────────────────────────────────────────┘
   bottom-left: home icon                              bottom-right: keyboard-help icon
```

### 2.1 Metric chips (top-left, 2-3 per state, live numbers only — never hand-typed)

Journeys: `Depth <n>` · `Hashes recomputed <n>` · `Bytes written <n>`. Zone Atlas: chips are
zone-specific (A3 code zone: `Chunks <n>` · `Groups <n>` · `Dedup saves <n>`; A4 storage zone:
`Bucket <n>` · `Groups <n>` · `Slot <n>`). Why panels: the fact sheet's own headline numbers
(`MPT branch @12: 5760 B` vs `PBT k=2 @24: 768 B`), always shown as a paired MPT-vs-PBT pill, never
PBT alone (a lone impressive number with no comparison is a decorative lie by omission). Every
chip value comes from `pbt-fixtures.json` or the fact sheet, never authored per-beat as a string —
mirrors airsup's chips being live physics readouts (reference-board.md §1.6).

### 2.2 Right-side controls (segmented, hotkeys 1-4, mirrors airsup's `Follow`/`Altitude`/`Engine` row)

- **Follow** — `Whole tree | This path | This zone`. Isolate/desaturate filter, camera does NOT
  move (reference-board.md §1.2). "This path" = the current beat's active root→node path lit,
  everything else ghosted (feeds E9's rendering when a witness/path beat is active; outside a
  witness beat it just highlights whatever nodes the current beat is touching). "This zone" dims
  every node outside the current zone sector (feeds E5).
- **Zoom** — `Tree | Zone | Node`, hotkeys `1`-`3` (airsup used `1`-`4` for its 4 Follow options;
  we have 3 zoom tiers so we keep 3 keys, not pad to 4 for symmetry). `Tree` = the wide establishing
  shot; `Zone` = one zone sector filling the frame; `Node` = close enough to read a single leaf's
  key/value label and, for a sub-index fan (E4), see individual slots. This is our substitute for
  airsup's `Engine: Whole|Cutaway|Exploded` — "Exploded" has no literal analogue (we don't explode
  a rigid object) but "Zone" pulling one district forward along the radial axis IS our exploded
  view (reference-board.md §1.4's "pull one bucket aside, keep a thin line back to its attachment
  point").
- **Play/Pause ▶⏸** — auto-advances beats on a timer (§3 durations); pausing freezes on the current
  beat indefinitely, user can still manually step.
- **? help** — dismissible card, plain-verb interaction grammar + one data-honesty line, exact
  airsup pattern (reference-board.md §1.1): "Drag to orbit, scroll to zoom. Follow highlights one
  path or zone without moving the camera. [Zone name] chips are read live from the demo world, not
  hand-typed. The tree's hash function is BLAKE3 in this build; EIP-8297 has not finalized the hash
  — see W6." "Got it" dismiss.

### 2.3 Bottom-center beat scrubber (journeys only; replaces airsup's chapter pill)

Airsup's bottom pill *switches machines* (a route change, reference-board.md §1.0/§1.5); ours
*steps through one journey's fixed beat sequence* — mechanically closer to a slide deck's progress
dots than a router. Dots fill in as beats are visited; clicking a future dot jumps ahead (skippable,
not gated — a curious/impatient reader must be able to skip); clicking a past dot replays it. Label
reads `"Beat <k> of <n>"` plus the current beat's name from the scenario bible.

### 2.4 Bottom-left home icon, bottom-right keyboard-help icon

Home always returns to ACTION PICKER regardless of current state (mirrors airsup's house icon,
reference-board.md §1.1). Keyboard-help icon opens a small legend (`Tab` cycles controls, `←/→`
steps beats, `Space` play/pause, arrow-drag or `WASD` orbits) — see §6.4 accessibility.

## 3. State machine

### 3.1 States

`HERO` · `PICKER` · `JOURNEY_ENTER(n)` (transition) · `JOURNEY_BEAT(n,k)` · `JOURNEY_EXIT(n)`
(transition) · `SUMMARY(n)` · `ATLAS_ENTER(z)` (transition) · `ATLAS(z)` · `WHY(w)` ·
`SANDBOX_ENTER` (transition) · `SANDBOX`.

### 3.2 Transitions, mount/unmount, camera behavior

| From → To | Camera | Mount | Unmount | HUD |
|---|---|---|---|---|
| `HERO → PICKER` | cut (no flight — nothing has been "entered" yet) | picker card grid (2D overlay) | hero ambient auto-orbit script | picker chrome, no chips |
| `PICKER → JOURNEY_ENTER(n)` | **authored flight**, current pose → journey `n` Beat-1 pose, 1.2s ease-in-out, ALWAYS runs even if the user is mid-orbit or this is a re-entry (§ reference-board.md 1.5 — do not copy airsup's accidental non-reset) | journey `n`'s Pre-state fixture world, IF different from whatever world is currently mounted (see §3.3) | previous world's meshes, if swapped | journey chips + caption card + beat scrubber fade in during the flight's last 300ms |
| `JOURNEY_BEAT(n,k) → JOURNEY_BEAT(n,k+1)` | **authored flight** to beat k+1's camera pose (see §3.4 for how the pose is computed) OR a **hold** (no camera move) if the beat schema marks it `camera: hold` | nodes the beat creates (E13/insert) | nodes the beat deletes (E12/E14, fade to hollow-then-gone, don't hard-cut) | chips update to beat k+1's TRUTH numbers; caption card cross-fades text; beat scrubber dot advances |
| `JOURNEY_BEAT(n,k) → JOURNEY_BEAT(n,k-1)` ("previous") | reverse flight to beat k-1's pose | re-mount anything beat k deleted | unmount anything beat k created | mirrors forward transition, numbers revert |
| last beat `→ JOURNEY_EXIT(n) → SUMMARY(n)` | camera holds last beat's pose | summary HUD panel (2D overlay: root diff, key list, links) | beat scrubber (summary has no beats) | summary chips (root before/after) |
| `SUMMARY(n) → PICKER` | cut | picker grid | journey world (unless the next action reuses it, see §3.3) | picker chrome |
| `PICKER → ATLAS_ENTER(z) → ATLAS(z)` | authored flight to zone `z`'s establishing pose | zone `z`'s representative subtree (may be a different, smaller fixture than the journeys' shared world — zones are explored in isolation) | journey/picker assets | atlas chips + zone-specific mini-controls (e.g. A4's slot calculator) |
| `ATLAS(z) → ATLAS(z')` | authored flight between zone sectors OR free-orbit hold if `z'` is reachable by panning within the same mounted world | only what changes between z and z' | only what changes | chips swap to z' |
| any → `WHY(w)` | mostly cut to a fixed comparison-panel camera (2D-heavy state, §1's "minimal 3D" rule) | comparison panel assets; 3D witness shot only for W1/W6 | previous 3D world if not needed | why-panel chips (paired MPT/PBT numbers) |
| `PICKER → SANDBOX_ENTER → SANDBOX` | authored flight to a neutral "workbench" pose, camera then stays fixed (no beats to fly between) | Key Forge input form + a small demo tree | journey/atlas assets | forge chips (`Zone`, `Stem`, `Key`, live-updated per keystroke) |

### 3.3 World reuse rule (avoid needless remounts)

J1, J2, J4, J5, J6, J7, J9, J10 share ONE demo world (the ≤400-leaf fixture, per brief §6
"Fixtures"). Switching between these journeys is camera-and-HUD-only — no remount, which also
means the tree the user has been building intuition about never resets under them, reinforcing "one
tree, no storage roots" (E5) by never *visually* implying separate worlds per journey either. J3
(dedup) and J8 (big contract, >256 chunks) may need to layer in a few EXTRA nodes onto the same
world at entry rather than swap worlds entirely — check against the actual fixture before assuming
a remount is needed; a remount should be the exception, justified per-journey, not the default.

### 3.4 Beat camera pose — computed, not hand-authored

A beat's camera pose is a function of the **nodes it names in its `TREE:` line** (created / read /
updated / deleted node ids), resolved against the tree layout's actual world positions (§4.1) —
never a hand-picked coordinate. Concretely: pose = a framing that fits the bounding sphere of
{named nodes ∪ their direct path-to-root} with standard margins, at a viewing angle biased toward
the current zone sector's "outward" direction (so different zones are approached from consistently
different compass directions across journeys — the account zone is always approached from the
same general direction, etc., building spatial memory of the atlas across journeys). This rule is
what makes camera moves reviewable against the beat table before any 3D asset exists: given
`fixtures/pbt-fixtures.json`'s node list (with positions from §4.1's layout), any beat's camera pose
is fully determined by its `TREE:` node ids.

## 4. Visual / geometric encoding — every tree concept

This section gives concrete geometry; `local://pbt-visual-encodings.md` (E1-E15) gives the
fact-justification for each. Cross-referenced by ID.

### 4.1 Tree layout algorithm

Radial hierarchical layout (same family as d3-hierarchy's radial tree, used by the Whitebox
reference, reference-board.md §2.3): root at world origin; a node's radius = `depth * DEPTH_UNIT`
(`DEPTH_UNIT = 2.4` world units, tuned so a `k=2`, N=300-leaf tree's ~9-11 levels fit a ~25-unit
scene radius — matches the fact sheet's own branch-length table for N≈2^24 scaled down); a node's
angular slice is proportional to its subtree's **leaf count**, recursively divided between its two
children — this is what makes the storage zone (many ERC-20 holders) visibly wider than a
three-leaf EOA's slice, for free, with no hand-tuning (feeds E5's "zone district size communicates
bucket size").

### 4.2 Node geometry (E1, E2)

| Concept | Shape | Size | Material |
|---|---|---|---|
| `LeafNode` | faceted capsule ("gem") | 0.4 world units | opaque, zone-tinted (§5.1), key/value etched label on hover/zoom-node |
| `BranchNode` | small open joint (icosphere or diamond) | 0.15 world units | translucent (60% opacity), no label unless "go deeper" |
| prefix corridor (E3) | single tapered tube, one mesh per edge | length ∝ `len(prefix)` bits (`0.08` units/bit, min `0.05` for zero-length) | zone-tinted, bit string printed along it only at `Zoom: Node` tier |
| sub-index fan (E4) | flat disc, 256 wedge slots, occupied slots raised+lit, empty slots hollow outline | disc radius 0.6 units | schematic/translucent always — never opaque, so it never reads as a solid extra node |

### 4.3 Zone districts (E5, E6)

Three always-present sectors fanning from the root, positioned to encode their real divergence depth
rather than implying false symmetry (PbtTruth's correction: evenly-spaced compass points would
wrongly suggest all three zones are equally "far apart" in the tree). Account and code diverge from
EACH OTHER only one level deeper than they diverge from storage (root splits bit0 into
{account,code} vs. {storage} — a 1-bit divergence; account and code then split from each other at
bit7 — a 6-bit-longer shared prefix), so account and code share one hemisphere and storage owns the
other: account = north-west, code = north-east (both "north"), storage = the entire south
hemisphere. FIXED across the whole experience so users build spatial memory. Boundary angle and
depth are read from the fixture's actual root/child prefixes.
This derivation is now triple-confirmed: analytically (zone-byte arithmetic), against
`pbt-fixtures.json`'s actual root/child nodes, and independently against geth's own exported EELS
vectors (`scenario-bible.md`'s ground-truth appendix, check #5/#7) — no divergence found. Ground-fog
tint per sector at 8% opacity, just enough to read as "a region," never opaque enough to occlude
nodes behind it. A persistent HUD legend chip states the fixed bit
convention (E6): `0 → left · 1 → right (MSB-first)`.

### 4.4 Hash forge (E7) and merkleization wave (E8)

The forge is a small assembler prop (a slotted frame, two input rails, one output rail) that
appears AT the branch node being recomputed — it is not a separate fixed "machine" bolted
somewhere in the scene; it manifests transiently at each recomputed branch, plays its ~600ms
assemble-and-compress animation showing the literal preimage bytes (`tag ‖ prefix-encoding ‖
left_hash ‖ right_hash`), then dissolves. The merkleization wave (E8) is the sequencing layer: it
fires one forge instance per branch on the write's root path, strictly bottom-up, one every ~250ms.
For multi-write beats (e.g. J1's sender+recipient+fee-recipient, J10's many writes), the forge set
is the **union** of every branch on any changed leaf's root path, deduplicated by node id — a
branch reached from two or more changed paths in the same beat fires exactly once, not once per
contributing leaf (PbtTruth's E8 correction: paths merging near the root, per W3, are hashed once
regardless of how many children changed). Total wave duration = `|union| * 250ms`, capped at 2.5s
(10 forges) by speeding up the per-forge interval proportionally beyond that, never by
dropping/skipping forges. The `Hashes recomputed` chip is bound directly to
`pbt-fixtures.json`'s per-beat `hashes_recomputed` field (already computed as this same union by
PbtTruth's generator) — never summed or recomputed client-side.

### 4.5 Witness / proof (E9)

Path nodes: full-opacity, zone-tinted as normal, but outlined in the reserved "active path" color
(phosphor green `#33FF33`, §5.1). Sibling nodes at each level: a small orbiting bead in the
reserved "witness" color (vermillion `#D55E00`), never reused for anything else in the whole
experience. Everything else: fades to 15% opacity, no outline. A HUD chip: `Witness: <n> siblings ·
<bytes> B`, both numbers read directly from the fixture's per-journey witness field (PbtTruth's
formula: per path branch, `2 + ceil(prefixlen/8)` bytes for that branch's `encode_bit_prefix` plus
`32` bytes for the sibling hash; absence proofs additionally carry the diverging neighbor leaf's
full key+value) — never hand-computed client-side.

### 4.6 Dedup (E10)

One shared code-zone geometry; converging thin lines (not tubes — thinner than a real prefix
corridor, visually distinct as "reference," not "structure") arrive from each referencing account's
CODE_HASH leaf. A small floating badge on the shared geometry: `× <n> accounts`.

### 4.7 Key derivation diagrams (E11)

A flat, HUD-depth overlay (not world-space), boxes connected by arrows, monospace byte values
pulled from the fixture. Rendered as an actual 2D layout (CSS/SVG-in-HUD or a billboarded flat
plane facing the camera at a fixed HUD-like depth — design agent's choice, but it must never be
mistaken for tree geometry: no shared materials/shapes with §4.2's node meshes). **Every arrow is
tagged with which hash primitive runs there**, not just "EIP vs. Solidity": `Keccak` (EVM-level,
permanent — CREATE address, `EXTCODEHASH`, Solidity mapping/array slot formulas) vs. `key_hash =
BLAKE3` (tree-level, EIP-8297, explicitly "not final" — stem/tree-index placement). A worked
example must chain both in one diagram (ERC-20 balance: `keccak256(pad32(holder) ‖ pad32(slot))`
produces the raw storage key — Keccak, permanent — THEN `key_hash(addr32)` and
`key_hash(addr32 ‖ tree_index)` place it in the tree — BLAKE3, tree-level, undecided). Non-EIP
(Solidity) derivation steps additionally get a small `Solidity convention, not EIP-8297` tag. Never
label an arrow with an undifferentiated "hash" — conflating the two primitives would wrongly imply
that changing the tree's hash algorithm could change contract addresses or storage-slot math.

### 4.8 Absence, insert-split, delete-merge (E12, E13, E14)

All three are *tree-geometry* animations (not HUD overlays): E12 is a fade-to-nothing of a hollow
outline (in an E4 fan slot, or nowhere at all in free tree space — there is no dedicated "absence"
mesh to design). E13 grows a new E2 joint + E3 corridor at the fixture's actual computed divergent
bit, dropping the old leaf to one child and placing the new leaf at the other, ~500ms. E14 is E13
played in reverse plus a corridor-splice (the surviving branch's printed bit-string label visibly
gains the parent's former prefix bits at its front), ~500ms.

### 4.9 Code chunk tiles (E15)

Flat rectangular tile (distinct silhouette from the E1 capsule, so a code chunk never reads as "just
another leaf" despite being one structurally) labeled with chunk index and a byte preview; zero
address text anywhere on or near it.

## 5. Color, typography, motion system

### 5.1 Color — evolve the migration article's palette, don't reuse it verbatim, and say why

The existing sibling piece (`articles/mpt-to-pbt-migration/index.html`) uses a monochrome
phosphor-green CRT terminal palette (`#33ff33` on near-black, scanline overlay, VT323 display font).
**Keep**: the phosphor green as the single "active/selected" accent (feeds E9's path color, §4.5),
the monospace-first typography, the scanline/glow *chrome* on HUD panels (ties this piece visually
to its sibling article — same knowledge-base identity). **Do not keep as-is**: pure monochrome
green for the 3D scene itself. Reason: this experience needs 4+ simultaneously-distinguishable,
colorblind-safe hues (three zones + a witness-highlight color, per E5/E9), which a single-hue
terminal palette cannot provide without inventing ad-hoc tints that would fail deuteranopia/
protanopia contrast checks. Resolution: **evolve** — same chrome, an Okabe-Ito-derived scene
palette (this is the standard colorblind-safe qualitative palette, verified safe for
deuteranopia/protanopia/tritanopia, not an invented guess):

| Role | Color | Hex | Reused from |
|---|---|---|---|
| Account zone | blue | `#0072B2` | Okabe-Ito |
| Code zone | orange | `#E69F00` | Okabe-Ito |
| Storage zone | bluish-green | `#009E73` | Okabe-Ito |
| Reserved zones (unused 0x02-0xFE) | neutral grey | `#8A8A8A` | — |
| Active/selected path | phosphor green | `#33FF33` | migration article's brand accent |
| Witness/sibling highlight | vermillion | `#D55E00` | Okabe-Ito, reserved exclusively for proofs |
| Scene background | near-black studio | `#0A0D14` | airsup's own set color (reference-board.md §1) |
| HUD text / chip values | phosphor green / off-white | `#33FF33` / `#E2E6E2` | migration article |

Every pairing above is checked against the other rows in the table by construction (Okabe-Ito is
designed as a mutually-distinguishable set); the two "borrowed" colors (phosphor green, near-black)
sit outside the Okabe-Ito hue set and were checked by eye against all six Okabe-Ito rows for
sufficient luminance/hue separation before being added.

### 5.2 Typography

`VT323` (display, HUD titles + numeric chip values — matches migration article and coincidentally
matches airsup's own monospace metric-chip convention) + `IBM Plex Mono` (body: captions, help
card, derivation-diagram labels). No third typeface. No serif/humanist font anywhere — every
sibling piece in this vault is monospace-first; breaking that here would fragment the identity for
no benefit.

### 5.3 Motion

- Camera flights: 1.2s default (journey entry / beat-to-beat), cubic ease-in-out; capped at 1.6s
  max for any single flight (from the fact sheet's own "minimal text, scene carries it" principle —
  a flight that takes attention away from the caption for too long fights the caption instead of
  supporting it).
  ponytail: fixed default 1.2s/1.6s cap chosen by feel from airsup's own pacing (its chapter
  flights read as ~1-1.5s in the captured frames); if the design agent's playtesting says
  otherwise, tune the two constants, not the rule.
- Node mutation animations: E13/E14 ~500ms, E7 forge ~600ms, E8 wave step ~250ms (see §4.4 for the
  cap rule).
- Caption text: cross-fade, never a typewriter/character-reveal effect (reads slower than plain
  fade for no comprehension benefit, and actively hurts the reduced-motion and screen-reader cases
  in §6.4).
- `prefers-reduced-motion`: camera "flights" become instant cuts to the destination pose; E7/E8/E13/
  E14 node animations collapse to their end-state appearing directly (no travel, no forge assembly
  playback) — but every discrete *fact* (which nodes are on the path, how many hashes recomputed)
  must still be fully conveyed by the end-state alone, per §6.4.

## 6. Tech stack and performance guidance

### 6.1 Renderer

WebGL2 via three.js (React Three Fiber if the design agent's shell is React, which is likely given
the target model also built airsup on a similar stack). **Skip WebGPU** — the node/scene budget
below (§6.2) is trivially within WebGL2's draw-call and shader-complexity envelope; WebGPU adds
build/toolchain and browser-support complexity with no measurable payoff at this scale.
`ponytail: add WebGPU only if a real profiler run on real fixture data shows a WebGL2 bottleneck —
none is expected.`

### 6.2 Node-count budget (concrete numbers, tied to the fixture contract in brief §6)

- Fixture target: 150-400 leaves (brief §6). Worst-case total node count (leaves + branches) for a
  binary tree is `2 * leaves - 1` if every branch has exactly two non-empty children and no sharing
  — so **hard budget: 800 tree-node meshes** (leaf capsules + branch joints combined) for the full
  shared world, comfortably inside the ~1,000-2,000-draw-call range where WebGL apps on mid-range
  mobile GPUs start needing instancing (a widely-cited rule of thumb, not a guess specific to this
  project — treat it as the trigger point, not a target to approach).
- **Use `InstancedMesh` anyway**, even though 800 draws would likely run fine uninstanced: two
  instanced batches (leaf capsules, branch joints), each keyed by `(LOD tier, zone tint)` so a
  single draw call handles every node sharing those two properties. This is nearly free to build
  and removes any risk of missing the budget on a lower-end device; it is not a response to a
  measured bottleneck, it is cheap insurance given the shape of the data (many visually-identical
  small meshes) — the textbook case instancing exists for.
- Prefix corridors (E3): one extruded-tube mesh per edge, **not instanced** (each has a unique
  length/orientation/label) — at most `leaves - 1` edges, well under 400, no perf concern.
- Sub-index fans (E4): only ever a handful mounted at once (one per stem currently at `Zoom: Node`
  tier) — never render all fans across the whole fixture simultaneously; they're a per-node
  "unfold" detail, not part of the base 800-mesh budget.

### 6.3 LOD strategy

Three tiers, driven by the SAME opacity state that E9's witness/path rendering already uses (reuse,
don't add a second system): **full mesh** (opaque, on-path or in the current zoom tier's focus) →
**simplified mesh** (a single low-poly proxy shape, used for every "ghosted" 15%-opacity node
outside the active Follow/Zoom focus, §4.5/§2.2) → **point sprite** (any node further than
`Zoom: Tree` tier's visible radius, i.e. essentially never for our ≤400-leaf budget, but specified
for headroom if a future fixture grows past ~1,000 leaves). Given §6.2's numbers, tiers 2-3 are a
safety margin, not a requirement at launch scale — build tier 1 first, wire the opacity-driven
switch, confirm on a real device before spending effort on tier 3's point-sprite path.

### 6.4 Accessibility (concrete, not boilerplate)

- **Keyboard nav**: `Tab`/`Shift+Tab` cycles every HUD control in DOM order (Follow segmented
  group → Zoom segmented group → Play/Pause → beat scrubber dots) using native
  `role="radiogroup"`/`role="button"` semantics — mirrors what `tab.observe()` actually found on
  airsup itself (`role: button`, `pressed` state) when I drove it live, so this is a *verified*
  achievable pattern, not aspirational. `←`/`→` step beats forward/back when the scrubber or canvas
  has focus. `Space` toggles Play/Pause. Camera orbit gets a keyboard fallback: `WASD` or arrow
  keys orbit in ~15° steps when the 3D canvas itself has focus (drag-to-orbit is mouse/touch-only
  otherwise, which excludes keyboard-only users from the one interaction airsup's whole grammar is
  built on — this fallback is required, not optional).
- **Reduced motion**: see §5.3's collapse rules. Verification bar: with `prefers-reduced-motion`
  forced on, every beat's TREE/TRUTH facts must still be fully conveyable from a single static
  frame per beat (no fact may live *only* inside an animation's travel, e.g. the merkleization
  wave's *count* must also be legible as a static chip number, which §4.4 already requires
  independent of the animation).
- **Captions**: the existing ≤14-word beat caption (brief's beat schema) is rendered in an
  `aria-live="polite"` region that updates in sync with the caption card, so a screen-reader user
  gets the same beat-by-beat text a sighted user reads, without needing to parse the 3D canvas at
  all. This doubles as a literal video-style caption track if a narrated-audio version is ever
  added later — no rework needed, the text pipe already exists.
- **Colorblind-safe zone colors**: §5.1's Okabe-Ito-derived palette is the actual accessibility
  mechanism here, not a separate feature — verified safe for the three common dichromacies by
  construction (Okabe-Ito's whole design goal). The one thing to verify in build: don't let the 8%
  ground-fog zone tint (§4.3) or the 15%-opacity ghost state (§4.5/§6.3) shift a hue enough to
  collide with another zone's color at low opacity — check this on a real render, not just the
  hex values in isolation, since alpha-blending against the `#0A0D14` background can desaturate
  colors non-linearly.
- **Contrast** (computed via the standard WCAG relative-luminance formula against the `#0A0D14`
  background, not eyeballed): HUD text `#33FF33` = **14.3:1**, `#E2E6E2` = **15.4:1** — both clear
  even AAA's 7:1 normal-text threshold with margin. The Okabe-Ito zone hues, computed the same way:
  code-zone orange `#E69F00` = 8.6:1 (AAA-safe), storage bluish-green `#009E73` = 5.7:1 and witness
  vermillion `#D55E00` = 5.0:1 (both clear AA's 4.5:1, not AAA). **Account-zone blue `#0072B2`
  computes to only 3.75:1 — below AA's 4.5:1 for normal text.** This is fine as a 3D node material
  (no text-contrast rule applies to a mesh), but if any label ever renders account-zone-blue *text*
  directly on the `#0A0D14` background (e.g. a zone-name chip), it must sit on a small opaque/near-
  opaque backing chip rather than bare on the scene background — don't reuse the raw zone hex for
  HUD text color, only for node/sector tinting.

## 7. Beat-by-beat mapping table

Sourced from `local://pbt-beats.md` (PbtTruth, IDs stable, every number pulled from the real generated `pbt-fixtures.json`). 84 beat ids total: 51 across 14 journeys (J1-J11b, including the J4a/b/c and J11a/b splits PbtTruth's generator required), 21 across the Zone Atlas (A0-A5), 11 across Why-PBT (W1-W9, including PbtTruth's two justified additions W8/W9), 1 for Key Forge (X1) — matching `pbt-beats.md`'s id count exactly, no sampling. `E<n>` ids reference `local://pbt-visual-encodings.md`. Atlas/Why/Sandbox beats are self-paced facets (no forced camera flight or play-timer, per §1's IA rule) — their "camera" column describes the framing *when that facet is opened*, not an automatic flight; "duration" is a dwell default, not a hard cut. Journey beats (J*) are the guided, timer-advanceable sequence described in §3.

### Journeys (J1-J11b)

| Beat | What (short) | Camera | Visual metaphor / animation | HUD state | Affordance | Duration |
|---|---|---|---|---|---|---|
| `J1.B1` | addr32 padding | hold (journey-entry flight to derivation overlay) | E11 (no hash, prepend zero bytes) | Derivation diagram; no chips yet | auto-advance only | 2.2s |
| `J1.B2` | header stem | hold (same diagram, next arrow) | E11 (BLAKE3 key_hash arrow) | Derivation diagram | auto-advance only | 2.2s |
| `J1.B3` | absence -> insertion split | flight to Acct1's future position in account sector | E12 (hollow) -> E13 (insert-split, 2 leaves) | Follow:This path; chip Depth <n> | click to pause/replay insert | 2.8s |
| `J1.B4` | coinbase also freshly created | flight to Acct9's position, account sector | E13 (independent insert) | chips update | scrubbable | 2.8s |
| `J1.B5` | sender update in place | pan to Acct0's existing leaf | E1 (value tag updates, no shape change) | chip nonce 4->5 | none (auto) | 2.2s |
| `J1.B6` | root recompute | pull back to wide shot, union path from 3 leaves | E7+E8 wave (17 branches, union) | chip Hashes recomputed:17 | play/pause wave, step tick-by-tick | 3.0s |
| `J2.B1` | CREATE address | flight to derivation overlay (journey entry) | E11 (Keccak: rlp -> keccak256 -> [12:]) | Derivation diagram | auto-advance | 2.5s |
| `J2.B2` | code_hash | hold (same diagram, next arrow) | E11 (Keccak: 8151B runtime -> keccak256) | Derivation diagram | auto-advance | 2.2s |
| `J2.B3` | chunkify | flight from diagram into empty code-zone sector | chunker anim (E15 tiles appear one by one) | chip Chunks 263, Groups 2 | scrub through slicing | 3.0s |
| `J2.B4` | code chunk 0 key | flight/zoom to 1st group's stem | E4 fan (slot0 lit) + E15 tile + E11 (BLAKE3 arrow) | Zoom:Node | none (auto) | 2.5s |
| `J2.B5` | code chunk 256 key (2nd group) | flight to 2nd group's stem | E4 fan (new, tree_index=1) + E15 + E11 | Zoom:Node | none (auto) | 2.5s |
| `J2.B6` | header creation | flight to new account-zone stem/fan | E4 fan opens (slots 0,1 lit via E13) | chips update | none (auto) | 2.8s |
| `J2.B7` | constructor storage: totalSupply (header slot) | pan within fan to slot 66 | E4 slot66 + E13 | chip 'header band <64->127' | none (auto) | 2.2s |
| `J2.B8` | constructor storage: owner+paused packed | pan to slot 67 | E4 slot67 + byte-offset annotation (owner20B+paused@20) | Zoom:Node | none (auto) | 2.5s |
| `J2.B9` | constructor storage: balanceOf[deployer] | flight OUT of header fan across E5 zone boundary into storage sector | E11 (Keccak mapping) -> E5 crossing -> E13 insert | Follow:This zone (storage) | none (auto) | 3.0s |
| `J3.B1` | CREATE address, 3rd deployment | flight to derivation overlay (journey entry) | E11 (Keccak, same formula as J2.B1) | Derivation diagram | auto-advance | 2.2s |
| `J3.B2` | code_hash identical to #1/#2 | hold; ghost-preview link toward existing code geometry | E11 + early E10 ghost link ('match found') | chip 'matches existing code_hash' | none (auto) | 2.5s |
| `J3.B3` | code chunk keys identical -> zero new leaves | flight to the EXISTING code-zone group (not a new one) | E10 (converging line draws, no new tiles) | chip Dedup saves:23 chunks | none (auto) | 3.0s |
| `J3.B4` | only a new header | flight to new header fan | E13 (2 leaves) + E7/E8 wave (14 branches) | chip Hashes recomputed:14 | none (auto) | 2.8s |
| `J4a.B1` | delegation indicator (0xef0100‖target20) | flight to derivation overlay | E11-style byte-layout callout (no hash) | Derivation diagram | auto-advance | 2.2s |
| `J4a.B2` | DELEGATION_LEAF_KEY write | flight to Acct's header fan slot2 | E4 slot2 lights + insert/update | chip 'sub=2 DELEGATION' | none (auto) | 2.5s |
| `J4a.B3` | CODE_HASH leaf removed | pan to slot1, same fan | E12 (fade to hollow) | callout 'mutually exclusive w/ slot2' | none (auto) | 2.2s |
| `J4a.B4` | nonce bump (EIP-7702, not EIP-8297) | pan to slot0 | E1 value-tag pulse on packed nonce field | callout 'protocol rule, not tree rule' | none (auto) | 2.0s |
| `J4a.B5` | resolves-to | long flight across zone sectors to target's CODE_HASH leaf | dashed pulsing link (explicitly not a tree edge) | callout 'client-side lookup only' | none (auto) | 2.8s |
| `J4b.B1` | same key, value overwritten | return to J4a.B2's slot2 framing | value-tag swap: old dashed link fades, new draws to VaultTemplate#2 | chip 'target updated' | none (auto) | 2.5s |
| `J4c.B1` | code=b'' -> delegation removed, CODE_HASH restored | combined shot: slot2 + slot1 | E12 (slot2 fade-hollow) + E13 (slot1 restore keccak("")) | callout 'shape of a never-delegated EOA' | none (auto) | 2.8s |
| `J5.B1` | sender mapping slot (Keccak, Solidity) | flight to derivation overlay (journey entry) | E11 (Keccak arrow, tagged 'Solidity, not EIP-8297') | Derivation diagram | auto-advance | 2.2s |
| `J5.B2` | sender storage-zone key, update in place | diagram continues (BLAKE3 arrows) -> flight to existing leaf | E11 (BLAKE3) -> E1 value pulse (balance decreases) | Follow:This path | none (auto) | 2.8s |
| `J5.B3` | recipient mapping slot, fresh insert | flight to a different group/bucket position | E11 (Keccak) -> E13 insert | chips update | none (auto) | 2.8s |
| `J5.B4` | contrast: totalSupply is a header slot, untouched | flight OUT to header fan slot66 (from J2.B7), shown dim | callout 'not touched' vs lit storage leaves just visited | Follow:Whole tree (contrast) | none (auto) | 2.5s |
| `J6.B1` | selector = keccak256(sig)[:4] | flight to derivation overlay | E11 (Keccak arrow) | Derivation diagram | auto-advance | 2.2s |
| `J6.B2` | dispatcher JUMPDEST (pc=687 -> chunk22) | flight to code-zone fan, chunk22 tile | E15 tile + E4 fan slot22 | Zoom:Node | none (auto) | 2.5s |
| `J6.B3` | dispatcher chunks always touched (0..22) | pan across chunks 0..22 in fan | plain highlight outline on 23 tiles, a DISTINCT color from E9's reserved path-green (PbtTruth's correction: chunks 0-22 are grouped by PC/execution-order locality under one shared stem, not a merkle root-to-leaf path — reusing E9's semantic color would wrongly imply a witness-path relationship) | Follow:This path | none (auto) | 2.8s |
| `J6.B4` | shared byte0 field (PUSHDATA count / jumpdest gate) | zoom to Node tier on one tile | byte-layout annotation on E15 tile | Zoom:Node | none (auto) | 2.5s |
| `J7.B1` | withdraw zeroes VaultTemplate#1's balance var | flight to header fan slot65 (existing, nonzero) | E1 leaf, value tag shown | chip 'sub=65, header band' | none (auto) | 2.2s |
| `J7.B2` | header sub-index of slot1 (64+1=65) | hold/zoom on slot65 | E4 fan slot-index label callout | Zoom:Node | none (auto) | 2.0s |
| `J7.B3` | merge recompute (2 changed -> 10 branches) | pull back; E14 delete-merge + E8 wave | E14 (surviving sibling promoted) + E7/E8 (10 branches) | chip Hashes recomputed:10 | none (auto) | 3.0s |
| `J8.B1` | chunk count 263, 2 groups | wide shot of both code-group fans side by side | E4 x2 | chips Chunks 263, Groups 2 | none (auto) | 2.5s |
| `J8.B2` | all-zero absent chunk (128 exist, first @131) | flight/zoom to chunk index131 | E12 (hollow) instead of E15 solid tile | chip 'absent chunk' | none (auto) | 2.5s |
| `J8.B3` | PUSH32 straddles chunk boundary (pc=454, chunk14->15) | flight framing chunk14+chunk15 together | highlighted 'bridge' annotation spanning both tiles | Zoom:Node | none (auto) | 2.8s |
| `J9.B1` | presence witness: Acct4 MegaToken balance (3 lvl, 167B) | flight framing root-to-leaf path | E9 (path colored, siblings vermillion beads) | chip Witness:3 siblings*167B | step through each level | 3.0s |
| `J9.B2` | absence witness: Acct1 BASIC_DATA (5 lvl, 238B, diverges before leaf) | flight to where key WOULD be | E9 + highlighted diverging-neighbor leaf (distinct badge) | chip Witness:5 siblings*238B | step through each level | 3.2s |
| `J9.B3` | MPT comparison (5760B/12 levels) | cut to 2D comparison panel | HUD numeric panel, no 3D | paired chips 167B/238B vs 5760B | none (auto) | 2.8s |
| `J10.B1` | combined write set: J1+J5+J4a, 9 leaves changed | wide establishing shot, all 9 positions lit across zones | multiple E13/E1-pulse firing together | chips update per zone | none (auto) | 3.2s |
| `J10.B2` | union vs naive sum: 27 vs 32 | pull back further; ghost 'naive' overlay fades, real wave fires | E8 wave (27, bottom-up) replacing a fading 32-pulse ghost | chip Hashes recomputed:27 (not 32) | none (auto) | 3.0s |
| `J11a.B1` | create phase: 3 new leaves, code_hash matches existing | flight to new header fan | E13 (x3) + E10 dedup link to existing code | chips update | none (auto) | 2.8s |
| `J11a.B2` | destroy phase: header+storage removed, code SURVIVES | hold/pan on the 3 leaves and the shared code link | E12 (3 leaves fade) + E10 link stays intact (not fading) | callout 'code survives - shared' | none (auto) | 3.0s |
| `J11a.B3` | net trace: post_root == pre_root exactly | cut to root-hash comparison chip | HUD panel, before/after identical | chips root before=after | none (auto) | 2.5s |
| `J11b.B1` | create phase: 7 new leaves (header+5 unique chunks) | flight to header fan then code-zone fan | E13 (x2 header) + E13 (x5 chunks, no E10 link) | chips update | none (auto) | 3.0s |
| `J11b.B2` | destroy phase: header+storage AND all 5 chunks removed | pan across both fans | E12 fade-to-hollow on all 7 leaves | callout 'code removed - unique, contrast J11a' | none (auto) | 3.0s |
| `J11b.B3` | net trace: post_root == pre_root, despite different code fate | cut to same root-hash comparison pattern as J11a.B3, side by side | HUD panel, dual comparison vs J11a | chips root before=after | none (auto) | 2.8s |

### Zone Atlas (A0-A5)

| Beat | What (short) | Camera | Visual metaphor / animation | HUD state | Affordance | Duration |
|---|---|---|---|---|---|---|
| `A0.B1` | two node types only | framing a representative leaf+branch pair, user-selected | E1 + E2 side by side, labeled | self-paced facet select | click facet to open | ~3.0s dwell |
| `A0.B2` | prefix compression | framing a real multi-bit corridor | E3 + toggle 'what a node chain would look like' (struck through) | self-paced facet select | toggle comparison | ~3.0s dwell |
| `A0.B3` | canonical form | same leaf set, two split orders converge to identical tree | before/after loop | self-paced facet select | replay toggle | ~3.0s dwell |
| `A0.B4` | why MAX_KEY_LENGTH=8192 | neutral establishing shot (not fixture-specific) | HUD formula callout (2^16-1)/8 | self-paced facet select | none | ~2.8s dwell |
| `A1.B1` | zone byte table | wide establishing shot | HUD table overlay (0x00/0x01/0x02-0xFE/0xFF) | self-paced facet select | none | ~2.5s dwell |
| `A1.B2` | real root geometry | flight to root | E5 sectors splitting bit0 | self-paced facet select | none | ~2.8s dwell |
| `A1.B3` | left sub-split depth7 | flight/zoom into left sector's corridor | E3 (6-bit '000000') -> bit7 fork | self-paced facet select | none | ~2.8s dwell |
| `A2.B1` | 256 sub-index positions, handful used | framing full 256-slot disc, ~6 lit | E4 (mostly hollow) | self-paced facet select | hover slots | ~3.0s dwell |
| `A2.B2` | BASIC_DATA fields | zoom to Node tier on slot0 | byte-layout annotation (version/reserved/code_size/nonce/balance) | self-paced facet select | none | ~3.0s dwell |
| `A2.B3` | CODE_HASH xor DELEGATION | pan slot1<->slot2 | toggle demo, only one ever lit | self-paced facet select | toggle | ~2.8s dwell |
| `A2.B4` | header-storage band | pan across 64-127 slot arc | highlighted contiguous band | self-paced facet select | none | ~2.5s dwell |
| `A3.B1` | live chunker | user-driven, no fixed camera | chunker anim (E15) responding live to pasted/selected bytecode | interactive (Key-Forge-style) | paste/select bytecode | user-driven, no fixed duration |
| `A3.B2` | groups | wide shot of 2+ code-zone fans | E4 x N | self-paced facet select | none | ~2.8s dwell |
| `A3.B3` | dedup | flight to VaultTemplate's shared fan | E10 (3 converging lines) | self-paced facet select | none | ~3.0s dwell |
| `A3.B4` | zero-chunk absence | side-by-side absent vs present-zero-PUSHDATA tile | E12 vs E15 contrast | self-paced facet select | none | ~3.0s dwell |
| `A4.B1` | bucket -> groups -> slots | wide shot, nested zoom demo | E5-like sub-sector -> E4 fans -> slots | self-paced facet select | zoom-in nesting | ~3.0s dwell |
| `A4.B2` | slot calculator | HUD widget, no fixed camera | live tree_index/sub computed from typed slot number | interactive | type a slot number | user-driven, no fixed duration |
| `A4.B3` | mapping/array derivation (Solidity, not EIP) | HUD widget, no fixed camera | E11 (Keccak arrow -> BLAKE3 arrows), live | interactive | type key + base slot | user-driven, no fixed duration |
| `A5.B1` | leaf/branch preimages | framing both preimage assemblies side by side | E7 (x2, leaf and branch) | self-paced facet select | none | ~3.0s dwell |
| `A5.B2` | encode_bit_prefix | HUD-depth byte-layout diagram | 2-byte BE count + packed bits | self-paced facet select | none | ~2.8s dwell |
| `A5.B3` | BLAKE3 vs Keccak | split panel | BLAKE3 'tree, not final' vs Keccak 'EVM identity, permanent' (E11 convention) | self-paced facet select | none | ~3.0s dwell |

### Why PBT (W1-W9)

| Beat | What (short) | Camera | Visual metaphor / animation | HUD state | Affordance | Duration |
|---|---|---|---|---|---|---|
| `W1.B1` | real fixture numbers 167B/3lvl, 238B/5lvl vs MPT 5760B/12lvl | cut to comparison panel + small 3D witness inset | HUD numeric panel + E9 inset (reused from J9) | paired MPT/PBT chips | none | 3.0s |
| `W1.B2` | arity table k=2:768B .. k=16:2880B | cut to comparison panel, no 3D | HUD numeric table | chips per arity | none | 2.8s |
| `W2.B1` | worst case ~1.8GB unchunked | cut to comparison panel, no 3D | HUD big-number callout | chip 1.8GB | none | 2.5s |
| `W3.B1` | J10's 27 vs 32 (paths meet near root) | cut to panel, replay J10.B2's wave inset | HUD comparison + E8 inset (reused from J10) | chip 27 vs 32 | none | 2.8s |
| `W4.B1` | addressable regions (zone/bucket provable/syncable/expirable) | small 3D shot of one zone sector highlighted | E5 inset | callout 'no side structure needed' | none | 2.5s |
| `W5.B1` | J3's numbers: 3 deployments, 1 set, 0 dup writes | cut to panel, replay J3.B3's E10 inset | HUD comparison + E10 inset (reused from J3) | chip Dedup saves:23 | none | 2.5s |
| `W6.B1` | hash candidates: BLAKE3 (ref), Keccak, Poseidon2; no elliptic curves | cut to panel + small 3D forge inset (2nd of the two 3D-eligible why-panels) | HUD text panel w/ 'not final' tag (Vitalik precedent, ref-board 2.2) + E7 inset | callout 'hash-based -> post-quantum' | none | 2.8s |
| `W7.B1` | EIP-8347 pointer (migration off consensus-critical path) | cut to panel, no 3D | HUD text + external link to migration article | link 'read the migration article' | click link | 2.2s |
| `W8.B1` | expiry unit: bucket or header stem (NEW panel) | small 3D shot, zone sector with speculative 'stub' overlay | E5 inset + explicitly-marked speculative overlay (mechanism is a separate EIP) | callout 'not implemented, EIP-8297 Rationale pointer' | none | 2.5s |
| `W9.B1` | collision cost 2^128 birthday work (NEW panel) | cut to panel, no 3D | HUD big-number panel | chip 2^128 | none | 2.2s |
| `W9.B2` | grinding cost 2^(k/2) uncompressed vs 2^d after E3 compression | cut to panel, ties back to A0.B2's corridor visual | HUD panel + E3 inset (reused from A0) | chips 2^(k/2) vs 2^d | none | 2.8s |

### Key Forge (X1)

| Beat | What (short) | Camera | Visual metaphor / animation | HUD state | Affordance | Duration |
|---|---|---|---|---|---|---|
| `X1.B1` | type address/slot/bytecode -> live pipeline lands in tree | user-driven, no fixed camera (neutral workbench pose, SANDBOX state) | E11 (live diagram) + E13 (live insert) | forge chips Zone/Stem/Key, live-updated per keystroke | type input; reset button | user-driven, no fixed duration |
