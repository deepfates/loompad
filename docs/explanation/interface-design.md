# Why Textile feels like an instrument

Textile makes one path through a branching corpus readable without hiding the
nearby alternatives or pretending the underlying causal graph is a tree. Its
small screen, d-pad grammar, and separate projections are functional
constraints, not a decorative Game Boy theme.

The loom metaphor begins with generation: a model can continue the same text in
many plausible directions, while an ordinary chat surface shows only one. A
loom keeps those alternatives first-class so a person can compare, backtrack,
and grow a different path. Imported archives and causal histories use the same
instrument because they also contain paths, alternatives, provenance, and
relations that a single linear transcript would hide.

Lync owns the durable append-only graph. Textile presents that graph through a
few deliberately partial views:

- **LOOM** is the reading column: one first-parent path at a time.
- **MAP** preserves the tree geometry while exposing additional typed relations
  and nearby alternatives.
- **LINKS** names and traverses non-first-parent causal and pointer relations
  directly.
- **LOOMS** is a spatial dial over available roots; the selected root blooms in
  place before descent.
- **Menus and action sheets** operate on the focused object without replacing
  the underlying context.

No projection claims to be the universal representation. Their composition is
how Textile keeps a large causal record legible on a small surface.

## Design laws

### One character grid

The interface uses one monospace base size. Hierarchy comes from position,
spacing, and colour, not caption scales, badges, or accumulated chrome. The
deliberate exceptions carry distinct physical or temporal meaning: enlarged
glyphs inside the gamepad buttons, and smaller elapsed-time seams within a
story path.

### One grammar per projection

The d-pad may mean different things in LOOM, MAP, LOOMS, and menus, but its
meaning does not change opportunistically inside one projection. START and
SELECT move between projections or configuration surfaces. The mode bar names
the active grammar.

### Preserve the map's geometry

The existing node layout is a stable spatial memory. Camera fitting,
containment, and entry framing may change when evidence demands it; the node
geometry itself is not a casual redesign surface.

### The Loom dial does not wrap

Roots retain their order and move beneath a fixed centre. Pill height encodes
Loom size. The dial clamps and gives edge feedback instead of wrapping, so
movement preserves orientation. Descending hands the selected root into MAP's
frame rather than treating the transition as unrelated navigation. The
implemented handoff, its exact camera rationale, and the still-candidate motion
work are recorded in the
[floor-to-story continuity rationale](../floor-descend-continuity-consult-fable.md).

### Actions rise over context

The focused Loom, map, or dial remains visible while one shared bottom sheet
presents its actions. Action sets are data rendered by the shared action menu,
not separate full-screen modes with new control rules.

### Authorship is durable; presence is not

Per-turn actor/controller provenance and coauthored Lync history belong to the
document. Live cursors, typing indicators, presence rosters, and generic CRDT
collaboration are outside Textile's current product boundary.

### Nothing important fails silently

Import, save, delete, export, share, generation, and sync outcomes use the
interface's own status idiom. Native prompt and confirmation dialogs are not a
fallback because they break the tactile control model and are not reliably
reachable in every host.

## Change test

A change belongs in Textile when it makes branching material more legible,
navigable, or curatable without erasing source identity or overloading the
control grammar. New graph semantics should enter through an owned Lync pact
and an appropriate projection. New UI chrome should not compensate for an
unclear responsibility boundary.

The controls remain bottom-anchored and mobile-first. Expressive range should
come from composing the existing projections and verbs rather than adding a
dashboard around them.
