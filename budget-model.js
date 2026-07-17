const PHASES = [
  { id: "above_line", name: "Above the Line", color: "#BA7517" },
  { id: "production", name: "Production", color: "#5B7A4A" },
  { id: "postproduction", name: "Postproduction", color: "#4A6B8A" },
  { id: "other", name: "Other", color: "#8A5A8A" },
];

const DEFAULT_TIMELINE = {
  prepWeeks: 5,
  shootWeeks: 1,
  wrapWeeks: 1,
  postWeeks: 16,
};

const boundedWeekCount = (value, fallback, maximum) => {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
};

function buildWeeklyPeriods(value = {}) {
  const prepWeeks = boundedWeekCount(value.prepWeeks, DEFAULT_TIMELINE.prepWeeks, 12);
  const shootWeeks = boundedWeekCount(value.shootWeeks, DEFAULT_TIMELINE.shootWeeks, 24);
  const wrapWeeks = boundedWeekCount(value.wrapWeeks, DEFAULT_TIMELINE.wrapWeeks, 4);
  const postWeeks = boundedWeekCount(value.postWeeks, DEFAULT_TIMELINE.postWeeks, 32);
  return [
    ...Array.from({ length: prepWeeks }, (_, index) => {
      const week = prepWeeks - index;
      return { id: `prep_${week}`, label: `Prep Week ${week}`, stage: "prep", week };
    }),
    ...Array.from({ length: shootWeeks }, (_, index) => {
      const week = index + 1;
      return { id: `shoot_${week}`, label: `Shoot Week ${week}`, stage: "shoot", week };
    }),
    ...Array.from({ length: wrapWeeks }, (_, index) => {
      const week = index + 1;
      return { id: `wrap_${week}`, label: `Wrap Week ${week}`, stage: "wrap", week };
    }),
    ...Array.from({ length: postWeeks }, (_, index) => {
      const week = index + 1;
      return { id: `post_${week}`, label: `Post Week ${week}`, stage: "post", week };
    }),
  ];
}

const PERIODS = buildWeeklyPeriods(DEFAULT_TIMELINE);

