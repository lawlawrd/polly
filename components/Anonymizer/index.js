import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import Editor from "../Editor/index.js";

import {
  applyAnonymizationToHtml,
  formatConfidence,
} from "./../../utils/anonymizerUtils.js";

const INITIAL_EDITOR_STATE = {
  html: "",
  text: "",
};

const DEFAULT_ACCEPTANCE_THRESHOLD = 0.5;

const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 10;

const formatSavedTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const stableStringify = (value) => {
  if (value === null) {
    return "null";
  }

  const valueType = typeof value;

  if (valueType === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return "null";
    }
    return JSON.stringify(Number(value.toFixed(6)));
  }

  if (valueType === "boolean" || valueType === "string") {
    return JSON.stringify(value);
  }

  if (valueType === "undefined") {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (valueType === "object") {
    const keys = Object.keys(value).sort();
    const parts = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
    );
    return `{${parts.join(",")}}`;
  }

  return "null";
};

const buildResultSignature = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const {
    sourceText = "",
    sourceHtml = "",
    resultText = "",
    resultHtml = "",
    nerModel = "",
    language = "",
    threshold = DEFAULT_ACCEPTANCE_THRESHOLD,
    allowlist = "",
    denylist = "",
    entityTypes = [],
    entities = [],
    items = [],
  } = payload;

  const normalizedThreshold =
    typeof threshold === "number"
      ? threshold
      : typeof threshold === "string"
        ? Number.parseFloat(threshold)
        : DEFAULT_ACCEPTANCE_THRESHOLD;

  const normalizedEntityTypes = Array.isArray(entityTypes)
    ? Array.from(
        new Set(
          entityTypes
            .map((value) =>
              typeof value === "string" ? value.trim().toUpperCase() : "",
            )
            .filter(Boolean),
        ),
      ).sort()
    : [];

  const signaturePayload = {
    sourceText,
    sourceHtml,
    resultText,
    resultHtml,
    nerModel,
    language,
    threshold: Number.isFinite(normalizedThreshold)
      ? Number(normalizedThreshold.toFixed(6))
      : DEFAULT_ACCEPTANCE_THRESHOLD,
    allowlist,
    denylist,
    entityTypes: normalizedEntityTypes,
    entities: Array.isArray(entities) ? entities : [],
    items: Array.isArray(items) ? items : [],
  };

  return stableStringify(signaturePayload);
};

const buildEntityId = (entity, fallbackIndex) => {
  const entityType = entity?.entity_type ?? "";
  const start = typeof entity?.start === "number" ? entity.start : undefined;
  return `${entityType}-${start ?? fallbackIndex}-${fallbackIndex}`;
};

const NER_MODEL_OPTIONS = [
  {
    value: "en_core_web_lg",
    label: "English (en_core_web_lg)",
    language: "en",
    disabled: false,
  },
  {
    value: "nl_core_news_lg",
    label: "Dutch (nl_core_news_lg)",
    language: "nl",
    disabled: false,
  },
  {
    value: "de_core_news_lg",
    label: "German (de_core_news_lg)",
    language: "de",
    disabled: true,
  },
  {
    value: "fr_core_news_lg",
    label: "French (fr_core_news_lg)",
    language: "fr",
    disabled: true,
  },
];

const DEFAULT_NER_MODEL =
  localStorage.getItem("preferredNerModel") || NER_MODEL_OPTIONS[0].value;

const ENTITY_TYPE_OPTIONS = [
  { value: "PERSON", label: "Person" },
  { value: "ORGANIZATION", label: "Organization" },
  { value: "LOCATION", label: "Place / Location" },
  { value: "GPE", label: "Geo-political entity" },
  { value: "NRP", label: "Nationality / Religion / Political" },
  { value: "FAC", label: "Facility" },
  { value: "PRODUCT", label: "Product" },
  { value: "EVENT", label: "Event" },
  { value: "LAW", label: "Law" },
  { value: "LANGUAGE", label: "Language" },
  { value: "DATE_TIME", label: "Date & Time" },
  { value: "DATE", label: "Date" },
  { value: "TIME", label: "Time" },
  { value: "AGE", label: "Age" },
  { value: "TITLE", label: "Job title" },
  { value: "MONEY", label: "Money" },
  { value: "PERCENT", label: "Percent" },
  { value: "QUANTITY", label: "Quantity" },
  { value: "ORDINAL", label: "Ordinal" },
  { value: "CARDINAL", label: "Cardinal" },
  { value: "EMAIL_ADDRESS", label: "Email address" },
  { value: "PHONE_NUMBER", label: "Phone number" },
  { value: "IP_ADDRESS", label: "IP address" },
  { value: "IPV4_ADDRESS", label: "IPv4 address" },
  { value: "IPV6_ADDRESS", label: "IPv6 address" },
  { value: "MAC_ADDRESS", label: "MAC address" },
  { value: "DOMAIN_NAME", label: "Domain name" },
  { value: "URL", label: "URL" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "IBAN_CODE", label: "IBAN" },
  { value: "SWIFT_CODE", label: "SWIFT/BIC" },
  { value: "CRYPTO", label: "Cryptocurrency wallet" },
  { value: "MEDICAL_LICENSE", label: "Medical license" },
  { value: "US_HEALTHCARE_NPI", label: "US healthcare NPI" },
  { value: "BANK_ACCOUNT", label: "Bank account" },
  { value: "US_BANK_ACCOUNT_NUMBER", label: "US bank account number" },
  { value: "US_BANK_ROUTING", label: "US bank routing" },
  { value: "US_SSN", label: "US SSN" },
  { value: "US_ITIN", label: "US ITIN" },
  { value: "US_PASSPORT", label: "US passport" },
  { value: "PASSPORT", label: "Passport" },
  { value: "US_DRIVER_LICENSE", label: "US driver license" },
  { value: "UK_NHS", label: "UK NHS" },
  { value: "SG_NRIC_FIN", label: "Singapore NRIC/FIN" },
  { value: "ES_NIF", label: "Spain NIF" },
  { value: "ES_NIE", label: "Spain NIE" },
  { value: "ES_CIF", label: "Spain CIF" },
  { value: "IT_FISCAL_CODE", label: "Italy fiscal code" },
  { value: "IT_VAT_CODE", label: "Italy VAT code" },
  { value: "IT_IDENTITY_CARD", label: "Italy identity card" },
  { value: "IT_DRIVER_LICENSE", label: "Italy driver license" },
  { value: "IT_PASSPORT", label: "Italy passport" },
  { value: "IN_AADHAAR", label: "India Aadhaar" },
  { value: "IN_PAN", label: "India PAN" },
  { value: "IN_VOTER", label: "India voter ID" },
  { value: "IN_PASSPORT", label: "India passport" },
  { value: "NL_BSN", label: "Netherlands BSN" },
  { value: "AU_TFN", label: "Australia TFN" },
  { value: "AU_ABN", label: "Australia ABN" },
  { value: "AU_ACN", label: "Australia ACN" },
  { value: "AU_MEDICARE_NUMBER", label: "Australia Medicare" },
  { value: "ZIP_CODE", label: "ZIP / Postal code" },
];

