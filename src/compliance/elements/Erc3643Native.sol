// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {Governed} from "../../auth/Governed.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev Element-local minimal views over the ERC-3643 (T-REX) token surface and
///      its wired components. Repo precedent (HolderCount, IdentityUniqueness)
///      prefers element-local interface declarations to importing the heavyweight
///      vendored `lib/ERC-3643` interfaces (IToken pulls in IIdentityRegistry,
///      IModularCompliance, IERC20 ...). Only the probe functions B-02 calls are
///      declared here. `identityRegistry()`/`compliance()` are typed to return
///      `address` (ABI-compatible with the real IIdentityRegistry/IModularCompliance
///      returns) so no vendored types are needed.
interface IErc3643TokenProbe {
    function identityRegistry() external view returns (address);
    function compliance() external view returns (address);
    function paused() external view returns (bool);
    function isFrozen(address userAddress) external view returns (bool);
    function getFrozenTokens(address userAddress) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IIdentityRegistryProbe {
    function isVerified(address userAddress) external view returns (bool);
}

interface IComplianceProbe {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
}

/// @dev B-02-v1 Token Standard Conformance (mock, ASSET-side). Confirms that the
///      trade's target token is a genuine ERC-3643 (T-REX) machine, wired as
///      registered, and currently alive enough to permit this transfer. B-02 does
///      NOT judge party eligibility (A-03/A-13/A-04 do); its gate ⑤ probe merely
///      pre-asks the issuer-side machine its own answer (doc §1, §3.4).
///
///      TWO REGIMES:
///        (1) Declaration-only (legacy, default). The operator attestation
///            `erc3643Native[asset]` stands in for listing-review gate ① (doc
///            §5.4). An attested asset with NO wiring registered PASSes on the
///            declaration alone — exact legacy behavior. An unattested asset fails
///            closed with code 1.
///        (2) Live-wiring (OPT-IN, per asset). Once `registerWiring` seals the
///            component addresses + implementation codehash, `check` runs doc
///            §5.4 gates ②–⑤ against the REAL token via view staticcalls (legal
///            from a view check). `clearWiring` returns the asset to regime (1).
///
///      All external probes are wrapped in try/catch: any revert / nonconforming
///      target => code 1 (TOKEN_STANDARD_MISMATCH, fail-closed — doc §3.1). EOA /
///      undeployed targets are caught up-front by `asset.code.length == 0 => 1`.
///
///      check(user=buyer, counterparty=seller, asset, amount): the engine passes
///      buyer as `user`, seller as `counterparty` (ComplianceEngine.sol:202). The
///      doc pseudocode's transfer `from` is the seller, `to` is the buyer.
///
///      reasonCode table (n -> doc §6.1 failure-code name):
///        1  TOKEN_STANDARD_MISMATCH   declaration != ERC-3643 / no code / any probe revert (fail-closed)
///        2  TOKEN_WIRING_DRIFT        IR / MC binding or impl codehash != registered (⚠ security-event grade)
///        3  TOKEN_PAUSED              token globally paused by the issuer
///        4  TOKEN_FROZEN_PARTY        seller or buyer wallet frozen
///        5  TOKEN_INSUFFICIENT_UNFROZEN  seller free balance (balance - frozen) < amount
///        6  TOKEN_TRANSFER_INELIGIBLE unverified buyer OR compliance canTransfer=false (two branches, one code)
///      REJECT_LISTING_NONCONFORMANT (doc §6.1) is the listing-pipeline channel
///      (L1~L4 review), not a per-trade check code — surfaced off-chain, not here.
///
///      Production seam: the declaration check would be ERC-165 introspection /
///      trusted-token registry, and the wiring registered values would live in the
///      B-01 manifest card + governance constants (self-reference guard, doc §3.20).
contract Erc3643Native is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-02-v1";

    /// @notice asset => attested ERC-3643-native (declaration check ①).
    mapping(address => bool) public erc3643Native;

    /// @dev Live-wiring registration for gates ②–⑤. `registered == false` => the
    ///      asset stays in declaration-only regime (legacy behavior).
    struct Wiring {
        bool registered;
        address identityRegistry;
        address compliance;
        bytes32 implCodehash;
    }

    /// @notice asset => registered live-wiring (empty => declaration-only regime).
    mapping(address => Wiring) public wiringOf;

    event Erc3643NativeSet(address indexed asset, bool native_);
    event WiringRegistered(address indexed asset, address identityRegistry, address compliance, bytes32 implCodehash);
    event WiringCleared(address indexed asset);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-02-v1",
                temporal: TemporalNature.ONE_TIME,
                // DETERMINISTIC: both regimes are onchain-decidable — the declaration
                // is the operator stand-in for listing review, the live regime is
                // pure staticcall/compare against onchain state (doc §5.5).
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Attest whether `asset` is an ERC-3643-native (T-REX) token
    ///         (declaration check ①). Legacy setter — signature and effect
    ///         preserved: an attested asset with no wiring PASSes; unattested
    ///         fails closed with code 1.
    function setErc3643Native(address asset, bool native_) external onlyOperator {
        erc3643Native[asset] = native_;
        emit Erc3643NativeSet(asset, native_);
    }

