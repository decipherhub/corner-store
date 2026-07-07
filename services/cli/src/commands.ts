import {execFileSync} from "child_process";
import {formatEther, parseEther} from "ethers";

import {relative} from "path";

import {ACQ_SOURCE_ABI, ERC20_ABI, ELEMENT_ABI, ELEMENT_SETTERS_ABI, LOCKUP_ABI, RECIPE_ABI} from "./abi";
import {
  ALLOWED_JURISDICTION,
  Artifact,
  DEFAULT_RPC,
  GlobalOpts,
  elementRegistry,
  engine,
  erc20,
  factory,
  findRepoRoot,
  loadArtifact,
  makeProvider,
  policyRegistry,
  recipeRegistry,
  resolveArtifactPath,
  resolveSigner,
  rfqAdapter,
  router,
  venueRegistry,
  walletForAccount,
  DEFAULT_CHAIN_ID,
} from "./config";
import {AbiCoder, Contract, decodeBytes32String, encodeBytes32String} from "ethers";
import {ELEMENT_IDS, applyAttestation, defaultIdentityId} from "./elements";
import {ELEMENT_LABELS, POLICY_STATUS, RECIPE_LABELS, decodeReason, encodeReason} from "./reason";
import {RFQQuoteService, WalletTypedDataSigner, encodeVenueData, readQuoteFile, writeQuoteFile} from "./rfq";
import {CliError} from "./util";

const CTX_TUPLE =
  "tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate)";

const VENUE_TYPE_NAMES = ["AMM", "ORDER_BOOK", "RFQ"];
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

function subjectAddress(opts: GlobalOpts, positional: string | undefined, fallbackAccount: number): string {
  if (positional) return positional;
  if (opts.key) return new (require("ethers").Wallet)(opts.key.startsWith("0x") ? opts.key : `0x${opts.key}`).address;
  const idx = opts.account !== undefined ? Number(opts.account) : fallbackAccount;
  return walletForAccount(idx).address;
}

