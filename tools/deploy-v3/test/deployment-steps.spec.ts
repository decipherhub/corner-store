import { expect } from 'chai'
import { CORNER_STORE_MIGRATION_STEPS, UPSTREAM_MIGRATION_STEPS } from '../src/deployment-steps'
import { ADD_1BP_FEE_TIER } from '../src/steps/add-1bp-fee-tier'
import { DEPLOY_MULTICALL2 } from '../src/steps/deploy-multicall2'
import { DEPLOY_NFT_DESCRIPTOR_LIBRARY_V1_3_0 } from '../src/steps/deploy-nft-descriptor-library-v1_3_0'
import { DEPLOY_NFT_POSITION_DESCRIPTOR_V1_3_0 } from '../src/steps/deploy-nft-position-descriptor-v1_3_0'
import { DEPLOY_NONFUNGIBLE_POSITION_MANAGER } from '../src/steps/deploy-nonfungible-position-manager'
import { DEPLOY_PROXY_ADMIN } from '../src/steps/deploy-proxy-admin'
import { DEPLOY_QUOTER_V2 } from '../src/steps/deploy-quoter-v2'
import { DEPLOY_TICK_LENS } from '../src/steps/deploy-tick-lens'
import { DEPLOY_TRANSPARENT_PROXY_DESCRIPTOR } from '../src/steps/deploy-transparent-proxy-descriptor'
import { DEPLOY_V3_CORE_FACTORY } from '../src/steps/deploy-v3-core-factory'
import { DEPLOY_V3_MIGRATOR } from '../src/steps/deploy-v3-migrator'
import { DEPLOY_V3_STAKER } from '../src/steps/deploy-v3-staker'
import { DEPLOY_V3_SWAP_ROUTER_02 } from '../src/steps/deploy-v3-swap-router-02'
import { TRANSFER_PROXY_ADMIN } from '../src/steps/transfer-proxy-admin'
import { TRANSFER_V3_CORE_FACTORY_OWNER } from '../src/steps/transfer-v3-core-factory-owner'

describe('deployment steps', () => {
  it('defines the Corner Store deployment steps in dependency order', () => {
    expect(CORNER_STORE_MIGRATION_STEPS).to.deep.equal([
      DEPLOY_V3_CORE_FACTORY,
      DEPLOY_MULTICALL2,
      DEPLOY_PROXY_ADMIN,
      DEPLOY_TICK_LENS,
      DEPLOY_NFT_DESCRIPTOR_LIBRARY_V1_3_0,
      DEPLOY_NFT_POSITION_DESCRIPTOR_V1_3_0,
      DEPLOY_TRANSPARENT_PROXY_DESCRIPTOR,
      DEPLOY_NONFUNGIBLE_POSITION_MANAGER,
      DEPLOY_QUOTER_V2,
      TRANSFER_V3_CORE_FACTORY_OWNER,
      TRANSFER_PROXY_ADMIN,
    ])
  })

  it('excludes upstream-only steps from the Corner Store deployment steps', () => {
    expect(CORNER_STORE_MIGRATION_STEPS).not.to.include(ADD_1BP_FEE_TIER)
    expect(CORNER_STORE_MIGRATION_STEPS).not.to.include(DEPLOY_V3_MIGRATOR)
    expect(CORNER_STORE_MIGRATION_STEPS).not.to.include(DEPLOY_V3_STAKER)
    expect(CORNER_STORE_MIGRATION_STEPS).not.to.include(DEPLOY_V3_SWAP_ROUTER_02)
  })

  it('preserves the upstream deployment scope and order', () => {
    expect(UPSTREAM_MIGRATION_STEPS).to.deep.equal([
      DEPLOY_V3_CORE_FACTORY,
      ADD_1BP_FEE_TIER,
      DEPLOY_MULTICALL2,
      DEPLOY_PROXY_ADMIN,
      DEPLOY_TICK_LENS,
      DEPLOY_NFT_DESCRIPTOR_LIBRARY_V1_3_0,
      DEPLOY_NFT_POSITION_DESCRIPTOR_V1_3_0,
      DEPLOY_TRANSPARENT_PROXY_DESCRIPTOR,
      DEPLOY_NONFUNGIBLE_POSITION_MANAGER,
      DEPLOY_V3_MIGRATOR,
      TRANSFER_V3_CORE_FACTORY_OWNER,
      DEPLOY_V3_STAKER,
      DEPLOY_QUOTER_V2,
      DEPLOY_V3_SWAP_ROUTER_02,
      TRANSFER_PROXY_ADMIN,
    ])
  })
})
