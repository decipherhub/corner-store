(function expose(factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.PortalModel = api;
})(function createModel() {
  const MIN_ORDER = 50;
  const issuerQuestions = ["offering", "fund", "investor", "holding", "distribution"];

  function initialState() {
    return {
      investorQualified: false,
      walletConnected: true,
      walletProvider: "MetaMask",
      qualificationChecks: [true, true, true, false],
      provider: null,
      certificationFile: null,
      certificationUploadProgress: 0,
      orderAmount: 20,
      postTrade: false,
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

  function normalizeState(value) {
    const base = initialState();
    if (!value || typeof value !== "object") return base;
    return {
      ...base,
      ...value,
      issuerForm: { ...base.issuerForm, ...(value.issuerForm || {}) },
      issuerAnswers: { ...(value.issuerAnswers || {}) },
      evidence: { ...base.evidence, ...(value.evidence || {}) },
      qualificationChecks: Array.isArray(value.qualificationChecks)
        ? base.qualificationChecks.map((_, index) => Boolean(value.qualificationChecks[index]))
        : base.qualificationChecks
    };
  }

  function isMinimumOrder(amount) {
    return Number(amount) >= MIN_ORDER;
  }

  function qualificationReady(state) {
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
    const rows = [
      { symbol: "KTB", name: "국고채 토큰", eligible: true, price: "10,000 원", minimum: "10개" },
      { symbol: "MMF", name: "MMF 토큰", eligible: true, price: "24,000 원", minimum: "10개" },
      { symbol: "KLMS", name: "KLM 주식", eligible: false, missing: 2, price: "42,000 원", minimum: "20개" },
      { symbol: "ABCF", name: "ABC 사모 펀드 토큰", eligible: false, missing: 4, price: "100,000 원", minimum: "50개" }
    ];
    return rows;
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
    assets
  };
});
