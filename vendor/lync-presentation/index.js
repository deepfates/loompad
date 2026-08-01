import { BEHOLD_INHABITANT_PROFILE, BEHOLD_INHABITANT_PROFILE_V2, presentBeholdInhabitantEvent, presentBeholdInhabitantEventV2, } from "./presenters/behold-inhabitant.js";
export { BEHOLD_INHABITANT_PROFILE, BEHOLD_INHABITANT_PROFILE_V2, } from "./presenters/behold-inhabitant.js";
const splicePresenters = {
    "twitter/tweet": {
        contract: "splice/twitter-archive",
        present: (event) => content(event, firstString(event.payload, ["full_text", "fullText", "text"]), "splice/twitter-archive", firstStringPath(event.payload, ["full_text", "fullText", "text"])),
    },
    "twitter/like": {
        contract: "splice/twitter-archive",
        present: (event) => content(event, firstString(event.payload, ["full_text", "fullText", "text"]), "splice/twitter-archive", firstStringPath(event.payload, ["full_text", "fullText", "text"])),
    },
    "bluesky/post": {
        contract: "splice/bluesky-archive",
        present: (event) => {
            const nested = nestedString(event.payload, ["record", "text"]);
            return content(event, nested ?? stringField(event.payload, "text"), "splice/bluesky-archive", nested !== null ? "payload.record.text" : fieldPath(event.payload, "text"));
        },
    },
    "glowfic/post": {
        contract: "splice/glowfic-json",
        present: (event) => content(event, htmlToPlainText(stringField(event.payload, "content")), "splice/glowfic-json", fieldPath(event.payload, "content")),
    },
    "twitter/tweet-embed": {
        contract: "splice/twitter-embed-cache",
        present: (event) => content(event, htmlToPlainText(nestedString(event.payload, ["embed", "html"])), "splice/twitter-embed-cache", nestedString(event.payload, ["embed", "html"]) !== null
            ? "payload.embed.html"
            : null),
    },
    "ocr/page": {
        contract: "splice/ocr-text-import",
        present: (event) => content(event, stringField(event.payload, "text"), "splice/ocr-text-import", fieldPath(event.payload, "text")),
    },
    "ocr/document": {
        contract: "splice/ocr-text-import",
        present: (event) => content(event, stringField(event.payload, "text"), "splice/ocr-text-import", fieldPath(event.payload, "text")),
    },
    "glowfic/thread": {
        contract: "splice/glowfic-json",
        present: glowficThread,
    },
    "ocr/set": {
        contract: "splice/ocr-text-import",
        present: ocrSet,
    },
};
/**
 * Resolve one source event through exact profile, exact kind, then the small
 * generic text/message pact. A claimed profile or kind never falls through
 * when its payload is malformed: callers receive an explicit unsupported
 * decision instead of plausible prose from an unrelated nested field.
 */
export function presentLyncEvent(event, context = {}) {
    if (context.loomProfile === BEHOLD_INHABITANT_PROFILE) {
        const presentation = presentBeholdInhabitantEvent(event);
        return presentation
            ? normalizePresentation(event, presentation)
            : unsupported("org.behold.presentation.inhabitant-turn.v1", "unsupported_profile_event");
    }
    if (context.loomProfile === BEHOLD_INHABITANT_PROFILE_V2) {
        const presentation = presentBeholdInhabitantEventV2(event);
        return presentation
            ? normalizePresentation(event, presentation)
            : unsupported("org.behold.presentation.inhabitant-turn.v2", "unsupported_profile_event");
    }
    const known = splicePresenters[event.kind];
    if (known) {
        const presentation = known.present(event);
        return presentation
            ? normalizePresentation(event, presentation)
            : unsupported(known.contract, "malformed_known_kind");
    }
    if (event.kind === "lync/pointer") {
        const presentation = lyncPointer(event);
        return presentation
            ? normalizePresentation(event, presentation)
            : unsupported("lync/pointer", "malformed_known_kind");
    }
    const generic = genericPresentation(event);
    return generic ? normalizePresentation(event, generic) : { status: "unclaimed" };
}
/**
 * Resolve the one profile inherited through an event's causal parents.
 * Parent order and event identities are untouched. Conflicting inherited
 * profiles deliberately resolve to no profile rather than choosing one.
 */
