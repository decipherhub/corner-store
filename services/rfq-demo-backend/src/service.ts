import {
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  RFQBackendSDK,
  createRFQService
} from "../../rfq/src";
import {JsonRpcProvider} from "ethers";

import {DemoBackendConfig, asAddress} from "./config";
import {EthersTypedDataSigner} from "./signer";

export async function createDemoQuoteService(config: DemoBackendConfig): Promise<RFQBackendSDK> {
  const maker = asAddress(await config.makerWallet.getAddress(), "maker wallet");
  const artifactMaker = asAddress(config.artifact.maker, "artifact maker");
  asAddress(config.artifact.quote, "artifact quote");
  asAddress(config.artifact.rwaToken, "artifact rwaToken");
  asAddress(config.artifact.rfqVenue, "artifact rfqVenue");
  if (maker.toLowerCase() !== artifactMaker.toLowerCase()) {
    throw new Error(`maker wallet ${maker} does not match deployment artifact maker ${artifactMaker}`);
  }
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
  const now = config.now ?? (async () => {
    const block = await provider.getBlock("latest");
    if (!block) throw new Error("cannot read latest block timestamp from RFQ chain RPC");
    return block.timestamp;
  });

  return createRFQService({
    chainId: config.chainId,
    verifyingContract: asAddress(config.artifact.rfqAdapter, "artifact rfqAdapter"),
    maker,
    signer: new EthersTypedDataSigner(config.makerWallet),
    pricing: new FixedRatePricingProvider({
      numerator: config.priceNumerator,
      denominator: config.priceDenominator
    }),
    nonceStore: new InMemoryNonceStore(),
    riskCheck: new NoopInventoryRiskCheck(),
    defaultTtlSeconds: config.defaultTtlSeconds,
    now
  });
}
