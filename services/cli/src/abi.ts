// Minimal hand-written ABI fragments covering exactly the functions, events, and
// errors the CLI calls. Deliberately NOT coupled to Foundry's out/ artifacts.

// ExecutionRouter.execute takes a nested ExecutionRequest{ComplianceContext,...}.
export const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))",
  "event Executed(bytes32 indexed executionId, address indexed venue, uint256 amountOut)"
];

// ExecutionRouter (and adapters) surface these custom errors on the revert path.
export const ERRORS_ABI = [
  "error ComplianceRejected(bytes32 reasonCode)",
  "error GlobalPaused()",
  "error TokenInPaused()",
  "error TokenOutPaused()",
  "error DeadlineExpired()",
  "error NotAuthorized()",
  "error NonceUsed()",
  "error MaxAmountExceeded()",
  "error InvalidAmountCapToken()",
  "error VenueSuspended()",
  "error VenueNotAllowed()",
  "error AdapterNotRegistered()",
  "error VenueTypeMismatch()",
  "error SlippageExceeded()",
  "error RFQMakerNotApproved()",
  "error RFQQuoteUsed()",
  "error RFQQuoteExpired()",
  "error RFQInvalidSignature()",
  "error RFQQuoteMismatch()",
  "error InvalidRecipeBinding()",
  "error TooManyRecipeBindings(uint256 supplied, uint256 maximum)",
  "error TooManyRecipeElements(uint16 recipeId, uint256 supplied, uint256 maximum)",
  "error DuplicateRecipeBinding(uint16 recipeId)",
  "error RecipeVersionMismatch(uint16 recipeId, uint16 expected, uint16 actual)"
];

export const ELEMENT_REGISTRY_ABI = [
  "function elementOf(bytes32 elementId) view returns (address)"
];

// RecipeRegistry.recipeOf(id) -> recipe address; the recipe exposes its required
// element id list (IRecipe.requiredElements). Used by `check` to enumerate the
// active manifest's per-element preflight set.
export const RECIPE_REGISTRY_ABI = [
  "function recipeOf(uint16 recipeId) view returns (address)"
];
export const RECIPE_ABI = [
  "function version() view returns (uint16)",
  "function isApplicable(bytes context) view returns (bool)",
  "function requiredElements() view returns (bytes32[])"
];

// ComplianceEngine.evaluate(ctx) is a VIEW returning the full ComplianceDecision
// (src/types/ComplianceTypes.sol). `check` calls it for the overall verdict.
export const ENGINE_ABI = [
  "function evaluate(tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) ctx) view returns (tuple(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,address maxAmountToken,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash))"
];

// Event fragments for `watch` (src/libraries/Events.sol + RFQAdapter.sol). Only
// the seven the tail decodes; topic0 hashes are derived from these at runtime.
export const EVENTS_ABI = [
  "event Executed(bytes32 indexed executionId, address indexed venue, uint256 amountOut)",
  "event RFQFilled(bytes32 indexed quoteHash, address indexed maker, address indexed taker, uint256 amountIn, uint256 amountOut)",
  "event RFQQuoteCancelled(address indexed maker, uint256 indexed nonce)",
  "event MakerApprovalSet(address indexed maker, bool approved)",
  "event ManifestRegistered(address indexed token, bytes32 bindingsHash, address declaredBy)",
  "event ManifestStatusChanged(address indexed token, uint8 status, bytes32 reasonCode)",
  "event ComplianceFlags(bytes32 indexed decisionHash, uint256 flagsBitmap)",
  "event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode)"
];

// IComplianceElement.check(user, counterparty, asset, amount, context).
export const ELEMENT_ABI = [
  "function check(address user, address counterparty, address asset, uint256 amount, bytes context) view returns (bool passed, bytes32 reasonCode)"
];

// Per-element setters (write-gated to the operator). Grouped so a single Contract
// instance bound to an element address exposes the right setter.
export const ELEMENT_SETTERS_ABI = [
  "function setBlocked(address user, bool isBlocked)",
  "function setJurisdiction(address investor, bytes32 code)",
  "function setJurisdictionAllowed(bytes32 code, bool allowed)",
  "function setAccredited(address user, bool isAccredited)",
  "function bindIdentity(address wallet, bytes32 identityId)",
  "function setUsTaxResident(address investor, bool isResident)",
  "function setQp(address user, bool isQp)",
  "function setClassification(address asset, bytes32 classification)",
  "function setErc3643Native(address asset, bool native_)",
  "function setFormDFiled(address asset, bool filed, bytes32 ref)"
];

export const TOKEN_POLICY_REGISTRY_ABI = [
  "function statusOf(address token) view returns (uint8)",
  "function manifestOf(address token) view returns (tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy))",
  "function recipeBindingsOf(address token) view returns (tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[])",
  "function suspendManifest(address token, bytes32 reasonCode)",
  "function scheduleManifestResume(address token, bytes32 reasonCode)",
  "function pendingManifestResumeOf(address token) view returns (uint64 effectiveTime,bytes32 reasonCode)",
  "function MIN_MANIFEST_DELAY() view returns (uint64)",
  "function resumeManifest(address token)",
  "function retireManifest(address token, bytes32 reasonCode)"
];

export const FACTORY_ABI = [
  "function registerRWAToken(address token, tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy) manifest, tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[] bindings, address venue, tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active) venueCfg)",
  "function scheduleManifestResume(address token, bytes32 reasonCode)",
  "function cancelManifestResume(address token)",
  "function scheduleManifestUpdate(address token, tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy) manifest, tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[] bindings, bytes32 reasonCode)",
  "function cancelManifestUpdate(address token)",
  "event RWATokenRegistered(address indexed token, address indexed venue)"
];

export const VENUE_REGISTRY_ABI = [
  "function venueOf(address venue) view returns (tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active))"
];

export const RFQ_ADAPTER_ABI = [
  "function approvedMaker(address maker) view returns (bool)",
  "function usedQuoteNonce(address maker, uint256 nonce) view returns (bool)",
  "function setMakerApproved(address maker, bool approved)",
  "function cancelQuoteNonce(uint256 nonce)",
  "function makerAuthorizer() view returns (address)"
];

export const MAKER_AUTHORIZER_ABI = [
  "function authorizerVersion() view returns (uint64)",
  "function isAuthorizedSigner(address maker,bytes32 quoteHash,bytes signature) view returns (bool)"
];

// Lockup (C-01) consumes a provider-neutral operator-attested snapshot.
export const LOCKUP_ABI = ["function acquisitionSource() view returns (address)"];
export const ACQ_SOURCE_ABI = [
  "function setSnapshot(address holder,address asset,uint64 clockStart,uint64 expiresAt,bytes32 sourceRef,uint8 status)"
];

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function symbol() view returns (string)"
];