const ENTITY_TYPE_STORAGE_KEY = "preferredEntityTypes";
const ENTITY_TYPE_TRANSLATIONS = {
  nl: {
    PERSON: { label: "Persoon", value: "PERSOON" },
    ORGANIZATION: { label: "Organisatie", value: "ORGANISATIE" },
    LOCATION: { label: "Plaats / locatie", value: "LOCATIE" },
    GPE: { label: "Geo-politieke entiteit", value: "GEO_POLITIEKE_ENTITEIT" },
    NRP: {
      label: "Nationaliteit / religie / politiek",
      value: "NATIONALITEIT_RELIGIE_POLITIEK",
    },
    FAC: { label: "Faciliteit", value: "FACILITEIT" },
    PRODUCT: { label: "Product", value: "PRODUCT" },
    EVENT: { label: "Gebeurtenis", value: "GEBEURTENIS" },
    LAW: { label: "Wetgeving", value: "WETGEVING" },
    LANGUAGE: { label: "Taal", value: "TAAL" },
    DATE_TIME: { label: "Datum en tijd", value: "DATUM_TIJDSAANDUIDING" },
    DATE: { label: "Datum", value: "DATUM" },
    TIME: { label: "Tijd", value: "TIJD" },
    AGE: { label: "Leeftijd", value: "LEEFTIJD" },
    TITLE: { label: "Functietitel", value: "FUNCTIETITEL" },
    MONEY: { label: "Bedrag", value: "BEDRAG" },
    PERCENT: { label: "Percentage", value: "PERCENTAGE" },
    QUANTITY: { label: "Hoeveelheid", value: "HOEVEELHEID" },
    ORDINAL: { label: "Rangnummer", value: "RANGNUMMER" },
    CARDINAL: { label: "Getal", value: "GETAL" },
    EMAIL_ADDRESS: { label: "E-mailadres", value: "E_MAILADRES" },
    PHONE_NUMBER: { label: "Telefoonnummer", value: "TELEFOONNUMMER" },
    IP_ADDRESS: { label: "IP-adres", value: "IP_ADRES" },
    IPV4_ADDRESS: { label: "IPv4-adres", value: "IPV4_ADRES" },
    IPV6_ADDRESS: { label: "IPv6-adres", value: "IPV6_ADRES" },
    MAC_ADDRESS: { label: "MAC-adres", value: "MAC_ADRES" },
    DOMAIN_NAME: { label: "Domeinnaam", value: "DOMEINNAAM" },
    URL: { label: "URL", value: "URL" },
    CREDIT_CARD: {
      label: "Kredietkaartnummer",
      value: "KREDIETKAARTNUMMER",
    },
    IBAN_CODE: { label: "IBAN", value: "IBAN" },
    SWIFT_CODE: { label: "SWIFT/BIC", value: "SWIFT_BIC" },
    CRYPTO: { label: "Cryptowallet", value: "CRYPTO_WALLET" },
    MEDICAL_LICENSE: { label: "Medische licentie", value: "MEDISCHE_LICENTIE" },
    US_HEALTHCARE_NPI: {
      label: "Amerikaans zorgverlenersnummer (NPI)",
      value: "VS_ZORG_NPI",
    },
    BANK_ACCOUNT: { label: "Bankrekening", value: "BANKREKENING" },
    US_BANK_ACCOUNT_NUMBER: {
      label: "Amerikaans bankrekeningnummer",
      value: "VS_BANKREKENINGNUMMER",
    },
    US_BANK_ROUTING: {
      label: "Amerikaanse bankroutingcode",
      value: "VS_BANKROUTING",
    },
    US_SSN: {
      label: "Amerikaans sofinummer (SSN)",
      value: "VS_SOFINUMMER",
    },
    US_ITIN: {
      label: "Amerikaans belastingnummer (ITIN)",
      value: "VS_BELASTINGNUMMER",
    },
    US_PASSPORT: {
      label: "Amerikaans paspoortnummer",
      value: "VS_PASPOORT",
    },
    PASSPORT: { label: "Paspoortnummer", value: "PASPOORTNUMMER" },
    US_DRIVER_LICENSE: {
      label: "Amerikaans rijbewijsnummer",
      value: "VS_RIJBEWIJS",
    },
    UK_NHS: { label: "Brits NHS-nummer", value: "VK_NHS_NUMMER" },
    SG_NRIC_FIN: {
      label: "Singaporees NRIC/FIN-nummer",
      value: "SG_NRIC_FIN",
    },
    ES_NIF: { label: "Spaans NIF-nummer", value: "ES_NIF" },
    ES_NIE: { label: "Spaans NIE-nummer", value: "ES_NIE" },
    ES_CIF: { label: "Spaans CIF-nummer", value: "ES_CIF" },
    IT_FISCAL_CODE: {
      label: "Italiaans fiscaal nummer",
      value: "IT_FISCAAL_NUMMER",
    },
    IT_VAT_CODE: {
      label: "Italiaans btw-nummer",
      value: "IT_BTW_NUMMER",
    },
    IT_IDENTITY_CARD: {
      label: "Italiaanse identiteitskaart",
      value: "IT_IDENTITEITSKAART",
    },
    IT_DRIVER_LICENSE: {
      label: "Italiaans rijbewijsnummer",
      value: "IT_RIJBEWIJS",
    },
    IT_PASSPORT: {
      label: "Italiaans paspoortnummer",
      value: "IT_PASPOORT",
    },
    IN_AADHAAR: {
      label: "Indiaas Aadhaar-nummer",
      value: "IN_AADHAAR",
    },
    IN_PAN: { label: "Indiaas PAN-nummer", value: "IN_PAN" },
    IN_VOTER: {
      label: "Indiaas kiezersnummer",
      value: "IN_KIEZERSNUMMER",
    },
    IN_PASSPORT: {
      label: "Indiaas paspoortnummer",
      value: "IN_PASPOORT",
    },
    NL_BSN: { label: "Nederlands BSN", value: "NL_BSN" },
    AU_TFN: { label: "Australisch TFN", value: "AU_TFN" },
    AU_ABN: { label: "Australisch ABN", value: "AU_ABN" },
    AU_ACN: { label: "Australisch ACN", value: "AU_ACN" },
    AU_MEDICARE_NUMBER: {
      label: "Australisch Medicare-nummer",
      value: "AU_MEDICARE",
    },
    ZIP_CODE: { label: "Postcode", value: "POSTCODE" },
  },
};
const INITIAL_ENTITY_DISPLAY_LIMIT = 10;

const buildDefaultEntityTypeSelection = () => {
  const defaults = {};
  ENTITY_TYPE_OPTIONS.forEach((option) => {
    defaults[option.value] = true;
  });
  return defaults;
};

const sortPresetsByName = (presetList) =>
  [...presetList].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