    /// @notice Seal the live-wiring for `asset` (doc §5.4 L5 registered-value
    ///         seal). Enables gates ②–⑤ on `check`. `implCodehash` is the expected
    ///         `asset.codehash`. onlyOperator (governance-driven activation).
    /// @dev The doc's gate ② hashes the implementation-of for proxy tokens; this
    ///      mock hashes the asset address's own code directly (`asset.codehash`) —
    ///      the impl-of-proxy nuance is a documented production seam (doc §5.4, §3.20).
    function registerWiring(address asset, address identityRegistry_, address compliance_, bytes32 implCodehash)
        external
        onlyOperator
    {
        wiringOf[asset] = Wiring({
            registered: true, identityRegistry: identityRegistry_, compliance: compliance_, implCodehash: implCodehash
        });
        emit WiringRegistered(asset, identityRegistry_, compliance_, implCodehash);
    }

    /// @notice Remove the live-wiring for `asset`, returning it to the
    ///         declaration-only regime. onlyOperator.
    function clearWiring(address asset) external onlyOperator {
        delete wiringOf[asset];
        emit WiringCleared(asset);
    }

    /// @dev ASSET-side check. Regime (1): declaration-only — attested PASSes,
    ///      unattested => 1. Regime (2): live-wiring — gates ②–⑤ (doc §5.4).
    ///      user=buyer, counterparty=seller.
    function check(address user, address counterparty, address asset, uint256 amount, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // ① declaration check (legacy): unattested fails closed with code 1.
        if (!erc3643Native[asset]) return (false, _code(1));

        Wiring memory w = wiringOf[asset];
        // No wiring registered => stop after declaration (exact legacy behavior).
        if (!w.registered) return (true, ReasonCodes.OK);

        // Live regime. from (transfer source) = seller = counterparty; to = buyer = user.
        address seller = counterparty;
        address buyer = user;

        // ① code presence (only meaningful under the live regime): an EOA /
        //    undeployed target is a standard mismatch. Also guards the try/catch
        //    below, whose return-data decoding of a no-code target would not be
        //    caught (Solidity try/catch catches reverts, not decode failures).
        if (asset.code.length == 0) return (false, _code(1));

        IErc3643TokenProbe token = IErc3643TokenProbe(asset);

        // ② wiring drift (⚠ security-event grade): IR / MC binding or impl codehash
        //    != registered => 2. Any probe revert => 1 (fail-closed, nonconforming).
        try token.identityRegistry() returns (address ir) {
            if (ir != w.identityRegistry) return (false, _code(2));
        } catch {
            return (false, _code(1));
        }
        try token.compliance() returns (address mc) {
            if (mc != w.compliance) return (false, _code(2));
        } catch {
            return (false, _code(1));
        }
        if (asset.codehash != w.implCodehash) return (false, _code(2));

        // ③ standard state: paused => 3.
        try token.paused() returns (bool isPaused) {
            if (isPaused) return (false, _code(3));
        } catch {
            return (false, _code(1));
        }

        // ④ party freeze: either wallet frozen => 4.
        try token.isFrozen(seller) returns (bool frozenSeller) {
            if (frozenSeller) return (false, _code(4));
        } catch {
            return (false, _code(1));
        }
        try token.isFrozen(buyer) returns (bool frozenBuyer) {
            if (frozenBuyer) return (false, _code(4));
        } catch {
            return (false, _code(1));
        }

        // ④ free balance: (balance - frozen) < amount => 5. INCLUSIVE ≥ passes —
        //    exactly-equal free balance passes (doc §5.3). Skip when amount == 0:
        //    a zero-quantity transfer has nothing to clear.
        if (amount != 0) {
            uint256 bal;
            uint256 frozen;
            try token.balanceOf(seller) returns (uint256 b) {
                bal = b;
            } catch {
                return (false, _code(1));
            }
            try token.getFrozenTokens(seller) returns (uint256 f) {
                frozen = f;
            } catch {
                return (false, _code(1));
            }
            // Saturating subtraction: a conformant token keeps frozen <= balance;
            // a pathological frozen > balance means zero free balance => 5, not an
            // underflow revert.
            uint256 free = bal > frozen ? bal - frozen : 0;
            if (free < amount) return (false, _code(5));
        }

        // ⑤ delegation probe: pre-run the issuer-side gate. Call the REGISTERED
        //    component addresses (gate ② already proved they equal the token's) so
        //    "we only call verified addresses" holds on the code face (doc §5.4).
        //    Two distinct branches, single code 6 — the sub-cause is internal-log
        //    only per doc §6.1.
        try IIdentityRegistryProbe(w.identityRegistry).isVerified(buyer) returns (bool verified) {
            if (!verified) return (false, _code(6)); // sub: RECIPIENT_UNVERIFIED
        } catch {
            return (false, _code(1));
        }
        try IComplianceProbe(w.compliance).canTransfer(seller, buyer, amount) returns (bool ok) {
            if (!ok) return (false, _code(6)); // sub: COMPLIANCE_MODULE
        } catch {
            return (false, _code(1));
        }

        return (true, ReasonCodes.OK);
    }

    /// @dev recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
    function _code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
