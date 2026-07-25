---
id: Hac-bgmi
status: open
deps: []
links: []
created: 2026-07-25T17:44:17Z
type: bug
priority: 1
assignee: deepfates
tags: [corpus, textile, multiplayer, identity, ux, e2e]
---
# Textile: make shared-curator identity reachable without native dialogs

In a fresh ordinary browser session, Settings -> Author Name highlights normally, but activation calls window.prompt/window.alert. Textile's design contract forbids native prompt/confirmation dialogs; in the Codex in-app browser the activation silently returned with the value still 'anonymous'. The accepted Ada/Grace Playwright co-curation test seeds localStorage before page load, so it bypasses and does not verify this user path. Anonymous per-browser ids remain technically distinct, but the user cannot establish a meaningful visible curator identity through the tested product surface.

## Acceptance Criteria

A fresh browser user can enter and confirm a curator name through Textile's own interface idiom, sees when it takes effect, and subsequent keep/note events export with that actor; the flow uses no native prompt/alert, is keyboard and pointer reachable, and a focused two-client browser test establishes both names through ordinary UI rather than localStorage seeding.

