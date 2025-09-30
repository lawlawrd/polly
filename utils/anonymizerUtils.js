export const formatConfidence = (value) => {
  if (typeof value !== "number") return "--";
  return `${Math.round(value * 1000) / 10}%`;
};

const resolveDisplayEntityType = (entityType, displayMap) => {
  if (typeof entityType !== "string" || entityType.length === 0) {
    return entityType;
  }

  if (!displayMap) {
    return entityType;
  }

  if (displayMap instanceof Map) {
    return displayMap.get(entityType) ?? entityType;
  }

  if (typeof displayMap === "object") {
    return displayMap[entityType] ?? entityType;
  }

  return entityType;
};

export const applyAnonymizationToHtml = (
  html,
  plainText,
  _items,
  entities,
  { entityTypeDisplayMap } = {},
) => {
  let sanitizedHtml = typeof html === "string" ? html : "";

  if (!Array.isArray(entities) || entities.length === 0) {
    return sanitizedHtml;
  }

  if (typeof plainText === "string") {
    entities.forEach((entity) => {
      if (
        entity &&
        typeof entity.start === "number" &&
        typeof entity.end === "number" &&
        entity.end > entity.start
      ) {
        entity.foundText = plainText.slice(entity.start, entity.end);
      }
    });
  }

  const sortedEntities = [...entities].sort((a, b) => {
    const aLength = typeof a?.foundText === "string" ? a.foundText.length : 0;
    const bLength = typeof b?.foundText === "string" ? b.foundText.length : 0;
    return bLength - aLength;
  });

  sortedEntities.forEach((entity) => {
    if (
      entity &&
      typeof entity.foundText === "string" &&
      entity.foundText.length > 0
    ) {
      const displayEntityType = resolveDisplayEntityType(
        entity.entity_type,
        entityTypeDisplayMap,
      );
      const replacement =
        displayEntityType && displayEntityType.length > 0
          ? `&lt;${displayEntityType}&gt;`
          : "&lt;REDACTED&gt;";
      const escapedFoundText = entity.foundText.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      const regex = new RegExp(escapedFoundText, "g");
      sanitizedHtml = sanitizedHtml.replace(regex, replacement);
    }
  });

  return sanitizedHtml;
};
