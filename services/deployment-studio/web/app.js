const $ = (id) => document.getElementById(id);
const state = {
  project: "",
  snapshot: null,
  doctorReady: false,
  planReady: false,
  verified: false,
  plan: null,
  artifact: null,
  operationsUrl: "",
  runtime: null
};

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  bindControls();
  try {
    const health = await api("/api/v1/health");
    $("apiLed").classList.add("is-pass");
    $("apiStatus").textContent = "Local API ready";
    $("workspacePath").textContent = health.workspaceRoot;
    state.runtime = health.runtime;
    $("network").value = health.runtime.broadcastNetwork;
    $("rpcUrl").value = health.runtime.defaultRpcUrl;
    $("broadcastPolicy").textContent = `${health.runtime.broadcastNetwork} · ${health.runtime.allowedRpcHosts.join(", ")}`;
    await loadProjects();
  } catch (error) {
    $("apiStatus").textContent = "Local API unavailable";
    message("projectMessage", error.message, true);
  }
}

function bindControls() {
  document.querySelectorAll(".workflow-step").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".workflow-step").forEach((item) => item.classList.remove("is-current"));
      button.classList.add("is-current");
      $(button.dataset.target).scrollIntoView({behavior: "smooth", block: "start"});
    };
  });
  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.onchange = () => {
      document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("is-selected", card.contains(input)));
      $("dockerCompose").disabled = input.value !== "reference-service";
      if ($("dockerCompose").disabled) $("dockerCompose").checked = false;
      applyModuleDefaults(input.value);
      if (state.project) invalidatePlan();
    };
  });
  $("projectSelector").onchange = () => selectProject($("projectSelector").value);
  $("createProject").onclick = createProject;
  $("saveConfiguration").onclick = saveConfig;
  $("runDoctor").onclick = runDoctor;
  $("reviewPlan").onclick = reviewPlan;
  $("deployDemo").onclick = deployDemo;
  $("verifyArtifact").onclick = verifyArtifact;
  $("openOperations").onclick = () => {
    if (state.operationsUrl) window.open(state.operationsUrl, "_blank", "noopener");
  };
  $("configSection").querySelectorAll("input, select, textarea").forEach((input) => {
    input.addEventListener("input", invalidatePlan);
    input.addEventListener("change", invalidatePlan);
  });
  document.querySelectorAll("[data-activation]").forEach((input) => {
    input.onchange = saveActivation;
  });
}

function invalidatePlan() {
  state.doctorReady = false;
  state.planReady = false;
  state.plan = null;
  $("doctorChecks").className = "check-list empty-state";
  $("doctorChecks").textContent = "Configuration changed. Save it, then run doctor again.";
  $("planReview").className = "plan-review empty-state";
  $("planReview").textContent = "Configuration or RPC changed. Generate a new dry-run before deployment.";
  refreshDeployGate();
}

async function loadProjects() {
  const result = await api("/api/v1/projects");
  const selector = $("projectSelector");
  selector.innerHTML = '<option value="">No project</option>';
  result.projects.forEach((project) => selector.add(new Option(project.name, project.name)));
  const requested = localStorage.getItem("corner-store-studio-project");
  const selected = result.projects.find((item) => item.name === requested)?.name ?? result.projects[0]?.name;
  if (selected) {
    selector.value = selected;
    await selectProject(selected);
  }
}

async function selectProject(name) {
  if (!name) return;
  const snapshot = await api(`/api/v1/projects/${encodeURIComponent(name)}`);
  state.project = name;
  state.snapshot = snapshot;
  state.doctorReady = false;
  state.planReady = false;
  state.verified = snapshot.activation?.artifactVerified === true;
  localStorage.setItem("corner-store-studio-project", name);
  hydrate(snapshot);
  setProjectControls(true);
  $("projectState").textContent = "Configured";
  message("projectMessage", `Loaded ${name}.`, false);
  await refreshArtifact();
  await refreshHandoff();
  refreshDeployGate();
  updateWorkflowState();
}

async function createProject() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  setBusy($("createProject"), true, "Creating…");
  try {
    const result = await api("/api/v1/projects", {
      method: "POST",
      body: {
        name: $("projectName").value.trim(),
        mode,
        docker: $("dockerCompose").checked
      }
    });
    await loadProjects();
    $("projectSelector").value = result.project.name;
    await selectProject(result.project.name);
  } catch (error) {
    message("projectMessage", error.message, true);
  } finally {
    setBusy($("createProject"), false, "Create integration project");
  }
}