const ACCOUNT_DEFINITIONS = [
  ["1000", "Project Development", "above_line", [
    ["1001", "Breakdown preparation", "fixed"],
    ["1002", "Budget preparation", "fixed"],
    ["1003", "Location scout fees", "fixed"],
    ["1004", "Scout vehicle", "fixed"],
    ["1005", "Scout fuel", "variable"],
    ["1006", "Scout meals", "variable"],
    ["1007", "Pitch deck design", "fixed"],
    ["1008", "Production design", "fixed"],
    ["1009", "Other development expenses", "variable"],
  ]],
  ["1100", "Script and Rights", "above_line", [
    ["1101", "Screenplay and story rights", "fixed"],
    ["1102", "Rights registration", "fixed"],
    ["1103", "Translations", "variable"],
    ["1104", "Copies and binding", "variable"],
  ]],
  ["1200", "Producing", "above_line", [
    ["1201", "Producer", "fixed"],
    ["1202", "Executive producer", "fixed"],
    ["1203", "Line producer", "fixed"],
    ["1204", "Additional executive producer", "fixed"],
  ]],
  ["1300", "Directing", "above_line", [
    ["1301", "Director", "fixed"],
    ["1302", "Action choreography director", "fixed"],
    ["1303", "Additional directing costs", "fixed"],
  ]],
  ["1400", "Cast", "above_line", [
    ["1401", "Lead performer 1", "fixed"],
    ["1402", "Lead performer 2", "fixed"],
    ["1403", "Lead performer 3", "fixed"],
    ["1404", "Supporting performer 1", "fixed"],
    ["1405", "Supporting performer 2", "fixed"],
    ["1406", "Supporting performer 3", "fixed"],
    ["1407", "Day player 1", "fixed"],
    ["1408", "Day player 2", "fixed"],
    ["1409", "Additional cast", "fixed"],
  ]],
  ["1500", "Extras and Stunts", "production", [
    ["1501", "Casting lead", "fixed"],
    ["1502", "Background performers", "fixed"],
    ["1503", "Stunt performers", "fixed"],
  ]],
  ["1600", "Production Staff", "production", [
    ["1601", "Production assistant 1", "fixed"],
    ["1602", "Production coordinator", "fixed"],
    ["1603", "First assistant director", "fixed"],
    ["1604", "Second assistant director", "fixed"],
    ["1605", "Script supervisor", "fixed"],
    ["1606", "Production assistant 2", "fixed"],
    ["1607", "Production assistant 3", "fixed"],
    ["1608", "Production assistant 4", "fixed"],
    ["1609", "Office rent, phone and internet", "fixed"],
    ["1610", "General production expenses", "variable"],
    ["1611", "Mobile phones", "variable"],
    ["1612", "Copies", "variable"],
    ["1613", "Office consumables", "variable"],
    ["1614", "Courier services", "variable"],
    ["1615", "Cleaning", "variable"],
    ["1616", "Rideshare", "variable"],
  ]],
  ["1700", "Art Department", "production", [
    ["1701", "Art director", "fixed"],
    ["1702", "Practical effects artist", "fixed"],
    ["1703", "Art assistant 1", "fixed"],
    ["1704", "Art purchases and rentals", "variable"],
    ["1705", "Art assistant 2", "fixed"],
    ["1706", "Set dresser", "fixed"],
    ["1707", "Props", "variable"],
    ["1708", "Set dressing", "variable"],
    ["1709", "Other art expenses", "variable"],
  ]],
  ["1800", "Camera Crew", "production", [
    ["1801", "Director of photography", "fixed"],
    ["1802", "First assistant camera", "fixed"],
    ["1803", "Second assistant camera", "fixed"],
    ["1804", "Data manager", "fixed"],
    ["1805", "Video assist with equipment", "fixed"],
    ["1806", "Camera custodian", "fixed"],
    ["1807", "Additional camera crew", "fixed"],
  ]],
  ["1900", "Camera Equipment", "production", [
    ["1901", "Camera package with lenses", "fixed"],
    ["1902", "Lens package", "fixed"],
    ["1903", "Tripod and accessories", "fixed"],
    ["1904", "Filters and matte box", "fixed"],
    ["1905", "Video assist materials", "variable"],
    ["1906", "Production storage", "fixed"],
    ["1907", "Camera equipment insurance", "fixed"],
  ]],
  ["2000", "Sound and Equipment", "production", [
    ["2001", "Production sound mixer", "fixed"],
    ["2002", "Boom operator", "fixed"],
    ["2003", "Sound equipment package", "fixed"],
    ["2004", "Additional sound crew", "fixed"],
    ["2005", "Radio rentals", "fixed"],
    ["2006", "Sound expendables", "variable"],
  ]],
  ["2100", "Electric and Grip Crew", "production", [
    ["2101", "Gaffer", "fixed"],
    ["2102", "Lighting technician", "fixed"],
    ["2103", "Grip 1", "fixed"],
    ["2104", "Grip 2", "fixed"],
    ["2105", "Grip 3", "fixed"],
    ["2106", "Lighting lead", "fixed"],
    ["2107", "Truck lead", "fixed"],
    ["2108", "Lighting expendables", "variable"],
    ["2109", "Grip expendables", "variable"],
  ]],
  ["2200", "Electric and Grip Equipment", "production", [
    ["2201", "Lighting package rental", "fixed"],
    ["2202", "Additional equipment rental", "fixed"],
    ["2203", "Damage and loss allowance", "variable"],
    ["2204", "Generator", "fixed"],
    ["2205", "Diesel", "variable"],
    ["2206", "Equipment expendables", "variable"],
    ["2207", "Stands and sandbags", "fixed"],
  ]],
  ["2300", "Wardrobe Department", "production", [
    ["2301", "Costume designer", "fixed"],
    ["2302", "Wardrobe assistants", "fixed"],
    ["2303", "Wardrobe purchases and rentals", "variable"],
    ["2304", "Laundry", "variable"],
  ]],
  ["2400", "Hair and Makeup", "production", [
    ["2401", "Makeup artist", "fixed"],
    ["2402", "Hair assistant", "fixed"],
    ["2403", "Makeup purchases", "variable"],
    ["2404", "Hair and makeup consumables", "variable"],
  ]],
  ["2500", "Special Effects", "production", [
    ["2501", "Water trucks", "fixed"],
    ["2502", "Special effects", "fixed"],
    ["2503", "Special effects expendables", "variable"],
  ]],
  ["2600", "Animals and Picture Vehicles", "production", [
    ["2601", "Animal handler or trainer", "fixed"],
    ["2602", "Animals", "fixed"],
    ["2603", "Animal feed", "variable"],
    ["2604", "Picture vehicles", "fixed"],
    ["2605", "Picture vehicle fuel", "variable"],
  ]],
  ["2700", "Locations", "production", [
    ["2701", "Location manager", "fixed"],
    ["2702", "Location assistant", "fixed"],
    ["2703", "Technical scout costs", "variable"],
    ["2704", "Primary location", "fixed"],
    ["2705", "Support location 1", "fixed"],
    ["2706", "Support location 2", "fixed"],
    ["2707", "Support location 3", "fixed"],
    ["2708", "Additional locations", "fixed"],
    ["2709", "Location permits", "fixed"],
    ["2710", "Location security", "fixed"],
  ]],
  ["2800", "Lodging and Travel", "production", [
    ["2801", "Crew hotels", "variable"],
    ["2802", "Airfare", "variable"],
    ["2803", "Travel transportation", "variable"],
    ["2804", "Per diem", "variable"],
    ["2805", "Other travel costs", "variable"],
  ]],
  ["2900", "Set Operations", "production", [
    ["2901", "Catering", "variable"],
    ["2902", "Snacks", "variable"],
    ["2903", "Box meals for extras", "variable"],
    ["2904", "Craft service", "variable"],
    ["2905", "Set medic", "fixed"],
    ["2906", "First aid kit", "fixed"],
    ["2907", "Health testing", "variable"],
  ]],
  ["3000", "Transportation", "production", [
    ["3001", "Production van", "fixed"],
    ["3002", "Equipment van", "fixed"],
    ["3003", "Wardrobe van", "fixed"],
    ["3004", "Lighting and grip truck", "fixed"],
    ["3005", "Transportation fuel", "variable"],
    ["3006", "Taxis and rideshare", "variable"],
    ["3007", "Drivers", "fixed"],
    ["3008", "Parking", "variable"],
  ]],
  ["3100", "Behind the Scenes", "production", [
    ["3101", "Behind the scenes crew", "fixed"],
    ["3102", "Behind the scenes equipment", "fixed"],
    ["3103", "Behind the scenes materials", "variable"],
  ]],
  ["3200", "Picture Editing", "postproduction", [
    ["3201", "Picture editor", "fixed"],
    ["3202", "Assistant editor", "fixed"],
    ["3203", "Editing equipment", "fixed"],
    ["3204", "Trailer edit", "fixed"],
    ["3205", "Other editing costs", "variable"],
  ]],
  ["3300", "Picture Postproduction", "postproduction", [
    ["3301", "Postproduction supervisor", "fixed"],
    ["3302", "Color correction", "fixed"],
    ["3303", "Visual effects", "fixed"],
    ["3304", "Credits design", "fixed"],
    ["3305", "Subtitles", "fixed"],
    ["3306", "Conform and export", "fixed"],
    ["3307", "Mastering", "fixed"],
    ["3308", "Deliverables", "fixed"],
    ["3309", "Postproduction materials", "variable"],
  ]],
  ["3400", "Sound Postproduction", "postproduction", [
    ["3401", "Sound designer", "fixed"],
    ["3402", "Sound editing", "fixed"],
    ["3403", "Dialogue replacement", "fixed"],
    ["3404", "Sound mix", "fixed"],
    ["3405", "Sound editing facility", "fixed"],
  ]],
  ["3500", "Music", "postproduction", [
    ["3501", "Original score", "fixed"],
    ["3502", "Music licenses", "fixed"],
    ["3503", "Music recording and delivery", "fixed"],
  ]],
  ["3600", "Distribution", "other", [
    ["3601", "Festival submissions", "variable"],
    ["3602", "Support platforms and services", "variable"],
    ["3603", "Festival attendance", "variable"],
    ["3604", "Poster design", "variable"],
    ["3605", "Press kit design", "variable"],
    ["3606", "Shipping", "variable"],
    ["3607", "Other distribution costs", "variable"],
  ]],
  ["3700", "Contingency", "other", [
    ["3701", "Cash production contingency", "fixed", "contingency"],
  ]],
  ["3800", "Insurance", "other", [
    ["3801", "Production insurance", "fixed"],
    ["3802", "Additional insurance days", "fixed"],
    ["3803", "Insurance deductibles", "variable"],
  ]],
];

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const cleanText = (value, limit = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
const cleanId = (value, fallback) => cleanText(value, 80).replace(/[^a-zA-Z0-9_]/g, "_") || fallback;
const rounded = (value) => Math.round((finite(value) + Number.EPSILON) * 1000000) / 1000000;

function createLineItem(accountCode, definition, index = 0) {
  const [code, name, costType = "fixed", calculation = ""] = definition;
  return {
    id: `li_${accountCode}_${code}_${index}`,
    code,
    name,
    quantity: calculation === "contingency" ? 0 : 0,
    unit: calculation === "contingency" ? "calculated" : "flat",
    multiplier: calculation === "contingency" ? 0 : 1,
    unitCost: 0,
    taxRateId: "tax_exempt",
    taxMode: "exclusive",
    costType,
    fundingKind: "cash",
    origin: "producer",
    invoiceNumber: "",
    schedule: {},
    calculation,
  };
}

function createBudgetTemplate(projectTitle = "Untitled screenplay") {
  const now = new Date().toISOString();
  return {
    version: 2,
    projectTitle: cleanText(projectTitle, 160) || "Untitled screenplay",
    metadata: {
      producer: "",
      director: "",
      format: "",
      locations: "",
      shootingDates: "",
    },
    settings: {
      currencyCode: "GTQ",
      currencySymbol: "Q",
      contingencyRate: 0.05,
      defaultTaxRateId: "tax_standard",
      taxRates: [
        { id: "tax_exempt", name: "Exempt", rate: 0 },
        { id: "tax_standard", name: "VAT", rate: 0.12 },
      ],
    },
    timeline: { ...DEFAULT_TIMELINE },
    periods: buildWeeklyPeriods(DEFAULT_TIMELINE),
    accounts: ACCOUNT_DEFINITIONS.map(([code, name, phaseId, items]) => ({
      code,
      name,
      phaseId,
      items: items.map((definition, index) => createLineItem(code, definition, index)),
    })),
    fundingSources: [],
    expenses: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTaxRates(value) {
  const rates = (Array.isArray(value) ? value : []).slice(0, 20).map((rate, index) => ({
    id: cleanId(rate?.id, `tax_${index}`),
    name: cleanText(rate?.name, 60) || `Tax ${index + 1}`,
    rate: Math.max(0, Math.min(1, finite(rate?.rate))),
  }));
  if (!rates.some((rate) => rate.id === "tax_exempt")) rates.unshift({ id: "tax_exempt", name: "Exempt", rate: 0 });
  return rates;
}

function highestScheduledWeek(sourceAccounts, stage) {
  let highest = 0;
  const pattern = new RegExp(`^${stage}_(\\d+)$`);
  (Array.isArray(sourceAccounts) ? sourceAccounts : []).forEach((account) => {
    (Array.isArray(account?.items) ? account.items : []).forEach((item) => {
      Object.keys(item?.schedule || {}).forEach((periodId) => {
        const match = periodId.match(pattern);
        if (match && finite(item.schedule?.[periodId]) > 0) highest = Math.max(highest, Number(match[1]) || 0);
      });
    });
  });
  return highest;
}

function highestDefinedWeek(sourcePeriods, stage) {
  const pattern = new RegExp(`^${stage}_(\\d+)$`);
  return (Array.isArray(sourcePeriods) ? sourcePeriods : []).reduce((highest, period) => {
    const match = String(period?.id || "").match(pattern);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
}

function normalizeTimeline(value, sourceAccounts, sourcePeriods) {
  const hasTimeline = Boolean(value && typeof value === "object" && !Array.isArray(value));
  const source = hasTimeline ? value : {};
  const inferredPrep = Math.max(highestDefinedWeek(sourcePeriods, "prep"), highestScheduledWeek(sourceAccounts, "prep"));
  const inferredShoot = Math.max(highestDefinedWeek(sourcePeriods, "shoot"), highestScheduledWeek(sourceAccounts, "shoot"));
  const inferredWrap = Math.max(highestDefinedWeek(sourcePeriods, "wrap"), highestScheduledWeek(sourceAccounts, "wrap"));
  const inferredPost = Math.max(highestDefinedWeek(sourcePeriods, "post"), highestScheduledWeek(sourceAccounts, "post"));
  const count = (explicit, inferred, fallback, maximum) => {
    const requested = hasTimeline
      ? Math.max(0, finite(explicit), inferred)
      : Math.max(fallback, inferred);
    return boundedWeekCount(requested || fallback, fallback, maximum);
  };
  return {
    prepWeeks: count(source.prepWeeks, inferredPrep, DEFAULT_TIMELINE.prepWeeks, 12),
    shootWeeks: count(source.shootWeeks, inferredShoot, DEFAULT_TIMELINE.shootWeeks, 24),
    wrapWeeks: count(source.wrapWeeks, inferredWrap, DEFAULT_TIMELINE.wrapWeeks, 4),
    postWeeks: count(source.postWeeks, inferredPost, DEFAULT_TIMELINE.postWeeks, 32),
  };
}

function normalizeBudget(value, projectTitle = "Untitled screenplay") {
  const base = createBudgetTemplate(projectTitle);
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const legacySchedule = Math.trunc(finite(value.version, 1)) < 2;
  const settings = value.settings && typeof value.settings === "object" ? value.settings : {};
  const taxRates = normalizeTaxRates(settings.taxRates || base.settings.taxRates);
  const taxIds = new Set(taxRates.map((rate) => rate.id));
  const baseAccounts = new Map(base.accounts.map((account) => [account.code, account]));
  const sourceAccounts = Array.isArray(value.accounts) ? value.accounts.slice(0, 80) : base.accounts;
  const timelineSource = legacySchedule
    ? {
      ...(value.timeline && typeof value.timeline === "object" && !Array.isArray(value.timeline) ? value.timeline : {}),
      postWeeks: Math.max(
        DEFAULT_TIMELINE.postWeeks,
        finite(value.timeline?.postWeeks),
        highestDefinedWeek(value.periods, "post") * 4,
        highestScheduledWeek(sourceAccounts, "post") * 4,
      ),
    }
    : value.timeline;
  const timeline = normalizeTimeline(timelineSource, sourceAccounts, value.periods);
  const periods = buildWeeklyPeriods(timeline);
  const stagePeriods = {
    shoot: periods.filter((period) => period.stage === "shoot"),
    wrap: periods.filter((period) => period.stage === "wrap"),
  };
  const splitScheduledAmount = (amount, index, count) => {
    const cents = Math.max(0, Math.round(finite(amount) * 100));
    const baseCents = Math.floor(cents / Math.max(1, count));
    const remainder = cents % Math.max(1, count);
    return (baseCents + (index < remainder ? 1 : 0)) / 100;
  };
  const accounts = sourceAccounts.map((account, accountIndex) => {
    const code = cleanText(account?.code, 12) || String(1000 + accountIndex * 100);
    const fallback = baseAccounts.get(code);
    const phaseId = PHASES.some((phase) => phase.id === account?.phaseId) ? account.phaseId : fallback?.phaseId || "other";
    const sourceItems = Array.isArray(account?.items) ? account.items.slice(0, 250) : fallback?.items || [];
    return {
      code,
      name: cleanText(account?.name, 120) || fallback?.name || `Account ${code}`,
      phaseId,
      items: sourceItems.map((item, itemIndex) => {
        const calculation = item?.calculation === "contingency" ? "contingency" : "";
        const taxRateId = taxIds.has(item?.taxRateId) ? item.taxRateId : "tax_exempt";
        const schedule = {};
        periods.forEach((period) => {
          let scheduledValue = item?.schedule?.[period.id];
          if (legacySchedule && period.stage === "shoot" && item?.schedule?.shoot != null) {
            scheduledValue = splitScheduledAmount(item.schedule.shoot, Math.max(0, period.week - 1), stagePeriods.shoot.length);
          }
          if (legacySchedule && period.stage === "wrap" && item?.schedule?.wrap != null) {
            scheduledValue = splitScheduledAmount(item.schedule.wrap, Math.max(0, period.week - 1), stagePeriods.wrap.length);
          }
          if (legacySchedule && period.stage === "post") {
            const month = Math.ceil(period.week / 4);
            const weekInMonth = (period.week - 1) % 4;
            scheduledValue = splitScheduledAmount(item?.schedule?.[`post_${month}`], weekInMonth, 4);
          }
          schedule[period.id] = Math.max(0, finite(scheduledValue));
        });
        return {
          id: cleanId(item?.id, `li_${code}_${itemIndex}`),
          code: cleanText(item?.code, 16) || `${code}_${itemIndex + 1}`,
          name: cleanText(item?.name, 180) || "Untitled cost",
          quantity: calculation ? 0 : Math.max(0, Math.trunc(finite(item?.quantity))),
          unit: cleanText(item?.unit, 40) || (calculation ? "calculated" : "flat"),
          multiplier: calculation ? 0 : Math.max(0, finite(item?.multiplier, 1)),
          unitCost: calculation ? 0 : Math.max(0, finite(item?.unitCost)),
          taxRateId,
          taxMode: item?.taxMode === "included" ? "included" : "exclusive",
          costType: item?.costType === "variable" ? "variable" : "fixed",
          fundingKind: item?.fundingKind === "in_kind" ? "in_kind" : "cash",
          origin: ["producer", "studio", "partner", "other"].includes(item?.origin) ? item.origin : "producer",
          invoiceNumber: cleanText(item?.invoiceNumber, 80),
          schedule,
          calculation,
        };
      }),
    };
  });
  const normalizeReceipt = (entry) => ({
    receiptId: cleanId(entry?.receiptId, "") || "",
    receiptName: cleanText(entry?.receiptName, 180),
    receiptType: cleanText(entry?.receiptType, 80),
    receiptSize: Math.max(0, Math.round(finite(entry?.receiptSize))),
  });
  const fundingSources = (Array.isArray(value.fundingSources) ? value.fundingSources : []).slice(0, 300).map((source, index) => ({
    id: cleanId(source?.id, `fund_${index}`),
    name: cleanText(source?.name, 160) || "Untitled contributor",
    type: source?.type === "in_kind" ? "in_kind" : source?.type === "partner" ? "partner" : "cash",
    amount: Math.max(0, finite(source?.amount)),
    paid: Math.max(0, finite(source?.paid)),
    status: ["Planned", "Pending", "Partially paid", "Received"].includes(source?.status) ? source.status : "Planned",
    paymentDate: cleanText(source?.paymentDate, 60),
    notes: cleanText(source?.notes, 500),
    ...normalizeReceipt(source),
  }));
  const validItems = new Set(accounts.flatMap((account) => account.items.map((item) => item.id)));
  const expenses = (Array.isArray(value.expenses) ? value.expenses : []).slice(0, 5000).map((expense, index) => ({
    id: cleanId(expense?.id, `expense_${index}`),
    lineItemId: validItems.has(expense?.lineItemId) ? expense.lineItemId : "",
    paymentNumber: cleanText(expense?.paymentNumber, 40),
    paymentDate: cleanText(expense?.paymentDate, 40),
    vendor: cleanText(expense?.vendor, 160),
    concept: cleanText(expense?.concept, 240),
    amount: Math.max(0, finite(expense?.amount)),
    notes: cleanText(expense?.notes, 500),
    ...normalizeReceipt(expense),
  }));
  const normalized = {
    version: 2,
    projectTitle: cleanText(value.projectTitle || projectTitle, 160) || "Untitled screenplay",
    metadata: {
      producer: cleanText(value.metadata?.producer, 120),
      director: cleanText(value.metadata?.director, 120),
      format: cleanText(value.metadata?.format, 80),
      locations: cleanText(value.metadata?.locations, 180),
      shootingDates: cleanText(value.metadata?.shootingDates, 120),
    },
    settings: {
      currencyCode: cleanText(settings.currencyCode, 8).toUpperCase() || "GTQ",
      currencySymbol: cleanText(settings.currencySymbol, 8) || "Q",
      contingencyRate: Math.max(0, Math.min(0.5, finite(settings.contingencyRate, 0.05))),
      defaultTaxRateId: taxIds.has(settings.defaultTaxRateId) ? settings.defaultTaxRateId : "tax_standard",
      taxRates,
    },
    timeline,
    periods,
    accounts,
    fundingSources,
    expenses,
    createdAt: cleanText(value.createdAt, 40) || base.createdAt,
    updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString(),
  };
  return normalized;
}

function calculateRegularItem(item, taxRates) {
  const rate = taxRates.get(item.taxRateId)?.rate || 0;
  const grossBase = Math.max(0, finite(item.quantity)) * Math.max(0, finite(item.multiplier)) * Math.max(0, finite(item.unitCost));
  const included = item.taxMode === "included" && rate > 0;
  const subtotal = included ? grossBase / (1 + rate) : grossBase;
  const tax = included ? grossBase - subtotal : subtotal * rate;
  return { subtotal: rounded(subtotal), tax: rounded(tax), total: rounded(subtotal + tax) };
}

function computeBudget(value, projectTitle = "Untitled screenplay") {
  const budget = normalizeBudget(value, projectTitle);
  const taxRates = new Map(budget.settings.taxRates.map((rate) => [rate.id, rate]));
  const expenseByItem = new Map();
  budget.expenses.forEach((expense) => {
    if (!expense.lineItemId) return;
    expenseByItem.set(expense.lineItemId, rounded((expenseByItem.get(expense.lineItemId) || 0) + expense.amount));
  });
  const preliminary = new Map();
  let contingencyBase = 0;
  budget.accounts.forEach((account) => account.items.forEach((item) => {
    if (item.calculation === "contingency") return;
    const result = calculateRegularItem(item, taxRates);
    preliminary.set(item.id, result);
    if (item.fundingKind === "cash" && ["above_line", "production"].includes(account.phaseId)) contingencyBase += result.total;
  }));
  const contingencyAmount = rounded(contingencyBase * budget.settings.contingencyRate);
  const phaseMap = new Map(PHASES.map((phase) => [phase.id, { ...phase, subtotal: 0, tax: 0, total: 0, spent: 0, remaining: 0 }]));
  const scheduleTotals = Object.fromEntries(budget.periods.map((period) => [period.id, 0]));
  const scheduleCashTotals = Object.fromEntries(budget.periods.map((period) => [period.id, 0]));
  const scheduleInKindTotals = Object.fromEntries(budget.periods.map((period) => [period.id, 0]));
  const itemMap = new Map();
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  let linkedSpent = 0;
  let fixedTotal = 0;
  let variableTotal = 0;
  let cashTotal = 0;
  let inKindTotal = 0;
  let scheduledTotal = 0;
  let scheduledCashTotal = 0;
  let scheduledInKindTotal = 0;
  let unscheduledCashTotal = 0;
  let overScheduledCashTotal = 0;
  const accounts = budget.accounts.map((account) => {
    const phase = phaseMap.get(account.phaseId) || phaseMap.get("other");
    const items = account.items.map((item) => {
      const result = item.calculation === "contingency"
        ? { subtotal: contingencyAmount, tax: 0, total: contingencyAmount }
        : preliminary.get(item.id) || { subtotal: 0, tax: 0, total: 0 };
      const itemSpent = expenseByItem.get(item.id) || 0;
      const remaining = rounded(result.total - itemSpent);
      const scheduled = rounded(budget.periods.reduce((sum, period) => sum + Math.max(0, finite(item.schedule?.[period.id])), 0));
      const overScheduled = rounded(Math.max(0, scheduled - result.total));
      const unscheduled = rounded(Math.max(0, result.total - scheduled));
      budget.periods.forEach((period) => {
        const periodAmount = Math.max(0, finite(item.schedule?.[period.id]));
        scheduleTotals[period.id] = rounded(scheduleTotals[period.id] + periodAmount);
        if (item.fundingKind === "in_kind") scheduleInKindTotals[period.id] = rounded(scheduleInKindTotals[period.id] + periodAmount);
        else scheduleCashTotals[period.id] = rounded(scheduleCashTotals[period.id] + periodAmount);
      });
      const row = { ...item, accountCode: account.code, accountName: account.name, phaseId: account.phaseId, ...result, spent: itemSpent, remaining, scheduled, unscheduled, overScheduled };
      itemMap.set(item.id, row);
      phase.subtotal += result.subtotal;
      phase.tax += result.tax;
      phase.total += result.total;
      phase.spent += itemSpent;
      subtotal += result.subtotal;
      tax += result.tax;
      total += result.total;
      linkedSpent += itemSpent;
      if (item.costType === "variable") variableTotal += result.total;
      else fixedTotal += result.total;
      if (item.fundingKind === "in_kind") inKindTotal += result.total;
      else cashTotal += result.total;
      scheduledTotal += scheduled;
      if (item.fundingKind === "in_kind") scheduledInKindTotal += scheduled;
      else {
        scheduledCashTotal += scheduled;
        unscheduledCashTotal += unscheduled;
        overScheduledCashTotal += overScheduled;
      }
      return row;
    });
    return {
      code: account.code,
      name: account.name,
      phaseId: account.phaseId,
      items,
      subtotal: rounded(items.reduce((sum, item) => sum + item.subtotal, 0)),
      tax: rounded(items.reduce((sum, item) => sum + item.tax, 0)),
      total: rounded(items.reduce((sum, item) => sum + item.total, 0)),
      spent: rounded(items.reduce((sum, item) => sum + item.spent, 0)),
      remaining: rounded(items.reduce((sum, item) => sum + item.remaining, 0)),
    };
  });
  const phases = PHASES.map((phase) => {
    const valueForPhase = phaseMap.get(phase.id);
    valueForPhase.subtotal = rounded(valueForPhase.subtotal);
    valueForPhase.tax = rounded(valueForPhase.tax);
    valueForPhase.total = rounded(valueForPhase.total);
    valueForPhase.spent = rounded(valueForPhase.spent);
    valueForPhase.remaining = rounded(valueForPhase.total - valueForPhase.spent);
    valueForPhase.share = total > 0 ? valueForPhase.total / total : 0;
    return valueForPhase;
  });
  const runningSpent = new Map();
  const expenseRows = budget.expenses.map((expense) => {
    const item = itemMap.get(expense.lineItemId);
    const runningKey = item?.id || expense.id;
    const previous = runningSpent.get(runningKey) || 0;
    const cumulativeSpent = rounded(previous + expense.amount);
    runningSpent.set(runningKey, cumulativeSpent);
    const budgeted = item?.total || 0;
    const lineSpentTotal = item ? expenseByItem.get(item.id) || 0 : expense.amount;
    const isUnbudgeted = !item || budgeted <= 0.005;
    const variance = rounded(budgeted - cumulativeSpent);
    const lineBalance = rounded(budgeted - lineSpentTotal);
    return {
      ...expense,
      accountCode: item?.accountCode || "",
      accountName: item?.accountName || "Unexpected cost",
      lineItemCode: item?.code || "",
      lineItemName: item?.name || "No approved budget line",
      fundingKind: item?.fundingKind || "cash",
      budgeted,
      cumulativeSpent,
      lineSpentTotal,
      variance,
      lineBalance,
      isUnbudgeted,
      isOverBudget: !isUnbudgeted && lineBalance < -0.005,
      varianceState: isUnbudgeted ? "unbudgeted" : lineBalance < -0.005 ? "over" : "within",
    };
  });
  const cashSpent = rounded(expenseRows
    .filter((expense) => expense.fundingKind !== "in_kind")
    .reduce((sum, expense) => sum + expense.amount, 0));
  const inKindSpent = rounded(expenseRows
    .filter((expense) => expense.fundingKind === "in_kind")
    .reduce((sum, expense) => sum + expense.amount, 0));
  const spent = rounded(cashSpent + inKindSpent);
  const budgetedSpent = rounded(expenseRows
    .filter((expense) => !expense.isUnbudgeted)
    .reduce((sum, expense) => sum + expense.amount, 0));
  const unbudgetedSpent = rounded(expenseRows
    .filter((expense) => expense.isUnbudgeted)
    .reduce((sum, expense) => sum + expense.amount, 0));
  const unassignedSpent = rounded(expenseRows
    .filter((expense) => !expense.lineItemId)
    .reduce((sum, expense) => sum + expense.amount, 0));
  const overBudgetItems = Array.from(itemMap.values())
    .filter((item) => item.total > 0.005 && item.spent > item.total + 0.005);
  const overBudgetSpent = rounded(overBudgetItems
    .reduce((sum, item) => sum + Math.max(0, item.spent - item.total), 0));
  const fundingPlanned = rounded(budget.fundingSources.reduce((sum, source) => sum + source.amount, 0));
  const fundingReceived = rounded(budget.fundingSources.reduce((sum, source) => sum + source.paid, 0));
  return {
    budget,
    accounts,
    phases,
    itemMap,
    expenseRows,
    scheduleTotals,
    scheduleCashTotals,
    scheduleInKindTotals,
    scheduledTotal: rounded(scheduledTotal),
    scheduledCashTotal: rounded(scheduledCashTotal),
    scheduledInKindTotal: rounded(scheduledInKindTotal),
    unscheduledCashTotal: rounded(unscheduledCashTotal),
    overScheduledCashTotal: rounded(overScheduledCashTotal),
    subtotal: rounded(subtotal),
    tax: rounded(tax),
    total: rounded(total),
    linkedSpent: rounded(linkedSpent),
    spent,
    remaining: rounded(total - spent),
    spentShare: total > 0 ? spent / total : 0,
    contingencyBase: rounded(contingencyBase),
    contingencyAmount,
    fixedTotal: rounded(fixedTotal),
    variableTotal: rounded(variableTotal),
    cashTotal: rounded(cashTotal),
    inKindTotal: rounded(inKindTotal),
    cashSpent,
    inKindSpent,
    budgetedSpent,
    unbudgetedSpent,
    unassignedSpent,
    unbudgetedCount: expenseRows.filter((expense) => expense.isUnbudgeted).length,
    overBudgetSpent,
    overBudgetLineCount: overBudgetItems.length,
    fundingPlanned,
    fundingReceived,
    fundingGap: rounded(total - fundingPlanned),
    cashFundingGap: rounded(cashTotal - budget.fundingSources.filter((source) => source.type !== "in_kind").reduce((sum, source) => sum + source.amount, 0)),
  };
}

export {
  ACCOUNT_DEFINITIONS,
  DEFAULT_TIMELINE,
  PERIODS,
  PHASES,
  buildWeeklyPeriods,
  computeBudget,
  createBudgetTemplate,
  normalizeBudget,
};
