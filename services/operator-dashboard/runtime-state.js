(function exposeRuntimeState(root) {
  function composeDashboardRuntime(baseState, marketHistory, tsvStyle) {
    if (!baseState || typeof baseState !== "object" || baseState.ready !== true) {
      throw new Error("Runtime state is unavailable or not ready");
    }
    if (!baseState.presentation || !Array.isArray(baseState.wallets)) {
      throw new Error("Runtime state is incomplete");
    }
    if (!marketHistory || !Array.isArray(marketHistory.oracle) || !Array.isArray(marketHistory.fills)) {
      throw new Error("Runtime market history is unavailable");
    }
    return {
      chainState: {...baseState, tsvStyle: tsvStyle || {enabled: false, source: "unavailable"}},
      marketHistory
    };
  }

  root.composeDashboardRuntime = composeDashboardRuntime;
  if (typeof module !== "undefined" && module.exports) module.exports = {composeDashboardRuntime};
})(typeof globalThis !== "undefined" ? globalThis : window);