function hydrate(snapshot) {
  const config = snapshot.config;
  const integration = snapshot.integration;
  if (config) {
    $("network").value = config.deployment.network;
    $("assetProfile").value = config.asset.profile;
    $("artifactPath").value = config.deployment.artifact;
    $("venueRfq").checked = config.venues.rfq;
    $("venueAmm").checked = config.venues.amm;
    $("operatorAccount").value = config.accounts.operator;
    $("investorAccount").value = config.accounts.investor;
    $("makerAccount").value = config.accounts.maker;
    $("multisig").value = config.governance.multisig;
    $("requiredApprovals").value = config.governance.requiredApprovals;
  }
  if (integration) {
    const modeInput = document.querySelector(`input[name="mode"][value="${CSS.escape(integration.mode)}"]`);
    if (modeInput) {
      modeInput.checked = true;
      document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("is-selected", card.contains(modeInput)));
      $("dockerCompose").disabled = integration.mode !== "reference-service";
      $("dockerCompose").checked = integration.deployment?.dockerCompose === true;
    }
    $("pricingModule").value = integration.modules.pricing.moduleId;
    $("riskModule").value = integration.modules.risk.moduleId;
    $("signerModule").value = integration.modules.signer.moduleId;
    $("nonceModule").value = integration.modules.nonce.moduleId;
  }
  if (snapshot.scenario) $("scenarioJson").value = JSON.stringify(snapshot.scenario, null, 2);
  Object.entries(snapshot.activation ?? {}).forEach(([key, value]) => {
    const input = document.querySelector(`[data-activation="${key}"]`);
    if (input) input.checked = value === true;
  });
}

function setProjectControls(enabled) {
  for (const id of ["saveConfiguration", "runDoctor", "reviewPlan"]) $(id).disabled = !enabled;
}

async function saveConfig() {
  try {
    const config = {
      schemaVersion: 1,
      deployment: {artifact: $("artifactPath").value.trim(), network: $("network").value},
      asset: {profile: $("assetProfile").value},
      venues: {amm: $("venueAmm").checked, rfq: $("venueRfq").checked, orderBook: false},
      accounts: {
        operator: $("operatorAccount").value.trim(),
        investor: $("investorAccount").value.trim(),
        maker: $("makerAccount").value.trim()
      },
      governance: {
        multisig: $("multisig").value.trim(),
        requiredApprovals: Number($("requiredApprovals").value)
      }
    };
    const integration = buildIntegration(document.querySelector('input[name="mode"]:checked').value);
    const scenario = JSON.parse($("scenarioJson").value);
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/config`, {method: "PUT", body: config});
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/integration`, {method: "PUT", body: integration});
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/scenario`, {method: "PUT", body: scenario});
    state.doctorReady = false;
    state.planReady = false;
    state.verified = false;
    state.snapshot = await api(`/api/v1/projects/${encodeURIComponent(state.project)}`);
    message("configMessage", "Saved the three versioned project files.", false);
    await refreshHandoff();
    refreshDeployGate();
  } catch (error) {
    message("configMessage", error.message, true);
  }
}

function buildIntegration(mode) {
  const definitions = {
    pricing: [$("pricingModule").value.trim(), "rfq.price.v1", ["RFQ_PRICE_NUMERATOR", "RFQ_PRICE_DENOMINATOR"]],
    risk: [$("riskModule").value.trim(), "rfq.risk.pre-sign.v1", []],
    signer: [$("signerModule").value.trim(), "rfq.sign.eip712.v1", ["RFQ_SIGNER_PRIVATE_KEY"]],
    nonce: [$("nonceModule").value.trim(), "rfq.nonce.maker-scoped.v1", []]
  };
  return {
    schemaVersion: 1,
    mode,
    sdk: {package: "@corner-store/rfq-service", version: "0.1.0"},
    modules: Object.fromEntries(Object.entries(definitions).map(([kind, [moduleId, capability, env]]) => [kind, {
      moduleId, moduleVersion: "1.0.0", capabilities: [capability], env
    }])),
    deployment: {dockerCompose: mode === "reference-service" && $("dockerCompose").checked}
  };
}

function applyModuleDefaults(mode) {
  const reference = mode === "reference-service";
  $("pricingModule").value = reference ? "corner-store.fixed-rate" : "integrator.pricing";
  $("riskModule").value = reference ? "corner-store.noop-risk" : "integrator.risk";
  $("signerModule").value = "integrator.signer";
  $("nonceModule").value = reference ? "corner-store.in-memory-nonce" : "integrator.nonce";
}

async function runDoctor() {
  setBusy($("runDoctor"), true, "Checking…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/doctor`, {method: "POST"});
    state.doctorReady = result.ready === true;
    renderChecks(result.checks ?? []);
    refreshDeployGate();
  } catch (error) {
    state.doctorReady = false;
    $("doctorChecks").className = "check-list empty-state";
    $("doctorChecks").textContent = error.message;
  } finally {
    setBusy($("runDoctor"), false, "Run doctor");
  }
}