async function logTx(tx: any, label: string): Promise<void> {
  const receipt = await tx.wait();
  console.log(`  ${label}: ${tx.hash} (block ${receipt.blockNumber}, status ${receipt.status})`);
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
export async function cmdStatus(positional: string | undefined, opts: GlobalOpts & {json?: boolean}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const subject = subjectAddress(opts, positional, 1);

  const policy = policyRegistry(a, provider);
  const manifest = await policy.manifestOf(a.rwaToken);
  const status = Number(manifest.status);
  const supportedEngines = Number(manifest.supportedEngines);

  const venues: Array<{label: string; address: string; type: string; active: boolean}> = [];
  for (const [label, address] of [
    ["AMM pool", a.pool],
    ["RFQ venue", a.rfqVenue]
  ] as const) {
    const cfg = await venueRegistry(a, provider).venueOf(address);
    venues.push({label, address, type: VENUE_TYPE_NAMES[Number(cfg.venueType)] ?? String(cfg.venueType), active: cfg.active});
  }

  // Per-element attestation state for the subject: replay each element's check.
  const reg = elementRegistry(a, provider);
  const ctx = [subject, subject, a.pool, a.quote, a.rwaToken, parseEther("1"), parseEther("1"), 0, a.pool, 0, false];
  const coder = require("ethers").AbiCoder.defaultAbiCoder();
  const elementContext = coder.encode([CTX_TUPLE], [ctx]);
  const elements: Array<{id: string; label: string; passed: boolean}> = [];
  for (const [id, label] of Object.entries(ELEMENT_LABELS)) {
    const elAddr = await reg.elementOf(encodeBytes32String(id));
    if (elAddr === "0x0000000000000000000000000000000000000000") {
      elements.push({id, label, passed: false});
      continue;
    }
    const el = new Contract(elAddr, ELEMENT_ABI, provider);
    try {
      const [passed] = await el.check(subject, a.pool, a.rwaToken, parseEther("1"), elementContext);
      elements.push({id, label, passed});
    } catch {
      elements.push({id, label, passed: false});
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          rpc: opts.rpc ?? DEFAULT_RPC,
          artifact: resolveArtifactPath(opts.artifact),
          subject,
          addresses: a,
          manifest: {
            status,
            statusName: POLICY_STATUS[status] ?? "?",
            issuanceRecipeId: Number(manifest.issuanceRecipeId),
            recipeName: RECIPE_LABELS[Number(manifest.issuanceRecipeId)] ?? "?",
            supportedEngines,
            declaredBy: manifest.declaredBy,
            approvedBy: manifest.approvedBy
          },
          venues,
          elements
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Corner Store — deployment status");
  console.log("  rpc      :", opts.rpc ?? DEFAULT_RPC);
  console.log("  artifact :", resolveArtifactPath(opts.artifact));
  console.log("");
  console.log("Addresses:");
  for (const [k, v] of Object.entries(a)) console.log(`  ${k.padEnd(16)} ${v}`);
  console.log("");
  console.log("RWA manifest:");
  console.log(`  status           ${status} (${POLICY_STATUS[status] ?? "?"})`);
  console.log(
    `  issuanceRecipe   ${Number(manifest.issuanceRecipeId)} (${RECIPE_LABELS[Number(manifest.issuanceRecipeId)] ?? "?"})`
  );
  console.log(`  supportedEngines 0b${supportedEngines.toString(2).padStart(3, "0")} (AMM=${!!(supportedEngines & 1)}, RFQ=${!!(supportedEngines & 4)})`);
  console.log(`  declaredBy       ${manifest.declaredBy}`);
  console.log(`  approvedBy       ${manifest.approvedBy}`);
  console.log("");
  console.log("Venues:");
  for (const v of venues) console.log(`  ${v.label.padEnd(10)} ${v.address}  type=${v.type} active=${v.active}`);
  console.log("");
  console.log(`Attestation state for ${subject}:`);
  for (const e of elements) console.log(`  [${e.passed ? "PASS" : "FAIL"}] ${e.id.padEnd(8)} ${e.label}`);
}

// ---------------------------------------------------------------------------
// onboard
// ---------------------------------------------------------------------------
function enginesMask(spec: string | undefined): number {
  if (!spec) return 1 | 4; // amm | rfq (default)
  let mask = 0;
  for (const part of spec.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (part === "amm") mask |= 1;
    else if (part === "order_book" || part === "orderbook") mask |= 2;
    else if (part === "rfq") mask |= 4;
    else throw new CliError(`unknown engine "${part}" (amm|order_book|rfq)`);
  }
  return mask;
}

export async function cmdOnboard(opts: GlobalOpts & {engines?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const mask = enginesMask(opts.engines);

  const policy = policyRegistry(a, signer);
  const current = Number(await policy.statusOf(a.rwaToken));
  console.log(`RWA manifest current status: ${current} (${POLICY_STATUS[current] ?? "?"})`);
  // registerManifest only accepts UNKNOWN(0) or RETIRED(5). Retire an in-flight
  // ACTIVE(2)/SUSPENDED(3) manifest first (RFQFlow.t.sol precedent).
  if (current === 2 || current === 3) {
    console.log("  manifest in-flight — retiring before re-onboarding");
    await logTx(await policy.retireManifest(a.rwaToken, encodeBytes32String("CLI-REONBOARD")), "retire");
  } else if (current === 4) {
    throw new CliError("manifest is PROPOSED; approve or wait — cannot re-onboard from PROPOSED");
  }

  // ManifestCore: status(ignored),issuanceRecipeId=1,version=1,fundRecipeId=0,
  // enabledResalePaths=0,supportedEngines=mask,stateScopeId=0,factsPacked=0,
  // coverageScope=0,fullManifestHash=0,declaredBy(ignored),approvedBy(ignored).
  const m = [2, 1, 1, 0, 0, mask, 0, 0, 0, ZERO32, ZERO_ADDR, ZERO_ADDR];
  const venueCfg = [0, a.ammAdapter, a.pool, ZERO_ADDR, 1, true]; // AMM, custody POOL
  await logTx(await factory(a, signer).registerRWAToken(a.rwaToken, m, a.pool, venueCfg), "registerRWAToken");
  console.log(`Onboarded RWA ${a.rwaToken} with supportedEngines 0b${mask.toString(2).padStart(3, "0")} + AMM venue ${a.pool}`);
}

// ---------------------------------------------------------------------------
// manifest <status|suspend|resume|retire>
// ---------------------------------------------------------------------------
export async function cmdManifest(action: string, opts: GlobalOpts & {reason?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const reason = encodeBytes32String((opts.reason ?? "CLI-ACTION").slice(0, 31));

  if (action === "status") {
    const cur = Number(await policyRegistry(a, provider).statusOf(a.rwaToken));
    console.log(`RWA manifest status: ${cur} (${POLICY_STATUS[cur] ?? "?"})`);
    return;
  }

  const signer = resolveSigner(opts, provider, 0); // operator
  const policy = policyRegistry(a, signer);
  switch (action) {
    case "suspend":
      await logTx(await policy.suspendManifest(a.rwaToken, reason), "suspendManifest");
      break;
    case "resume":
      await logTx(await policy.resumeManifest(a.rwaToken), "resumeManifest");
      break;
    case "retire":
      await logTx(await policy.retireManifest(a.rwaToken, reason), "retireManifest");
      break;
    default:
      throw new CliError(`unknown manifest action "${action}" (status|suspend|resume|retire)`);
  }
  const cur = Number(await policyRegistry(a, provider).statusOf(a.rwaToken));
  console.log(`  new status: ${cur} (${POLICY_STATUS[cur] ?? "?"})`);
}

// ---------------------------------------------------------------------------
// attest <element> <subject> [value...]
// ---------------------------------------------------------------------------
function elementContract(a: Artifact, id: string, signer: any, regRunner: any): Promise<Contract> {
  return elementRegistry(a, regRunner)
    .elementOf(encodeBytes32String(id))
    .then((addr: string) => {
      if (addr === ZERO_ADDR) throw new CliError(`element ${id} not registered in ElementRegistry`);
      return new Contract(addr, ELEMENT_SETTERS_ABI, signer);
    });
}

export async function cmdAttest(element: string, subject: string, values: string[], opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const id = ELEMENT_IDS[element];
  if (!id) throw new CliError(`unknown element "${element}". Known: ${Object.keys(ELEMENT_IDS).join(", ")}`);
  const contract = await elementContract(a, id, signer, provider);
  const {tx, description} = await applyAttestation(element, contract, subject, values);
  await logTx(tx, description);
}

// ---------------------------------------------------------------------------
// investor-setup <addr>
// ---------------------------------------------------------------------------
export async function cmdInvestorSetup(subject: string, opts: GlobalOpts & {fund?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const reg = provider;

  console.log(`Investor-side Reg D happy-path setup for ${subject}`);
  // jurisdiction: US + allow US
  const jur = await elementContract(a, "A-02-v1", signer, reg);
  await logTx(await jur.setJurisdictionAllowed(encodeBytes32String(ALLOWED_JURISDICTION), true), `jurisdiction.setJurisdictionAllowed("${ALLOWED_JURISDICTION}", true)`);
  await logTx(await jur.setJurisdiction(subject, encodeBytes32String(ALLOWED_JURISDICTION)), `jurisdiction.setJurisdiction(${subject}, "${ALLOWED_JURISDICTION}")`);
  // identity bind (matches deploy-time id derivation)
  const ident = await elementContract(a, "A-04-v1", signer, reg);
  await logTx(await ident.bindIdentity(subject, defaultIdentityId(subject)), `identity.bindIdentity(${subject})`);
  // accredited
  const acc = await elementContract(a, "A-03-v1", signer, reg);
  await logTx(await acc.setAccredited(subject, true), `accredited.setAccredited(${subject}, true)`);
  // sanctions clear
  const san = await elementContract(a, "A-01-v1", signer, reg);
  await logTx(await san.setBlocked(subject, false), `sanctions.setBlocked(${subject}, false)`);

  // C-01 Rule 144 lockup: seed the acquisition-time source at t=1 so the (already
  // elapsed) lockup window passes, mirroring DeployStack's investor seed.
  const lockupAddr = await elementRegistry(a, reg).elementOf(encodeBytes32String("C-01-v1"));
  const acqAddr = await new Contract(lockupAddr, LOCKUP_ABI, reg).acquisitionSource();
  const acq = new Contract(acqAddr, ACQ_SOURCE_ABI, signer);
  await logTx(await acq.setAcquiredAt(subject, a.rwaToken, 1), `lockup.acquisitionSource.setAcquiredAt(${subject}, rwa, 1)`);

  // fund the buyer with QUOTE so it can trade (MockERC20.mint is permissionless).
  const fund = parseEther(opts.fund ?? "5000");
  await logTx(await erc20(a.quote, signer).mint(subject, fund), `quote.mint(${subject}, ${formatEther(fund)})`);
  console.log("Investor attestations applied. Run `corner-store kyc <addr>` to add the ERC-3643 identity/claim.");
}

// ---------------------------------------------------------------------------
// kyc <addr> — shells out to the forge script (ERC-3643 identity + claim)
// ---------------------------------------------------------------------------
export async function cmdKyc(subject: string, opts: GlobalOpts): Promise<void> {
  const artifactPath = resolveArtifactPath(opts.artifact);
  const rpc = opts.rpc ?? DEFAULT_RPC;
  // Run forge from the repo root so relative fs_permissions + the source path
  // resolve; pass the artifact as a root-relative path.
  const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (!repoRoot) throw new CliError("could not locate the repo root (foundry.toml) to run the forge KYC script");
  const relArtifact = relative(repoRoot, artifactPath);
  console.log(`Deploying ERC-3643 identity + KYC claim for ${subject} via forge script (cwd=${repoRoot})`);
  const env = {...process.env, SUBJECT: subject, ARTIFACT: relArtifact};
  try {
    const out = execFileSync(
      "forge",
      ["script", "script/KycInvestor.s.sol:KycInvestor", "--rpc-url", rpc, "--broadcast", "--offline"],
      {env, encoding: "utf8", cwd: repoRoot}
    );
    console.log(out.trim());
  } catch (e: any) {
    throw new CliError(`forge KycInvestor script failed:\n${e.stdout ?? ""}${e.stderr ?? e.message}`);
  }
  console.log(`KYC complete for ${subject}`);
}

// ---------------------------------------------------------------------------
// buy <amountIn> [--venue amm|rfq] [--min <amountOut>] [--quote <file>]
// ---------------------------------------------------------------------------
export async function cmdBuy(
  amountInArg: string,
  opts: GlobalOpts & {venue?: string; min?: string; quote?: string}
): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 1); // buyer/taker
  const buyer = await signer.getAddress();
  const venue = (opts.venue ?? "amm").toLowerCase();
  const nonce = BigInt(Date.now());
  const rwaBefore = await erc20(a.rwaToken, provider).balanceOf(buyer);

  let ctx: any[];
  let venueData: string;
  let amountOutMin: bigint;
  let adapterForApproval: string;
  let amountIn: bigint;

  if (venue === "rfq") {
    if (!opts.quote) throw new CliError("--quote <file> is required for --venue rfq");
    const qf = readQuoteFile(opts.quote);
    const q = qf.quote;
    amountIn = BigInt(q.amountIn);
    const amountOut = BigInt(q.amountOut);
    if (q.taker.toLowerCase() !== buyer.toLowerCase()) {
      throw new CliError(`quote taker ${q.taker} != signer ${buyer}; run buy as the quote's taker (--account/--key)`);
    }
    amountOutMin = opts.min ? parseEther(opts.min) : amountOut;
    ctx = [buyer, buyer, q.maker, q.tokenIn, q.tokenOut, amountIn, amountOut, 2, q.venue, 0, false];
    venueData = encodeVenueData(q, qf.signature);
    adapterForApproval = a.rfqAdapter;
  } else if (venue === "amm") {
    amountIn = parseEther(amountInArg);
    const amountOut = amountIn; // 1:1 MockPool
    amountOutMin = opts.min ? parseEther(opts.min) : 0n;
    ctx = [buyer, buyer, a.pool, a.quote, a.rwaToken, amountIn, amountOut, 0, a.pool, 0, false];
    venueData = "0x";
    adapterForApproval = a.ammAdapter;
  } else {
    throw new CliError(`unknown venue "${venue}" (amm|rfq)`);
  }

  // ensure the buyer has approved the adapter to pull QUOTE (tokenIn).
  const quoteToken = erc20(a.quote, signer);
  const allowance: bigint = await quoteToken.allowance(buyer, adapterForApproval);
  if (allowance < amountIn) {
    console.log(`  approving ${adapterForApproval} to spend QUOTE`);
    await logTx(await quoteToken.approve(adapterForApproval, (1n << 256n) - 1n), "approve");
  }

  const req = [ctx, amountOutMin, BigInt(Math.floor(Date.now() / 1000) + 3600), nonce, venueData];
  console.log(`Executing ${venue.toUpperCase()} buy: amountIn=${formatEther(amountIn)} as ${buyer}`);
  await logTx(await router(a, signer).execute(req), "execute");

  const rwaAfter = await erc20(a.rwaToken, provider).balanceOf(buyer);
  console.log(`  RWA balance delta: +${formatEther(rwaAfter - rwaBefore)}`);
}

// ---------------------------------------------------------------------------
// rfq-quote --maker-account N --amount-in X --amount-out Y [--expiry sec] [--out file]
// ---------------------------------------------------------------------------
export async function cmdRfqQuote(opts: GlobalOpts & {
  makerAccount?: string;
  amountIn?: string;
  amountOut?: string;
  expiry?: string;
  taker?: string;
  out?: string;
}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  if (opts.makerAccount === undefined) throw new CliError("--maker-account <0-9> is required");
  if (!opts.amountIn || !opts.amountOut) throw new CliError("--amount-in and --amount-out are required");
  const maker = walletForAccount(Number(opts.makerAccount)).connect(provider);
  const taker = opts.taker ?? a.investor;
  const ttl = opts.expiry ? Number(opts.expiry) : 3600;

  const service = new RFQQuoteService(
    {chainId: DEFAULT_CHAIN_ID, verifyingContract: a.rfqAdapter as `0x${string}`, defaultTtlSeconds: ttl},
    new WalletTypedDataSigner(maker)
  );
  const signed = await service.createSignedQuote({
    maker: (await maker.getAddress()) as `0x${string}`,
    taker: taker as `0x${string}`,
    tokenIn: a.quote as `0x${string}`,
    tokenOut: a.rwaToken as `0x${string}`,
    amountIn: parseEther(opts.amountIn).toString(),
    amountOut: parseEther(opts.amountOut).toString(),
    venue: a.rfqVenue as `0x${string}`,
    ttlSeconds: ttl
  });

  const out = opts.out ?? "quote.json";
  writeQuoteFile(out, signed);
  console.log(`Signed RFQ quote written to ${out}`);
  console.log(`  maker=${signed.quote.maker} taker=${signed.quote.taker}`);
  console.log(`  amountIn=${formatEther(signed.quote.amountIn)} amountOut=${formatEther(signed.quote.amountOut)} nonce=${signed.quote.nonce} expiry=${signed.quote.expiry}`);
}

// ---------------------------------------------------------------------------
// rfq-cancel <nonce> --maker-account N
// ---------------------------------------------------------------------------
export async function cmdRfqCancel(nonce: string, opts: GlobalOpts & {makerAccount?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  if (opts.makerAccount === undefined) throw new CliError("--maker-account <0-9> is required");
  const maker = walletForAccount(Number(opts.makerAccount)).connect(provider);
  await logTx(await rfqAdapter(a, maker).cancelQuoteNonce(BigInt(nonce)), `cancelQuoteNonce(${nonce})`);
  console.log(`Cancelled RFQ nonce ${nonce} for maker ${await maker.getAddress()}`);
}

// ---------------------------------------------------------------------------
// maker <approve|revoke> <addr>
// ---------------------------------------------------------------------------
export async function cmdMaker(action: string, addr: string, opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  let approved: boolean;
  if (action === "approve") approved = true;
  else if (action === "revoke") approved = false;
  else throw new CliError(`unknown maker action "${action}" (approve|revoke)`);
  await logTx(await rfqAdapter(a, signer).setMakerApproved(addr, approved), `setMakerApproved(${addr}, ${approved})`);
}

// ---------------------------------------------------------------------------
// reason <bytes32>
// ---------------------------------------------------------------------------
export function cmdReason(code: string, opts: {json?: boolean}): void {
  const decoded = decodeReason(code);
  if (opts.json) {
    console.log(JSON.stringify(decoded, null, 2));
    if (decoded.label === "unknown code") process.exitCode = 1;
    return;
  }
  console.log(`${decoded.code}`);
  console.log(`  -> ${decoded.label}`);
  if (decoded.label === "unknown code") process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// check <buyer> [--venue amm|rfq] [--amount <n>] [--json]
// ---------------------------------------------------------------------------
// Elements whose check() ignores its `user` argument and gates purely on the
// asset (see src/compliance/elements/{AssetClassification,Erc3643Native,
// FormDFiling}.sol). Labelled asset-side so a per-buyer FAIL isn't misread.
const ASSET_SIDE_ELEMENTS = new Set(["B-01-v1", "B-02-v1", "E-01-v1"]);

export async function cmdCheck(
  buyer: string,
  opts: GlobalOpts & {venue?: string; amount?: string; json?: boolean}
): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const venue = (opts.venue ?? "amm").toLowerCase();
  if (venue !== "amm" && venue !== "rfq") throw new CliError(`unknown venue "${venue}" (amm|rfq)`);
  const amount = parseEther(opts.amount ?? "1");
  const seller = a.pool; // buy direction: the RWA counterparty is the AMM pool
  const venueType = venue === "rfq" ? 2 : 0;
  const venueAddr = venue === "rfq" ? a.rfqVenue : a.pool;

  // Buy-direction context: tokenIn=QUOTE, tokenOut=RWA. The engine screens
  // ctx.buyer for investor elements (documented non-direction-aware limitation).
  const ctx = [buyer, buyer, seller, a.quote, a.rwaToken, amount, amount, venueType, venueAddr, 0, false];

  // Active manifest's recipe ids -> requiredElements -> element addresses.
  const manifest = await policyRegistry(a, provider).manifestOf(a.rwaToken);
  const status = Number(manifest.status);
  const recipeIds: number[] = [];
  for (const rid of [Number(manifest.issuanceRecipeId), Number(manifest.fundRecipeId)]) {
    if (rid !== 0 && !recipeIds.includes(rid)) recipeIds.push(rid);
  }

  const reg = elementRegistry(a, provider);
  const recipeReg = recipeRegistry(a, provider);
  const seen = new Set<string>();
  const rows: Array<{
    id: string;
    label: string;
    assetSide: boolean;
    recipeId: number;
    passed: boolean;
    reason?: string;
  }> = [];
  for (const rid of recipeIds) {
    const recipeAddr = await recipeReg.recipeOf(rid);
    if (recipeAddr === ZERO_ADDR) throw new CliError(`recipe ${rid} not registered in RecipeRegistry`);
    const requiredIds: string[] = await new Contract(recipeAddr, RECIPE_ABI, provider).requiredElements();
    for (const raw of requiredIds) {
      const idStr = decodeBytes32String(raw);
      if (seen.has(idStr)) continue;
      seen.add(idStr);
      const label = ELEMENT_LABELS[idStr] ?? "?";
      const assetSide = ASSET_SIDE_ELEMENTS.has(idStr);
      const elAddr = await reg.elementOf(raw);
      if (elAddr === ZERO_ADDR) {
        rows.push({id: idStr, label, assetSide, recipeId: rid, passed: false, reason: "element not registered"});
        continue;
      }
      try {
        const [passed] = await new Contract(elAddr, ELEMENT_ABI, provider).check(buyer, seller, a.rwaToken, amount, "0x");
        // The recipe-aware reason the engine would report for THIS element.
        const reason = passed ? undefined : decodeReason(encodeReason(rid, idStr, 1)).label;
        rows.push({id: idStr, label, assetSide, recipeId: rid, passed, reason});
      } catch (e: any) {
        rows.push({
          id: idStr,
          label,
          assetSide,
          recipeId: rid,
          passed: false,
          reason: `check reverted: ${e?.shortMessage ?? e?.message ?? e}`
        });
      }
    }
  }

  // Overall verdict from the engine's view evaluate over the full context.
  const decision = await engine(a, provider).evaluate(ctx);
  const allowed: boolean = decision.allowed;
  const verdictReason = allowed ? undefined : decodeReason(String(decision.reasonCode)).label;

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          buyer,
          venue,
          amount: formatEther(amount),
          seller,
          manifest: {status, statusName: POLICY_STATUS[status] ?? "?"},
          recipes: recipeIds.map((r) => ({id: r, name: RECIPE_LABELS[r] ?? "?"})),
          elements: rows,
          verdict: {allowed, reasonCode: String(decision.reasonCode), reason: verdictReason}
        },
        null,
        2
      )
    );
    if (!allowed) process.exitCode = 1;
    return;
  }

  console.log(`Preflight for ${buyer}`);
  console.log(`  venue=${venue}  amount=${formatEther(amount)}  seller/counterparty=${seller}`);
  console.log(
    `  manifest status ${status} (${POLICY_STATUS[status] ?? "?"}); recipes: ${
      recipeIds.map((r) => `${r} (${RECIPE_LABELS[r] ?? "?"})`).join(", ") || "none"
    }`
  );
  console.log("");
  console.log("Per-element checks (asset-side rows gate on the asset, not the subject — a FAIL there is asset state):");
  for (const r of rows) {
    const tag = r.assetSide ? "  [asset-side]" : "";
    const reason = r.passed ? "" : `  -> ${r.reason}`;
    console.log(`  [${r.passed ? "PASS" : "FAIL"}] ${r.id.padEnd(8)} ${r.label.padEnd(22)}${tag}${reason}`);
  }
  console.log("");
  if (allowed) {
    console.log("Engine verdict: ALLOWED");
  } else {
    console.log(`Engine verdict: REJECTED  ${String(decision.reasonCode)}  -> ${verdictReason}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// sell <amountIn> [--min <amountOut>]
// ---------------------------------------------------------------------------
export async function cmdSell(amountInArg: string, opts: GlobalOpts & {min?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 1); // seller defaults to the investor
  const seller = await signer.getAddress();
  const nonce = BigInt(Date.now());

  const amountIn = parseEther(amountInArg);
  const amountOut = amountIn; // 1:1 MockPool
  const amountOutMin = opts.min ? parseEther(opts.min) : 0n;

  // SELL direction — mirror of `buy` with the token sides swapped, following
  // test/integration/SwapFlow.t.sol::test_sell_shaped_success: tokenIn=RWA,
  // tokenOut=QUOTE; ctx.buyer is the SELLER (the engine screens ctx.buyer, not a
  // direction); venueData encodes zeroForOne=false so the pool pays token0(QUOTE).
  const ctx = [seller, seller, a.pool, a.rwaToken, a.quote, amountIn, amountOut, 0, a.pool, 0, false];
  const venueData = AbiCoder.defaultAbiCoder().encode(["bool", "uint160"], [false, 0]);

  // The seller must approve the adapter to pull RWA (tokenIn).
  const rwa = erc20(a.rwaToken, signer);
  const allowance: bigint = await rwa.allowance(seller, a.ammAdapter);
  if (allowance < amountIn) {
    console.log(`  approving ${a.ammAdapter} to spend RWA`);
    await logTx(await rwa.approve(a.ammAdapter, (1n << 256n) - 1n), "approve");
  }

  const rwaBefore = await erc20(a.rwaToken, provider).balanceOf(seller);
  const quoteBefore = await erc20(a.quote, provider).balanceOf(seller);
  const req = [ctx, amountOutMin, BigInt(Math.floor(Date.now() / 1000) + 3600), nonce, venueData];
  console.log(`Executing AMM sell: amountIn=${formatEther(amountIn)} RWA as ${seller}`);
  await logTx(await router(a, signer).execute(req), "execute");

  const rwaAfter = await erc20(a.rwaToken, provider).balanceOf(seller);
  const quoteAfter = await erc20(a.quote, provider).balanceOf(seller);
  console.log(`  RWA balance delta:   ${formatEther(rwaAfter - rwaBefore)}`);
  console.log(`  QUOTE balance delta: +${formatEther(quoteAfter - quoteBefore)}`);
}

// ---------------------------------------------------------------------------
// balances [addr...]
// ---------------------------------------------------------------------------
const ROLE_LABELS = ["deployer/operator", "investor", "maker", "unapproved-maker", "free"];

export async function cmdBalances(addrs: string[], opts: GlobalOpts & {json?: boolean}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const targets: Array<{label: string; address: string}> =
    addrs.length > 0
      ? addrs.map((x) => ({label: "-", address: x}))
      : ROLE_LABELS.map((label, i) => ({label, address: walletForAccount(i).address}));

  const rwa = erc20(a.rwaToken, provider);
  const quote = erc20(a.quote, provider);
  const rows: Array<{
    label: string;
    address: string;
    rwa: bigint;
    quote: bigint;
    rwaAmm: bigint;
    quoteAmm: bigint;
    rwaRfq: bigint;
    quoteRfq: bigint;
  }> = [];
  for (const t of targets) {
    const [rwaBal, quoteBal, rwaAmm, quoteAmm, rwaRfq, quoteRfq] = await Promise.all([
      rwa.balanceOf(t.address),
      quote.balanceOf(t.address),
      rwa.allowance(t.address, a.ammAdapter),
      quote.allowance(t.address, a.ammAdapter),
      rwa.allowance(t.address, a.rfqAdapter),
      quote.allowance(t.address, a.rfqAdapter)
    ]);
    rows.push({...t, rwa: rwaBal, quote: quoteBal, rwaAmm, quoteAmm, rwaRfq, quoteRfq});
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          label: r.label,
          address: r.address,
          rwa: formatEther(r.rwa),
          quote: formatEther(r.quote),
          allowances: {
            ammAdapter: {rwa: formatEther(r.rwaAmm), quote: formatEther(r.quoteAmm)},
            rfqAdapter: {rwa: formatEther(r.rwaRfq), quote: formatEther(r.quoteRfq)}
          }
        })),
        null,
        2
      )
    );
    return;
  }

  const fmtAllow = (v: bigint) => (v >= 1n << 255n ? "MAX" : formatEther(v));
  console.log("Balances (RWA / QUOTE) and adapter allowances — ether units, MAX = unlimited:");
  console.log(
    `  ${"account".padEnd(18)} ${"address".padEnd(42)} ${"RWA".padStart(12)} ${"QUOTE".padStart(12)}  amm(rwa/quote)  rfq(rwa/quote)`
  );
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(18)} ${r.address} ${formatEther(r.rwa).padStart(12)} ${formatEther(r.quote).padStart(12)}  ` +
        `${fmtAllow(r.rwaAmm)}/${fmtAllow(r.quoteAmm)}  ${fmtAllow(r.rwaRfq)}/${fmtAllow(r.quoteRfq)}`
    );
  }
}

// ---------------------------------------------------------------------------
// faucet <addr> <amount> — mint QUOTE (MockERC20.mint is permissionless).
// ---------------------------------------------------------------------------
export async function cmdFaucet(addr: string, amount: string, opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0);
  const amt = parseEther(amount);
  await logTx(await erc20(a.quote, signer).mint(addr, amt), `quote.mint(${addr}, ${formatEther(amt)})`);
  const bal = await erc20(a.quote, provider).balanceOf(addr);
  console.log(`  ${addr} QUOTE balance: ${formatEther(bal)}`);
}
