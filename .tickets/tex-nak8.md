---
id: tex-nak8
status: closed
deps: []
links: [tex-wrif]
created: 2026-08-01T23:20:41Z
type: bug
priority: 0
assignee: deepfates
tags: [behold, lync, presentation, residents]
---
# Present current Behold combat and yield events without diagnostic loss

Behold qualified habitat episode 000001 streams safely through Textile main e375435, but the org.behold.inhabitant.v2 presenter drops current public causal events: 10 day_phase_changed, 6 self_hurt, 4 visible_entity_hurt, and 2 died instances are marked unsupported_observation_event. Eighty ordinary wait_for_event results are rendered generically but marked unsupported_outcome_result. Source-only pose/reference/numeric diagnostics are intentional and not part of this defect.

## Acceptance Criteria

Against the exact episode 000001 ordered-prefix manifest and focused fixtures, Textile presents safe non-coordinate prose for day phase, self hurt, visible entity hurt, and death; recognizes the current wait_for_event {ok,status} result; emits no unsupported_observation_event or unsupported_outcome_result for these known shapes; preserves all source-only/withheld diagnostics, private-payload exclusion, indexed ownership bounds, and fail-closed unknown shapes. Existing test/build/lint gates pass.


## Notes

**2026-08-01T23:26:43Z**

Implemented the bounded current-v2 reader overlay. Exact Behold qualified habitat episode 000001 projects 155 source events into 153 readable turns with unsupportedEventCount=0 and no unsupported_* diagnostics; remaining diagnostics are intentional source-only identity/window/pose/visual fields and withheld private/local/numeric fields. Focused raw-Lync tests 24/24, full suite 210 pass/1 skip, lint, build, and diff-check pass. Unknown event shapes still fail closed and coordinate-bearing extras remain withheld.

**2026-08-01T23:33:30Z**

Follow-up principal review carried Behold's new chat_input_dispatched/whisper_input_dispatched distinction through the Textile prose. Both old and current v2 results now say only that input was submitted and explicitly deny independently confirmed recipient delivery; over-bound/rejected input remains distinct. Full suite 211 pass/1 skip, lint, build, and diff-check pass.

**2026-08-01T23:52:05Z**

Episode 000003 adversarial projection found one further current-v2 gap: use_focused_block {} plus admitted_block_focus_unavailable rendered with unsupported_action_input and unsupported_outcome_result. Added a bounded focused-use/factual-failure overlay and fixture; exact episode reprojection pending full gates. Canonical upstream parity is separately recorded in Lync.

**2026-08-01T23:52:53Z**

Episode 000003 now projects its exact 10,133,930-byte two-source prefix set as 212 source events: 210 readable resident turns plus two structural roots, with zero unsupported events, zero nonconforming lines, and zero unsupported_* diagnostics. Focused test 26/26; full 212 pass/1 scale skip; lint and production build pass. Lync upstream ownership is tracked as lyn-cnew.

**2026-08-02T08:21:50Z**

Removed Textile's now-redundant Behold v2 presenter overlay. Textile now consumes
the checksum-pinned Lync package from canonical commit `6e0734d` directly. Exact
episode 000014 projects all 692 source events with no unsupported or unclaimed
event; Textile retains only its reader, grouping, and storage responsibilities.
