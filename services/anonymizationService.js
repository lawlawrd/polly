import db from "../db/index.js";

const DEFAULT_THRESHOLD = 0.5;
const ENTITY_TYPE_SPLIT_REGEX = /[\s,]+/;
const DEFAULT_LANGUAGE = "en";
const SUGGESTION_LIMIT = 10;

const recentStatement = db.prepare(`
  SELECT
    id,
    source_text AS sourceText,
    created_at AS createdAt
  FROM anonymizer_saved_runs
  WHERE user_id = ?
  ORDER BY datetime(created_at) DESC
  LIMIT ?
`);

const searchStatement = db.prepare(`
  SELECT
    id,
    source_text AS sourceText,
    created_at AS createdAt
  FROM anonymizer_saved_runs
  WHERE user_id = ?
    AND (
      lower(source_text) LIKE lower(?)
      OR lower(result_text) LIKE lower(?)
    )
  ORDER BY datetime(created_at) DESC
  LIMIT ?
`);

const selectByIdStatement = db.prepare(`
  SELECT
    id,
    source_text AS sourceText,
    source_html AS sourceHtml,
    result_text AS resultText,
    result_html AS resultHtml,
    ner_model AS nerModel,
    language,
    threshold,
    allowlist,
    denylist,
    entity_types AS entityTypes,
    entities,
    items,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM anonymizer_saved_runs
  WHERE user_id = ? AND id = ?
`);

const insertStatement = db.prepare(`
  INSERT INTO anonymizer_saved_runs (
    user_id,
    source_text,
    source_html,
    result_text,
    result_html,
    ner_model,
    language,
    threshold,
    allowlist,
    denylist,
    entity_types,
    entities,
    items
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const normalizeText = (value) => (typeof value === "string" ? value : "");

const normalizeThreshold = (value) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_THRESHOLD;
  }

  if (numericValue < 0) return 0;
  if (numericValue > 1) return 1;
  return Number(numericValue.toFixed(4));
};

const normalizeLanguage = (value) => {
  if (typeof value !== "string") {
    return DEFAULT_LANGUAGE;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_LANGUAGE;
};

const normalizeEntityTypes = (value) => {
  if (!value) return [];

  const values = Array.isArray(value) ? value : [value];

  const collected = values
    .flatMap((entry) => {
      if (typeof entry !== "string") return [];
      return entry
        .split(ENTITY_TYPE_SPLIT_REGEX)
        .map((piece) => piece.trim().toUpperCase())
        .filter(Boolean);
    })
    .filter(Boolean);

  return Array.from(new Set(collected));
};

const serializeEntityTypes = (value) => JSON.stringify(normalizeEntityTypes(value));

const parseEntityTypes = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) =>
        typeof entry === "string" ? entry.trim().toUpperCase() : null,
      )
      .filter(Boolean);
  } catch (error) {
    return [];
  }
};

const serializeJsonArray = (value) => {
  if (!Array.isArray(value)) {
    return "[]";
  }

  return JSON.stringify(value);
};

const parseJsonArray = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const clampLimit = (value) => {
  const numericValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return SUGGESTION_LIMIT;
  }
  return Math.min(Math.max(numericValue, 1), 50);
};

const escapeQuery = (value) => value.replace(/[%_]/g, "");

const buildPreview = (text) => {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "(No content)";
  }

  const words = normalized.split(" ").slice(0, 10);
  const snippet = words.join(" ");
  return words.length === 10 ? `${snippet}…` : snippet;
};

const mapSuggestionRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    preview: buildPreview(row.sourceText),
  };
};

const mapFullRow = (row) => {
  if (!row) return null;

  const numericThreshold = Number.parseFloat(row.threshold);

  return {
    id: row.id,
    sourceText: row.sourceText ?? "",
    sourceHtml: row.sourceHtml ?? "",
    resultText: row.resultText ?? "",
    resultHtml: row.resultHtml ?? "",
    settings: {
      nerModel: row.nerModel ?? "en_core_web_lg",
      language: normalizeLanguage(row.language),
      threshold: Number.isFinite(numericThreshold)
        ? numericThreshold
        : DEFAULT_THRESHOLD,
      allowlist: row.allowlist ?? "",
      denylist: row.denylist ?? "",
      entityTypes: parseEntityTypes(row.entityTypes),
    },
    entities: parseJsonArray(row.entities),
    items: parseJsonArray(row.items),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const saveAnonymizationForUser = ({
  userId,
  sourceText,
  sourceHtml,
  resultText,
  resultHtml,
  nerModel,
  language,
  threshold,
  allowlist,
  denylist,
  entityTypes,
  entities,
  items,
}) => {
  if (!userId) {
    throw new Error("A user must be provided to save an anonymization.");
  }

  const normalizedSourceText = normalizeText(sourceText);
  const normalizedSourceHtml = normalizeText(sourceHtml);
  const normalizedResultText = normalizeText(resultText);
  const normalizedResultHtml = normalizeText(resultHtml);
  const normalizedNerModel = normalizeText(nerModel) || "en_core_web_lg";
  const normalizedLanguage = normalizeLanguage(language);
  const normalizedThreshold = normalizeThreshold(threshold);
  const normalizedAllowlist = normalizeText(allowlist);
  const normalizedDenylist = normalizeText(denylist);
  const serializedEntityTypes = serializeEntityTypes(entityTypes);
  const serializedEntities = serializeJsonArray(entities);
  const serializedItems = serializeJsonArray(items);

  const result = insertStatement.run(
    userId,
    normalizedSourceText,
    normalizedSourceHtml,
    normalizedResultText,
    normalizedResultHtml,
    normalizedNerModel,
    normalizedLanguage,
    normalizedThreshold,
    normalizedAllowlist,
    normalizedDenylist,
    serializedEntityTypes,
    serializedEntities,
    serializedItems,
  );

  return getAnonymizationForUser(userId, Number(result.lastInsertRowid));
};

export const searchAnonymizationsForUser = ({ userId, query, limit } = {}) => {
  if (!userId) return [];

  const effectiveLimit = clampLimit(limit);
  const trimmedQuery = typeof query === "string" ? query.trim() : "";

  if (!trimmedQuery) {
    const rows = recentStatement.all(userId, effectiveLimit);
    return rows.map(mapSuggestionRow).filter(Boolean);
  }

  const likePattern = `%${escapeQuery(trimmedQuery)}%`;
  const rows = searchStatement.all(
    userId,
    likePattern,
    likePattern,
    effectiveLimit,
  );
  return rows.map(mapSuggestionRow).filter(Boolean);
};

export const getAnonymizationForUser = (userId, anonymizationId) => {
  if (!userId || !anonymizationId) return null;
  const row = selectByIdStatement.get(userId, anonymizationId);
  return mapFullRow(row);
};

export default {
  saveAnonymizationForUser,
  searchAnonymizationsForUser,
  getAnonymizationForUser,
};
