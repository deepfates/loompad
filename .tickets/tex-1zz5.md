---
id: tex-1zz5
status: closed
deps: []
links: []
created: 2026-08-02T01:12:31Z
type: bug
priority: 0
assignee: deepfates
tags: [behold, lync, presentation, residents]
---
# Preserve private-channel resident speech in Textile

Qualified Behold episode 000006 proves recipient delivery in OxfordSedge's canonical Lync, but Textile main renders the exact channel=private event as Public chat from Lark. Lync commit ddace87 already owns and tests the corrected presentation pact; Textile's vendored 0.4.2 presenter snapshot has not adopted it.

## Acceptance Criteria

A Behold resident-v2 chat_received event with channel=private and addressed=true renders as a private whisper with exact sender/text, never public chat; public channel remains public; exact episode 000006 ordered-prefix import shows the received Lark→Sedge whisper truthfully; focused tests, full Textile gates, and provenance remain aligned.


## Notes

**2026-08-02T01:14:03Z**

Exact episode oxford-qualified-habitat-a-qwen36-camera-v1/000006 located the defect at Textile's vendored presenter: OxfordSedge's canonical Lync turn 127 nextObservation event 130 retained channel=private/addressed=true and full Lark text, while the reader rendered it as public chat. Adopted Lync ddace87's v2 received-whisper rule at the vendored boundary and added focused fixture coverage. The exact authenticated 18,826,863-byte ordered-prefix set now projects 309 source events as 307 readable resident turns plus two roots and renders the recipient line as Private whisper from Lark with exact text. Full Textile suite: 194 pass/1 scale skip; lint and production build pass.
