import { Signer } from '@ethersproject/abstract-signer'
import { BigNumber } from '@ethersproject/bignumber'
import { migrate } from './migrate'
import { UPSTREAM_MIGRATION_STEPS } from './deployment-steps'
import { MigrationState, StepOutput } from './migrations'

export default function deploy({
  signer,
  gasPrice: numberGasPrice,
  initialState,
  onStateChange,
  weth9Address,
  nativeCurrencyLabelBytes,
  v2CoreFactoryAddress,
  ownerAddress,
}: {
  signer: Signer
  gasPrice: number | undefined
  weth9Address: string
  nativeCurrencyLabelBytes: string
  v2CoreFactoryAddress: string
  ownerAddress: string
  initialState: MigrationState
  onStateChange: (newState: MigrationState) => Promise<void>
}): AsyncGenerator<StepOutput[], void, void> {
  const gasPrice =
    typeof numberGasPrice === 'number' ? BigNumber.from(numberGasPrice).mul(BigNumber.from(10).pow(9)) : undefined // convert to wei

  return migrate({
    steps: UPSTREAM_MIGRATION_STEPS,
    config: { gasPrice, signer, weth9Address, nativeCurrencyLabelBytes, v2CoreFactoryAddress, ownerAddress },
    initialState,
    onStateChange,
  })
}
