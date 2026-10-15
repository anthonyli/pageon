# @pageon/note-animations

Dependency-free entrance effects for PageOn note cards. No account, billing,
React, service or network dependency; not published to npm.

`createNoteAnimations({ allowCharacters = true })` returns an isolated registry and player.
Setting `allowCharacters: false` excludes the companion effect and presenter:

- `effects`: ordered, immutable definitions (`id`, bilingual `label`, `keyframes`, `duration`).
- `normalize(id)`: unknown or missing IDs fall back to `none`.
- `play(element, id)`: cancels previous playback on that element and starts again.
- `cancel(element)`: safely cancels the current animation.
- `register(definition)`: adds an effect; duplicate/invalid IDs are rejected.

Built-ins: `none`, `fade`, `fly`, `zoom`, `companion`. Preserve these IDs across releases.
To ship another built-in, add its definition inside the self-contained factory.
The editor options and offline options come from the same registry. Rebuild both
runtimes and regenerate the public mirror. Runtime-only registrations belong to
that player instance and are not serialized into exported HTML.

The factory can be embedded with `toString()`; do not add free variables/imports
inside it. Effects animate only the floating card, using opacity and individual
translate/scale properties so its centering transform stays intact. Effects
should end at the card's natural appearance and must not modify document layout.
Unsupported animation APIs, unknown IDs and reduced-motion preferences show the
card immediately. The note controller owns the existing 2-second lifetime and
cancels playback on replacement, page change, blur and destruction.

HTML stores `data-pageon-note-animation` alongside `data-pageon-note`. Missing
configuration means `none`. Element diffs use `noteAnimation`; text selections
store the same ID on every span in their group. Unknown future IDs can remain in
HTML but play as `none` until supported. Deleting a note removes its animation.


`companion` presents an embedded Circle, Jelly, Spark or Frog (ten palette colors),
or a user image, with a random hop, roll or glide. New notes default to `none` (free text notes). Website character notes require
premium HTML export. Standard offline files offer only text-note effects; the
paid runtime enables character configuration and playback.
`present({ tip, root, node, character, onSettled })` returns `cancel()` and
`reposition()`. The note controller starts its 2-second reading timer in
`onSettled`, after the 850–1250 ms entrance. Reduced motion skips the entrance.

`layout()` constrains both the character and the text bubble to the visual
viewport. Bubbles choose the left/right side, or above on narrow screens; long
text scrolls within the available height. Every movement waypoint stays inside
the viewport. Each playback samples a new edge, start point, curve, hop height,
rotation and duration. The exported HTML stores no path or fixed random seed, so
replaying a note and reopening the same file both generate fresh routes. Resize/scroll lands the character immediately and recalculates.

`characters`, `normalizeCharacter()`, `characterImage()` and
`readImage(file, document)` are shared by both forms. Uploaded PNG/WebP/JPEG
files are limited to 2 MiB, decoded with a 40-million-pixel limit, and resized to
at most 256 px (128 px when necessary) as transparent PNG data. No URL or SVG
upload is executed. The data is embedded in `data-pageon-note-character` as JSON
`{ id, color, image }`; element patches use `noteCharacter`. All spans in a text
selection share the configuration, and deletion clears it. No external assets
or network requests are needed after exporting. Preview uses the document's
`pageon:note-preview` event with `detail.node`.

Preset color choices are provided by the shared `@pageon/ui/color-palette` component, independently of the animation player.
