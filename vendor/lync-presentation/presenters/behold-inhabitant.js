export const BEHOLD_INHABITANT_PROFILE = "org.behold.inhabitant.v1";
export const BEHOLD_INHABITANT_PROFILE_V2 = "org.behold.inhabitant.v2";
const V1 = {
    profile: BEHOLD_INHABITANT_PROFILE,
    contract: "org.behold.presentation.inhabitant-turn.v1",
    version: 1,
};
const V2 = {
    profile: BEHOLD_INHABITANT_PROFILE_V2,
    contract: "org.behold.presentation.inhabitant-turn.v2",
    version: 2,
};
const HUMAN_PROFILE = "minecraft-human-semantic-v1";
const OBSERVATION_PROTOCOL = "behold.minecraft-human-semantic-observation.v1";
/**
 * Behold owns the meaning of this exact profile. Lync projects only the
 * allowlisted paths in Behold's v1 presentation pact; it never searches an
 * opaque payload for plausible prose.
 */
export function presentBeholdInhabitantEvent(event) {
    return presentBeholdEvent(event, V1);
}
export function presentBeholdInhabitantEventV2(event) {
    return presentBeholdEvent(event, V2);
}
function presentBeholdEvent(event, profile) {
    if (event.kind === "lync/loom")
        return presentResidentLoom(event, profile);
    if (event.kind === "lync/turn")
        return presentResidentTurn(event, profile);
    return null;
}
function presentResidentLoom(event, profile) {
    const meta = recordField(event.payload, "meta");
    if (stringField(meta, "protocol") !== "behold.entity-loom.v1" ||
        stringField(meta, "profile") !== profile.profile) {
        return null;
    }
    const entityId = stringField(meta, "entityId");
    const circleId = stringField(meta, "circleId");
    if (!entityId)
        return null;
    const lines = [
        `Behold resident life: ${entityId}`,
        circleId ? `World circle: ${circleId}` : null,
        `Profile: ${profile.profile}`,
    ].filter((line) => line !== null);
    const section = {
        role: "structure",
        text: lines.join("\n"),
        sourcePaths: ["payload.meta"],
    };
    return {
        text: section.text,
        kind: "structure",
        contract: profile.contract,
        source: presentationSource(event),
        sections: [section],
        diagnostics: [],
    };
}
function presentResidentTurn(event, profile) {
    const link = recordField(event.payload, "meta");
    const turn = recordField(event.payload, "payload");
    if (!link ||
        !turn ||
        stringField(link, "protocol") !== "behold.entity-turn-link.v1" ||
        stringField(turn, "protocol") !== "behold.entity-turn.v1") {
        return null;
    }
    const profiles = recordField(turn, "profiles");
    if (stringField(profiles, "body") !== HUMAN_PROFILE ||
        stringField(profiles, "actions") !== HUMAN_PROFILE) {
        return null;
    }
    const entityId = stringField(turn, "entityId");
    const sequence = integerField(turn, "sequence");
    const model = stringField(turn, "model");
    if (!entityId || sequence === null || !model)
        return null;
    const diagnostics = [];
    const sections = [];
    const observation = presentObservation(turn.observation, entityId, "payload.payload.observation", diagnostics, profile);
    if (observation)
        sections.push(observation);
    const utterance = presentUtterance(turn.utterance);
    if (utterance)
        sections.push(utterance);
    sections.push(presentAction(turn.action, entityId, diagnostics, profile));
    sections.push(presentOutcome(turn.action, turn.outcome, diagnostics, profile));
    const nextObservation = presentObservation(turn.nextObservation, entityId, "payload.payload.nextObservation", diagnostics, profile);
    if (nextObservation)
        sections.push(nextObservation);
    const release = recordField(turn, "experimentRelease");
    const releaseId = stringField(release, "releaseId");
    const observedOrder = integerField(release, "residentObservedOrder");
    const structure = [
        `${entityId} · turn ${sequence}`,
        `Model: ${model}`,
        `Profiles: ${stringField(profiles, "policy") ?? "unknown"} · ${HUMAN_PROFILE} · ${stringField(profiles, "safety") ?? "unknown"}`,
        releaseId ? `Release: ${releaseId}` : null,
        observedOrder === null ? null : `Resident-observed order: ${observedOrder}`,
    ].filter((line) => line !== null);
    return {
        text: [structure.join("\n"), ...sections.map(sectionText)].join("\n\n"),
        kind: "content",
        contract: profile.contract,
        source: presentationSource(event),
        sections,
        diagnostics,
    };
}
function presentationSource(event) {
    return {
        id: event.id,
        parents: [...event.parents],
        author: {
            actor: event.author.actor,
            ...(typeof event.author.via === "string"
                ? { via: event.author.via }
                : {}),
        },
        kind: event.kind,
    };
}
function presentObservation(value, entityId, sourcePath, diagnostics, profile) {
    const observation = recordValue(value);
    if (!observation || stringField(observation, "protocol") !== OBSERVATION_PROTOCOL) {
        diagnostics.push({ code: "unsupported_observation_protocol", sourcePath });
        return null;
    }
    const bodyContract = recordField(observation, "bodyContract");
    if (stringField(bodyContract, "profile") !== HUMAN_PROFILE) {
        diagnostics.push({
            code: "unsupported_observation_body_profile",
            sourcePath,
        });
        return null;
    }
    const lines = [];
    const self = recordField(observation, "self");
    const condition = recordField(self, "condition");
    const conditionParts = [
        numberField(condition, "health") === null
            ? null
            : `health ${numberField(condition, "health")}`,
        numberField(condition, "food") === null
            ? null
            : `food ${numberField(condition, "food")}`,
        numberField(condition, "breathBubbles") === null
            ? null
            : `breath ${numberField(condition, "breathBubbles")}`,
        typeof condition?.sleeping === "boolean"
            ? condition.sleeping
                ? "sleeping"
                : "awake"
            : null,
        stringField(condition, "dimension"),
        stringField(condition, "daylight"),
    ].filter((part) => part !== null);
    if (conditionParts.length)
        lines.push(`${entityId}'s condition: ${conditionParts.join(" · ")}.`);
    const inventory = arrayField(self, "inventory").flatMap(presentInventoryItem);
    if (inventory.length)
        lines.push(`Inventory: ${inventory.join(", ")}.`);
    else if (Array.isArray(self?.inventory))
        lines.push("Inventory: empty.");
    const heldItem = presentInventoryItem(self?.heldItem);
    if (heldItem.length)
        lines.push(`Held item: ${heldItem.join(", ")}.`);
    if (observation.eventWindow !== undefined) {
        diagnostics.push({
            code: "source_only_event_window",
            sourcePath: `${sourcePath}.eventWindow`,
        });
    }
    if (self?.pose !== undefined) {
        diagnostics.push({
            code: "source_only_pose",
            sourcePath: `${sourcePath}.self.pose`,
        });
    }
    const scene = recordField(observation, "scene");
    const social = recordField(scene, "social");
    const players = stringArray(social?.playersOnline);
    if (players.length)
        lines.push(`Players online: ${players.join(", ")}.`);
    const entities = arrayField(scene, "entities").flatMap((item, index) => {
        const entity = recordValue(item);
        const name = stringField(entity, "name");
        const kind = stringField(entity, "kind");
        if (!name && !kind)
            return [];
        if (entity?.reference !== undefined) {
            diagnostics.push({
                code: "withheld_observation_local_reference",
                sourcePath: `${sourcePath}.scene.entities[${index}].reference`,
            });
        }
        const details = [
            kind,
            stringField(entity, "proximity"),
            stringField(entity, "relativeDirection"),
            stringField(entity, "visibility"),
        ].filter((detail) => detail !== null);
        return [
            `Saw ${name ?? kind}${details.length ? ` (${details.join(", ")})` : ""}.`,
        ];
    });
    lines.push(...entities);
    const focus = recordField(scene, "focus");
    if (focus) {
        const focusParts = [
            stringField(focus, "name"),
            stringField(focus, "kind"),
            stringField(focus, "material"),
            stringField(focus, "proximity"),
            stringField(focus, "relativeDirection"),
            stringField(focus, "visibility"),
        ].filter((part) => part !== null);
        if (focusParts.length)
            lines.push(`Focus: ${focusParts.join(" · ")}.`);
        if (focus.reference !== undefined) {
            diagnostics.push({
                code: "withheld_observation_local_reference",
                sourcePath: `${sourcePath}.scene.focus.reference`,
            });
        }
    }
    const terrain = recordField(scene, "terrain");
    const visualField = recordField(terrain, "visualField");
    if (stringField(visualField, "protocol") === "behold.visual-field.v1" &&
        visualField?.available === true) {
        const materials = arrayField(visualField, "materialLegend").flatMap((item) => {
            const name = stringField(recordValue(item), "name");
            return name ? [humanize(name)] : [];
        });
        const depths = arrayField(visualField, "depthLegend").flatMap((item) => {
            const label = stringField(recordValue(item), "label");
            return label ? [label] : [];
        });
        if (materials.length)
            lines.push(`Visible terrain: ${unique(materials).join(", ")}.`);
        if (depths.length)
            lines.push(`Visual depth bands: ${unique(depths).join(", ")}.`);
        if (visualField.materialRows !== undefined ||
            visualField.depthRows !== undefined) {
            diagnostics.push({
                code: "source_only_visual_field_encoding",
                sourcePath: `${sourcePath}.scene.terrain.visualField`,
            });
        }
    }
    const eventLines = arrayField(observation, "events").flatMap((item, index) => {
        const event = recordValue(item);
        const type = stringField(event, "type");
        const data = recordField(event, "data");
        if (type === "spawned")
            return ["Spawned into the world."];
        if (type === "condition_changed")
            return ["HUD condition changed."];
        if (type === "entity_became_visible") {
            const name = stringField(data, "name") ?? stringField(data, "kind") ?? "An entity";
            const proximity = stringField(data, "proximity");
            return [`${name} became visible${proximity ? ` ${proximity}` : ""}.`];
        }
        if (type === "entity_left_view") {
            const name = stringField(data, "name") ?? stringField(data, "kind") ?? "An entity";
            if (data?.lastSeenDistance !== undefined) {
                diagnostics.push({
                    code: "withheld_incidental_numeric_estimate",
                    sourcePath: `${sourcePath}.events[${index}].data.lastSeenDistance`,
                });
            }
            return [`${name} left the current view.`];
        }
        if (type === "chat_received") {
            const from = stringField(data, "from");
            const text = stringField(data, "text");
            return text
                ? [`Public chat${from ? ` from ${from}` : ""}: ${text}`]
                : [];
        }
        if (profile.version === 2 && type === "sound_heard") {
            diagnoseObservationEventEnvelope(event, `${sourcePath}.events[${index}]`, diagnostics);
            return presentSoundHeard(data, `${sourcePath}.events[${index}]`, diagnostics);
        }
        if (profile.version === 2 && type === "sound_sequence_heard") {
            diagnoseObservationEventEnvelope(event, `${sourcePath}.events[${index}]`, diagnostics);
            return presentSoundSequence(data, `${sourcePath}.events[${index}]`, diagnostics);
        }
        if (profile.version === 2 && type === "time_passed") {
            diagnoseObservationEventEnvelope(event, `${sourcePath}.events[${index}]`, diagnostics);
            diagnoseSourceOnlyFields(data, new Set(["elapsedMs"]), `${sourcePath}.events[${index}].data`, diagnostics);
            const elapsedMs = integerField(data, "elapsedMs");
            return elapsedMs !== null && elapsedMs >= 0
                ? [`Time passed: ${elapsedMs} ms.`]
                : unsupportedObservationEvent(`${sourcePath}.events[${index}]`, diagnostics);
        }
        if (profile.version === 2 &&
            [
                "action_failed",
                "controller_suspended",
                "cancellation_requested",
                "day_phase_changed",
                "died",
                "self_hurt",
                "visible_entity_hurt",
                "visible_block_changed",
            ].includes(type ?? "")) {
            return presentResidentLifecycleEvent(type ?? "", event, data, `${sourcePath}.events[${index}]`, diagnostics);
        }
        diagnostics.push({
            code: "unsupported_observation_event",
            sourcePath: `${sourcePath}.events[${index}]`,
        });
        return [];
    });
    lines.push(...eventLines);
    if (lines.length === 0) {
        diagnostics.push({ code: "empty_safe_observation_projection", sourcePath });
        return null;
    }
    return {
        role: "perception",
        text: lines.join(" "),
        sourcePaths: [sourcePath],
    };
}
function presentUtterance(value) {
    const assistant = recordField(recordValue(value), "assistant");
    const content = stringField(assistant, "content")?.trim();
    if (!content)
        return null;
    return {
        role: "utterance",
        text: content,
        sourcePaths: ["payload.payload.utterance.assistant.content"],
    };
}
function presentAction(value, entityId, diagnostics, profile) {
    const action = recordValue(value);
    const name = stringField(action, "name") ?? "unknown action";
    const source = stringField(action, "source") ?? "unknown source";
    const kind = stringField(action, "kind") ?? "unknown kind";
    const input = recordField(action, "input");
    let description = null;
    const paths = [
        "payload.payload.action.name",
        "payload.payload.action.source",
        "payload.payload.action.kind",
    ];
    if (action?.id !== undefined) {
        diagnostics.push({
            code: "source_only_action_identity",
            sourcePath: "payload.payload.action.id",
        });
    }
    if (action?.toolCallId !== undefined) {
        diagnostics.push({
            code: "source_only_tool_call_identity",
            sourcePath: "payload.payload.action.toolCallId",
        });
    }
    if (name === "look_direction") {
        const horizontal = stringField(input, "horizontal");
        const vertical = stringField(input, "vertical");
        if (horizontal) {
            description = `${entityId} looked ${horizontal}${vertical ? `, ${vertical}` : ""}.`;
            paths.push("payload.payload.action.input.horizontal");
            if (vertical)
                paths.push("payload.payload.action.input.vertical");
        }
    }
    else if (name === "move_controls") {
        const direction = stringField(input, "direction");
        const durationMs = integerField(input, "durationMs");
        if (direction) {
            description = `${entityId} held ${direction}${durationMs === null ? "" : ` for ${durationMs} ms`}.`;
            paths.push("payload.payload.action.input.direction");
            if (durationMs !== null)
                paths.push("payload.payload.action.input.durationMs");
        }
    }
    else if (name === "chat") {
        const text = stringField(input, "text");
        if (text) {
            description = `${entityId} sent public chat: ${text}`;
            paths.push("payload.payload.action.input.text");
        }
    }
    else if (name === "wait_for_event") {
        const reason = stringField(input, "reason");
        description = `${entityId} waited for another event${reason ? `: ${reason}` : "."}`;
        if (reason)
            paths.push("payload.payload.action.input.reason");
    }
    else if (profile.version === 2 &&
        ["attack_focused_entity", "dig_focused_block"].includes(name)) {
        diagnoseSourceOnlyFields(action, new Set(["id", "name", "input", "kind", "toolCallId", "source"]), "payload.payload.action", diagnostics, new Set(), "source_only_action_field");
        diagnoseSourceOnlyFields(input, new Set(), "payload.payload.action.input", diagnostics, new Set(), "source_only_action_input_field");
        if (input) {
            description =
                name === "attack_focused_entity"
                    ? `${entityId} attempted one attack at the focused entity.`
                    : `${entityId} attempted to dig the focused block.`;
        }
    }
    else if (profile.version === 2 && name === "whisper") {
        diagnoseSourceOnlyFields(action, new Set(["id", "name", "input", "kind", "toolCallId", "source"]), "payload.payload.action", diagnostics, new Set(), "source_only_action_field");
        diagnoseSourceOnlyFields(input, new Set(["username", "text"]), "payload.payload.action.input", diagnostics, new Set(), "source_only_action_input_field");
        const username = stringField(input, "username")?.trim();
        const text = stringField(input, "text")?.trim();
        if (username && text) {
            description = `${entityId} whispered to ${username}: ${text}`;
            paths.push("payload.payload.action.input.username", "payload.payload.action.input.text");
        }
    }
    if (!description) {
        description = `${entityId} recorded ${name}; its input has no safe v${profile.version} Textile presenter.`;
        diagnostics.push({
            code: "unsupported_action_input",
            sourcePath: "payload.payload.action.input",
        });
    }
    return {
        role: "action",
        text: `[${source} · ${kind}] ${description}`,
        sourcePaths: paths,
    };
}
function presentOutcome(actionValue, outcomeValue, diagnostics, profile) {
    const action = recordValue(actionValue);
    const outcome = recordValue(outcomeValue);
    const actionName = stringField(action, "name") ?? "action";
    const eventType = stringField(outcome, "eventType") ?? "unknown outcome";
    const ok = typeof outcome?.ok === "boolean" ? outcome.ok : null;
    const result = recordField(outcome, "result");
    const paths = [
        "payload.payload.outcome.ok",
        "payload.payload.outcome.eventType",
    ];
    let detail = null;
    let v2ShownResultKeys = null;
    if (actionName === "look_direction") {
        const orientation = recordField(result, "orientation");
        const facing = stringField(orientation, "facing");
        const vertical = stringField(orientation, "vertical");
        if (facing) {
            detail = ` The body confirmed facing ${facing}${vertical ? ` and ${vertical}` : ""}.`;
            paths.push("payload.payload.outcome.result.orientation.facing");
            if (vertical)
                paths.push("payload.payload.outcome.result.orientation.vertical");
        }
    }
    else if (actionName === "move_controls" &&
        typeof result?.bodyMoved === "boolean") {
        detail = result.bodyMoved ? " The body moved." : " The body did not move.";
        paths.push("payload.payload.outcome.result.bodyMoved");
    }
    else if (profile.version === 2 && actionName === "chat" && result) {
        const resultOk = typeof result.ok === "boolean" ? result.ok : null;
        const status = stringField(result, "status")?.trim();
        const error = stringField(result, "error")?.trim();
        if (resultOk === true && (!status || status === "chat_input_dispatched")) {
            detail = " The public chat input was submitted; recipient delivery was not independently confirmed here.";
            v2ShownResultKeys = new Set(["ok", "status", "message"]);
            paths.push("payload.payload.outcome.result.ok");
            if (status)
                paths.push("payload.payload.outcome.result.status");
        }
        else if (resultOk === false && error) {
            detail = ` The public chat input was rejected: ${humanize(error)}.`;
            v2ShownResultKeys = new Set(["ok", "error", "maximumCharacters", "providedCharacters"]);
            paths.push("payload.payload.outcome.result.ok", "payload.payload.outcome.result.error");
        }
    }
    else if (actionName === "wait_for_event" &&
        typeof result?.sawPeerChat === "boolean") {
        detail = result.sawPeerChat
            ? " The resident observed peer chat."
            : " No peer chat was observed.";
        paths.push("payload.payload.outcome.result.sawPeerChat");
    }
    else if (profile.version === 2 &&
        actionName === "wait_for_event" &&
        result?.ok === true &&
        result?.status === "waiting_for_world_event") {
        detail = " The resident is waiting for a world event.";
        v2ShownResultKeys = new Set(["ok", "status"]);
        paths.push("payload.payload.outcome.result.ok", "payload.payload.outcome.result.status");
    }
    else if (profile.version === 2 && actionName === "whisper" && result) {
        diagnoseSourceOnlyFields(outcome, new Set(["ok", "eventType", "result"]), "payload.payload.outcome", diagnostics, new Set(), "source_only_outcome_field");
        const resultOk = typeof result.ok === "boolean" ? result.ok : null;
        const status = stringField(result, "status")?.trim();
        const error = stringField(result, "error")?.trim();
        if (resultOk === true && (!status || status === "whisper_input_dispatched")) {
            detail = " The private whisper input was submitted; recipient delivery was not independently confirmed here.";
            v2ShownResultKeys = new Set(["ok", "status", "message"]);
            paths.push("payload.payload.outcome.result.ok");
            if (status)
                paths.push("payload.payload.outcome.result.status");
        }
        else if (resultOk === false && error) {
            detail = ` The private whisper input was rejected: ${humanize(error)}.`;
            v2ShownResultKeys = new Set(["ok", "error", "maximumCharacters", "providedCharacters"]);
            paths.push("payload.payload.outcome.result.ok", "payload.payload.outcome.result.error");
        }
    }
    else if (profile.version === 2 &&
        result &&
        ["attack_focused_entity", "dig_focused_block"].includes(actionName)) {
        diagnoseSourceOnlyFields(outcome, new Set(["ok", "eventType", "result", "error", "cancellation"]), "payload.payload.outcome", diagnostics, new Set(["error", "cancellation"]), "source_only_outcome_field");
        const focused = presentFocusedActionResult(actionName, result, paths, diagnostics);
        detail = focused.detail;
        v2ShownResultKeys = focused.shownResultKeys;
    }
    if (result && detail === null) {
        diagnostics.push({
            code: "unsupported_outcome_result",
            sourcePath: "payload.payload.outcome.result",
        });
    }
    if (result) {
        const shownResultKeys = v2ShownResultKeys ?? (actionName === "look_direction"
            ? new Set(["orientation"])
            : actionName === "move_controls"
                ? new Set(["bodyMoved"])
                : actionName === "wait_for_event"
                    ? new Set(["sawPeerChat"])
                    : new Set());
        for (const key of Object.keys(result)) {
            if (!shownResultKeys.has(key)) {
                diagnostics.push({
                    code: "source_only_outcome_field",
                    sourcePath: `payload.payload.outcome.result.${key}`,
                });
            }
        }
    }
    const terminal = outcomeTerminal(ok, eventType);
    return {
        role: "outcome",
        text: `${actionName} ${terminal} (${eventType}).${detail ?? ""}`,
        sourcePaths: paths,
    };
}
function presentResidentLifecycleEvent(type, event, data, eventPath, diagnostics) {
    diagnoseObservationEventEnvelope(event, eventPath, diagnostics);
    if (type === "day_phase_changed") {
        diagnoseSourceOnlyFields(data, new Set(["previous", "current"]), `${eventPath}.data`, diagnostics);
        const previous = stringField(data, "previous")?.trim();
        const current = stringField(data, "current")?.trim();
        return previous && current
            ? [`Day phase changed: ${humanize(previous)} → ${humanize(current)}.`]
            : unsupportedObservationEvent(eventPath, diagnostics);
    }
    if (type === "self_hurt") {
        diagnoseSourceOnlyFields(data, new Set(["name", "kind", "proximity"]), `${eventPath}.data`, diagnostics);
        const name = stringField(data, "name")?.trim();
        const kind = stringField(data, "kind")?.trim();
        const proximity = stringField(data, "proximity")?.trim();
        if (!name && !kind)
            return unsupportedObservationEvent(eventPath, diagnostics);
        const subject = name ?? humanize(kind ?? "resident");
        const details = [kind, proximity].filter((item) => Boolean(item));
        return [
            `${subject} was hurt${details.length ? ` (${details.join(", ")})` : ""}.`,
        ];
    }
    if (type === "visible_entity_hurt") {
        diagnoseSourceOnlyFields(data, new Set(["name", "kind", "proximity"]), `${eventPath}.data`, diagnostics);
        const name = stringField(data, "name")?.trim();
        const kind = stringField(data, "kind")?.trim();
        const proximity = stringField(data, "proximity")?.trim();
        if (!name && !kind)
            return unsupportedObservationEvent(eventPath, diagnostics);
        const subject = name ?? humanize(kind ?? "entity");
        const details = [kind, proximity].filter((item) => Boolean(item));
        return [
            `${subject} was seen taking damage${details.length ? ` (${details.join(", ")})` : ""}.`,
        ];
    }
    if (type === "died") {
        diagnoseSourceOnlyFields(data, new Set(), `${eventPath}.data`, diagnostics);
        return ["The resident died."];
    }
    if (type === "visible_block_changed") {
        diagnoseSourceOnlyFields(data, new Set(["before", "after"]), `${eventPath}.data`, diagnostics);
        const before = stringField(data, "before")?.trim();
        const after = stringField(data, "after")?.trim();
        return before && after
            ? [`Visible block changed: ${humanize(before)} → ${humanize(after)}.`]
            : unsupportedObservationEvent(eventPath, diagnostics);
    }
    if (type === "action_failed") {
        diagnoseSourceOnlyFields(data, new Set([
            "intent",
            "authorization",
            "result",
            "error",
            "cancellation",
            "failureKind",
        ]), `${eventPath}.data`, diagnostics, new Set(["authorization", "result", "cancellation", "failureKind"]));
        const intent = recordField(data, "intent");
        diagnoseIntentFields(intent, `${eventPath}.data.intent`, diagnostics);
        const tool = stringField(intent, "tool")?.trim();
        const error = stringField(data, "error")?.trim();
        if (!error)
            return unsupportedObservationEvent(eventPath, diagnostics);
        return [
            `Action failed${tool ? `: ${humanize(tool)}` : ""} (${humanize(error)}).`,
        ];
    }
    if (type === "controller_suspended") {
        diagnoseSourceOnlyFields(data, new Set(["reason", "activeIntent"]), `${eventPath}.data`, diagnostics);
        const activeIntent = recordField(data, "activeIntent");
        diagnoseIntentFields(activeIntent, `${eventPath}.data.activeIntent`, diagnostics);
        const reason = stringField(data, "reason")?.trim();
        const tool = stringField(activeIntent, "tool")?.trim();
        if (!reason)
            return unsupportedObservationEvent(eventPath, diagnostics);
        return [
            `Controller suspended (${humanize(reason)})${tool ? ` during ${humanize(tool)}` : ""}.`,
        ];
    }
    if (type === "cancellation_requested") {
        diagnoseSourceOnlyFields(data, new Set(["intent", "requestedBy", "reason"]), `${eventPath}.data`, diagnostics);
        const intent = recordField(data, "intent");
        diagnoseIntentFields(intent, `${eventPath}.data.intent`, diagnostics);
        const requestedBy = recordField(data, "requestedBy");
        diagnoseSourceOnlyFields(requestedBy, new Set(["source", "tool"]), `${eventPath}.data.requestedBy`, diagnostics);
        const tool = stringField(intent, "tool")?.trim();
        const requesterSource = stringField(requestedBy, "source")?.trim();
        const requesterTool = stringField(requestedBy, "tool")?.trim();
        const reason = stringField(data, "reason")?.trim();
        if (!reason)
            return unsupportedObservationEvent(eventPath, diagnostics);
        const requester = [requesterSource, requesterTool]
            .filter((item) => Boolean(item))
            .map(humanize)
            .join(" ");
        return [
            `Cancellation requested${tool ? ` for ${humanize(tool)}` : ""}${requester ? ` by ${requester}` : ""} (${humanize(reason)}).`,
        ];
    }
    return unsupportedObservationEvent(eventPath, diagnostics);
}
function diagnoseIntentFields(intent, sourcePath, diagnostics) {
    diagnoseSourceOnlyFields(intent, new Set(["source", "tool", "input", "observationSequence", "enqueuedAt"]), sourcePath, diagnostics, new Set(["source", "input", "observationSequence", "enqueuedAt"]));
}
function presentFocusedActionResult(actionName, result, paths, diagnostics) {
    const shownResultKeys = new Set();
    const details = [];
    const resultOk = typeof result.ok === "boolean" ? result.ok : null;
    if (resultOk !== null) {
        shownResultKeys.add("ok");
        paths.push("payload.payload.outcome.result.ok");
    }
    const error = stringField(result, "error")?.trim();
    if (error) {
        shownResultKeys.add("error");
        paths.push("payload.payload.outcome.result.error");
        details.push(`Body report: ${humanize(error)}.`);
    }
    if (actionName === "attack_focused_entity") {
        const status = stringField(result, "status")?.trim();
        const confirmation = stringField(result, "confirmation")?.trim();
        if (resultOk === true && status && confirmation) {
            shownResultKeys.add("status");
            shownResultKeys.add("confirmation");
            paths.push("payload.payload.outcome.result.status", "payload.payload.outcome.result.confirmation");
            details.push(`Body confirmation: ${humanize(status)} (${confirmation}).`);
        }
    }
    else {
        const changes = presentMaterialChanges(result, "changes", "Change evidence", paths, diagnostics);
        const attempted = presentMaterialChanges(result, "attemptedChanges", "Attempted change", paths, diagnostics);
        if (changes.length)
            shownResultKeys.add("changes");
        if (attempted.length)
            shownResultKeys.add("attemptedChanges");
        details.push(...changes, ...attempted);
    }
    return {
        detail: details.length ? ` ${details.join(" ")}` : null,
        shownResultKeys,
    };
}
function presentMaterialChanges(result, field, label, paths, diagnostics) {
    const raw = result[field];
    if (raw === undefined)
        return [];
    if (!Array.isArray(raw)) {
        diagnostics.push({
            code: "unsupported_outcome_change",
            sourcePath: `payload.payload.outcome.result.${field}`,
        });
        return [];
    }
    return raw.flatMap((item, index) => {
        const change = recordValue(item);
        const changePath = `payload.payload.outcome.result.${field}[${index}]`;
        diagnoseSourceOnlyFields(change, new Set([
            "verb",
            "position",
            "before",
            "after",
            "verified",
            "observed",
            "confirmation",
            "context",
        ]), changePath, diagnostics, new Set(["position", "context"]), "source_only_outcome_field");
        const confirmation = recordField(change, "confirmation");
        diagnoseSourceOnlyFields(confirmation, new Set([
            "source",
            "observedAt",
            "dimension",
            "position",
            "before",
            "after",
            "beforeStateId",
            "afterStateId",
        ]), `${changePath}.confirmation`, diagnostics, new Set([
            "observedAt",
            "dimension",
            "position",
            "before",
            "after",
            "beforeStateId",
            "afterStateId",
        ]), "source_only_outcome_field");
        const verb = stringField(change, "verb")?.trim();
        const before = stringField(change, "before")?.trim();
        const after = stringField(change, "after")?.trim();
        const verified = typeof change?.verified === "boolean" ? change.verified : null;
        const observed = typeof change?.observed === "boolean" ? change.observed : null;
        const confirmationSource = stringField(confirmation, "source")?.trim();
        if (!verb || !before || !after || verified === null || observed === null) {
            diagnostics.push({ code: "unsupported_outcome_change", sourcePath: changePath });
            return [];
        }
        paths.push(`${changePath}.verb`, `${changePath}.before`, `${changePath}.after`, `${changePath}.verified`, `${changePath}.observed`);
        if (confirmationSource)
            paths.push(`${changePath}.confirmation.source`);
        return [
            `${label}: ${humanize(verb)} ${humanize(before)} → ${humanize(after)}; verified ${verified ? "yes" : "no"}; observed ${observed ? "yes" : "no"}; confirmation ${confirmationSource ?? "none"}.`,
        ];
    });
}
function presentSoundHeard(data, eventPath, diagnostics) {
    diagnoseSourceOnlyFields(data, new Set(["sound", "distanceBand", "relativeDirection", "volume", "pitch"]), `${eventPath}.data`, diagnostics, new Set(["volume", "pitch"]));
    const sound = stringField(data, "sound")?.trim();
    const distanceBand = stringField(data, "distanceBand")?.trim();
    const relativeDirection = stringField(data, "relativeDirection")?.trim();
    if (!sound || !distanceBand || !relativeDirection) {
        return unsupportedObservationEvent(eventPath, diagnostics);
    }
    return [
        `Heard ${sound} (${distanceBand}, ${relativeDirection}).`,
    ];
}
function diagnoseObservationEventEnvelope(event, eventPath, diagnostics) {
    diagnoseSourceOnlyFields(event, new Set(["sequence", "type", "salience", "source", "isNew", "data"]), eventPath, diagnostics);
}
function presentSoundSequence(data, eventPath, diagnostics) {
    diagnoseSourceOnlyFields(data, new Set([
        "compaction",
        "fromSequence",
        "throughSequence",
        "omittedIndividualEvents",
        "occurrences",
    ]), `${eventPath}.data`, diagnostics);
    if (stringField(data, "compaction") !== "behold.sound-sequence.v1") {
        return unsupportedObservationEvent(eventPath, diagnostics);
    }
    const occurrences = arrayField(data, "occurrences");
    if (occurrences.length === 0) {
        return unsupportedObservationEvent(eventPath, diagnostics);
    }
    let total = 0;
    const descriptions = [];
    for (let index = 0; index < occurrences.length; index += 1) {
        const occurrence = recordValue(occurrences[index]);
        const occurrencePath = `${eventPath}.data.occurrences[${index}]`;
        diagnoseSourceOnlyFields(occurrence, new Set([
            "fromSequence",
            "throughSequence",
            "count",
            "firstAt",
            "lastAt",
            "salience",
            "data",
        ]), occurrencePath, diagnostics);
        const count = integerField(occurrence, "count");
        const sound = recordField(occurrence, "data");
        diagnoseSourceOnlyFields(sound, new Set(["sound", "distanceBand", "relativeDirection", "volume", "pitch"]), `${occurrencePath}.data`, diagnostics, new Set(["volume", "pitch"]));
        const name = stringField(sound, "sound")?.trim();
        const distanceBand = stringField(sound, "distanceBand")?.trim();
        const relativeDirection = stringField(sound, "relativeDirection")?.trim();
        if (count === null ||
            count < 1 ||
            !name ||
            !distanceBand ||
            !relativeDirection) {
            return unsupportedObservationEvent(eventPath, diagnostics);
        }
        total += count;
        descriptions.push(`${count} × ${name} (${distanceBand}, ${relativeDirection})`);
    }
    return [`Heard ${total} sounds: ${descriptions.join("; ")}.`];
}
function unsupportedObservationEvent(eventPath, diagnostics) {
    diagnostics.push({
        code: "unsupported_observation_event",
        sourcePath: eventPath,
    });
    return [];
}
function diagnoseSourceOnlyFields(value, allowed, sourcePath, diagnostics, explicitlySourceOnly = new Set(), code = "source_only_observation_event_field") {
    if (!value)
        return;
    for (const key of Object.keys(value)) {
        if (!allowed.has(key) || explicitlySourceOnly.has(key)) {
            diagnostics.push({
                code,
                sourcePath: `${sourcePath}.${key}`,
            });
        }
    }
}
function outcomeTerminal(ok, eventType) {
    if (ok === true)
        return "succeeded";
    if (/reject/i.test(eventType))
        return "was rejected";
    if (/cancel/i.test(eventType))
        return "was cancelled";
    if (/provider.*fail|fail.*provider/i.test(eventType)) {
        return "ended with a provider failure";
    }
    return ok === false ? "failed" : "ended";
}
function sectionText(section) {
    const label = section.role === "perception" ? "PERCEPTION" : section.role.toUpperCase();
    return `${label}\n${section.text}`;
}
function presentInventoryItem(value) {
    if (typeof value === "string")
        return [humanize(value)];
    const item = recordValue(value);
    const name = stringField(item, "name") ?? stringField(item, "kind");
    if (!name)
        return [];
    const count = integerField(item, "count");
    return [`${humanize(name)}${count === null ? "" : ` ×${count}`}`];
}
function unique(values) {
    return [...new Set(values)];
}
function humanize(value) {
    return value.replaceAll("_", " ");
}
function recordField(value, field) {
    return recordValue(value?.[field]);
}
function recordValue(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function stringField(value, field) {
    return typeof value?.[field] === "string" ? value[field] : null;
}
function integerField(value, field) {
    const item = value?.[field];
    return Number.isSafeInteger(item) ? item : null;
}
function numberField(value, field) {
    const item = value?.[field];
    return typeof item === "number" && Number.isFinite(item) ? item : null;
}
function arrayField(value, field) {
    const item = value?.[field];
    return Array.isArray(item) ? item : [];
}
function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
}
