/* global ethers */
const $ = (id) => document.getElementById(id);
const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))"
];
const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];

let state;
let provider;
let signer;
let account;
let side = "buy";
let quoteEnvelope;
let precheckPassed = false;
let lastEvidence;
let chainClock;

async function api(path, options) {
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || value.error || `HTTP ${response.status}`);
  return value;
}

async function load() {
  state = await api("/api/state");
  chainClock = Number.isSafeInteger(state.readiness.chainTimestamp)
    ? {timestamp: state.readiness.chainTimestamp, observedAt: performance.now()}
    : undefined;
  $("deployment").textContent = state.deployment.deploymentId;
  $("network").textContent = `Chain ${state.deployment.chainId} · source ${short(state.deployment.sourceCommit)} · ${state.deployment.transactionCount ?? "—"} transactions`;
  $("asset").textContent = `${state.tokens.rwa.name} (${state.tokens.rwa.symbol}) · mock testnet asset`;
  $("rate").textContent = state.pricing.display;
  renderReadiness();
  renderContracts();
  renderScenarios();
  updateSide();
  addTrace("Deployment artifact", "Verified addresses loaded");
}

async function connect() {
  if (!window.ethereum) throw new Error("Browser wallet not found");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  account = await signer.getAddress();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== state.deployment.chainId) {
    throw new Error(`Switch wallet to chain ${state.deployment.chainId}`);
  }
  $("wallet").textContent = short(account);
  $("connect").textContent = "Wallet connected";
  await refreshWallet();
  $("precheck").disabled = false;
  addTrace("Wallet", `${short(account)} connected on chain ${network.chainId}`);
}

async function refreshWallet() {
  if (!account) return;
  const wallet = await api(`/api/wallet/${account}`);
  $("wallet-state").textContent =
    `${state.tokens.rwa.symbol} ${wallet.balances.rwaDisplay} · ${state.tokens.quote.symbol} ${wallet.balances.quoteDisplay} · QP ${wallet.qualifiedPurchaser.allowed ? "eligible" : "not eligible"}`;
}

function updateSide() {
  document.querySelectorAll(".side").forEach((button) => {
    button.classList.toggle("active", button.dataset.side === side);
    button.textContent = `${button.dataset.side === "buy" ? "Buy" : "Sell"} ${state?.tokens.rwa.symbol ?? "RWA"}`;
  });
  const input = side === "buy" ? state?.tokens.quote : state?.tokens.rwa;
  $("input-symbol").textContent = input?.symbol ?? "—";
  quoteEnvelope = undefined;
  precheckPassed = false;
  $("request").disabled = true;
  $("approve").disabled = true;
  $("execute").disabled = true;
  $("quote-status").textContent = "None";
  $("estimated").textContent = "—";
  hideBlockPanel();
}

async function runPrecheck() {
  requireWallet();
  const amountIn = amountBaseUnits();
  const result = await api("/api/precheck", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({taker: account, amountIn, side})
  });
  precheckPassed = result.allowed;
  const output = side === "buy" ? state.tokens.rwa : state.tokens.quote;
  $("estimated").textContent = `${ethers.formatUnits(result.amountOut, output.decimals)} ${output.symbol}`;
  $("precheck-result").className = `result ${result.allowed ? "pass" : "fail"}`;
  $("precheck-result").textContent = result.allowed
    ? "Pre-check passed. The Router will evaluate current policy again at settlement."
    : `Blocked · ${result.explanation?.title || result.checks.filter((check) => !check.pass).map((check) => check.name).join(", ")}`;
  renderBlockPanel(result.explanation);
  $("request").disabled = !result.allowed;
  addTrace("Compliance pre-check", result.allowed ? "Allowed" : `Rejected ${result.reasonCode}`, !result.allowed);
}

async function requestQuote() {
  if (!precheckPassed) throw new Error("Run a passing pre-check first");
  quoteEnvelope = await api("/api/quote", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({taker: account, amountIn: amountBaseUnits(), side})
  });
  const q = quoteEnvelope.signed.quote;
  const input = side === "buy" ? state.tokens.quote : state.tokens.rwa;
  const output = side === "buy" ? state.tokens.rwa : state.tokens.quote;
  const values = [
    short(q.maker),
    `${ethers.formatUnits(q.amountIn, input.decimals)} ${input.symbol}`,
    `${ethers.formatUnits(q.amountOut, output.decimals)} ${output.symbol}`,
    new Date(q.expiry * 1000).toLocaleTimeString(),
    q.nonce
  ];
  document.querySelectorAll("#quote-details dd").forEach((node, index) => { node.textContent = values[index]; });
  $("quote-status").textContent = "Signed";
  $("approve").disabled = false;
  $("execute").disabled = true;
  addTrace("Maker quote", `Signed nonce ${q.nonce}`);
}

