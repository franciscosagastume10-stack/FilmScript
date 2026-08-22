import {
  normalizeTimestamp,
  sha256,
  stableStringify,
} from "./common.mjs";

const MAX_CREDIT_AMOUNT = 99_999_999.999999;
const FREE_FEATURE_LIMITS = Object.freeze({ analysis: 1, breakdown: 1, storyboard: 1 });
const CALENDAR_PERIOD = /^(\d{4})-(\d{2})$/;
const WEEK_PERIOD = /^(\d{4})-(\d{2})-(\d{2})$/;
const PROVIDER_PERIOD = /^provider:(\d{10,16}):(\d{10,16})$/;
const PLAN_ALIASES = Object.freeze({ basic: "creator", lumiere: "creator" });
const ACTIVE_AI_JOB_STATUSES = new Set(["queued", "processing", "running", "saving"]);

const TARGET_DEFINITIONS = Object.freeze([
  {
    target: "private.credit_accounts",
    order: 77,
    primaryKey: ["user_id"],
    columnTypes: { user_id: "scalar", legacy_snapshot: "jsonb" },
  },
  {
    target: "private.credit_windows",
    order: 78,
    primaryKey: ["id"],
    columnTypes: {
      id: "scalar", user_id: "scalar", feature: "scalar", period_key: "scalar", plan: "scalar",
      allowance: "scalar", used: "scalar", starts_at: "timestamptz", ends_at: "timestamptz",
      legacy_allowance_unknown: "boolean",
    },
  },
  {
    target: "private.credit_reservations",
    order: 79,
    primaryKey: ["id"],
    columnTypes: {
      id: "scalar", window_id: "scalar", user_id: "scalar", feature: "scalar", amount: "scalar",
      state: "scalar", idempotency_key: "scalar", metadata: "jsonb", expires_at: "timestamptz",
      settled_at: "timestamptz", released_at: "timestamptz", created_at: "timestamptz",
    },
  },
  {
    target: "private.credit_ledger",
    order: 80,
    primaryKey: ["id"],
    columnTypes: {
      id: "scalar", window_id: "scalar", user_id: "scalar", reservation_id: "scalar", feature: "scalar",
      entry_type: "scalar", amount: "scalar", idempotency_key: "scalar", metadata: "jsonb",
      created_at: "timestamptz",
    },
  },
  {
    target: "private.feature_allowances",
    order: 81,
    primaryKey: ["user_id", "feature", "period_key"],
    columnTypes: {
      user_id: "scalar", feature: "scalar", period_key: "scalar", limit_count: "scalar",
      used_count: "scalar", reserved_count: "scalar",
    },
  },
]);

export function creditTargetDefinitions() {
  return TARGET_DEFINITIONS.map((definition) => ({
    ...definition,
    primaryKey: [...definition.primaryKey],
    columnTypes: { ...definition.columnTypes },
  }));
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, context) {
  if (!plainObject(value)) throw new Error(`${context} must be a JSON object`);
  return value;
}

function requiredString(value, context) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${context} must be a non-empty string`);
  if (result.includes("\0")) throw new Error(`${context} cannot contain a NUL byte`);
  return result;
}

function requiredLegacyIdentifier(value, context) {
  const result = requiredString(value, context);
  if (result !== value) {
    throw new Error(`${context} has surrounding whitespace and cannot be preserved exactly`);
  }
  return result;
}

function optionalTimestamp(value, context) {
  if (value == null || value === "") return null;
  return normalizeTimestamp(value, context);
}

function creditAmount(value, context, { positive = false, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${context} must be a finite JSON number`);
  if (positive ? value <= 0 : value < 0) throw new Error(`${context} must be ${positive ? "positive" : "nonnegative"}`);
  if (integer && !Number.isSafeInteger(value)) throw new Error(`${context} must be a safe integer`);
  if (!integer && Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) > 1e-7) {
    throw new Error(`${context} has more than six decimal places`);
  }
  if (value > MAX_CREDIT_AMOUNT) throw new Error(`${context} exceeds numeric(14,6)`);
  return value;
}

function optionalCreditAmount(value, context) {
  return value == null ? null : creditAmount(value, context);
}

function targetId(prefix, ...identity) {
  return `${prefix}_${sha256(stableStringify(identity)).slice(0, 24)}`;
}

function canonicalPlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  return PLAN_ALIASES[plan] || plan || "free";
}

function calendarBounds(period, context) {
  const match = String(period || "").match(CALENDAR_PERIOD);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`${context} has an invalid calendar month`);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function weekBounds(period, context) {
  const match = String(period || "").match(WEEK_PERIOD);
  if (!match) return null;
  const start = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== period) {
    throw new Error(`${context} has an invalid UTC date`);
  }
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 7 * 86_400_000).toISOString() };
}

function providerBounds(period, context) {
  const match = String(period || "").match(PROVIDER_PERIOD);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
    throw new Error(`${context} has an invalid provider cycle`);
  }
  const startsAt = new Date(start);
  const endsAt = new Date(end);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error(`${context} has an invalid provider cycle timestamp`);
  }
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function imagePeriodBounds(period, context) {
  return calendarBounds(period, context) || providerBounds(period, context)
    || (() => { throw new Error(`${context} is not a supported image-credit cycle`); })();
}

