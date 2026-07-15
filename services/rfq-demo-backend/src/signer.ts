import {Signer} from "ethers";

import {Hex, RFQTypedData, TypedDataSigner} from "../../rfq/src";

export class EthersTypedDataSigner implements TypedDataSigner {
  constructor(private readonly signer: Pick<Signer, "signTypedData">) {}

  async signTypedData(typedData: RFQTypedData): Promise<Hex> {
    return (await this.signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    )) as Hex;
  }
}