async function approve() {
  requireQuote();
  const token = new ethers.Contract(quoteEnvelope.execution.inputToken, ERC20_ABI, signer);
  const amount = BigInt(quoteEnvelope.signed.quote.amountIn);
  const current = await token.allowance(account, quoteEnvelope.execution.spender);
  if (current < amount) {
    const transaction = await token.approve(quoteEnvelope.execution.spender, amount);
    addTrace("Input approval", `Submitted ${short(transaction.hash)}`);
    await transaction.wait();
  }
  $("execute").disabled = false;
  addTrace("Input approval", "RFQ Adapter allowance ready");
}

async function execute() {
  requireQuote();
  $("execute").disabled = true;
  try {
    const router = new ethers.Contract(quoteEnvelope.execution.router, ROUTER_ABI, signer);
    await router.execute.staticCall(quoteEnvelope.execution.request);
    addTrace("Final Router preflight", "Current compliance accepted");
    const transaction = await router.execute(quoteEnvelope.execution.request);
    addTrace("Router settlement", `Submitted ${short(transaction.hash)}`);
    const confirmationStartedAt = performance.now();
    const submittedAt = new Date().toISOString();
    const receipt = await transaction.wait();
    const confirmationMs = Math.round(performance.now() - confirmationStartedAt);
    const confirmationSeconds = confirmationMs / 1000;
    addTrace("Asset movement", `Confirmed in block ${receipt.blockNumber} · ${confirmationSeconds.toFixed(2)}s after submission`);
    lastEvidence = {
      schemaVersion: 1,
      kind: "corner-store-public-testnet-rfq-settlement",
      deploymentId: state.deployment.deploymentId,
      sourceCommit: state.deployment.sourceCommit,
      chainId: state.deployment.chainId,
      router: quoteEnvelope.execution.router,
      rfqAdapter: quoteEnvelope.execution.spender,
      wallet: account,
      side,
      tokenIn: quoteEnvelope.signed.quote.tokenIn,
      tokenOut: quoteEnvelope.signed.quote.tokenOut,
      amountIn: quoteEnvelope.signed.quote.amountIn,
      amountOut: quoteEnvelope.signed.quote.amountOut,
      transactionHash: transaction.hash,
      blockNumber: Number(receipt.blockNumber),
      submittedAt,
      confirmedAt: new Date().toISOString(),
      confirmationMs
    };
    $("download-evidence").disabled = false;
    $("quote-status").textContent = "Filled";
    await refreshWallet();
  } catch (error) {
    addTrace("Router settlement", readableError(error), true);
    $("quote-status").textContent = "Rejected";
  }
}

function amountBaseUnits() {
  const value = $("amount").value.trim();
  if (!value || Number(value) <= 0) throw new Error("Enter a positive amount");
  const token = side === "buy" ? state.tokens.quote : state.tokens.rwa;
  return ethers.parseUnits(value, token.decimals).toString();
}

function renderReadiness() {
  const checks = [
    ["Manifest active", state.readiness.manifestActive],
    ["Maker approved", state.readiness.makerApproved],
    ["Maker RWA inventory", BigInt(state.readiness.makerRwa) > 0n],
    ["Maker quote inventory", BigInt(state.readiness.makerQuote) > 0n],
    ["Maker RWA allowance", BigInt(state.readiness.makerRwaAllowance) > 0n],
    ["Maker quote allowance", BigInt(state.readiness.makerQuoteAllowance) > 0n]
  ];
  $("readiness").innerHTML = checks.map(([label, pass]) =>
    `<span class="${pass ? "" : "fail"}">${label}</span>`).join("");
}

function renderContracts() {
  const entries = {
    ...state.contracts,
    ...state.participants
  };
  $("contracts").innerHTML = Object.entries(entries).map(([name, address]) => {
    const body = state.deployment.explorerUrl
      ? `<a href="${state.deployment.explorerUrl}/address/${address}" target="_blank" rel="noreferrer">${address}</a>`
      : address;
    return `<div><strong>${name}</strong>${body}</div>`;
  }).join("");
}

