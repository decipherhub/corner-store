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
  "error DeadlineExpired()",
  "error NotAuthorized()",
  "error NonceUsed()",
  "error MaxAmountExceeded()",
  "error VenueSuspended()",
  "error VenueNotAllowed()",
  "error AdapterNotRegistered()",
  "error VenueTypeMismatch()",
  "error SlippageExceeded()",
  "error RFQMakerNotApproved()",
  "error RFQQuoteUsed()",
  "error RFQQuoteExpired()",
  "error RFQInvalidSignature()",
  "error RFQQuoteMismatch()"
];

export const ELEMENT_REGISTRY_ABI = [
  "function elementOf(bytes32 elementId) view returns (address)"
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
  "function suspendManifest(address token, bytes32 reasonCode)",
  "function resumeManifest(address token)",
  "function retireManifest(address token, bytes32 reasonCode)"
];

export const FACTORY_ABI = [
  "function registerRWAToken(address token, tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy) manifest, address venue, tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active) venueCfg)",
  "event RWATokenRegistered(address indexed token, address indexed venue)"
];

export const VENUE_REGISTRY_ABI = [
  "function venueOf(address venue) view returns (tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active))"
];

export const RFQ_ADAPTER_ABI = [
  "function approvedMaker(address maker) view returns (bool)",
  "function usedQuoteNonce(address maker, uint256 nonce) view returns (bool)",
  "function setMakerApproved(address maker, bool approved)",
  "function cancelQuoteNonce(uint256 nonce)"
];

// Lockup (C-01) element exposes its injected acquisition-time source; the source
// itself carries the operator-free demo setter used to seed a holder's clock.
export const LOCKUP_ABI = ["function acquisitionSource() view returns (address)"];
export const ACQ_SOURCE_ABI = ["function setAcquiredAt(address holder, address asset, uint64 ts)"];

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function symbol() view returns (string)"
];
