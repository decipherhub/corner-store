export const AMM_LOCKUP_INCOMPATIBILITY = "AMM_LOCKUP_RECIPE_UNSUPPORTED";

const LOCKUP_ELEMENT_PREFIX = "0x432d30312d"; // bytes32 ASCII prefix: C-01-

function asciiBytes32(value: string): string {
  if (!/^[\x20-\x7e]{1,32}$/.test(value)) throw new Error(`invalid bytes32 ASCII value ${value}`);
  return `0x${[...value]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .padEnd(64, "0")}`;
}

const REG_D_V3_ELEMENTS = [
  "A-01-v1",
  "A-02-v1",
  "A-03-v1",
  "A-04-v1",
  "A-05-v1",
  "B-01-v1",
  "B-02-v2",
  "C-01-v2",
  "E-01-v1"
].map(asciiBytes32);
const FUND_V2_ELEMENTS = ["A-13-v1", "MIN-AMOUNT-v1"].map(asciiBytes32);

const PROFILE_RECIPES: Record<string, {bindings: RecipeBindingDefinition[]; recipes: RecipeDefinition[]}> = {
  "reg-d": {
    bindings: [{recipeId: 1, recipeVersion: 3}],
    recipes: [{recipeId: 1, version: 3, requiredElements: REG_D_V3_ELEMENTS}]
  },
  "buidl-like": {
    bindings: [{recipeId: 1, recipeVersion: 3}, {recipeId: 3, recipeVersion: 2}],
    recipes: [
      {recipeId: 1, version: 3, requiredElements: REG_D_V3_ELEMENTS},
      {recipeId: 3, version: 2, requiredElements: FUND_V2_ELEMENTS}
    ]
  }
};

interface RecipeDefinition {
  recipeId: number;
  version: number;
  requiredElements?: readonly string[];
}

interface RecipeBindingDefinition {
  recipeId: number;
  recipeVersion: number;
}

export function assertProfileVenueCompatibility(profile: string, ammEnabled: boolean): void {
  const definition = PROFILE_RECIPES[profile];
  if (!definition) throw new Error(`unknown asset profile ${profile}`);
  try {
    assertRecipeVenueCompatibility(ammEnabled, 2, definition.bindings, definition.recipes);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${detail}: asset profile ${profile} must use RFQ or another non-AMM venue`);
  }
}

export function isLockupElementId(elementId: string): boolean {
  return elementId.toLowerCase().startsWith(LOCKUP_ELEMENT_PREFIX);
}

export function assertRecipeVenueCompatibility(
  ammEnabled: boolean,
  schemaVersion: number,
  bindings: readonly RecipeBindingDefinition[],
  recipes: readonly RecipeDefinition[]
): void {
  if (!ammEnabled) return;
  for (const binding of bindings) {
    const recipe = recipes.find(
      (candidate) => candidate.recipeId === binding.recipeId && candidate.version === binding.recipeVersion
    );
    const requiredElements = recipe?.requiredElements;
    if (!requiredElements) {
      throw new Error(
        `${AMM_LOCKUP_INCOMPATIBILITY}: schema ${schemaVersion} recipe ${binding.recipeId} v${binding.recipeVersion} composition cannot be verified`
      );
    }
    if (requiredElements.some(isLockupElementId)) {
      throw new Error(
        `${AMM_LOCKUP_INCOMPATIBILITY}: recipe ${binding.recipeId} v${binding.recipeVersion} contains the C-01 holding-period family and cannot be bound to AMM`
      );
    }
  }
}
