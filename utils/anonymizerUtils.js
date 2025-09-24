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
  if (typeof plainText === "string" && Array.isArray(entities)) {
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

  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
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
      html = html.replace(regex, replacement);
    }
  }

  return typeof html === "string" ? html : "";
};