function addUnique(map, row, context) {
  const existing = map.get(row.id);
  if (existing && stableStringify(existing) !== stableStringify(row)) {
    throw new Error(`${context} produces conflicting normalized rows for ${row.id}`);
  }
  map.set(row.id, row);
  return row;
}

function windowRow({ userId, feature, periodKey, plan, allowance, used, bounds, legacyAllowanceUnknown = false }) {
  if (allowance == null && !legacyAllowanceUnknown) {
    throw new Error(`${userId}.${feature}.${periodKey} has no authoritative allowance`);
  }
  return {
    id: targetId("cwin", userId, feature, periodKey),
    user_id: userId,
    feature,
    period_key: periodKey,
    plan: plan || null,
    allowance,
    used,
    starts_at: bounds?.startsAt || null,
    ends_at: bounds?.endsAt || null,
    legacy_allowance_unknown: legacyAllowanceUnknown,
  };
}

function reservationIdentity(legacyId) {
  // Settlement and retry paths persist this exact value in AI job input and
  // reconstruct it from the client idempotency key. Re-keying it during ETL
  // would make an already authorized job impossible to settle safely.
  return { id: legacyId, idempotencyKey: legacyId };
}

function ledgerIdentity(userId, feature, kind, legacyId) {
  const identityHash = sha256(stableStringify([userId, feature, kind, legacyId]));
  return {
    id: targetId("cled", userId, feature, kind, legacyId),
    idempotencyKey: `legacy:v18:ledger:${identityHash}`,
  };
}

function settlementLedgerIdentity(legacyId) {
  const id = `settlement:${legacyId}`;
  return { id, idempotencyKey: id };
}

function inferredReservationCreatedAt(raw, capturedAt, context) {
  const explicit = optionalTimestamp(raw.createdAt, `${context}.createdAt`);
  return { createdAt: explicit || capturedAt, inferred: !explicit };
}

function assertUniqueLegacyReservationIds(snapshot) {
  const seen = new Map();
  const record = (value, context) => {
    const legacyId = requiredLegacyIdentifier(value, context);
    const previous = seen.get(legacyId);
    if (previous) {
      throw new Error(`legacy credit reservation id ${legacyId} is not globally unique (${previous} and ${context}); exact settlement/retry continuity cannot be preserved`);
    }
    seen.set(legacyId, context);
  };
  for (const [userId, accountValue] of Object.entries(snapshot)) {
    const accountContext = `lumiere_credits.${userId}`;
    const account = requireObject(accountValue, accountContext);
    const textReservations = account.textReservations == null
      ? {}
      : requireObject(account.textReservations, `${accountContext}.textReservations`);
    for (const legacyId of Object.keys(textReservations)) {
      record(legacyId, `${accountContext}.textReservations.${legacyId}`);
    }
    if (account.imageCredits != null) {
      const image = requireObject(account.imageCredits, `${accountContext}.imageCredits`);
      const imageReservations = image.reservations == null
        ? {}
        : requireObject(image.reservations, `${accountContext}.imageCredits.reservations`);
      for (const legacyId of Object.keys(imageReservations)) {
        record(legacyId, `${accountContext}.imageCredits.reservations.${legacyId}`);
      }
    }
    if (account.freeAllowances != null) {
      const allowances = requireObject(account.freeAllowances, `${accountContext}.freeAllowances`);
      for (const [feature, allowanceValue] of Object.entries(allowances)) {
        const allowance = requireObject(allowanceValue, `${accountContext}.freeAllowances.${feature}`);
        if (allowance.reservation != null) {
          const reservation = requireObject(allowance.reservation, `${accountContext}.freeAllowances.${feature}.reservation`);
          record(reservation.id, `${accountContext}.freeAllowances.${feature}.reservation.id`);
        }
      }
    }
  }
}

function assertNoActiveLegacyReservations(snapshot, capturedAt) {
  const captureTime = Date.parse(capturedAt);
  const active = (expiresAt, context) => {
    const normalized = optionalTimestamp(expiresAt, `${context}.expiresAt`);
    if (!normalized) throw new Error(`${context}.expiresAt is required`);
    if (Date.parse(normalized) > captureTime) {
      throw new Error(`active legacy credit reservation ${context} expires after the cutover snapshot; settle, release, or let it expire before recapturing`);
    }
  };
  for (const [userId, accountValue] of Object.entries(snapshot)) {
    const accountContext = `lumiere_credits.${userId}`;
    const account = requireObject(accountValue, accountContext);
    const textReservations = account.textReservations == null
      ? {}
      : requireObject(account.textReservations, `${accountContext}.textReservations`);
    for (const [legacyId, value] of Object.entries(textReservations)) {
      const reservation = requireObject(value, `${accountContext}.textReservations.${legacyId}`);
      if (String(reservation.state || "reserved").trim().toLowerCase() !== "settled") {
        active(reservation.expiresAt, `${accountContext}.textReservations.${legacyId}`);
      }
    }
    if (account.imageCredits != null) {
      const image = requireObject(account.imageCredits, `${accountContext}.imageCredits`);
      const imageReservations = image.reservations == null
        ? {}
        : requireObject(image.reservations, `${accountContext}.imageCredits.reservations`);
      for (const [legacyId, value] of Object.entries(imageReservations)) {
        const reservation = requireObject(value, `${accountContext}.imageCredits.reservations.${legacyId}`);
        active(reservation.expiresAt, `${accountContext}.imageCredits.reservations.${legacyId}`);
      }
    }
    if (account.freeAllowances != null) {
      const allowances = requireObject(account.freeAllowances, `${accountContext}.freeAllowances`);
      for (const [feature, value] of Object.entries(allowances)) {
        const allowance = requireObject(value, `${accountContext}.freeAllowances.${feature}`);
        if (allowance.reservation != null) {
          const reservation = requireObject(allowance.reservation,
            `${accountContext}.freeAllowances.${feature}.reservation`);
          active(reservation.expiresAt, `${accountContext}.freeAllowances.${feature}.reservation`);
        }
      }
    }
  }
}

