(function expose(factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.PortalModel = api;
})(function createModel() {
  const MIN_ORDER = 50;
  const issuerQuestions = ["offering", "fund", "investor", "holding", "distribution"];
  const catalog = {
    KTB: { symbol: "KTB", name: "국고채 토큰", unitPrice: 20000, eligible: true, minimum: "10개", minimumQuantity: 10 },
    MMF: { symbol: "MMF", name: "MMF 토큰", unitPrice: 10000, eligible: true, minimum: "10개", minimumQuantity: 10 },
    KLMS: { symbol: "KLMS", name: "KLM 주식", unitPrice: 42000, eligible: false, requirements: 2, minimum: "20개", minimumQuantity: 20 },
    ABCF: { symbol: "ABCF", name: "ABC 사모 펀드 토큰", unitPrice: 100000, eligible: false, requirements: 4, minimum: "50개", minimumQuantity: 50 }
  };
  const seedTransactions = [
    { id: "TX-KTB-0901", symbol: "KTB", side: "BUY", quantity: 400, unitPrice: 20000, fee: 8000, total: 8008000, completedAt: "2026-09-01T10:14:00+09:00", status: "COMPLETED", source: "seed" },
    { id: "TX-MMF-0828", symbol: "MMF", side: "BUY", quantity: 840, unitPrice: 10000, fee: 8400, total: 8408400, completedAt: "2026-08-28T15:32:00+09:00", status: "COMPLETED", source: "seed" }
  ];

  function cloneTransactions(rows) {
    return rows.map((row) => ({ ...row }));
  }

  function initialState() {
    return {
      schemaVersion: 6,
      investorQualified: false,
      qualifiedAssets: { KTB: true, MMF: true, KLMS: false, ABCF: false },
      selectedAsset: "ABCF",
      walletConnected: true,
      walletProvider: "MetaMask",
      qualificationChecks: [true, true, true, false],
      provider: null,
      certificationFile: null,
      certificationUploadProgress: 0,
      orderAmount: 20,
      postTrade: false,
      holdings: { KTB: 1200, MMF: 840, KLMS: 0, ABCF: 0 },
      transactions: cloneTransactions(seedTransactions),
      pendingOrder: null,
      nextTradeSequence: 1842,
      assetPaused: false,
      pauseReason: null,
      pauseUpdatedAt: null,
      operationLog: [
        { id: "OP-ACTIVE-0904", action: "RESUME", reason: "거래 시작", at: "2026-09-04T17:02:00+09:00" }
      ],
      issuerAssetListed: false,
      issuerForm: {
        name: "ABC 사모 펀드 토큰",
        symbol: "ABCF",
        supply: "1000000",
        minimum: "50",
        contract: "0x7c41...a9e2",
        chain: "Ethereum"
      },
      issuerAnswers: {},
      evidence: {
        qualified: true,
        highValue: true,
        acquisition: false,
        holders: true,
        related: false,
        sanctions: true,
        distribution: true
      }
    };
  }

  function nonNegativeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
  }

  function normalizeTransactions(value) {
    if (!Array.isArray(value)) return cloneTransactions(seedTransactions);
    const seen = new Set();
    return value.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const symbol = String(row.symbol || "").toUpperCase();
      const id = String(row.id || "").slice(0, 64);
      if (!catalog[symbol] || !id || seen.has(id)) return [];
      const quantity = nonNegativeInteger(row.quantity);
      const unitPrice = nonNegativeInteger(row.unitPrice, catalog[symbol].unitPrice);
      const fee = nonNegativeInteger(row.fee);
      const total = nonNegativeInteger(row.total, quantity * unitPrice + fee);
      const completedAt = Number.isNaN(Date.parse(row.completedAt))
        ? "2026-09-05T00:00:00+09:00"
        : String(row.completedAt);
      seen.add(id);
      return [{
        id,
        symbol,
        side: "BUY",
        quantity,
        unitPrice,
        fee,
        total,
        completedAt,
        status: "COMPLETED",
        source: row.source === "demo" ? "demo" : "seed",
        sequence: nonNegativeInteger(row.sequence) || null,
        transactionHash: row.transactionHash ? String(row.transactionHash).slice(0, 66) : null
      }];
    });
  }

  function normalizePendingOrder(value) {
    if (!value || typeof value !== "object") return null;
    const symbol = catalog[String(value.symbol || "ABCF").toUpperCase()] ? String(value.symbol || "ABCF").toUpperCase() : "ABCF";
    const quantity = nonNegativeInteger(value.quantity);
    const sequence = nonNegativeInteger(value.sequence);
    const id = String(value.id || "").slice(0, 64);
    if (!id || !sequence || quantity < catalog[symbol].minimumQuantity) return null;
    const unitPrice = catalog[symbol].unitPrice;
    const fee = Math.round(quantity * unitPrice * 0.001);
    return {
      id,
      sequence,
      symbol,
      side: "BUY",
      quantity,
      unitPrice,
      fee,
      total: quantity * unitPrice + fee,
      createdAt: Number.isNaN(Date.parse(value.createdAt)) ? new Date(0).toISOString() : String(value.createdAt),
      transactionHash: String(value.transactionHash || `0x9b2c7d${String(sequence).slice(-2)}`).slice(0, 66)
    };
  }

  function normalizeOperationLog(value) {
    if (!Array.isArray(value)) return initialState().operationLog;
    return value.slice(0, 20).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const action = entry.action === "PAUSE" ? "PAUSE" : entry.action === "RESUME" ? "RESUME" : null;
      const id = String(entry.id || "").slice(0, 64);
      if (!action || !id) return [];
      return [{
        id,
        action,
        reason: String(entry.reason || (action === "PAUSE" ? "운영 점검" : "거래 재개")).slice(0, 80),
        at: Number.isNaN(Date.parse(entry.at)) ? "2026-09-05T00:00:00+09:00" : String(entry.at)
      }];
    });
  }

  function legacyTrade() {
    return {
      id: "RFQ-DEMO-1841",
      symbol: "ABCF",
      side: "BUY",
      quantity: 180,
      unitPrice: 100000,
      fee: 18000,
      total: 18018000,
      completedAt: "2026-09-04T14:21:00+09:00",
      status: "COMPLETED",
      source: "demo",
      transactionHash: "0x9b2c7d14"
    };
  }

  function normalizeState(value) {
    const base = initialState();
    if (!value || typeof value !== "object") return base;
    const holdings = {
      KTB: nonNegativeInteger(value.holdings?.KTB, base.holdings.KTB),
      MMF: nonNegativeInteger(value.holdings?.MMF, base.holdings.MMF),
      KLMS: nonNegativeInteger(value.holdings?.KLMS, base.holdings.KLMS),
      ABCF: nonNegativeInteger(value.holdings?.ABCF, base.holdings.ABCF)
    };
    const transactions = normalizeTransactions(value.transactions);
    const legacyPostTrade = Boolean(value.postTrade) && nonNegativeInteger(value.schemaVersion) < 5;
    if (legacyPostTrade && holdings.ABCF === 0) holdings.ABCF = 180;
    if (legacyPostTrade && !transactions.some((trade) => trade.symbol === "ABCF")) transactions.unshift(legacyTrade());
    const resetsSeededQualification = nonNegativeInteger(value.schemaVersion) < 6;
    const qualifiedAssets = {
      KTB: true,
      MMF: true,
      KLMS: resetsSeededQualification ? false : Boolean(value.qualifiedAssets?.KLMS),
      ABCF: resetsSeededQualification ? false : Boolean(value.qualifiedAssets?.ABCF ?? value.investorQualified)
    };
    return {
      ...base,
      ...value,
      schemaVersion: 6,
      investorQualified: qualifiedAssets.ABCF,
      qualifiedAssets,
      selectedAsset: catalog[String(value.selectedAsset || "ABCF").toUpperCase()] ? String(value.selectedAsset || "ABCF").toUpperCase() : "ABCF",
      holdings,
      transactions,
      pendingOrder: normalizePendingOrder(value.pendingOrder),
      nextTradeSequence: Math.max(1842, nonNegativeInteger(value.nextTradeSequence, 1842)),
      assetPaused: Boolean(value.assetPaused),
      pauseReason: value.pauseReason ? String(value.pauseReason).slice(0, 80) : null,
      pauseUpdatedAt: value.pauseUpdatedAt && !Number.isNaN(Date.parse(value.pauseUpdatedAt)) ? String(value.pauseUpdatedAt) : null,
      operationLog: normalizeOperationLog(value.operationLog),
      issuerAssetListed: Boolean(value.issuerAssetListed || holdings.ABCF > 0),
      issuerForm: { ...base.issuerForm, ...(value.issuerForm || {}) },
      issuerAnswers: { ...(value.issuerAnswers || {}) },
      evidence: { ...base.evidence, ...(value.evidence || {}) },
      qualificationChecks: Array.isArray(value.qualificationChecks)
        ? base.qualificationChecks.map((_, index) => Boolean(value.qualificationChecks[index]))
        : base.qualificationChecks
    };
  }

  function isMinimumOrder(amount, symbol = "ABCF") {
    const asset = catalog[String(symbol).toUpperCase()] || catalog.ABCF;
    return Number(amount) >= asset.minimumQuantity;
  }

  function qualificationReady(state, symbol = "ABCF") {
    if (String(symbol).toUpperCase() === "KLMS") return true;
    return state.qualificationChecks.every(Boolean);
  }

  function issuerRulesReady(state) {
    return issuerQuestions.every((key) => Boolean(state.issuerAnswers[key]));
  }

  function evidenceProgress(state) {
    const entries = Object.values(state.evidence);
    return { ready: entries.filter(Boolean).length, total: entries.length };
  }

  function compiledRules(state) {
    const answers = state.issuerAnswers;
    const badges = [];
    if (answers.offering === "reg-d") badges.push("Reg D 506(c)");
    if (answers.offering === "reg-s") badges.push("Reg S");
    if (answers.fund === "private-fund") badges.push("§ 3(c)(7)");
    if (answers.investor === "contract") badges.push("계약 이전 제한");
    if (answers.holding === "transfer-agent") badges.push("명의개서대리인");
    if (answers.distribution === "rule-144") badges.push("Rule 144");
    return badges;
  }

  function assets(state) {
    return Object.values(catalog).map((asset) => ({
      ...asset,
      eligible: Boolean(state.qualifiedAssets?.[asset.symbol] ?? asset.eligible),
      price: `${asset.unitPrice.toLocaleString("ko-KR")} 원`,
      paused: Boolean(state.assetPaused) && Boolean(state.qualifiedAssets?.[asset.symbol] ?? asset.eligible)
    }));
  }

  function portfolioSummary(state) {
    const normalized = normalizeState(state);
    const holdings = Object.entries(normalized.holdings).flatMap(([symbol, quantity]) => {
      const asset = catalog[symbol];
      return asset && quantity > 0 ? [{ ...asset, quantity, value: quantity * asset.unitPrice }] : [];
    });
    const demoTrades = normalized.transactions.filter((trade) => trade.source === "demo");
    return {
      holdings,
      totalValue: holdings.reduce((total, holding) => total + holding.value, 0),
      assetCount: holdings.length,
      todayPurchaseValue: demoTrades.reduce((total, trade) => total + trade.quantity * trade.unitPrice, 0),
      transactionCount: normalized.transactions.length,
      demoTradeCount: demoTrades.length
    };
  }

  function recentTransactions(state, limit = 5) {
    return normalizeState(state).transactions
      .slice()
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, limit);
  }

  function createPendingOrder(state, amount, now = new Date()) {
    const normalized = normalizeState(state);
    const symbol = normalized.selectedAsset;
    const asset = assets(normalized).find((candidate) => candidate.symbol === symbol);
    const quantity = nonNegativeInteger(amount);
    if (!asset?.eligible || normalized.assetPaused || quantity < asset.minimumQuantity) return null;
    const sequence = normalized.nextTradeSequence;
    const unitPrice = asset.unitPrice;
    const fee = Math.round(quantity * unitPrice * 0.001);
    return {
      id: `RFQ-DEMO-${sequence}`,
      sequence,
      symbol,
      side: "BUY",
      quantity,
      unitPrice,
      fee,
      total: quantity * unitPrice + fee,
      createdAt: new Date(now).toISOString(),
      transactionHash: `0x9b2c7d${String(sequence).slice(-2)}`
    };
  }

  function settlePendingOrder(state, now = new Date()) {
    const next = normalizeState(state);
    const order = next.pendingOrder;
    if (!order) return { state: next, trade: recentTransactions(next, 1)[0] || null, created: false };
    const existing = next.transactions.find((trade) => trade.id === order.id);
    if (existing) {
      next.pendingOrder = null;
      return { state: next, trade: existing, created: false };
    }
    const trade = {
      ...order,
      completedAt: new Date(now).toISOString(),
      status: "COMPLETED",
      source: "demo"
    };
    next.holdings[trade.symbol] = nonNegativeInteger(next.holdings[trade.symbol]) + trade.quantity;
    next.transactions.unshift(trade);
    next.pendingOrder = null;
    next.nextTradeSequence = Math.max(next.nextTradeSequence, trade.sequence + 1);
    next.postTrade = true;
    if (trade.symbol === "ABCF") next.issuerAssetListed = true;
    return { state: next, trade, created: true };
  }

  function setAssetPaused(state, paused, reason, now = new Date()) {
    const next = normalizeState(state);
    const desired = Boolean(paused);
    if (next.assetPaused === desired) return { state: next, changed: false };
    const at = new Date(now).toISOString();
    const action = desired ? "PAUSE" : "RESUME";
    const normalizedReason = String(reason || (desired ? "운영 점검" : "점검 완료")).slice(0, 80);
    next.assetPaused = desired;
    next.pauseReason = desired ? normalizedReason : null;
    next.pauseUpdatedAt = at;
    next.operationLog.unshift({ id: `OP-${action}-${Date.parse(at)}`, action, reason: normalizedReason, at });
    next.operationLog = next.operationLog.slice(0, 20);
    if (desired) next.pendingOrder = null;
    return { state: next, changed: true };
  }

  return {
    MIN_ORDER,
    issuerQuestions,
    initialState,
    normalizeState,
    isMinimumOrder,
    qualificationReady,
    issuerRulesReady,
    evidenceProgress,
    compiledRules,
    assets,
    portfolioSummary,
    recentTransactions,
    createPendingOrder,
    settlePendingOrder,
    setAssetPaused
  };
});
