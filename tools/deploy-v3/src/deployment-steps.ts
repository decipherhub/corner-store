import { MigrationStep } from './migrations'
import { ADD_1BP_FEE_TIER } from './steps/add-1bp-fee-tier'
import { DEPLOY_MULTICALL2 } from './steps/deploy-multicall2'
import { DEPLOY_NFT_DESCRIPTOR_LIBRARY_V1_3_0 } from './steps/deploy-nft-descriptor-library-v1_3_0'
import { DEPLOY_NFT_POSITION_DESCRIPTOR_V1_3_0 } from './steps/deploy-nft-position-descriptor-v1_3_0'
import { DEPLOY_NONFUNGIBLE_POSITION_MANAGER } from './steps/deploy-nonfungible-position-manager'
import { DEPLOY_PROXY_ADMIN } from './steps/deploy-proxy-admin'
import { DEPLOY_QUOTER_V2 } from './steps/deploy-quoter-v2'
import { DEPLOY_TICK_LENS } from './steps/deploy-tick-lens'
import { DEPLOY_TRANSPARENT_PROXY_DESCRIPTOR } from './steps/deploy-transparent-proxy-descriptor'
import { DEPLOY_V3_CORE_FACTORY } from './steps/deploy-v3-core-factory'
import { DEPLOY_V3_MIGRATOR } from './steps/deploy-v3-migrator'
import { DEPLOY_V3_STAKER } from './steps/deploy-v3-staker'
import { DEPLOY_V3_SWAP_ROUTER_02 } from './steps/deploy-v3-swap-router-02'
import { TRANSFER_PROXY_ADMIN } from './steps/transfer-proxy-admin'
import { TRANSFER_V3_CORE_FACTORY_OWNER } from './steps/transfer-v3-core-factory-owner'

export const CORNER_STORE_MIGRATION_STEPS: MigrationStep[] = [
  // Must come first because dependent contracts use the factory address.
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
]

export const UPSTREAM_MIGRATION_STEPS: MigrationStep[] = [
  // Preserve the upstream deployment order.
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
]