function renderScenarios() {
  const network = state.walletNetwork;
  $("wallet-network").innerHTML = network
    ? `Wallet network · <strong>${escapeHtml(network.name)}</strong> · Chain ID <code>${network.chainId}</code> · RPC <code>${escapeHtml(network.rpcUrl)}</code> · Currency <code>${escapeHtml(network.nativeCurrency)}</code>`
    : `Use the network details supplied with deployment chain <code>${state.deployment.chainId}</code>.`;
  $("scenarios").innerHTML = state.scenarios.map((scenario) => `
    <article class="scenario-card ${scenario.enabled === false ? "disabled" : ""}">
      <strong>${escapeHtml(scenario.title)}</strong>
      <code>${escapeHtml(scenario.wallet)}</code>
      <span>${escapeHtml(scenario.instruction)}</span>
    </article>
  `).join("");
}

function addTrace(label, detail, error = false) {
  const item = document.createElement("li");
  if (error) item.className = "error";
  item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(detail)}</strong>`;
  $("trace").appendChild(item);
}

function downloadEvidence() {
  if (!lastEvidence) throw new Error("Complete a settlement before downloading evidence");
  const content = `${JSON.stringify(lastEvidence, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([content], {type: "application/json"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${lastEvidence.deploymentId}-${lastEvidence.transactionHash.slice(2, 12)}-evidence.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  addTrace("Test evidence", "Downloaded non-secret settlement evidence");
}

function renderBlockPanel(explanation) {
  if (!explanation) return hideBlockPanel();
  $("block-title").textContent = explanation.title;
  $("block-detail").textContent = explanation.detail;
  $("block-action").textContent = explanation.action;
  $("block-time").textContent = timingText(explanation.timing);
  $("block-code").textContent = explanation.code;
  $("block-label").textContent = explanation.technicalLabel;
  $("block-panel").classList.remove("hidden");
}

function hideBlockPanel() {
  $("block-panel").classList.add("hidden");
}

function timingText(timing) {
  if (!timing) return "No reliable availability time is available.";
  if (timing.availableAt) {
    const remaining = Math.max(0, Number(timing.availableAt) - currentChainTime());
    const suffix = remaining > 0 ? ` · about ${formatDuration(remaining)} remaining` : " · retry now";
    return `${new Date(Number(timing.availableAt) * 1000).toLocaleString()}${suffix}`;
  }
  if (timing.evidenceExpiredAt) {
    return `Evidence expired ${new Date(Number(timing.evidenceExpiredAt) * 1000).toLocaleString()} · operator refresh required`;
  }
  return timing.note;
}

function currentChainTime() {
  if (!chainClock) return Math.floor(Date.now() / 1000);
  return chainClock.timestamp + Math.floor((performance.now() - chainClock.observedAt) / 1000);
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", !days && minutes ? `${minutes}m` : ""]
    .filter(Boolean)
    .join(" ");
}

function requireWallet() {
  if (!signer || !account) throw new Error("Connect wallet first");
}

function requireQuote() {
  requireWallet();
  if (!quoteEnvelope) throw new Error("Request a signed quote first");
}

function short(value) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function readableError(error) {
  return error?.shortMessage || error?.reason || error?.message || "Transaction rejected";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

$("connect").addEventListener("click", () => connect().catch((error) => addTrace("Wallet", readableError(error), true)));
$("precheck").addEventListener("click", () => runPrecheck().catch((error) => addTrace("Pre-check", readableError(error), true)));
$("request").addEventListener("click", () => requestQuote().catch((error) => addTrace("Quote", readableError(error), true)));
$("approve").addEventListener("click", () => approve().catch((error) => addTrace("Approval", readableError(error), true)));
$("execute").addEventListener("click", execute);
$("refresh").addEventListener("click", () => Promise.all([load(), refreshWallet()]).catch((error) => addTrace("Refresh", readableError(error), true)));
$("download-evidence").addEventListener("click", () => {
  try { downloadEvidence(); }
  catch (error) { addTrace("Test evidence", readableError(error), true); }
});
document.querySelectorAll(".side").forEach((button) => button.addEventListener("click", () => {
  side = button.dataset.side;
  updateSide();
}));
$("amount").addEventListener("input", () => {
  precheckPassed = false;
  quoteEnvelope = undefined;
  $("request").disabled = true;
  $("approve").disabled = true;
  $("execute").disabled = true;
  hideBlockPanel();
});

load().catch((error) => addTrace("Startup", readableError(error), true));