function renderChecks(checks) {
  $("doctorChecks").className = "check-list";
  $("doctorChecks").innerHTML = checks.map((check) => `
    <div class="check-row">
      <span class="status-led ${check.pass ? "is-pass" : ""}"></span>
      <b>${escapeHtml(check.name)}</b>
      <span>${escapeHtml(check.detail)}</span>
      <em>${check.required ? "required" : "optional"}</em>
    </div>`).join("");
}

async function reviewPlan() {
  setBusy($("reviewPlan"), true, "Planning…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/deploy/plan`, {
      method: "POST", body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    state.plan = result;
    state.planReady = true;
    renderPlan(result);
    refreshDeployGate();
  } catch (error) {
    state.planReady = false;
    $("planReview").className = "plan-review empty-state";
    $("planReview").textContent = error.message;
  } finally {
    setBusy($("reviewPlan"), false, "Generate dry-run");
  }
}

function renderPlan(plan) {
  $("planReview").className = "plan-review";
  $("planReview").innerHTML = `
    <div class="plan-grid">
      <div><span>Profile</span><strong>${escapeHtml(plan.profile)}</strong></div>
      <div><span>Network</span><strong>${escapeHtml(plan.config.deployment.network)}</strong></div>
      <div><span>RPC</span><strong>${escapeHtml(plan.rpcUrl)}</strong></div>
      <div><span>Artifact</span><strong>${escapeHtml(plan.artifactPath)}</strong></div>
      <div><span>RFQ</span><strong>${plan.config.venues.rfq ? "enabled" : "disabled"}</strong></div>
      <div><span>AMM</span><strong>${plan.config.venues.amm ? "enabled" : "disabled"}</strong></div>
      <div><span>Contracts</span><strong>${escapeHtml(plan.contractSource ?? "bundled")}</strong></div>
      <div><span>Mutation</span><strong>dry-run only</strong></div>
    </div>
    <div class="command-block">${escapeHtml(plan.command ?? "No command returned")}</div>`;
}

function refreshDeployGate() {
  const allowed = state.runtime &&
    $("network").value === state.runtime.broadcastNetwork &&
    isAllowedRpc($("rpcUrl").value, state.runtime.allowedRpcHosts);
  $("gateDoctor").classList.toggle("is-pass", state.doctorReady);
  $("gatePlan").classList.toggle("is-pass", state.planReady);
  $("gateNetwork").classList.toggle("is-pass", allowed);
  $("gateNetworkLabel").textContent = allowed
    ? "Operator broadcast policy matched"
    : `Requires ${state.runtime?.broadcastNetwork ?? "configured demo network"} and an allowlisted RPC host`;
  $("deployDemo").disabled = !(state.project && state.doctorReady && state.planReady && allowed);
  updateWorkflowState();
}

function updateWorkflowState() {
  const completed = {
    project: Boolean(state.project),
    config: Boolean(state.project),
    doctor: state.doctorReady,
    plan: state.planReady,
    deploy: Boolean(state.artifact),
    artifact: state.verified,
    activation: state.verified
  };
  const order = ["project", "config", "doctor", "plan", "deploy", "artifact", "activation"];
  let previousComplete = true;
  for (const stage of order) {
    const step = document.querySelector(`[data-stage="${stage}"]`);
    if (!step) continue;
    step.classList.toggle("is-complete", completed[stage]);
    step.classList.toggle("is-blocked", !completed[stage] && !previousComplete);
    previousComplete = previousComplete && completed[stage];
  }
}

function isAllowedRpc(value, allowedHosts) {
  try {
    const host = new URL(value).hostname;
    return allowedHosts.includes(host);
  } catch {
    return false;
  }
}

