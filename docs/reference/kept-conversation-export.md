# Kept conversation artifact

`textile/kept-conversation` version 1 is Textile's portable artifact for an
imported conversation whose source is not itself a raw Lync event union. The
current producer is the native Twitter/X archive path.

## Selection meaning

Export KEPT starts from the exact Loom named by the current Stories row. A
target is included only when its latest durable mark is positive. For every
explicit target, Textile includes the full Loom-parent path from the
conversation root to that target. A sibling that happened to be visible when
Keep was pressed is absent unless it is independently kept or is an ancestor
of another kept target.

This is contextual conversation export, not preference construction. Actor and
source roles are retained as provenance; Textile does not invent ChatML roles,
positive/negative pairs, or a training perspective.

## Markdown and manifest

The visible Markdown repeats one readable path per kept target. Every beat
names its actor, source record identity, timestamp, exact presented text, and
notes. The final HTML comment contains a base64-encoded JSON manifest with:

- `kind: "textile/kept-conversation"` and `schemaVersion: 1`;
- the original immutable Loom ID;
- explicit kept portable turn IDs;
- deterministic turn order;
- each included turn's parent, presented text, carried
  role/actor/controller, source provenance, keep event, and notes; and
- literal selection/context/sibling/role semantics.

Importing the Markdown reconstructs only those included turns. It does not need
the original archive, a share URL, or a provider key. Re-export preserves the
portable turn identities, keep, notes, and source record references.

## Privacy and fidelity boundary

The artifact contains the readable text selected for the conversation and the
minimal provenance above. It does not embed the original ZIP, unselected
archive records, media, or arbitrary raw provider objects. Twitter account
email and other unused account fields are never projected by the Splice browser
adapter. The native ZIP remains local to the importing browser.

The minimized readable Loom follows Textile's configured sync policy; import a
private archive only through a trusted relay or use the explicit local-only
review URL.

This differs from [`textile/kept-context`](kept-context-export.md), which carries
an export-eligible raw Lync causal downset plus explicit policy/drop reporting.
Version 1 kept-conversation artifacts follow a single Loom-parent path because
conversation Loom turns have one parent. Raw multi-parent causal histories use
the kept-context contract instead.

## Empty and unsupported cases

Exporting a conversation with no positive keeps produces readable Markdown
whose manifest has an empty target set; reopening that empty artifact is
rejected because there is no curated conversation to show. Native archive
containers other than the documented Twitter/X ZIP are not guessed by shape.
