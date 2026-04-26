# Lync v0.2 Spec

## Package Boundaries

`@lync/core` models one shared branching loom. A loom has append-only turns,
canonical sibling order, thread reconstruction, leaves, subscriptions,
references, and deterministic import/export.

`@lync/index` models a linked index of looms. It stores loom references and
lightweight display metadata. It does not embed loom content.

`@lync/text` provides helpers for text payload looms, including thread
flattening and appending chains of text chunks.

`@lync/sync-server` provides a simple Automerge WebSocket sync relay. The
relay helps peers find and sync documents; it is not the semantic owner of a
loom.

## Loom Identity

In the Automerge backend, `LoomInfo.id` is the Automerge document URL. Sharing a
loom means sharing that loom ID, usually through a `LoomReference`.

Snapshot import preserves turn IDs and parent IDs but creates a new loom ID in
the target backend.

## Reference Model

Lync has four reference kinds:

- `loom`: open a whole loom
- `turn`: open a loom and focus one exact turn
- `thread`: open a loom and materialize the lineage to one turn
- `index`: open a discovery index of loom references

Default URL encoding is `?ref=<base64url-json>`. References are intentionally
opaque and title-free. Slugs, aliases, permissions, publishing, and user
profiles belong above this layer.

## Content Boundary

Core and index packages store durable shared content only. Cursor position,
preferred branch, minimap focus, draft text, selection, read state, and presence
belong to host applications.

Turn payload should hold the human-readable content. Turn metadata should hold
app-defined semantics such as role, author, model provenance, `revises`,
`references`, or `respondsTo`. Loom metadata should remain mutable chrome and
not carry the actual story seed or root text.

## Backends

The in-memory backend proves API semantics and fast unit tests. The Automerge
backend satisfies the same interfaces with IndexedDB, BroadcastChannel, and
optional WebSocket sync.

The internal Automerge schema can keep plain implementation names such as
`root`, `nodes`, `children`, and `parentId`; those are storage details, not the
public language of the library.