async function deployDemo() {
  setBusy($("deployDemo"), true, "Deploying…");
  $("deployLog").textContent = "$ Starting guarded local reference deployment…\n";
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/deploy`, {
      method: "POST", body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    const stream = new EventSource(`/api/v1/jobs/${encodeURIComponent(result.jobId)}/events`);
    stream.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      $("deployLog").textContent += `${payload.line}\n`;
      $("deployLog").scrollTop = $("deployLog").scrollHeight;
    };
    stream.addEventListener("done", async (event) => {
      const job = JSON.parse(event.data);
      stream.close();
      setBusy($("deployDemo"), false, "Deploy reference stack");
      if (job.status === "succeeded") {
        $("deployLog").textContent += "Artifact ready for verification.\n";
        await refreshArtifact();
        $("verifyArtifact").disabled = false;
      } else {
        $("deployLog").textContent += `FAILED: ${job.error}\n`;
      }
    });
    stream.onerror = () => {
      stream.close();
      setBusy($("deployDemo"), false, "Deploy reference stack");
    };
  } catch (error) {
    $("deployLog").textContent += `BLOCKED: ${error.message}\n`;
    setBusy($("deployDemo"), false, "Deploy reference stack");
  }
}

async function refreshArtifact() {
  if (!state.project) return;
  try {
    state.artifact = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/artifact`);
    renderArtifact(state.artifact);
    $("verifyArtifact").disabled = false;
    updateWorkflowState();
  } catch {
    state.artifact = null;
    $("artifactViewer").className = "artifact-grid empty-state";
    $("artifactViewer").textContent = "The deployment artifact will appear here as the address source of truth.";
    $("verifyArtifact").disabled = true;
    updateWorkflowState();
  }
}

function renderArtifact(artifact) {
  const priority = ["assetProfile", "router", "engine", "rwaToken", "quote", "rfqAdapter", "makerAuthorizer", "rfqVenue", "ammAdapter", "pool", "elementReg", "recipeReg", "policyReg", "operatorReg", "factory", "scenarioHash"];
  const keys = [...priority.filter((key) => artifact[key] !== undefined), ...Object.keys(artifact).filter((key) => !priority.includes(key))];
  $("artifactViewer").className = "artifact-grid";
  $("artifactViewer").innerHTML = keys.map((key) => `
    <div class="artifact-item" title="${escapeHtml(String(artifact[key]))}">
      <span>${escapeHtml(key)}</span><code>${escapeHtml(String(artifact[key]))}</code>
    </div>`).join("");
}

async function verifyArtifact() {
  setBusy($("verifyArtifact"), true, "Verifying…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/verify`, {method: "POST"});
    state.verified = result.ready === true;
    $("verifySummary").className = `verify-summary ${state.verified ? "is-pass" : ""}`;
    $("verifySummary").textContent = state.verified
      ? `Basic artifact verification passed · ${(result.checks ?? []).length} bindings checked`
      : "Artifact verification failed.";
    await refreshHandoff();
    updateWorkflowState();
  } catch (error) {
    state.verified = false;
    $("verifySummary").className = "verify-summary";
    $("verifySummary").textContent = error.message;
  } finally {
    setBusy($("verifyArtifact"), false, "Verify artifact");
  }
}

async function saveActivation() {
  if (!state.project) return;
  const body = {};
  document.querySelectorAll("[data-activation]").forEach((input) => {
    body[input.dataset.activation] = input.checked;
  });
  await api(`/api/v1/projects/${encodeURIComponent(state.project)}/activation`, {method: "PUT", body});
}

async function refreshHandoff() {
  if (!state.project) return;
  const handoff = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/handoff`);
  state.operationsUrl = handoff.url;
  $("openOperations").disabled = !handoff.enabled;
  $("handoffMessage").className = `handoff-card ${handoff.enabled ? "is-ready" : ""}`;
  $("handoffMessage").innerHTML = handoff.enabled
    ? "<strong>Verified deployment ready</strong><span>Open the existing runtime dashboard with this artifact as its source of truth.</span>"
    : `<strong>Operations handoff locked</strong><span>${escapeHtml(handoff.reason)}</span>`;
  updateWorkflowState();
}

async function api(path, options = {}) {
  const method = options.method ?? "GET";
  const mutation = method === "POST" || method === "PUT";
  const response = await fetch(path, {
    method,
    headers: mutation ? {"content-type": "application/json"} : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? body.error ?? `Request failed (${response.status})`);
  return body;
}

function setBusy(button, busy, text) {
  button.disabled = busy;
  button.textContent = text;
}

function message(id, text, error) {
  const target = $(id);
  target.textContent = text;
  target.className = `inline-message ${error ? "is-error" : "is-pass"}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