function subscriptionPlanByUser(subscriptions) {
  return new Map((subscriptions || []).map((row) => {
    const userId = requiredString(row.user_id, "billing.subscriptions.user_id");
    const plan = String(row.status || "").trim().toLowerCase() === "active" ? canonicalPlan(row.plan) : "free";
    return [userId, { ...row, entitlementPlan: plan }];
  }));
}

function subscriptionImageCycle(subscription, context) {
  if (!subscription) return null;
  const stored = String(subscription.billing_cycle_key || "").trim();
  if (stored) {
    imagePeriodBounds(stored, `${context}.billing_cycle_key`);
    return stored;
  }
  const startsAt = optionalTimestamp(subscription.current_period_start, `${context}.current_period_start`);
  const endsAt = optionalTimestamp(subscription.current_period_end, `${context}.current_period_end`);
  if (!startsAt && !endsAt) return null;
  if (!startsAt || !endsAt) throw new Error(`${context} has an incomplete provider billing period`);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (end <= start) throw new Error(`${context} has an invalid provider billing period`);
  return `provider:${start}:${end}`;
}

function calendarCycleForTimestamp(capturedAt) {
  const date = new Date(capturedAt);
  const period = date.toISOString().slice(0, 7);
  const bounds = calendarBounds(period, "credit snapshot calendar cycle");
  return { key: period, startAt: bounds.startsAt, endAt: bounds.endsAt, source: "calendar" };
}

