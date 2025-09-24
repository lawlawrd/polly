import { Router } from "express";

const DEFAULT_ACCEPTANCE_THRESHOLD = 0.5;
const TERM_SPLIT_REGEX = /[\n,]+/;
const ENTITY_TYPE_SPLIT_REGEX = /[\s,]+/;

const NER_MODEL_LANGUAGE_MAP = {
  en_core_web_lg: "en",
  nl_core_news_lg: "nl",
  de_core_news_lg: "de",
  fr_core_news_lg: "fr",
};

const normalizeListTerm = (value) =>
  typeof value === "string"
    ? value
        .normalize("NFC")
        .trim()
        .toLowerCase()
    : "";

const parseListInput = (input) => {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .flatMap((entry) =>
        typeof entry === "string" ? entry.split(TERM_SPLIT_REGEX) : [],
      )
      .map(normalizeListTerm)
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(TERM_SPLIT_REGEX)
      .map(normalizeListTerm)
      .filter(Boolean);
  }

  return [];
};

const buildTermSet = (input) => new Set(parseListInput(input));

const parseRequestedEntityTypes = (input) => {
  const values = Array.isArray(input) ? input : [input];

  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (typeof value !== "string") return [];
          return value
            .split(ENTITY_TYPE_SPLIT_REGEX)
            .map((part) => part.trim().toUpperCase())
            .filter(Boolean);
        })
        .filter(Boolean),
    ),
  );
};

const shouldIncludeEntity = (entity, sourceText, allowlistSet, denylistSet) => {
  if (!entity || typeof entity !== "object") return false;

  const start = entity.start;
  const end = entity.end;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return false;
  }

  const candidate = sourceText.slice(start, end);
  const normalizedCandidate = normalizeListTerm(candidate);

  if (normalizedCandidate.length === 0) {
    return false;
  }

  if (denylistSet.has(normalizedCandidate)) {
    return true;
  }

  if (allowlistSet.has(normalizedCandidate)) {
    return false;
  }

  return true;
};

const findDenylistEntities = (sourceText, denylistSet) => {
  if (denylistSet.size === 0 || typeof sourceText !== "string") {
    return [];
  }

  const lowerSource = sourceText.toLowerCase();
  const results = [];

  for (const term of denylistSet) {
    if (!term) continue;

    let searchIndex = 0;

    while (searchIndex <= lowerSource.length) {
      const matchIndex = lowerSource.indexOf(term, searchIndex);

      if (matchIndex === -1) break;

      const start = matchIndex;
      const end = start + term.length;

      results.push({
        entity_type: "DENYLIST_TERM",
        start,
        end,
        score: 1,
        recognizer_result: "denylist",
        text: sourceText.slice(start, end),
      });

      searchIndex = end;
    }
  }

  return results;
};

const mergeEntities = (baseEntities, supplementalEntities) => {
  const seen = new Set();
  const output = [];

  const pushIfUnique = (entity) => {
    if (!entity || typeof entity !== "object") return;

    const start = entity.start;
    const end = entity.end;
    const type = entity.entity_type ?? "";

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      return;
    }

    const key = `${start}-${end}-${type}`;
    if (seen.has(key)) return;

    seen.add(key);
    output.push(entity);
  };

  for (const entity of baseEntities) {
    pushIfUnique(entity);
  }

  for (const entity of supplementalEntities) {
    pushIfUnique(entity);
  }

  return output;
};

import { ensureAuthenticated } from "../auth/middleware.js";
import {
  deletePresetForUser,
  listPresetsForUser,
  savePresetForUser,
} from "../services/presetService.js";
import {
  getAnonymizationForUser,
  saveAnonymizationForUser,
  searchAnonymizationsForUser,
} from "../services/anonymizationService.js";