export function resolveLyncPresentationProfiles(events) {
    const list = [...events];
    const byId = new Map(list.map((event) => [event.id, event]));
    const resolved = new Map();
    const visiting = new Set();
    const profileFor = (event) => {
        const cached = resolved.get(event.id);
        if (cached !== undefined)
            return cached;
        if (visiting.has(event.id))
            return null;
        visiting.add(event.id);
        let profile = null;
        if (event.kind === "lync/loom") {
            const meta = recordField(event.payload, "meta");
            profile = typeof meta?.profile === "string" ? meta.profile : null;
        }
        else {
            const inherited = new Set();
            for (const parentId of event.parents) {
                const parent = byId.get(parentId);
                if (!parent)
                    continue;
                const parentProfile = profileFor(parent);
                if (parentProfile)
                    inherited.add(parentProfile);
            }
            if (inherited.size === 1)
                profile = [...inherited][0] ?? null;
        }
        visiting.delete(event.id);
        resolved.set(event.id, profile);
        return profile;
    };
    const result = new Map();
    for (const event of list) {
        const profile = profileFor(event);
        if (profile)
            result.set(event.id, profile);
    }
    return result;
}
function normalizePresentation(event, presentation) {
    return {
        status: "presented",
        presentation: {
            ...presentation,
            source: presentation.source ?? presentationSource(event),
            sections: presentation.sections ?? [],
            diagnostics: presentation.diagnostics ?? [],
        },
    };
}
function unsupported(contract, code) {
    return {
        status: "unsupported",
        contract,
        diagnostics: [{ code, sourcePath: "payload" }],
    };
}
function content(event, text, contract, sourcePath) {
    if (text === null || sourcePath === null || text.length === 0)
        return null;
    return presentation(event, text, "content", contract, "content", [sourcePath]);
}
function presentation(event, text, kind, contract, role, sourcePaths) {
    return {
        text,
        kind,
        contract,
        source: presentationSource(event),
        sections: [{ role, text, sourcePaths }],
        diagnostics: [],
    };
}
function presentationSource(event) {
    return {
        id: event.id,
        parents: [...event.parents],
        author: {
            actor: event.author.actor,
            ...(typeof event.author.via === "string" ? { via: event.author.via } : {}),
        },
        kind: event.kind,
    };
}
function glowficThread(event) {
    const payload = event.payload;
    const title = stringField(payload, "title");
    const id = stringField(payload, "id");
    const authors = stringArray(payload.authors);
    const source = stringField(payload, "url");
    const lines = [
        `Glowfic thread: ${title ?? id ?? "untitled"}`,
        id && title ? `Thread ${id}` : null,
        authors.length ? `Authors: ${authors.join(", ")}` : null,
        source ? `Source: ${source}` : null,
    ].filter((line) => line !== null);
    const paths = [
        title !== null ? "payload.title" : null,
        id !== null ? "payload.id" : null,
        authors.length ? "payload.authors" : null,
        source !== null ? "payload.url" : null,
    ].filter((path) => path !== null);
    return presentation(event, lines.join("\n"), "structure", "splice/glowfic-json", "structure", paths);
}
function ocrSet(event) {
    const payload = event.payload;
    const locator = stringField(payload, "locator") ?? "unnamed set";
    const pages = integerField(payload, "pages");
    const documents = Array.isArray(payload.documents) ? payload.documents.length : null;
    const range = recordField(payload, "page_range");
    const min = range ? integerField(range, "min") : null;
    const max = range ? integerField(range, "max") : null;
    const counts = [
        pages === null ? null : `${pages} ${pages === 1 ? "page" : "pages"}`,
        documents === null ? null : `${documents} ${documents === 1 ? "document" : "documents"}`,
    ].filter((value) => value !== null);
    const lines = [
        `OCR set: ${locator}`,
        counts.length ? counts.join(" · ") : null,
        min === null || max === null ? null : `Page range: ${min}–${max}`,
    ].filter((line) => line !== null);
    const paths = [
        stringField(payload, "locator") !== null ? "payload.locator" : null,
        pages !== null ? "payload.pages" : null,
        documents !== null ? "payload.documents" : null,
        min !== null || max !== null ? "payload.page_range" : null,
    ].filter((path) => path !== null);
    return presentation(event, lines.join("\n"), "structure", "splice/ocr-text-import", "structure", paths);
}
function lyncPointer(event) {
    const name = stringField(event.payload, "name");
    const target = stringField(event.payload, "target");
    if (!name || !target)
        return null;
    return presentation(event, `Lync pointer: ${name}\nTarget: ${target}`, "structure", "lync/pointer", "structure", ["payload.name", "payload.target"]);
}
function genericPresentation(event) {
    const payload = event.payload;
    for (const field of ["text", "full_text", "fullText", "message"]) {
        const direct = stringField(payload, field);
        if (direct !== null) {
            return content(event, direct, "lync/generic-text-v1", `payload.${field}`);
        }
    }
    const message = recordField(payload, "message");
    if (!message)
        return null;
    const messageText = stringField(message, "content");
    if (messageText !== null) {
        return content(event, messageText, "lync/generic-message-v1", "payload.message.content");
    }
    const blocks = message.content;
    if (!Array.isArray(blocks))
        return null;
    const paths = [];
    const text = blocks
        .map((block, index) => {
        const record = recordValue(block);
        const value = record ? stringField(record, "text") : null;
        if (value !== null)
            paths.push(`payload.message.content[${index}].text`);
        return value ?? "";
    })
        .filter(Boolean)
        .join("");
    return text
        ? presentation(event, text, "content", "lync/generic-message-blocks-v1", "content", paths)
        : null;
}
/** Convert source HTML to inert, readable plain text without executing it. */
export function htmlToPlainText(html) {
    if (html === null)
        return null;
    const withoutExecutable = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    const withBreaks = withoutExecutable
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|blockquote|li|h[1-6])\s*>/gi, "\n");
    const decoded = decodeHtmlEntities(withBreaks.replace(/<[^>]*>/g, ""));
    const normalized = decoded
        .replace(/\r\n?/g, "\n")
        .replace(/[\t ]+\n/g, "\n")
        .replace(/\n[\t ]+/g, "\n")
        .replace(/[\t ]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return normalized || null;
}
function decodeHtmlEntities(value) {
    const named = {
        amp: "&", apos: "'", gt: ">", hellip: "…", ldquo: "“", lsquo: "‘",
        lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"', rdquo: "”", rsquo: "’",
    };
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
        if (entity[0] === "#") {
            const base = entity[1]?.toLowerCase() === "x" ? 16 : 10;
            const digits = base === 16 ? entity.slice(2) : entity.slice(1);
            const codePoint = Number.parseInt(digits, base);
            if (Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
                return String.fromCodePoint(codePoint);
            }
            return match;
        }
        return named[entity.toLowerCase()] ?? match;
    });
}
function firstString(payload, fields) {
    for (const field of fields) {
        const value = stringField(payload, field);
        if (value !== null)
            return value;
    }
    return null;
}
function firstStringPath(payload, fields) {
    for (const field of fields) {
        if (stringField(payload, field) !== null)
            return `payload.${field}`;
    }
    return null;
}
function fieldPath(payload, field) {
    return stringField(payload, field) !== null ? `payload.${field}` : null;
}
function nestedString(payload, path) {
    let value = payload;
    for (const key of path) {
        const record = recordValue(value);
        if (!record)
            return null;
        value = record[key];
    }
    return typeof value === "string" ? value : null;
}
function stringField(payload, field) {
    return typeof payload[field] === "string" ? payload[field] : null;
}
function integerField(payload, field) {
    const value = payload[field];
    return Number.isInteger(value) ? value : null;
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function recordField(payload, field) {
    return recordValue(payload[field]);
}
function recordValue(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
