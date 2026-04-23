# LoomSync v0.1 Spec

## Package Boundaries

`@loomsync/core` models one shared branching world. A world has one root,
append-only nodes, canonical sibling order, path reconstruction, leaves,
subscriptions, and deterministic import/export.

`@loomsync/index` models a linked index of worlds. It stores links to roots and
lightweight display metadata. It does not embed world content.

`@loomsync/text` provides helpers for text payload worlds, including path
flattening and appending chains of text chunks.

## Root Identity

In the Automerge backend, `LoomRoot.id` is the Automerge document URL. Sharing a
world means sharing that root ID.

Snapshot import preserves node IDs and parent IDs but creates a new root ID in
the target backend.

## Shared Content Boundary

Core and index packages store durable shared content only. Cursor position,
preferred branch, minimap focus, draft text, selection, and presence belong to
host applications.

## Deferred Backends

The in-memory backend is implemented first to prove API semantics and tests.
The Automerge backend must satisfy the same interfaces with IndexedDB,
BroadcastChannel, and optional WebSocket sync.
