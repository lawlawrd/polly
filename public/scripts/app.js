const form = document.getElementById("anonymize-form");
const textArea = document.getElementById("input-text");
const nerModelSelect = document.getElementById("ner-model");
const statusNode = document.getElementById("form-status");
const outputNode = document.getElementById("anonymized-output");
const entitiesNode = document.getElementById("entities");

const formatConfidence = (value) => {
  if (typeof value !== "number") return "--";
  return `${Math.round(value * 1000) / 10}%`;
};

const renderEntities = (entities, items) => {
  entitiesNode.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.classList.add("entities-wrapper");

  const entityHeader = document.createElement("h3");
  entityHeader.textContent = "Analyzer results";
  wrapper.appendChild(entityHeader);

  if (!entities?.length) {
    const empty = document.createElement("p");
    empty.textContent = "No entities detected.";
    wrapper.appendChild(empty);
  } else {
    const table = document.createElement("table");
    table.classList.add("table");
    const head = document.createElement("thead");
    head.innerHTML =
      "<tr><th>Entity</th><th>Confidence</th><th>Start</th><th>End</th></tr>";
    table.appendChild(head);

    const body = document.createElement("tbody");
    entities.forEach((entity) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entity.entity_type}</td>
        <td>${formatConfidence(entity.score)}</td>
        <td>${entity.start}</td>
        <td>${entity.end}</td>
      `;
      body.appendChild(row);
    });
    table.appendChild(body);
    wrapper.appendChild(table);
  }

  const anonymizerHeader = document.createElement("h3");
  anonymizerHeader.textContent = "Anonymizer actions";
  wrapper.appendChild(anonymizerHeader);

  if (!items?.length) {
    const empty = document.createElement("p");
    empty.textContent = "No anonymization performed.";
    wrapper.appendChild(empty);
  } else {
    const table = document.createElement("table");
    table.classList.add("table");
    const head = document.createElement("thead");
    head.innerHTML =
      "<tr><th>Entity</th><th>Anonymizer</th><th>Text</th></tr>";
    table.appendChild(head);

    const body = document.createElement("tbody");
    items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.entity_type ?? ""}</td>
        <td>${item.anonymizer ?? ""}</td>
        <td>${item.text ?? ""}</td>
      `;
      body.appendChild(row);
    });
    table.appendChild(body);
    wrapper.appendChild(table);
  }

  entitiesNode.appendChild(wrapper);
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = textArea?.value ?? "";
  const nerModel = nerModelSelect?.value ?? "en_core_web_lg";
  const language =
    typeof nerModel === "string" && nerModel.includes("_")
      ? nerModel.split("_")[0] || "en"
      : "en";

  if (!text.trim()) {
    statusNode.textContent = "Please provide some text first.";
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";
  }

  statusNode.textContent = "Contacting Presidio services...";

  try {
    const response = await fetch("/api/anonymize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, language, nerModel }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Request failed");
    }

    const result = await response.json();

    outputNode.textContent = result.anonymizedText ?? "";
    renderEntities(result.entities, result.items);
    statusNode.textContent = "Done!";
  } catch (error) {
    console.error(error);
    statusNode.textContent =
      "Something went wrong while contacting Presidio. Check the console and make sure the services are running.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Anonymize";
    }
  }
});