const Anonymizer = () => {
  const [editorState, setEditorState] = useState(INITIAL_EDITOR_STATE);
  const [nerModel, setNerModel] = useState(DEFAULT_NER_MODEL);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [lastSubmittedText, setLastSubmittedText] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_ACCEPTANCE_THRESHOLD);
  const [allowlistText, setAllowlistText] = useState("");
  const [denylistText, setDenylistText] = useState("");
  const [entityToggles, setEntityToggles] = useState({});
  const [lastSubmittedHtml, setLastSubmittedHtml] = useState("");
  const [displayHtml, setDisplayHtml] = useState("");
  const [entityTypeSelection, setEntityTypeSelection] = useState(() => {
    const defaults = buildDefaultEntityTypeSelection();

    if (typeof window === "undefined") {
      return defaults;
    }

    try {
      const stored = window.localStorage.getItem(ENTITY_TYPE_STORAGE_KEY);
      if (!stored) return defaults;

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return defaults;

      const allowed = new Set(
        parsed
          .map((value) =>
            typeof value === "string" ? value.trim().toUpperCase() : null,
          )
          .filter(Boolean),
      );

      if (allowed.size === 0) return defaults;

      const restored = {};
      ENTITY_TYPE_OPTIONS.forEach((option) => {
        restored[option.value] = allowed.has(option.value);
      });

      return restored;
    } catch (storageError) {
      console.warn(
        "Failed to read stored entity type preferences",
        storageError,
      );
      return defaults;
    }
  });
  const [results, setResults] = useState({
    anonymizedText: "",
    anonymizedHtml: "",
    entities: [],
    items: [],
  });
  const [currentAnonymizationPayload, setCurrentAnonymizationPayload] =
    useState(null);
  const [currentResultSignature, setCurrentResultSignature] = useState("");
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const [isSavingAnonymization, setIsSavingAnonymization] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [savedSuggestions, setSavedSuggestions] = useState([]);
  const [isFetchingSavedSuggestions, setIsFetchingSavedSuggestions] =
    useState(false);
  const [savedSuggestionsError, setSavedSuggestionsError] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editorOverride, setEditorOverride] = useState(null);
  const [isLoadingSavedAnonymization, setIsLoadingSavedAnonymization] =
    useState(false);
  const [openFilters, setOpenFilters] = useState(
    JSON.parse(localStorage.getItem("openFilters")) || ["ner-model"],
  );
  const [copiedPlainText, setCopiedPlainText] = useState(false);
  const [copiedHTML, setCopiedHTML] = useState(false);
  const [moreEntityOptions, setMoreEntityOptions] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [isFetchingPresets, setIsFetchingPresets] = useState(false);
  const [isPersistingPreset, setIsPersistingPreset] = useState(false);
  const [presetStatusMessage, setPresetStatusMessage] = useState("");
  const [presetErrorMessage, setPresetErrorMessage] = useState("");

  const editorContentRef = useRef(null);
  const savedSuggestionsControllerRef = useRef(null);
  const savedSuggestionsDebounceRef = useRef(null);
  const suggestionsContainerRef = useRef(null);
  const initialSuggestionsLoadedRef = useRef(false);

  const selectedModel = useMemo(
    () =>
      NER_MODEL_OPTIONS.find((option) => option.value === nerModel) ??
      NER_MODEL_OPTIONS[0],
    [nerModel],
  );
  const selectedLanguage = selectedModel?.language ?? "en";
  const localizedEntityOptions = useMemo(() => {
    const translations = ENTITY_TYPE_TRANSLATIONS[selectedLanguage] ?? {};
    return ENTITY_TYPE_OPTIONS.map((option) => {
      const translation = translations[option.value];
      return {
        ...option,
        displayLabel: translation?.label ?? option.label,
        displayValue: translation?.value ?? option.value,
      };
    });
  }, [selectedLanguage]);
  const entityTypeDisplayValueMap = useMemo(() => {
    const map = new Map();
    localizedEntityOptions.forEach((option) => {
      map.set(option.value, option.displayValue);
    });
    return map;
  }, [localizedEntityOptions]);

  const hasContent = editorState.text.trim().length > 0;
  const selectedBuiltinEntityTypes = useMemo(
    () =>
      ENTITY_TYPE_OPTIONS.filter(
        (option) => entityTypeSelection[option.value] !== false,
      ).map((option) => option.value),
    [entityTypeSelection],
  );
  const filteredEntityOptions = useMemo(() => {
    const query = entityTypeFilter.trim().toLowerCase();
    if (!query) return localizedEntityOptions;

    return localizedEntityOptions.filter((option) => {
      const label = option.label.toLowerCase();
      const value = option.value.toLowerCase();
      const displayLabel = option.displayLabel.toLowerCase();
      const displayValue = option.displayValue.toLowerCase();
      return (
        label.includes(query) ||
        value.includes(query) ||
        displayLabel.includes(query) ||
        displayValue.includes(query)
      );
    });
  }, [entityTypeFilter, localizedEntityOptions]);
  const displayedEntityOptions = useMemo(
    () =>
      moreEntityOptions
        ? filteredEntityOptions
        : filteredEntityOptions.slice(0, INITIAL_ENTITY_DISPLAY_LIMIT),
    [filteredEntityOptions, moreEntityOptions],
  );
  const shouldShowMoreEntityOptions =
    !moreEntityOptions &&
    filteredEntityOptions.length > INITIAL_ENTITY_DISPLAY_LIMIT;
  const requestedEntityTypes = useMemo(
    () => [...selectedBuiltinEntityTypes],
    [selectedBuiltinEntityTypes],
  );
  const selectedPreset = useMemo(() => {
    const parsedId = Number.parseInt(selectedPresetId, 10);
    if (!Number.isFinite(parsedId)) {
      return null;
    }

    return presets.find((preset) => preset.id === parsedId) ?? null;
  }, [presets, selectedPresetId]);

  useEffect(() => {
    setMoreEntityOptions(false);
  }, [selectedLanguage]);

  const loadPresets = useCallback(async () => {
    setIsFetchingPresets(true);
    setPresetErrorMessage("");
    try {
      const response = await fetch("/api/presets");
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      const data = await response.json();
      const list = Array.isArray(data?.presets) ? data.presets : [];
      setPresets(sortPresetsByName(list));
      setSelectedPresetId((current) => {
        if (!current) {
          return "";
        }

        const currentId = Number.parseInt(current, 10);
        return list.some((preset) => preset.id === currentId) ? current : "";
      });
    } catch (error) {
      console.error("Failed to load presets", error);
      setPresetErrorMessage("Failed to load presets.");
    } finally {
      setIsFetchingPresets(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!presetStatusMessage) return;
    const timeout = window.setTimeout(() => {
      setPresetStatusMessage("");
    }, 4000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [presetStatusMessage]);

  const fetchSavedSuggestions = useCallback(async (query) => {
    if (savedSuggestionsControllerRef.current) {
      savedSuggestionsControllerRef.current.abort();
      savedSuggestionsControllerRef.current = null;
    }

    const controller =
      typeof AbortController === "function" ? new AbortController() : null;

    if (controller) {
      savedSuggestionsControllerRef.current = controller;
    }

    setIsFetchingSavedSuggestions(true);
    setSavedSuggestionsError("");

    try {
      const params = new URLSearchParams();
      if (query && query.trim().length > 0) {
        params.set("q", query.trim());
      }
      params.set("limit", SUGGESTION_LIMIT.toString());

      const queryString = params.toString();
      const response = await fetch(
        `/api/anonymize/saved${queryString ? `?${queryString}` : ""}`,
        controller ? { signal: controller.signal } : undefined,
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      const data = await response.json();
      const list = Array.isArray(data?.anonymizations)
        ? data.anonymizations.filter(
            (item) => item && typeof item.id === "number",
          )
        : [];
      setSavedSuggestions(list);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      console.error("Failed to load saved anonymizations", error);
      setSavedSuggestionsError("Failed to load saved anonymizations.");
    } finally {
      if (savedSuggestionsControllerRef.current === controller) {
        savedSuggestionsControllerRef.current = null;
      }
      setIsFetchingSavedSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSuggestionsLoadedRef.current) {
      initialSuggestionsLoadedRef.current = true;
      fetchSavedSuggestions(savedSearchQuery);
      return;
    }

    if (typeof window === "undefined") {
      fetchSavedSuggestions(savedSearchQuery);
      return;
    }

    const timeout = window.setTimeout(() => {
      fetchSavedSuggestions(savedSearchQuery);
    }, SUGGESTION_DEBOUNCE_MS);

    savedSuggestionsDebounceRef.current = timeout;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [savedSearchQuery, fetchSavedSuggestions]);

  useEffect(() => {
    return () => {
      if (savedSuggestionsControllerRef.current) {
        savedSuggestionsControllerRef.current.abort();
        savedSuggestionsControllerRef.current = null;
      }
      if (
        savedSuggestionsDebounceRef.current &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(savedSuggestionsDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!saveStatusMessage) return;
    if (typeof window === "undefined") return;

    const timeout = window.setTimeout(() => {
      setSaveStatusMessage("");
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [saveStatusMessage]);

  useEffect(() => {
    if (!suggestionsOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (!suggestionsContainerRef.current) {
        return;
      }

      if (suggestionsContainerRef.current.contains(event.target)) {
        return;
      }

      setSuggestionsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [suggestionsOpen]);

  useEffect(() => {
    if (savedSearchQuery.trim().length > 0) {
      setSuggestionsOpen(true);
    }
  }, [savedSearchQuery]);

  const localizeEntityPlaceholders = useCallback(
    (input) => {
      if (typeof input !== "string" || input.length === 0) {
        return typeof input === "string" ? input : "";
      }

      let output = input;
      entityTypeDisplayValueMap.forEach((displayValue, originalValue) => {
        if (!displayValue || displayValue === originalValue) {
          return;
        }

        const plainPattern = new RegExp(`<${originalValue}>`, "g");
        const encodedPattern = new RegExp(`&lt;${originalValue}&gt;`, "g");
        output = output.replace(plainPattern, `<${displayValue}>`);
        output = output.replace(encodedPattern, `&lt;${displayValue}&gt;`);
      });

      return output;
    },
    [entityTypeDisplayValueMap],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        ENTITY_TYPE_STORAGE_KEY,
        JSON.stringify(selectedBuiltinEntityTypes),
      );
    } catch (storageError) {
      console.warn("Failed to persist entity type selection", storageError);
    }
  }, [selectedBuiltinEntityTypes]);
  const findings = useMemo(() => {
    if (!Array.isArray(results.entities)) return [];

    const itemMap = new Map();
    if (Array.isArray(results.items)) {
      results.items.forEach((item, index) => {
        if (typeof item?.start === "number" && typeof item?.end === "number") {
          const key = `${item.start}-${item.end}-${item.entity_type ?? ""}`;
          itemMap.set(key, { ...item, index });
        }
      });
    }

    return results.entities.map((entity, entityIndex) => {
      const entityType = entity?.entity_type ?? "";
      const displayEntityType =
        entityTypeDisplayValueMap.get(entityType) ?? entityType;
      const start = entity?.start;
      const end = entity?.end;
      const key = `${start ?? ""}-${end ?? ""}-${entityType}`;
      const matchedItem = itemMap.get(key);
      const originalText =
        typeof start === "number" &&
        typeof end === "number" &&
        typeof lastSubmittedText === "string"
          ? lastSubmittedText.slice(start, end)
          : "";
      const explanation =
        (entity && typeof entity.analysis_explanation === "object"
          ? entity.analysis_explanation
          : entity?.explanation) ?? {};
      const recognizer =
        explanation?.recognizer ??
        explanation?.recognizer_name ??
        entity?.recognizer ??
        entity?.recognizer_name ??
        "";
      const patternName = explanation?.pattern_name ?? "";
      const pattern = explanation?.pattern ?? "";

      return {
        id: buildEntityId(entity, entityIndex),
        entityType: displayEntityType,
        text: originalText,
        start,
        end,
        confidence: entity?.score,
        anonymizer: matchedItem?.anonymizer ?? "",
        replacement: matchedItem?.text ?? "",
        recognizer,
        patternName,
        pattern,
      };
    });
  }, [
    results.entities,
    results.items,
    lastSubmittedText,
    entityTypeDisplayValueMap,
  ]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!hasContent) {
        setErrorMessage("Please provide some text first.");
        return;
      }

      const submission = {
        html: editorState.html,
        text: editorState.text,
      };

      const requestLanguage =
        typeof selectedLanguage === "string" && selectedLanguage.length > 0
          ? selectedLanguage
          : "en";

      setIsSubmitting(true);
      setErrorMessage("");
      setStatusMessage("Contacting Presidio services...");
      setSaveStatusMessage("");
      setSaveErrorMessage("");

      try {
        const response = await fetch("/api/anonymize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: submission.text,
            language: requestLanguage,
            nerModel,
            threshold,
            allowlist: allowlistText,
            denylist: denylistText,
            entityTypes: requestedEntityTypes,
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Request failed");
        }

        const data = await response.json();
        const rawEntities = Array.isArray(data.entities)
          ? data.entities.map((entity) => ({ ...entity }))
          : [];
        const items = Array.isArray(data.items)
          ? data.items.map((item) => ({ ...item }))
          : [];
        const initialToggles = Object.fromEntries(
          rawEntities.map((entity, index) => [
            buildEntityId(entity, index),
            true,
          ]),
        );
        const anonymizedHtml = applyAnonymizationToHtml(
          submission.html,
          submission.text,
          items,
          rawEntities.map((entity) => ({ ...entity })),
          { entityTypeDisplayMap: entityTypeDisplayValueMap },
        );
        const localizedResultText =
          typeof data.anonymizedText === "string"
            ? localizeEntityPlaceholders(data.anonymizedText)
            : "";

        const payload = {
          sourceText: submission.text,
          sourceHtml: submission.html,
          resultText: localizedResultText,
          resultHtml: anonymizedHtml,
          nerModel,
          language: requestLanguage,
          threshold,
          allowlist: allowlistText,
          denylist: denylistText,
          entityTypes: requestedEntityTypes,
          entities: rawEntities,
          items,
        };

        setResults({
          anonymizedText: localizedResultText,
          anonymizedHtml,
          entities: rawEntities,
          items,
        });
        setLastSubmittedText(submission.text);
        setLastSubmittedHtml(submission.html);
        setEntityToggles(initialToggles);
        setDisplayHtml(anonymizedHtml);
        setCurrentAnonymizationPayload(payload);
        const signature = buildResultSignature(payload);
        setCurrentResultSignature(signature);
        setLastSavedSignature("");
        setStatusMessage("Done!");
      } catch (error) {
        console.error(error);
        setErrorMessage(
          "Something went wrong while contacting Presidio. Check the console and make sure the services are running.",
        );
        setStatusMessage("");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      editorState.html,
      editorState.text,
      hasContent,
      nerModel,
      threshold,
      allowlistText,
      denylistText,
      requestedEntityTypes,
      selectedLanguage,
      entityTypeDisplayValueMap,
      localizeEntityPlaceholders,
    ],
  );

  const handleLoadSavedAnonymization = useCallback(async (anonymizationId) => {
    const numericId =
      typeof anonymizationId === "number"
        ? anonymizationId
        : Number.parseInt(anonymizationId, 10);

    if (!Number.isFinite(numericId)) {
      return;
    }

    setIsLoadingSavedAnonymization(true);
    setSaveStatusMessage("");
    setSaveErrorMessage("");

    try {
      const response = await fetch(`/api/anonymize/saved/${numericId}`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      const data = await response.json();
      const record = data?.anonymization;

      if (!record || typeof record !== "object") {
        throw new Error("Anonymization not found.");
      }

      const settings = record.settings ?? {};
      const normalizedEntityTypes = Array.isArray(settings.entityTypes)
        ? Array.from(
            new Set(
              settings.entityTypes
                .map((value) =>
                  typeof value === "string" ? value.trim().toUpperCase() : "",
                )
                .filter(Boolean),
            ),
          )
        : [];
      const normalizedEntities = Array.isArray(record.entities)
        ? record.entities.map((entity) => ({ ...entity }))
        : [];
      const normalizedItems = Array.isArray(record.items)
        ? record.items.map((item) => ({ ...item }))
        : [];

      const payload = {
        sourceText:
          typeof record.sourceText === "string" ? record.sourceText : "",
        sourceHtml:
          typeof record.sourceHtml === "string" ? record.sourceHtml : "",
        resultText:
          typeof record.resultText === "string" ? record.resultText : "",
        resultHtml:
          typeof record.resultHtml === "string" ? record.resultHtml : "",
        nerModel:
          typeof settings.nerModel === "string" && settings.nerModel.length > 0
            ? settings.nerModel
            : DEFAULT_NER_MODEL,
        language:
          typeof settings.language === "string" && settings.language.length > 0
            ? settings.language
            : "en",
        threshold:
          typeof settings.threshold === "number"
            ? settings.threshold
            : typeof settings.threshold === "string"
              ? Number.parseFloat(settings.threshold)
              : DEFAULT_ACCEPTANCE_THRESHOLD,
        allowlist:
          typeof settings.allowlist === "string" ? settings.allowlist : "",
        denylist:
          typeof settings.denylist === "string" ? settings.denylist : "",
        entityTypes: normalizedEntityTypes,
        entities: normalizedEntities,
        items: normalizedItems,
      };

      setNerModel(payload.nerModel);
      setThreshold(
        Number.isFinite(payload.threshold)
          ? payload.threshold
          : DEFAULT_ACCEPTANCE_THRESHOLD,
      );
      setAllowlistText(payload.allowlist);
      setDenylistText(payload.denylist);

      const selection = buildDefaultEntityTypeSelection();
      if (payload.entityTypes.length > 0) {
        ENTITY_TYPE_OPTIONS.forEach((option) => {
          selection[option.value] = payload.entityTypes.includes(option.value);
        });
      }
      setEntityTypeSelection(selection);

      setCurrentAnonymizationPayload(payload);
      const signature = buildResultSignature(payload);
      setCurrentResultSignature(signature);
      setLastSavedSignature(signature);

      setEditorState({
        html: payload.sourceHtml,
        text: payload.sourceText,
      });
      setEditorOverride({
        version: Date.now(),
        html: payload.sourceHtml,
        text: payload.sourceText,
      });
      setLastSubmittedText(payload.sourceText);
      setLastSubmittedHtml(payload.sourceHtml);
      setResults({
        anonymizedText: payload.resultText,
        anonymizedHtml: payload.resultHtml,
        entities: payload.entities,
        items: payload.items,
      });
      setEntityToggles(
        Object.fromEntries(
          payload.entities.map((entity, index) => [
            buildEntityId(entity, index),
            true,
          ]),
        ),
      );
      setDisplayHtml(payload.resultHtml);
      setStatusMessage("Loaded anonymization.");
      setErrorMessage("");
      setSelectedPresetId("");
      setSuggestionsOpen(false);
      setSaveStatusMessage("Loaded anonymization.");
    } catch (error) {
      console.error("Failed to load anonymization", error);
      setSaveStatusMessage("");
      setSaveErrorMessage("Failed to load anonymization.");
    } finally {
      setIsLoadingSavedAnonymization(false);
    }
  }, []);

  const handleSavedSearchChange = useCallback((event) => {
    setSavedSearchQuery(event.target.value);
  }, []);

  const handleSavedSearchFocus = useCallback(() => {
    setSuggestionsOpen(true);
  }, []);

  const handleSuggestionKeyDown = useCallback(
    (event, anonymizationId) => {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Space" ||
        event.key === "Spacebar"
      ) {
        event.preventDefault();
        handleLoadSavedAnonymization(anonymizationId);
      }
    },
    [handleLoadSavedAnonymization],
  );

  const handleSaveCurrentResult = useCallback(async () => {
    if (!currentAnonymizationPayload) {
      return;
    }

    const signature = buildResultSignature(currentAnonymizationPayload);
    if (!signature || signature === lastSavedSignature) {
      return;
    }

    setIsSavingAnonymization(true);
    setSaveStatusMessage("");
    setSaveErrorMessage("");

    try {
      const response = await fetch("/api/anonymize/saved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currentAnonymizationPayload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      await response.json();
      setLastSavedSignature(signature);
      setCurrentResultSignature(signature);
      setSaveStatusMessage("Saved anonymization.");
      fetchSavedSuggestions(savedSearchQuery);
    } catch (error) {
      console.error("Failed to save anonymization", error);
      setSaveErrorMessage("Failed to save anonymization.");
    } finally {
      setIsSavingAnonymization(false);
    }
  }, [
    currentAnonymizationPayload,
    lastSavedSignature,
    savedSearchQuery,
    fetchSavedSuggestions,
  ]);

  const canSaveCurrentResult = useMemo(
    () =>
      Boolean(
        currentAnonymizationPayload &&
          currentResultSignature &&
          currentResultSignature !== lastSavedSignature &&
          !isSavingAnonymization,
      ),
    [
      currentAnonymizationPayload,
      currentResultSignature,
      lastSavedSignature,
      isSavingAnonymization,
    ],
  );

  const handleReset = useCallback(() => {
    setEditorState({ ...INITIAL_EDITOR_STATE });
    setResults({
      anonymizedText: "",
      anonymizedHtml: "",
      entities: [],
      items: [],
    });
    setStatusMessage("");
    setErrorMessage("");
    setResetSignal((value) => value + 1);
    setLastSubmittedText("");
    setLastSubmittedHtml("");
    setEntityToggles({});
    setDisplayHtml("");
    setThreshold(DEFAULT_ACCEPTANCE_THRESHOLD);
    setAllowlistText("");
    setDenylistText("");
    setNerModel(DEFAULT_NER_MODEL);
    setEntityTypeSelection(buildDefaultEntityTypeSelection());
    setCurrentAnonymizationPayload(null);
    setCurrentResultSignature("");
    setLastSavedSignature("");
    setSaveStatusMessage("");
    setSaveErrorMessage("");
    setSuggestionsOpen(false);
    setIsSavingAnonymization(false);
    setIsLoadingSavedAnonymization(false);
  }, []);

  useEffect(() => {
    if (!lastSubmittedHtml) {
      setDisplayHtml("");
      return;
    }

    if (!Array.isArray(results.entities)) {
      setDisplayHtml(lastSubmittedHtml);
      return;
    }

    const activeEntities = results.entities
      .map((entity, index) => ({ entity, index }))
      .filter(({ entity, index }) => {
        const id = buildEntityId(entity, index);
        return entityToggles[id] !== false;
      })
      .map(({ entity }) => ({ ...entity }));

    const html = applyAnonymizationToHtml(
      lastSubmittedHtml,
      lastSubmittedText,
      results.items,
      activeEntities,
      { entityTypeDisplayMap: entityTypeDisplayValueMap },
    );

    setResults((previous) =>
      previous.anonymizedHtml === html
        ? previous
        : {
            ...previous,
            anonymizedHtml: html,
            anonymizedText: localizeEntityPlaceholders(previous.anonymizedText),
          },
    );
    setDisplayHtml(html);
  }, [
    entityToggles,
    lastSubmittedHtml,
    lastSubmittedText,
    results.entities,
    results.items,
    entityTypeDisplayValueMap,
    localizeEntityPlaceholders,
  ]);

  const getPlainTextFromDisplay = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const sourceNode =
      editorContentRef.current?.cloneNode(true) ??
      (() => {
        if (!displayHtml) {
          return null;
        }
        const fallbackContainer = document.createElement("div");
        fallbackContainer.innerHTML = displayHtml;
        return fallbackContainer;
      })();

    if (!sourceNode) {
      return "";
    }

    const doubleBreakTags = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6"]);
    const singleBreakTags = new Set(["LI"]);
    const listContainerTags = new Set(["UL", "OL"]);
    const parts = [];

    const append = (value) => {
      if (!value) return;
      parts.push(value);
    };

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        append(node.nodeValue ?? "");
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tagName = node.tagName;

      if (tagName === "BR") {
        append("\n");
        return;
      }

      const children = Array.from(node.childNodes);
      children.forEach(walk);

      if (doubleBreakTags.has(tagName)) {
        append("\n\n");
        return;
      }

      if (singleBreakTags.has(tagName)) {
        append("\n");
        return;
      }

      if (listContainerTags.has(tagName)) {
        append("\n\n");
      }
    };

    walk(sourceNode);

    const result = parts
      .join("")
      .replace(/\u00A0/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return result;
  }, [displayHtml]);

  const handleCopyHtml = useCallback(async () => {
    if (typeof window === "undefined" || !displayHtml) {
      return;
    }

    const plainText = getPlainTextFromDisplay();

    try {
      const clipboard = navigator.clipboard;
      const ClipboardItemCtor = window.ClipboardItem;

      if (clipboard?.write && typeof ClipboardItemCtor === "function") {
        const item = new ClipboardItemCtor({
          "text/html": new Blob([displayHtml], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        });

        await clipboard.write([item]);
        setTimeout(() => {
          setCopiedHTML(true);
          setTimeout(() => {
            setCopiedHTML(false);
          }, 4000);
        }, 300);
        return;
      }
    } catch (clipboardError) {
      console.warn(
        "Rich text clipboard copy failed; falling back.",
        clipboardError,
      );
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayHtml);
        setTimeout(() => {
          setCopiedHTML(true);
          setTimeout(() => {
            setCopiedHTML(false);
          }, 4000);
        }, 300);
        return;
      }
    } catch (writeTextError) {
      console.warn(
        "Clipboard writeText fallback for HTML failed; using legacy path.",
        writeTextError,
      );
    }

    if (typeof document !== "undefined") {
      const element = editorContentRef.current;

      if (element && window.getSelection && document.createRange) {
        const selection = window.getSelection();

        if (selection) {
          const savedRanges = [];
          for (let index = 0; index < selection.rangeCount; index += 1) {
            savedRanges.push(selection.getRangeAt(index).cloneRange());
          }

          selection.removeAllRanges();

          const range = document.createRange();
          range.selectNodeContents(element);
          selection.addRange(range);

          try {
            const successful = document.execCommand("copy");
            selection.removeAllRanges();
            savedRanges.forEach((savedRange) => selection.addRange(savedRange));

            if (successful) {
              setTimeout(() => {
                setCopiedHTML(true);
                setTimeout(() => {
                  setCopiedHTML(false);
                }, 4000);
              }, 300);
              return;
            }
          } catch (execError) {
            selection.removeAllRanges();
            savedRanges.forEach((savedRange) => selection.addRange(savedRange));
            console.warn(
              "execCommand copy failed; falling back to textarea.",
              execError,
            );
          }
        }
      }

      const textarea = document.createElement("textarea");
      textarea.value = displayHtml;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        setTimeout(() => {
          setCopiedHTML(true);
          setTimeout(() => {
            setCopiedHTML(false);
          }, 4000);
        }, 300);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, [displayHtml, getPlainTextFromDisplay]);

  const handleCopyPlainText = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const textToCopy = getPlainTextFromDisplay();

    if (!textToCopy) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setTimeout(() => {
          setCopiedPlainText(true);
          setTimeout(() => {
            setCopiedPlainText(false);
          }, 4000);
        }, 300);
        return;
      }
    } catch (clipboardError) {
      console.warn(
        "Plain text clipboard copy failed; using fallback.",
        clipboardError,
      );
    }

    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        setTimeout(() => {
          setCopiedPlainText(true);
          setTimeout(() => {
            setCopiedPlainText(false);
          }, 4000);
        }, 1000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, [getPlainTextFromDisplay]);

  const handleFindingToggle = useCallback((id, isChecked) => {
    setEntityToggles((previous) => ({
      ...previous,
      [id]: isChecked,
    }));
  }, []);

  const handleOpenFilterToggle = useCallback((key, isOpenOrEvent) => {
    const isOpen =
      typeof isOpenOrEvent === "boolean"
        ? isOpenOrEvent
        : Boolean(isOpenOrEvent?.target?.checked);

    setOpenFilters((previous) => {
      const updated = isOpen
        ? Array.from(new Set([...previous, key]))
        : previous.filter((k) => k !== key);
      localStorage.setItem("openFilters", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handlePresetSave = useCallback(async () => {
    if (typeof window === "undefined") return;

    const requestedName = window.prompt("Give this preset a name:");
    if (requestedName === null) {
      return;
    }

    const trimmedName = requestedName.trim();
    if (trimmedName.length === 0) {
      setPresetStatusMessage("");
      setPresetErrorMessage("Preset name cannot be empty.");
      return;
    }

    setIsPersistingPreset(true);
    setPresetStatusMessage("");
    setPresetErrorMessage("");

    try {
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          nerModel,
          threshold,
          allowlist: allowlistText,
          denylist: denylistText,
          entityTypes: requestedEntityTypes,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      const data = await response.json();
      const preset = data?.preset;

      if (preset) {
        setPresets((previous) => {
          const filtered = previous.filter((item) => item.id !== preset.id);
          return sortPresetsByName([...filtered, preset]);
        });
        setSelectedPresetId(String(preset.id));
        setPresetStatusMessage(`Saved preset "${preset.name}".`);
      } else {
        await loadPresets();
        setPresetStatusMessage("Preset saved.");
      }
    } catch (error) {
      console.error("Failed to save preset", error);
      setPresetStatusMessage("");
      setPresetErrorMessage("Failed to save preset.");
    } finally {
      setIsPersistingPreset(false);
    }
  }, [
    allowlistText,
    denylistText,
    loadPresets,
    nerModel,
    requestedEntityTypes,
    threshold,
  ]);

  const handlePresetLoad = useCallback(() => {
    if (!selectedPreset) {
      setPresetStatusMessage("");
      setPresetErrorMessage("Select a preset to load.");
      return;
    }

    setPresetErrorMessage("");
    setPresetStatusMessage("");

    setNerModel(selectedPreset.nerModel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("preferredNerModel", selectedPreset.nerModel);
    }

    const nextThreshold =
      typeof selectedPreset.threshold === "number"
        ? selectedPreset.threshold
        : DEFAULT_ACCEPTANCE_THRESHOLD;
    setThreshold(nextThreshold);
    setAllowlistText(selectedPreset.allowlist ?? "");
    setDenylistText(selectedPreset.denylist ?? "");

    const enabledTypes = Array.isArray(selectedPreset.entityTypes)
      ? selectedPreset.entityTypes
      : [];
    const nextSelection = {};
    ENTITY_TYPE_OPTIONS.forEach((option) => {
      nextSelection[option.value] = enabledTypes.includes(option.value);
    });
    setEntityTypeSelection(nextSelection);

    setPresetStatusMessage(`Loaded preset "${selectedPreset.name}".`);
  }, [selectedPreset]);

  const handlePresetDelete = useCallback(async () => {
    if (!selectedPreset) {
      setPresetStatusMessage("");
      setPresetErrorMessage("Select a preset to delete.");
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Are you sure you want to delete preset "${selectedPreset.name}"?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setIsPersistingPreset(true);
    setPresetStatusMessage("");
    setPresetErrorMessage("");

    try {
      const response = await fetch(`/api/presets/${selectedPreset.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      setPresets((previous) =>
        previous.filter((item) => item.id !== selectedPreset.id),
      );
      setSelectedPresetId((current) => {
        const currentId = Number.parseInt(current, 10);
        return currentId === selectedPreset.id ? "" : current;
      });
      setPresetStatusMessage(`Deleted preset "${selectedPreset.name}".`);
    } catch (error) {
      console.error("Failed to delete preset", error);
      setPresetStatusMessage("");
      setPresetErrorMessage("Failed to delete preset.");
    } finally {
      setIsPersistingPreset(false);
    }
  }, [selectedPreset]);

  const suggestionListItems = (() => {
    if (savedSuggestionsError) {
      return [
        <li className="empty error" key="error">
          {savedSuggestionsError}
        </li>,
      ];
    }

    const items = savedSuggestions.map((suggestion) => {
      const timestamp = formatSavedTimestamp(suggestion.createdAt);
      const previewText =
        typeof suggestion.preview === "string" && suggestion.preview.length > 0
          ? suggestion.preview
          : "(No content)";

      return (
        <li key={suggestion.id}>
          <a
            tabIndex={0}
            role="button"
            onClick={() => handleLoadSavedAnonymization(suggestion.id)}
            onKeyDown={(event) => handleSuggestionKeyDown(event, suggestion.id)}
          >
            {timestamp ? `${timestamp} - ${previewText}` : previewText}
          </a>
        </li>
      );
    });

    if (items.length === 0) {
      if (isFetchingSavedSuggestions) {
        return [
          <li className="empty" key="loading">
            Loading…
          </li>,
        ];
      }

      return [
        <li className="empty" key="empty">
          No saved anonymizations.
        </li>,
      ];
    }

    return items;
  })();

  const suggestionPanelItems = isLoadingSavedAnonymization
    ? [
        ...suggestionListItems,
        <li className="empty" key="loading-selection">
          Loading anonymization…
        </li>,
      ]
    : suggestionListItems;

  return (
    <>
      <form className="anonymizer-input" onSubmit={handleSubmit}>
        <div id="anonymizer-editor" className="editor-field">
          <Editor
            editorSize="medium"
            initState={INITIAL_EDITOR_STATE}
            updateState={setEditorState}
            resetState={resetSignal}
            externalState={editorOverride}
            placeholder="Write or paste the text you want to anonymize..."
          />
        </div>

        <div className="header">
          <div>
            <strong>Input</strong>
            <br />
            {statusMessage && (
              <span className="help" role="status" aria-live="polite">
                {statusMessage}
              </span>
            )}
            {errorMessage && (
              <span className="help error" role="alert">
                {errorMessage}
              </span>
            )}
          </div>
          <div className="spacer" />

          <button type="button" onClick={handleReset} disabled={isSubmitting}>
            Clear
          </button>
          <button
            type="submit"
            className="primary"
            disabled={isSubmitting}
            style={{ marginRight: "0" }}
          >
            {isSubmitting ? "Processing…" : "Anonymize"}
          </button>
        </div>
      </form>

      <section className="anonymizer-results">
        <div className="header">
          <div>
            <strong>Output</strong>
            {saveStatusMessage && (
              <span className="help" role="status" aria-live="polite">
                {saveStatusMessage}
              </span>
            )}
            {saveErrorMessage && (
              <span className="help error" role="alert">
                {saveErrorMessage}
              </span>
            )}
          </div>
          <div className="spacer" />

          <button
            type="button"
            className="positive"
            onClick={handleSaveCurrentResult}
            disabled={!canSaveCurrentResult}
          >
            {isSavingAnonymization ? "Saving…" : "Save"}
          </button>
          <div style={{ minHeight: "1.2rem" }}></div>
          <div className="suggestions" ref={suggestionsContainerRef}>
            <div className="group">
              <svg
                className="icon chevron"
                role="button"
                tabIndex={0}
                style={{
                  transform: suggestionsOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                  cursor: "pointer",
                }}
                onClick={() => setSuggestionsOpen((previous) => !previous)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " " ||
                    event.key === "Space" ||
                    event.key === "Spacebar"
                  ) {
                    event.preventDefault();
                    setSuggestionsOpen((previous) => !previous);
                  }
                }}
              >
                <use xlinkHref="/images/icons.svg#chevron-down" />
              </svg>
              <input
                type="text"
                className="prepend-icon"
                placeholder="Search past anonymizations"
                value={savedSearchQuery}
                onChange={handleSavedSearchChange}
                onFocus={handleSavedSearchFocus}
                aria-expanded={suggestionsOpen}
              />
            </div>
            <div
              className="panel"
              style={{ display: suggestionsOpen ? "block" : "none" }}
            >
              <ul>{suggestionPanelItems}</ul>
            </div>
          </div>
        </div>
        {displayHtml ? (
          <div className="editor-wrapper">
            <div className="editor-toolbar">
              <button type="button" onClick={handleCopyHtml}>
                {copiedHTML ? (
                  <>
                    <svg
                      className="icon"
                      style={{ marginRight: ".2rem", transform: "scale(0.9)" }}
                    >
                      <use xlinkHref="/images/icons.svg#check" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="icon"
                      style={{ marginRight: ".2rem", transform: "scale(0.9)" }}
                    >
                      <use xlinkHref="/images/icons.svg#content-copy" />
                    </svg>
                    Copy HTML
                  </>
                )}
              </button>
              <div className="divider" />
              <button type="button" onClick={handleCopyPlainText}>
                {copiedPlainText ? (
                  <>
                    <svg
                      className="icon"
                      style={{ marginRight: ".2rem", transform: "scale(0.9)" }}
                    >
                      <use xlinkHref="/images/icons.svg#check" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="icon"
                      style={{ marginRight: ".2rem", transform: "scale(0.9)" }}
                    >
                      <use xlinkHref="/images/icons.svg#content-copy" />
                    </svg>
                    Copy plain text
                  </>
                )}
              </button>
            </div>

            <div className="editor-content">
              <div
                ref={editorContentRef}
                contentEditable={false}
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            </div>
          </div>
        ) : (
          <div className="pre-result">
            <img src="/images/face.svg" /><br />
            Run the anonymizer to see the generated markup preserving output.
          </div>
        )}

        <div className={`fetching ${isSubmitting ? "active" : ""}`}>
          <div className="spinner" style={{ position: "absolute" }}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="20" />
            </svg>
          </div>
        </div>
      </section>

      <section className="anonymizer-findings">
        {findings.length === 0 ? (
          <p>No findings yet</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Redact</th>
                <th>Entity type</th>
                <th>Text</th>
                <th>Confidence</th>
                <th>Recognizer</th>
                <th>Pattern name</th>
                <th>Pattern</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding, index) => (
                <tr key={`${finding.id}-${index}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={entityToggles[finding.id] !== false}
                      onChange={(event) =>
                        handleFindingToggle(finding.id, event.target.checked)
                      }
                      aria-label={`Toggle redaction for ${
                        finding.entityType || finding.recognizer || "entity"
                      }`}
                    />
                  </td>
                  <td>{finding.entityType}</td>
                  <td>{finding.text}</td>
                  <td>{formatConfidence(finding.confidence)}</td>
                  <td>{finding.recognizer || "—"}</td>
                  <td>{finding.patternName || "—"}</td>
                  <td className="code-cell">{finding.pattern || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <aside
        className="sidebar expandable anonymizer-settings"
        style={{ minWidth: "0" }}
      >
        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="ner-model"
            checked={openFilters.includes("ner-model")}
            onChange={handleOpenFilterToggle.bind(null, "ner-model")}
          />
          <label className="settings-label" htmlFor="ner-model">
            <strong>NER model</strong>
          </label>
          <div className="sidebar-group-content">
            <select
              id="ner-model"
              value={nerModel}
              onChange={(event) => {
                localStorage.setItem("preferredNerModel", event.target.value);
                setNerModel(event.target.value);
              }}
            >
              {NER_MODEL_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="acceptance-threshold"
            checked={openFilters.includes("acceptance-threshold")}
            onChange={handleOpenFilterToggle.bind(null, "acceptance-threshold")}
          />
          <label className="settings-label" htmlFor="acceptance-threshold">
            <svg className="icon chevron">
              <use xlinkHref="/images/icons.svg#chevron-down" />
            </svg>
            <strong>Acceptance threshold</strong>
          </label>
          <div className="sidebar-group-content threshold-control">
            <input
              id="acceptance-threshold"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                setThreshold(Number.isNaN(nextValue) ? 0 : nextValue);
              }}
            />
            <output htmlFor="acceptance-threshold">
              {threshold.toFixed(2)}
            </output>
          </div>
        </div>

        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="allowlist"
            checked={openFilters.includes("allowlist")}
            onChange={handleOpenFilterToggle.bind(null, "allowlist")}
          />
          <label className="settings-label" htmlFor="allowlist">
            <svg className="icon chevron">
              <use xlinkHref="/images/icons.svg#chevron-down" />
            </svg>
            <strong>Allowlist</strong>
          </label>
          <div className="sidebar-group-content">
            <textarea
              id="allowlist"
              rows={6}
              placeholder="Comma or newline separated"
              value={allowlistText}
              onChange={(event) => setAllowlistText(event.target.value)}
            />
            <small className="settings-help">
              Matching terms remain visible.
            </small>
          </div>
        </div>

        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="denylist"
            checked={openFilters.includes("denylist")}
            onChange={handleOpenFilterToggle.bind(null, "denylist")}
          />
          <label className="settings-label" htmlFor="denylist">
            <svg className="icon chevron">
              <use xlinkHref="/images/icons.svg#chevron-down" />
            </svg>
            <strong>Denylist</strong>
          </label>
          <div className="sidebar-group-content">
            <textarea
              id="denylist"
              rows={6}
              placeholder="Comma or newline separated"
              value={denylistText}
              onChange={(event) => setDenylistText(event.target.value)}
            />
            <small className="settings-help">
              Matching terms are always redacted.
            </small>
          </div>
        </div>

        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="entity-types"
            checked={openFilters.includes("entity-types")}
            onChange={handleOpenFilterToggle.bind(null, "entity-types")}
          />
          <label className="settings-label" htmlFor="entity-types">
            <svg className="icon chevron">
              <use xlinkHref="/images/icons.svg#chevron-down" />
            </svg>
            <strong>Entity types</strong>
          </label>
          <div className="sidebar-group-content">
            <form
              className="group"
              onSubmit={(event) => event.preventDefault()}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#search" />
              </svg>
              <input
                type="text"
                className="prepend-icon"
                placeholder="Filter entity types"
                value={entityTypeFilter}
                onChange={(event) => {
                  setEntityTypeFilter(event.target.value);
                  setMoreEntityOptions(false);
                }}
              />
            </form>
            <ul className="checkboxes settings-checkbox-list">
              {displayedEntityOptions.map((option) => (
                <li
                  key={option.value}
                  style={{
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="checkbox"
                    id={`entity-type-${option.value}`}
                    checked={entityTypeSelection[option.value] !== false}
                    onChange={(event) =>
                      setEntityTypeSelection((previous) => ({
                        ...previous,
                        [option.value]: event.target.checked,
                      }))
                    }
                  />
                  <label
                    htmlFor={`entity-type-${option.value}`}
                    className="settings-checkbox"
                  >
                    {option.displayLabel}
                    <span style={{ marginLeft: "0.4em", opacity: 0.7 }}>
                      ({option.displayValue})
                    </span>
                  </label>
                </li>
              ))}
              {displayedEntityOptions.length === 0 && (
                <li key="no-entity-matches" className="empty">
                  No matching entity types
                </li>
              )}
              {shouldShowMoreEntityOptions && (
                <li key="more-entity-options">
                  <a
                    href="#more-entity-options"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setMoreEntityOptions(true);
                    }}
                  >
                    More options
                  </a>
                </li>
              )}
              {moreEntityOptions &&
                filteredEntityOptions.length > INITIAL_ENTITY_DISPLAY_LIMIT && (
                  <li key="less-entity-options">
                    <a
                      href="#less-entity-options"
                      tabIndex={0}
                      role="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setMoreEntityOptions(false);
                      }}
                    >
                      Less options
                    </a>
                  </li>
                )}
            </ul>
          </div>
        </div>
        <div className="settings-group sidebar-group">
          <input
            type="checkbox"
            id="saved-presets"
            checked={openFilters.includes("saved-presets")}
            onChange={handleOpenFilterToggle.bind(null, "saved-presets")}
          />
          <label className="settings-label" htmlFor="saved-presets">
            <svg className="icon chevron">
              <use xlinkHref="/images/icons.svg#chevron-down" />
            </svg>
            <strong>Saved presets</strong>
          </label>
          <div className="sidebar-group-content">
            <select
              id="saved-presets-select"
              aria-label="Saved presets"
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
              disabled={isFetchingPresets || presets.length === 0}
            >
              <option value="">
                {isFetchingPresets ? "Loading presets…" : "Select a preset"}
              </option>
              {presets.map((preset) => (
                <option key={preset.id} value={String(preset.id)}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="preset-actions">
              <button
                type="button"
                className="small"
                onClick={handlePresetSave}
                disabled={isPersistingPreset}
              >
                Save
              </button>
              <button
                type="button"
                className="primary small"
                onClick={handlePresetLoad}
                disabled={
                  isPersistingPreset || isFetchingPresets || !selectedPreset
                }
              >
                Load
              </button>

              <div className="spacer" />

              <button
                type="button"
                className="negative small"
                onClick={handlePresetDelete}
                disabled={
                  isPersistingPreset || isFetchingPresets || !selectedPreset
                }
                style={{ marginRight: "0" }}
              >
                Delete
              </button>
            </div>
            {presetErrorMessage && (
              <small className="settings-help error">
                {presetErrorMessage}
              </small>
            )}
            {!presetErrorMessage && presetStatusMessage && (
              <small className="settings-help">{presetStatusMessage}</small>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

const container = document.getElementById("anonymizer");
if (container) {
  const root = createRoot(container);
  root.render(<Anonymizer />);
}