function weekKeyForTimestamp(capturedAt) {
  const date = new Date(capturedAt);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function validateBillingBinding(userId, account, subscription, capturedAt, enforceBilling) {
  if (!enforceBilling) return;
  const expectedPlan = subscription?.entitlementPlan || "free";
  const actualPlan = canonicalPlan(account.plan);
  if (actualPlan !== expectedPlan) {
    throw new Error(`lumiere_credits.${userId}.plan ${actualPlan} disagrees with billing subscription entitlement ${expectedPlan}`);
  }
  const image = plainObject(account.imageCredits) ? account.imageCredits : null;
  if (image?.plan != null && canonicalPlan(image.plan) !== actualPlan) {
    throw new Error(`lumiere_credits.${userId}.imageCredits.plan disagrees with the text-credit plan`);
  }
  const paid = Object.hasOwn({ creator: true, full: true }, expectedPlan);
  if (paid) {
    const expectedTextPeriod = calendarCycleForTimestamp(capturedAt).key;
    if (account.lifetime === true || String(account.period || "").trim() !== expectedTextPeriod) {
      throw new Error(`lumiere_credits.${userId}.period is not the current paid text-credit cycle`);
    }
    if (!plainObject(account.week)
      || String(account.week.key || "").trim() !== weekKeyForTimestamp(capturedAt)) {
      throw new Error(`lumiere_credits.${userId}.week.key is not the current paid weekly credit cycle`);
    }
  }
  const expectedCycle = subscriptionImageCycle(subscription, `subscriptions.${userId}`)
    || (paid ? calendarCycleForTimestamp(capturedAt).key : null);
  if (paid && !image) {
    throw new Error(`lumiere_credits.${userId} has no image-credit account for its active paid subscription`);
  }
  if (image && expectedCycle && expectedCycle !== image.period) {
    throw new Error(`lumiere_credits.${userId}.imageCredits.period disagrees with the subscription billing cycle`);
  }
}

function normalizeTextAccount({ userId, account, capturedAt, windows, reservations, ledger }) {
  const context = `lumiere_credits.${userId}`;
  const plan = canonicalPlan(requiredString(account.plan, `${context}.plan`));
  if (account.unlimited === true) throw new Error(`${context}.unlimited cannot be migrated as a production entitlement`);
  const lifetime = account.lifetime === true;
  const period = requiredString(account.period, `${context}.period`);
  if (lifetime ? period !== "lifetime" : !calendarBounds(period, `${context}.period`)) {
    throw new Error(`${context}.period is inconsistent with its lifetime flag`);
  }
  const allowance = creditAmount(account.limit, `${context}.limit`);
  // The legacy runtime deliberately treats lifetimeUsed as authoritative and
  // keeps used/week/session only as compatibility aliases for Free accounts.
  const used = creditAmount(lifetime ? (account.lifetimeUsed ?? account.used) : account.used,
    lifetime ? `${context}.lifetimeUsed` : `${context}.used`);
  if (used > allowance) throw new Error(`${context}.used exceeds its allowance`);
  const primaryFeature = lifetime ? "lumiere_text_lifetime" : "lumiere_text";
  const primaryWindow = addUnique(windows, windowRow({
    userId,
    feature: primaryFeature,
    periodKey: period,
    plan,
    allowance,
    used,
    bounds: lifetime ? null : calendarBounds(period, `${context}.period`),
  }), context);

  const week = requireObject(account.week, `${context}.week`);
  const weekKey = requiredString(week.key, `${context}.week.key`);
  const weekAllowance = creditAmount(week.limit, `${context}.week.limit`);
  const weekUsed = lifetime ? used : creditAmount(week.used, `${context}.week.used`);
  if (weekUsed > weekAllowance) throw new Error(`${context}.week.used exceeds its allowance`);
  if (lifetime ? weekKey !== "lifetime" : !weekBounds(weekKey, `${context}.week.key`)) {
    throw new Error(`${context}.week.key is inconsistent with its lifetime flag`);
  }
  addUnique(windows, windowRow({
    userId,
    feature: "lumiere_text_week",
    periodKey: weekKey,
    plan,
    allowance: weekAllowance,
    used: weekUsed,
    bounds: lifetime ? null : weekBounds(weekKey, `${context}.week.key`),
  }), context);

  const session = requireObject(account.session, `${context}.session`);
  const sessionAllowance = creditAmount(session.limit, `${context}.session.limit`);
  const sessionUsed = lifetime ? used : creditAmount(session.used, `${context}.session.used`);
  if (sessionUsed > sessionAllowance) throw new Error(`${context}.session.used exceeds its allowance`);
  const sessionStartedAt = optionalTimestamp(session.startedAt, `${context}.session.startedAt`);
  if (sessionUsed > 0 && !sessionStartedAt && !lifetime) throw new Error(`${context}.session used credits without a start timestamp`);
  if (lifetime || sessionStartedAt) {
    addUnique(windows, windowRow({
      userId,
      feature: "lumiere_text_session",
      periodKey: lifetime ? "lifetime" : sessionStartedAt,
      plan,
      allowance: sessionAllowance,
      used: sessionUsed,
      bounds: sessionStartedAt ? { startsAt: sessionStartedAt, endsAt: null } : null,
    }), context);
  }

  optionalTimestamp(account.lastResetAt, `${context}.lastResetAt`);
  const rawReservations = account.textReservations == null ? {} : requireObject(account.textReservations, `${context}.textReservations`);
  let settledInPrimaryWindow = 0;
  for (const [legacyIdValue, rawValue] of Object.entries(rawReservations)) {
    const legacyId = requiredLegacyIdentifier(legacyIdValue, `${context}.textReservations id`);
    const raw = requireObject(rawValue, `${context}.textReservations.${legacyId}`);
    const amount = creditAmount(raw.amount, `${context}.textReservations.${legacyId}.amount`, { positive: true });
    const createdAt = optionalTimestamp(raw.createdAt, `${context}.textReservations.${legacyId}.createdAt`);
    const expiresAt = optionalTimestamp(raw.expiresAt, `${context}.textReservations.${legacyId}.expiresAt`);
    if (!expiresAt) throw new Error(`${context}.textReservations.${legacyId}.expiresAt is required`);
    const sourceState = raw.state == null ? "reserved" : requiredString(raw.state, `${context}.textReservations.${legacyId}.state`);
    if (sourceState !== "reserved" && sourceState !== "settled") {
      throw new Error(`${context}.textReservations.${legacyId}.state is unsupported`);
    }
    const settledAt = optionalTimestamp(raw.settledAt, `${context}.textReservations.${legacyId}.settledAt`);
    if (sourceState === "settled" && !settledAt) throw new Error(`${context}.textReservations.${legacyId} is settled without settledAt`);
    if (sourceState !== "settled" && settledAt) throw new Error(`${context}.textReservations.${legacyId} has settledAt without settled state`);
    if (sourceState === "settled" && !plainObject(raw.receipt)) throw new Error(`${context}.textReservations.${legacyId} is settled without a receipt`);
    if (sourceState === "settled" && !lifetime && settledAt.slice(0, 7) !== period) {
      throw new Error(`${context}.textReservations.${legacyId} settled outside the recorded text period and needs remediation`);
    }
    const expired = Date.parse(expiresAt) <= Date.parse(capturedAt);
    // A receipt TTL controls how long the legacy API returned the cached
    // response; it does not undo a charge that already settled. Keep settled
    // reservations settled forever so a migrated idempotency key can never be
    // replayed into a second charge.
    const targetState = sourceState === "settled" ? "settled" : expired ? "expired" : "reserved";
    const identity = reservationIdentity(legacyId);
    const reservation = {
      id: identity.id,
      window_id: primaryWindow.id,
      user_id: userId,
      feature: primaryFeature,
      amount,
      state: targetState,
      idempotency_key: identity.idempotencyKey,
      metadata: {
        legacy_kind: "text_reservation",
        legacy_id: legacyId,
        legacy_state: sourceState,
        ...(createdAt ? { legacy_created_at: createdAt } : {}),
        legacy_created_at_inferred: !createdAt,
        ...(plainObject(raw.receipt) ? { receipt: raw.receipt } : {}),
      },
      expires_at: expiresAt,
      settled_at: settledAt,
      released_at: null,
      created_at: createdAt || capturedAt,
    };
    addUnique(reservations, reservation, context);
    if (sourceState === "settled") {
      settledInPrimaryWindow += amount;
      const ledgerId = settlementLedgerIdentity(legacyId);
      addUnique(ledger, {
        id: ledgerId.id,
        window_id: primaryWindow.id,
        user_id: userId,
        reservation_id: identity.id,
        feature: primaryFeature,
        entry_type: "settlement",
        amount,
        idempotency_key: ledgerId.idempotencyKey,
        metadata: { legacy_kind: "text_settlement", legacy_id: legacyId, legacy_settled_at: settledAt },
        created_at: settledAt,
      }, context);
    }
  }
  if (settledInPrimaryWindow > used) {
    throw new Error(`${context}.textReservations settled amount exceeds recorded text usage`);
  }
  const unattributedUsed = used - settledInPrimaryWindow;
  if (unattributedUsed > 0) {
    const identity = ledgerIdentity(userId, primaryFeature, "usage_snapshot", period);
    addUnique(ledger, {
      id: identity.id,
      window_id: primaryWindow.id,
      user_id: userId,
      reservation_id: null,
      feature: primaryFeature,
      entry_type: "legacy_usage_snapshot",
      amount: unattributedUsed,
      idempotency_key: identity.idempotencyKey,
      metadata: {
        legacy_kind: "text_usage_remainder",
        period_key: period,
        legacy_created_at_inferred: true,
      },
      created_at: capturedAt,
    }, context);
  }
  return { plan, primaryFeature, primaryWindow };
}

function normalizeImageAccount({ userId, account, plan, capturedAt, windows, reservations, ledger }) {
  if (account.imageCredits == null) return;
  const context = `lumiere_credits.${userId}.imageCredits`;
  const image = requireObject(account.imageCredits, context);
  if (image.unlimited === true) throw new Error(`${context}.unlimited cannot be migrated as a production entitlement`);
  const period = image.period == null ? null : requiredString(image.period, `${context}.period`);
  const allowance = optionalCreditAmount(image.limit, `${context}.limit`);
  const used = creditAmount(image.used ?? 0, `${context}.used`);
  const storedReserved = creditAmount(image.reserved ?? 0, `${context}.reserved`);
  if (!period) {
    if (allowance !== 0 || used !== 0 || storedReserved !== 0) throw new Error(`${context} has a balance without a billing cycle`);
  } else if (allowance == null) {
    throw new Error(`${context} current cycle has no authoritative allowance`);
  }
  const usageSource = image.usageByPeriod == null ? {} : requireObject(image.usageByPeriod, `${context}.usageByPeriod`);
  const usageByPeriod = new Map();
  for (const [usagePeriod, usageValue] of Object.entries(usageSource)) {
    imagePeriodBounds(usagePeriod, `${context}.usageByPeriod.${usagePeriod}`);
    usageByPeriod.set(usagePeriod, creditAmount(usageValue, `${context}.usageByPeriod.${usagePeriod}`));
  }
  if (period) {
    imagePeriodBounds(period, `${context}.period`);
    if (usageByPeriod.has(period) && usageByPeriod.get(period) !== used) {
      throw new Error(`${context}.used disagrees with usageByPeriod for its current cycle`);
    }
    usageByPeriod.set(period, used);
  }
  const carryForwardByPeriod = new Map();
  if (period && PROVIDER_PERIOD.test(period) && plainObject(image.cycle)
    && String(image.cycle.source || "").trim().toLowerCase() === "provider"
    && String(image.cycle.key || "").trim() === period) {
    const providerCycle = providerBounds(period, `${context}.period`);
    const sourcePeriod = providerCycle.startsAt.slice(0, 7);
    if (usageByPeriod.has(sourcePeriod)) {
      const carried = usageByPeriod.get(sourcePeriod);
      if (carried > used) {
        throw new Error(`${context}.usageByPeriod.${sourcePeriod} exceeds the provider-cycle usage it was carried into`);
      }
      carryForwardByPeriod.set(period, { sourcePeriod, amount: carried });
    }
  }
  const windowByPeriod = new Map();
  for (const [usagePeriod, usage] of usageByPeriod) {
    // Free/ineligible accounts retain a zero calendar marker in the legacy
    // runtime even though no image entitlement exists. It is not a historical
    // balance and must not become an allowance-unknown credit window.
    if (!period && usage === 0) continue;
    const current = usagePeriod === period;
    const row = addUnique(windows, windowRow({
      userId,
      feature: "imagine_image",
      periodKey: usagePeriod,
      plan: current ? canonicalPlan(image.plan == null ? plan : requiredString(image.plan, `${context}.plan`)) : null,
      allowance: current ? allowance : null,
      used: usage,
      bounds: imagePeriodBounds(usagePeriod, `${context}.usageByPeriod.${usagePeriod}`),
      legacyAllowanceUnknown: !current,
    }), context);
    windowByPeriod.set(usagePeriod, row);
    const carryForward = carryForwardByPeriod.get(usagePeriod);
    if (carryForward?.amount > 0) {
      const identity = ledgerIdentity(userId, "imagine_image", "carry_forward",
        `${carryForward.sourcePeriod}:${usagePeriod}`);
      addUnique(ledger, {
        id: identity.id,
        window_id: row.id,
        user_id: userId,
        reservation_id: null,
        feature: "imagine_image",
        entry_type: "legacy_carry_forward",
        amount: carryForward.amount,
        idempotency_key: identity.idempotencyKey,
        metadata: {
          legacy_kind: "image_usage_carry_forward",
          source_period_key: carryForward.sourcePeriod,
          target_period_key: usagePeriod,
          non_consumption: true,
          legacy_created_at_inferred: true,
        },
        created_at: capturedAt,
      }, context);
    }
    const incrementalUsage = usage - (carryForward?.amount || 0);
    if (incrementalUsage > 0) {
      const identity = ledgerIdentity(userId, "imagine_image", "usage_snapshot", usagePeriod);
      addUnique(ledger, {
        id: identity.id,
        window_id: row.id,
        user_id: userId,
        reservation_id: null,
        feature: "imagine_image",
        entry_type: "legacy_usage_snapshot",
        amount: incrementalUsage,
        idempotency_key: identity.idempotencyKey,
        metadata: {
          legacy_kind: "image_usage_snapshot",
          period_key: usagePeriod,
          raw_window_used: usage,
          carried_forward: carryForward?.amount || 0,
          legacy_created_at_inferred: true,
        },
        created_at: capturedAt,
      }, context);
    }
  }
  const rawReservations = image.reservations == null ? {} : requireObject(image.reservations, `${context}.reservations`);
  let storedCurrentReservationTotal = 0;
  for (const [legacyIdValue, rawValue] of Object.entries(rawReservations)) {
    const legacyId = requiredLegacyIdentifier(legacyIdValue, `${context}.reservations id`);
    const raw = requireObject(rawValue, `${context}.reservations.${legacyId}`);
    if (raw.state != null) throw new Error(`${context}.reservations.${legacyId}.state is unsupported legacy data`);
    const amount = creditAmount(raw.amount, `${context}.reservations.${legacyId}.amount`, { positive: true });
    const reservationPeriod = raw.period == null ? period : requiredString(raw.period, `${context}.reservations.${legacyId}.period`);
    if (!reservationPeriod) throw new Error(`${context}.reservations.${legacyId} has no attributable cycle`);
    const bounds = imagePeriodBounds(reservationPeriod, `${context}.reservations.${legacyId}.period`);
    let window = windowByPeriod.get(reservationPeriod);
    if (!window) {
      const current = reservationPeriod === period;
      window = addUnique(windows, windowRow({
        userId,
        feature: "imagine_image",
        periodKey: reservationPeriod,
        plan: current ? canonicalPlan(image.plan == null ? plan : requiredString(image.plan, `${context}.plan`)) : null,
        allowance: current ? allowance : null,
        used: current ? used : 0,
        bounds,
        legacyAllowanceUnknown: !current,
      }), context);
      windowByPeriod.set(reservationPeriod, window);
    }
    const expiresAt = optionalTimestamp(raw.expiresAt, `${context}.reservations.${legacyId}.expiresAt`);
    if (!expiresAt) throw new Error(`${context}.reservations.${legacyId}.expiresAt is required`);
    const creation = inferredReservationCreatedAt(raw, capturedAt, `${context}.reservations.${legacyId}`);
    const expired = Date.parse(expiresAt) <= Date.parse(capturedAt);
    if (reservationPeriod === period) storedCurrentReservationTotal += amount;
    const identity = reservationIdentity(legacyId);
    addUnique(reservations, {
      id: identity.id,
      window_id: window.id,
      user_id: userId,
      feature: "imagine_image",
      amount,
      state: expired ? "expired" : "reserved",
      idempotency_key: identity.idempotencyKey,
      metadata: {
        legacy_kind: "image_reservation",
        legacy_id: legacyId,
        legacy_period_was_implicit: raw.period == null,
        legacy_created_at_inferred: creation.inferred,
      },
      expires_at: expiresAt,
      settled_at: null,
      released_at: null,
      created_at: creation.createdAt,
    }, context);
  }
  if (storedCurrentReservationTotal !== storedReserved) {
    throw new Error(`${context}.reserved disagrees with its reservation records`);
  }
  if (period && image.remaining != null) {
    const remaining = creditAmount(image.remaining, `${context}.remaining`);
    const expected = Math.max(0, allowance - used - storedReserved);
    if (remaining !== expected) throw new Error(`${context}.remaining disagrees with its allowance, usage, and reservations`);
  }
  if (image.costPerImage != null) creditAmount(image.costPerImage, `${context}.costPerImage`, { positive: true });
  const resetAt = optionalTimestamp(image.resetAt, `${context}.resetAt`);
  if (plainObject(image.cycle)) {
    const cycleKey = requiredString(image.cycle.key, `${context}.cycle.key`);
    // Ineligible/free accounts deliberately retain a calendar-cycle marker
    // while `period` is null. It is renewal context, not an entitlement or a
    // zero-valued current window, and remains only in legacy_snapshot.
    if (period && cycleKey !== period) throw new Error(`${context}.cycle.key disagrees with period`);
    const bounds = imagePeriodBounds(cycleKey, `${context}.cycle.key`);
    const startAt = optionalTimestamp(image.cycle.startAt, `${context}.cycle.startAt`);
    const endAt = optionalTimestamp(image.cycle.endAt, `${context}.cycle.endAt`);
    if (startAt && startAt !== bounds.startsAt) throw new Error(`${context}.cycle.startAt disagrees with its key`);
    if (endAt && endAt !== bounds.endsAt) throw new Error(`${context}.cycle.endAt disagrees with its key`);
    if (resetAt && resetAt !== bounds.endsAt) throw new Error(`${context}.resetAt disagrees with its cycle`);
  }
}

function normalizeFreeAllowances({ userId, account, capturedAt, windows, reservations, ledger, allowances }) {
  if (account.freeAllowances == null) return;
  const context = `lumiere_credits.${userId}.freeAllowances`;
  const source = requireObject(account.freeAllowances, context);
  for (const unknown of Object.keys(source).filter((feature) => !Object.hasOwn(FREE_FEATURE_LIMITS, feature))) {
    throw new Error(`${context}.${unknown} is not a recognized lifetime allowance`);
  }
  for (const [feature, rawValue] of Object.entries(source)) {
    const raw = requireObject(rawValue, `${context}.${feature}`);
    const limit = FREE_FEATURE_LIMITS[feature];
    const used = creditAmount(raw.used ?? 0, `${context}.${feature}.used`, { integer: true });
    if (used > limit) throw new Error(`${context}.${feature}.used exceeds the policy limit`);
    const usedAt = optionalTimestamp(raw.usedAt, `${context}.${feature}.usedAt`);
    if (used > 0 && !usedAt) throw new Error(`${context}.${feature} has usage without usedAt evidence`);
    const targetFeature = `free_${feature}`;
    const window = addUnique(windows, windowRow({
      userId,
      feature: targetFeature,
      periodKey: "lifetime",
      plan: "free",
      allowance: limit,
      used,
      bounds: null,
    }), context);
    let activeReserved = 0;
    if (raw.reservation != null) {
      const sourceReservation = requireObject(raw.reservation, `${context}.${feature}.reservation`);
      const legacyId = requiredLegacyIdentifier(sourceReservation.id, `${context}.${feature}.reservation.id`);
      const expiresAt = optionalTimestamp(sourceReservation.expiresAt, `${context}.${feature}.reservation.expiresAt`);
      if (!expiresAt) throw new Error(`${context}.${feature}.reservation.expiresAt is required`);
      const creation = inferredReservationCreatedAt(sourceReservation, capturedAt,
        `${context}.${feature}.reservation`);
      const expired = Date.parse(expiresAt) <= Date.parse(capturedAt);
      activeReserved = expired ? 0 : 1;
      const identity = reservationIdentity(legacyId);
      addUnique(reservations, {
        id: identity.id,
        window_id: window.id,
        user_id: userId,
        feature: targetFeature,
        amount: 1,
        state: expired ? "expired" : "reserved",
        idempotency_key: identity.idempotencyKey,
        metadata: {
          legacy_kind: "free_allowance_reservation",
          legacy_id: legacyId,
          legacy_created_at_inferred: creation.inferred,
        },
        expires_at: expiresAt,
        settled_at: null,
        released_at: null,
        created_at: creation.createdAt,
      }, context);
    }
    allowances.push({
      user_id: userId,
      feature,
      period_key: "lifetime",
      limit_count: limit,
      used_count: used,
      reserved_count: activeReserved,
    });
    if (used > 0) {
      const identity = ledgerIdentity(userId, targetFeature, "usage_snapshot", "lifetime");
      addUnique(ledger, {
        id: identity.id,
        window_id: window.id,
        user_id: userId,
        reservation_id: null,
        feature: targetFeature,
        entry_type: "legacy_usage_snapshot",
        amount: used,
        idempotency_key: identity.idempotencyKey,
        metadata: {
          legacy_kind: "free_allowance_usage",
          ...(usedAt ? { legacy_used_at: usedAt } : {}),
          legacy_created_at_inferred: !usedAt,
        },
        created_at: usedAt,
      }, context);
    }
  }
}

function sortedRows(rows, primaryKey) {
  return [...rows].sort((left, right) => stableStringify(primaryKey.map((key) => left[key]))
    .localeCompare(stableStringify(primaryKey.map((key) => right[key]))));
}

export function normalizeLegacyCredits({
  appSettings,
  profiles,
  subscriptions = [],
  aiJobs = [],
  capturedAt,
  enforceBilling = false,
}) {
  const captureTimestamp = normalizeTimestamp(capturedAt, "credit snapshot capturedAt");
  const settings = new Map((appSettings || []).map((row) => [row.key, row.value]));
  const rawSnapshot = settings.get("lumiere_credits");
  const snapshot = rawSnapshot == null ? {} : requireObject(rawSnapshot, "app_settings.lumiere_credits");
  assertUniqueLegacyReservationIds(snapshot);
  const profileIds = new Set((profiles || []).map((row) => String(row.id || "")));
  const subscriptionByUser = subscriptionPlanByUser(subscriptions);
  if (enforceBilling) {
    for (const job of aiJobs || []) {
      const status = String(job.status || "").trim().toLowerCase();
      if (ACTIVE_AI_JOB_STATUSES.has(status)) {
        throw new Error(`active AI job ${job.id || "unknown"} has status ${status}; finish or cancel it before the credit cutover snapshot`);
      }
    }
    assertNoActiveLegacyReservations(snapshot, captureTimestamp);
  }
  const accounts = [];
  const windows = new Map();
  const reservations = new Map();
  const ledger = new Map();
  const allowances = [];

  for (const [userIdValue, accountValue] of Object.entries(snapshot)) {
    const userId = requiredString(userIdValue, "app_settings.lumiere_credits user id");
    if (!profileIds.has(userId)) throw new Error(`app_settings.lumiere_credits references unknown profile ${userId}`);
    const account = requireObject(accountValue, `lumiere_credits.${userId}`);
    validateBillingBinding(userId, account, subscriptionByUser.get(userId), captureTimestamp, enforceBilling);
    accounts.push({ user_id: userId, legacy_snapshot: account });
    const text = normalizeTextAccount({ userId, account, capturedAt: captureTimestamp, windows, reservations, ledger });
    normalizeImageAccount({ userId, account, plan: text.plan, capturedAt: captureTimestamp, windows, reservations, ledger });
    normalizeFreeAllowances({ userId, account, capturedAt: captureTimestamp, windows, reservations, ledger, allowances });
  }

  if (enforceBilling) {
    for (const [userId, subscription] of subscriptionByUser) {
      if (["creator", "full"].includes(subscription.entitlementPlan) && !Object.hasOwn(snapshot, userId)) {
        throw new Error(`active paid subscription ${userId} has no lumiere_credits account; materialize an authoritative ledger before cutover or provide an explicitly reviewed remediation manifest`);
      }
    }
    const activeReservationRows = [...reservations.values()].filter((row) => row.state === "reserved");
    if (activeReservationRows.length) {
      throw new Error(`strict credit cutover produced ${activeReservationRows.length} active reservation rows; recapture after all credit work is quiescent`);
    }
  }

  const rowsByTarget = new Map([
    ["private.credit_accounts", sortedRows(accounts, ["user_id"])],
    ["private.credit_windows", sortedRows(windows.values(), ["id"])],
    ["private.credit_reservations", sortedRows(reservations.values(), ["id"])],
    ["private.credit_ledger", sortedRows(ledger.values(), ["id"])],
    ["private.feature_allowances", sortedRows(allowances, ["user_id", "feature", "period_key"])],
  ]);
  const normalizedContract = [...rowsByTarget].map(([target, rows]) => ({ target, rows }));
  const summary = {
    status: "verified",
    capturedAt: captureTimestamp,
    sourceSha256: sha256(stableStringify(snapshot)),
    normalizedSha256: sha256(stableStringify(normalizedContract)),
    accountCount: accounts.length,
    windowCount: windows.size,
    reservationCount: reservations.size,
    activeReservationCount: [...reservations.values()].filter((row) => row.state === "reserved").length,
    settledReservationCount: [...reservations.values()].filter((row) => row.metadata.legacy_state === "settled").length,
    expiredReservationCount: [...reservations.values()].filter((row) => row.state === "expired").length,
    ledgerEntryCount: ledger.size,
    allowanceCount: allowances.length,
  };
  return { rowsByTarget, summary };
}

export function validateNormalizedCreditGraph({ tables, capturedAt, enforceBilling = false }) {
  const byTarget = new Map((tables || []).map((table) => [table.target, table.rows || []]));
  const expected = normalizeLegacyCredits({
    appSettings: byTarget.get("private.app_settings") || [],
    profiles: byTarget.get("public.profiles") || [],
    subscriptions: byTarget.get("billing.subscriptions") || [],
    aiJobs: byTarget.get("public.ai_jobs") || [],
    capturedAt,
    enforceBilling,
  });
  for (const definition of TARGET_DEFINITIONS) {
    const actualRows = sortedRows(byTarget.get(definition.target) || [], definition.primaryKey);
    const expectedRows = expected.rowsByTarget.get(definition.target) || [];
    if (stableStringify(actualRows) !== stableStringify(expectedRows)) {
      throw new Error(`${definition.target} does not reconcile to private.app_settings lumiere_credits`);
    }
  }
  return expected.summary;
}
