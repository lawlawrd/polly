import db from "../db/index.js";

const DEFAULT_THRESHOLD = 0.5;
const ENTITY_TYPE_SPLIT_REGEX = /[\s,]+/;

const listStatement = db.prepare(`
  SELECT
    id,
    name,
    ner_model AS nerModel,
    threshold,
    allowlist,
    denylist,
    entity_types AS entityTypes,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM anonymizer_presets
  WHERE user_id = ?
  ORDER BY name COLLATE NOCASE
`);

const selectByIdStatement = db.prepare(`
  SELECT
    id,
    name,
    ner_model AS nerModel,
    threshold,
    allowlist,
    denylist,
    entity_types AS entityTypes,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM anonymizer_presets
  WHERE user_id = ? AND id = ?
`);

const selectByNameStatement = db.prepare(`
  SELECT id FROM anonymizer_presets WHERE user_id = ? AND lower(name) = lower(?)
`);

const insertStatement = db.prepare(`
  INSERT INTO anonymizer_presets (
    user_id,
    name,
    ner_model,
    threshold,
    allowlist,
    denylist,
    entity_types
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const updateStatement = db.prepare(`
  UPDATE anonymizer_presets
  SET
    ner_model = ?,
    threshold = ?,
    allowlist = ?,
    denylist = ?,
    entity_types = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND user_id = ?
`);

const deleteStatement = db.prepare(
  "DELETE FROM anonymizer_presets WHERE id = ? AND user_id = ?",
);

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

const mapRow = (row) => {
  if (!row) return null;

  const numericThreshold = Number.parseFloat(row.threshold);

  return {
    id: row.id,
    name: row.name,
    nerModel: row.nerModel,
    threshold: Number.isFinite(numericThreshold)
      ? numericThreshold
      : DEFAULT_THRESHOLD,
    allowlist: row.allowlist ?? "",
    denylist: row.denylist ?? "",
    entityTypes: parseEntityTypes(row.entityTypes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const normalizeName = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 150);
};

const normalizeNerModel = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "en_core_web_lg";
  }
  return value.trim();
};

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

const normalizeListText = (value) => (typeof value === "string" ? value : "");

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

export const listPresetsForUser = (userId) => {
  if (!userId) return [];
  const rows = listStatement.all(userId);
  return rows.map(mapRow).filter(Boolean);
};

export const getPresetByIdForUser = (userId, presetId) => {
  if (!userId || !presetId) return null;
  const row = selectByIdStatement.get(userId, presetId);
  return mapRow(row);
};

export const savePresetForUser = ({
  userId,
  name,
  nerModel,
  threshold,
  allowlist,
  denylist,
  entityTypes,
}) => {
  if (!userId) {
    throw new Error("A user must be provided to save a preset.");
  }

  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    const error = new Error("Preset name is required.");
    error.code = "NAME_REQUIRED";
    throw error;
  }

  const normalizedNerModel = normalizeNerModel(nerModel);
  const normalizedThreshold = normalizeThreshold(threshold);
  const normalizedAllowlist = normalizeListText(allowlist);
  const normalizedDenylist = normalizeListText(denylist);
  const normalizedEntityTypes = normalizeEntityTypes(entityTypes);
  const serializedEntityTypes = JSON.stringify(normalizedEntityTypes);

  const existing = selectByNameStatement.get(userId, normalizedName);

  if (existing && existing.id) {
    updateStatement.run(
      normalizedNerModel,
      normalizedThreshold,
      normalizedAllowlist,
      normalizedDenylist,
      serializedEntityTypes,
      existing.id,
      userId,
    );
    return getPresetByIdForUser(userId, existing.id);
  }

  const result = insertStatement.run(
    userId,
    normalizedName,
    normalizedNerModel,
    normalizedThreshold,
    normalizedAllowlist,
    normalizedDenylist,
    serializedEntityTypes,
  );

  return getPresetByIdForUser(userId, Number(result.lastInsertRowid));
};

export const deletePresetForUser = (userId, presetId) => {
  if (!userId || !presetId) return false;
  const result = deleteStatement.run(presetId, userId);
  return result.changes > 0;
};

export default {
  listPresetsForUser,
  getPresetByIdForUser,
  savePresetForUser,
  deletePresetForUser,
};
