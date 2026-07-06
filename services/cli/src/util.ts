import {Interface} from "ethers";

import {ERRORS_ABI} from "./abi";
import {decodeReason} from "./reason";

const ERR_IFACE = new Interface(ERRORS_ABI);

export interface DecodedRevert {
  name: string; // custom error name, or "revert"/"unknown"
  reason?: string; // decoded ComplianceRejected reason-table match, if applicable
  detail: string; // one-line human summary
}

// Best-effort extraction of raw revert data from an ethers v6 error object.
function revertData(err: any): string | undefined {
  if (typeof err?.data === "string" && err.data.startsWith("0x")) return err.data;
  if (typeof err?.info?.error?.data === "string") return err.info.error.data;
  if (typeof err?.error?.data === "string") return err.error.data;
  return undefined;
}

export function decodeRevert(err: any): DecodedRevert {
  // ethers may already have decoded a named error from the contract interface.
  if (err?.revert?.name) {
    return summarize(err.revert.name, err.revert.args);
  }
  const data = revertData(err);
  if (data && data !== "0x") {
    try {
      const parsed = ERR_IFACE.parseError(data);
      if (parsed) return summarize(parsed.name, parsed.args as unknown as any[]);
    } catch {
      /* fall through */
    }
    return {name: "revert", detail: `reverted with data ${data}`};
  }
  const short = err?.shortMessage ?? err?.reason ?? err?.message ?? String(err);
  return {name: "revert", detail: short};
}

function summarize(name: string, args: any[]): DecodedRevert {
  if (name === "ComplianceRejected") {
    const code = String(args[0]);
    const decoded = decodeReason(code);
    return {
      name,
      reason: decoded.label,
      detail: `ComplianceRejected(${code})  ->  ${decoded.label}`
    };
  }
  return {name, detail: `${name}(${args.map((a) => String(a)).join(", ")})`};
}

// Thrown by commands to signal a clean nonzero exit with a message.
export class CliError extends Error {}

export function short(addr: string): string {
  return addr;
}
