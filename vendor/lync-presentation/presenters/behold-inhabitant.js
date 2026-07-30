export const BEHOLD_INHABITANT_PROFILE = "org.behold.inhabitant.v1";
const CONTRACT = "org.behold.presentation.inhabitant-turn.v1";
const HUMAN_PROFILE = "minecraft-human-semantic-v1";
const OBSERVATION_PROTOCOL = "behold.minecraft-human-semantic-observation.v1";
/**
 * Behold owns the meaning of this exact profile. Lync projects only the
 * allowlisted paths in Behold's v1 presentation pact; it never searches an
 * opaque payload for plausible prose.
 */
export function presentBeholdInhabitantEvent(event) {
    if (event.kind === "lync/loom")
        return presentResidentLoom(event);
    if (event.kind === "lync/turn")
        return presentResidentTurn(event);
    return null;
}
function presentResidentLoom(event) {
    const meta = recordField(event.payload, "meta");
    if (stringField(meta, "protocol") !== "behold.entity-loom.v1" ||
        stringField(meta, "profile") !== BEHOLD_INHABITANT_PROFILE) {
        return null;
    }
    const entityId = stringField(meta, "entityId");
    const circleId = stringField(meta, "circleId");
    if (!entityId)
        return null;
    const lines = [
        `Behold resident life: ${entityId}`,
        circleId ? `World circle: ${circleId}` : null,
        `Profile: ${BEHOLD_INHABITANT_PROFILE}`,
    ].filter((line) => line !== null);
    const section = {
        role: "structure",
        text: lines.join("\n"),
        sourcePaths: ["payload.meta"],
    };
    return {
        text: section.text,
        kind: "structure",
        contract: CONTRACT,
        source: presentationSource(event),
        sections: [section],
        diagnostics: [],
    };
}
function presentResidentTurn(event) {
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
    const observation = presentObservation(turn.observation, entityId, "payload.payload.observation", diagnostics);
    if (observation)
        sections.push(observation);
    const utterance = presentUtterance(turn.utterance);
    if (utterance)
        sections.push(utterance);
    sections.push(presentAction(turn.action, entityId, diagnostics));
    sections.push(presentOutcome(turn.action, turn.outcome, diagnostics));
    const nextObservation = presentObservation(turn.nextObservation, entityId, "payload.payload.nextObservation", diagnostics);
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
        contract: CONTRACT,
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
function presentObservation(value, entityId, sourcePath, diagnostics) {
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
function presentAction(value, entityId, diagnostics) {
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
    if (!description) {
        description = `${entityId} recorded ${name}; its input has no safe v1 Textile presenter.`;
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
function presentOutcome(actionValue, outcomeValue, diagnostics) {
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
    else if (actionName === "chat") {
        detail =
            ok === true ? " Minecraft confirmed the public chat action." : null;
    }
    else if (actionName === "wait_for_event" &&
        typeof result?.sawPeerChat === "boolean") {
        detail = result.sawPeerChat
            ? " The resident observed peer chat."
            : " No peer chat was observed.";
        paths.push("payload.payload.outcome.result.sawPeerChat");
    }
    if (result && detail === null) {
        diagnostics.push({
            code: "unsupported_outcome_result",
            sourcePath: "payload.payload.outcome.result",
        });
    }
    if (result) {
        const shownResultKeys = actionName === "look_direction"
            ? new Set(["orientation"])
            : actionName === "move_controls"
                ? new Set(["bodyMoved"])
                : actionName === "wait_for_event"
                    ? new Set(["sawPeerChat"])
                    : new Set();
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