export const createAnonymizeRouter = ({ analyzerUrl, anonymizerUrl }) => {
  const router = Router();
  const anonymizeRoute = "/anonymize";

  router.use(ensureAuthenticated);

  router.get("/presets", (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const presets = listPresetsForUser(userId);
      res.json({ presets });
    } catch (error) {
      console.error("Failed to list presets", error);
      res.status(500).json({ error: "Failed to load presets." });
    }
  });

  router.post("/presets", (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const { name, nerModel, threshold, allowlist, denylist, entityTypes } =
        req.body ?? {};

      const preset = savePresetForUser({
        userId,
        name,
        nerModel,
        threshold,
        allowlist,
        denylist,
        entityTypes,
      });

      res.status(201).json({ preset });
    } catch (error) {
      console.error("Failed to save preset", error);
      const status = error?.code === "NAME_REQUIRED" ? 400 : 500;
      const message =
        error?.code === "NAME_REQUIRED"
          ? "Preset name is required."
          : "Failed to save preset.";
      res.status(status).json({ error: message });
    }
  });

  router.delete("/presets/:presetId", (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const presetId = Number.parseInt(req.params?.presetId, 10);
      if (!Number.isFinite(presetId)) {
        res.status(400).json({ error: "Invalid preset." });
        return;
      }

      const removed = deletePresetForUser(userId, presetId);
      if (!removed) {
        res.status(404).json({ error: "Preset not found." });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete preset", error);
      res.status(500).json({ error: "Failed to delete preset." });
    }
  });

  router.get(`${anonymizeRoute}/saved`, (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const query = typeof req.query?.q === "string" ? req.query.q : "";
      const limitParam = req.query?.limit;
      const limit = Number.isFinite(Number.parseInt(limitParam, 10))
        ? Number.parseInt(limitParam, 10)
        : undefined;

      const anonymizations = searchAnonymizationsForUser({
        userId,
        query,
        limit,
      });

      res.json({ anonymizations });
    } catch (error) {
      console.error("Failed to list anonymizations", error);
      res.status(500).json({ error: "Failed to load anonymizations." });
    }
  });

  router.get(`${anonymizeRoute}/saved/:id`, (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const anonymizationId = Number.parseInt(req.params?.id, 10);
      if (!Number.isFinite(anonymizationId)) {
        res.status(400).json({ error: "Invalid anonymization." });
        return;
      }

      const anonymization = getAnonymizationForUser(userId, anonymizationId);
      if (!anonymization) {
        res.status(404).json({ error: "Anonymization not found." });
        return;
      }

      res.json({ anonymization });
    } catch (error) {
      console.error("Failed to load anonymization", error);
      res.status(500).json({ error: "Failed to load anonymization." });
    }
  });

  router.post(`${anonymizeRoute}/saved`, (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const {
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
      } = req.body ?? {};

      if (typeof sourceText !== "string" || typeof sourceHtml !== "string") {
        res.status(400).json({ error: "Source content is required." });
        return;
      }

      if (typeof resultText !== "string" || typeof resultHtml !== "string") {
        res.status(400).json({ error: "Result content is required." });
        return;
      }

      const anonymization = saveAnonymizationForUser({
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
      });

      res.status(201).json({ anonymization });
    } catch (error) {
      console.error("Failed to save anonymization", error);
      res.status(500).json({ error: "Failed to save anonymization." });
    }
  });

  router.post(anonymizeRoute, async (req, res) => {
    const { text, language: requestedLanguage, nerModel } = req.body ?? {};
    const requestedEntityTypes = parseRequestedEntityTypes(
      req.body?.entityTypes,
    );
    const entityTypeFilterSet =
      requestedEntityTypes.length > 0
        ? new Set(requestedEntityTypes)
        : null;

    const normalizedModel =
      typeof nerModel === "string" && nerModel in NER_MODEL_LANGUAGE_MAP
        ? nerModel
        : null;
    const resolvedLanguage =
      typeof requestedLanguage === "string" && requestedLanguage.length > 0
        ? requestedLanguage
        : normalizedModel
        ? NER_MODEL_LANGUAGE_MAP[normalizedModel]
        : "en";

    const rawThreshold = req.body?.threshold;
    const parsedThreshold =
      typeof rawThreshold === "number"
        ? rawThreshold
        : typeof rawThreshold === "string"
        ? Number.parseFloat(rawThreshold)
        : Number.NaN;
    const acceptanceThreshold =
      Number.isFinite(parsedThreshold) && parsedThreshold >= 0 && parsedThreshold <= 1
        ? parsedThreshold
        : DEFAULT_ACCEPTANCE_THRESHOLD;

    const allowlistSet = buildTermSet(req.body?.allowlist);
    const denylistSet = buildTermSet(req.body?.denylist);

    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({
        error: "Request body must include non-empty text.",
      });
      return;
    }

    const payload = {
      text,
      language: resolvedLanguage,
      return_decision_process: true,
    };

    if (normalizedModel) {
      payload.ner_model = normalizedModel;
    }

    if (entityTypeFilterSet) {
      payload.entities = Array.from(entityTypeFilterSet);
    }

    try {
      const analyzerResponse = await fetch(
        `${analyzerUrl.replace(/\/$/, "")}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!analyzerResponse.ok) {
        const message = await analyzerResponse.text();
        res.status(502).json({
          error:
            "Presidio analyzer request failed. Check that the service is reachable.",
          details: message,
        });
        return;
      }

      const analyzerResults = await analyzerResponse.json();
      const entityTypeFiltered = Array.isArray(analyzerResults)
        ? analyzerResults.filter((entity) => {
            if (!entity || typeof entity !== "object") return false;

            if (!entityTypeFilterSet) return true;

            const type =
              typeof entity.entity_type === "string"
                ? entity.entity_type.trim().toUpperCase()
                : "";

            return entityTypeFilterSet.has(type);
          })
        : [];

      const thresholdFiltered = entityTypeFiltered.filter((entity) => {
        if (!entity || typeof entity !== "object") return false;
        const score =
          typeof entity.score === "number"
            ? entity.score
            : typeof entity.score === "string"
            ? Number.parseFloat(entity.score)
            : Number.NaN;

        return Number.isFinite(score) ? score >= acceptanceThreshold : true;
      });

      const allowDenyFiltered = thresholdFiltered.filter((entity) =>
        shouldIncludeEntity(entity, text, allowlistSet, denylistSet),
      );

      const denylistEntities = findDenylistEntities(text, denylistSet);
      const filteredAnalyzerResults = mergeEntities(
        allowDenyFiltered,
        denylistEntities,
      );

      const anonymizerResponse = await fetch(
        `${anonymizerUrl.replace(/\/$/, "")}/anonymize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            analyzer_results: filteredAnalyzerResults,
          }),
        },
      );

      if (!anonymizerResponse.ok) {
        const message = await anonymizerResponse.text();
        res.status(502).json({
          error:
            "Presidio anonymizer request failed. Check that the service is reachable.",
          details: message,
        });
        return;
      }

      const anonymizerResult = await anonymizerResponse.json();

      res.json({
        anonymizedText:
          anonymizerResult.text ?? anonymizerResult.anonymized_text ?? "",
        items: anonymizerResult.items ?? [],
        entities: filteredAnalyzerResults,
      });
    } catch (error) {
      console.error("Presidio proxy failed", error);
      res.status(500).json({
        error: "Unexpected error while contacting Presidio services.",
      });
    }
  });

  return router;
};

export default createAnonymizeRouter;
