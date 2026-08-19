import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runLedgerScenario() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-credit-reservations-"));
  const source = `
    import {
      connectGoogleIdentity,
      createSession,
      saveBillingSnapshot,
      saveLumiereCreditsSnapshot,
    } from "./database.js";
    import { __entitlementTesting as entitlements } from "./server.js";

    const freeSession = createSession();
    const freeUser = connectGoogleIdentity(freeSession.session.id, {
      sub: "free-credit-reservation-test",
      email: "free-credit-reservation@example.test",
      name: "Free writer",
    });
    const firstReservation = entitlements.reserveFreeAllowance(freeUser.id, "analysis");
    const heldAllowance = entitlements.freeAllowancesFor(freeUser.id).analysis;
    const released = entitlements.releaseFreeAllowanceReservation(
      freeUser.id,
      "analysis",
      firstReservation.reservationId,
    );
    const releasedAllowance = entitlements.freeAllowancesFor(freeUser.id).analysis;
    const secondReservation = entitlements.reserveFreeAllowance(freeUser.id, "analysis");
    const settled = entitlements.settleFreeAllowanceReservation(
      freeUser.id,
      "analysis",
      secondReservation.reservationId,
    );
    const settledAllowance = entitlements.freeAllowancesFor(freeUser.id).analysis;

    const fullSession = createSession();
    const fullUser = connectGoogleIdentity(fullSession.session.id, {
      sub: "full-credit-reservation-test",
      email: "full-credit-reservation@example.test",
      name: "Full writer",
    });
    saveBillingSnapshot({
      users: {
        [fullUser.id]: {
          ...fullUser,
          subscription: {
            plan: "full",
            status: "active",
            updatedAt: new Date().toISOString(),
          },
        },
      },
      checkouts: {},
    });
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const priorDate = new Date();
    priorDate.setUTCMonth(priorDate.getUTCMonth() - 1, 1);
    const priorPeriod = priorDate.toISOString().slice(0, 7);
    const reservationId = "imgres_cross_month";
    saveLumiereCreditsSnapshot({
      [fullUser.id]: {
        imageCredits: {
          period: priorPeriod,
          used: 997,
          reservations: {
            [reservationId]: {
              amount: 3,
              period: priorPeriod,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            },
          },
        },
      },
    });
    const beforeSettlement = entitlements.imageCreditsFor(fullUser.id);
    const settledImage = entitlements.settleImageCreditReservation(fullUser.id, reservationId);
    const afterSettlement = entitlements.imageCreditsFor(fullUser.id);
    console.log(JSON.stringify({
      currentPeriod,
      priorPeriod,
      free: {
        firstAllowed: firstReservation.allowed,
        held: heldAllowance,
        released,
        releasedAllowance,
        secondAllowed: secondReservation.allowed,
        settled,
        settledAllowance,
      },
      images: { beforeSettlement, settledImage, afterSettlement },
    }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function runProviderCycleScenario() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-provider-cycle-"));
  const source = `
    import {
      connectGoogleIdentity,
      createSession,
      getSubscription,
      saveBillingSnapshot,
      saveLumiereCreditsSnapshot,
    } from "./database.js";
    import { __entitlementTesting as entitlements } from "./server.js";

    const now = Date.now();
    const iso = (value) => new Date(value).toISOString();
    const currentStart = now - 2 * 24 * 60 * 60 * 1000;
    const currentEnd = now + 27 * 24 * 60 * 60 * 1000;
    const currentCycleKey = "provider:" + currentStart + ":" + currentEnd;
    const previousStart = now - 31 * 24 * 60 * 60 * 1000;
    const previousEnd = now - 3 * 24 * 60 * 60 * 1000;
    const previousCycleKey = "provider:" + previousStart + ":" + previousEnd;
    const createFullUser = (sub, email) => {
      const session = createSession();
      const user = connectGoogleIdentity(session.session.id, { sub, email, name: "Full writer" });
      saveBillingSnapshot({
        users: {
          [user.id]: {
            ...user,
            subscription: {
              plan: "full",
              status: "active",
              billingCycleKey: currentCycleKey,
              currentPeriodStart: iso(currentStart),
              currentPeriodEnd: iso(currentEnd),
              updatedAt: iso(now),
            },
          },
        },
        checkouts: {},
      });
      return user;
    };

    const providerUser = createFullUser("provider-cycle-user", "provider-cycle@example.test");
    const providerBefore = entitlements.imageCreditsFor(providerUser.id);
    const providerReservation = entitlements.reserveImageCredits(providerUser.id);
    const providerSettled = entitlements.settleImageCreditReservation(providerUser.id, providerReservation.reservationId);

    const crossUser = createFullUser("provider-cycle-cross-user", "provider-cycle-cross@example.test");
    const crossReservationId = "imgres_provider_cycle";
    saveLumiereCreditsSnapshot({
      [crossUser.id]: {
        imageCredits: {
          period: previousCycleKey,
          used: 997,
          reservations: {
            [crossReservationId]: {
              amount: 3,
              period: previousCycleKey,
              expiresAt: iso(now + 60 * 60 * 1000),
            },
          },
        },
      },
    });
    const crossBefore = entitlements.imageCreditsFor(crossUser.id);
    const crossSettled = entitlements.settleImageCreditReservation(crossUser.id, crossReservationId);
    const crossAfter = entitlements.imageCreditsFor(crossUser.id);

    const fallbackSession = createSession();
    const fallbackUser = connectGoogleIdentity(fallbackSession.session.id, {
      sub: "provider-cycle-fallback-user", email: "provider-cycle-fallback@example.test", name: "Fallback writer",
    });
    saveBillingSnapshot({
      users: {
        [fallbackUser.id]: {
          ...fallbackUser,
          subscription: { plan: "full", status: "active", updatedAt: iso(now) },
        },
      },
      checkouts: {},
    });
    const fallback = entitlements.imageCreditsFor(fallbackUser.id);

    const migratedUser = createFullUser("provider-cycle-migrated-user", "provider-cycle-migrated@example.test");
    const calendarKey = iso(now).slice(0, 7);
    saveLumiereCreditsSnapshot({
      [migratedUser.id]: {
        imageCredits: { period: calendarKey, used: 9 },
      },
    });
    const migrated = entitlements.imageCreditsFor(migratedUser.id);

    console.log(JSON.stringify({
      currentCycleKey,
      previousCycleKey,
      provider: {
        stored: getSubscription(providerUser.id),
        before: providerBefore,
        settled: providerSettled,
      },
      cross: { before: crossBefore, settled: crossSettled, after: crossAfter },
      fallback: { expectedKey: calendarKey, state: fallback },
      migrated,
    }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test("Free grants settle only after a result and image reservations charge their originating cycle", () => {
  const scenario = runLedgerScenario();

  assert.equal(scenario.free.firstAllowed, true);
  assert.equal(scenario.free.held.used, 0);
  assert.equal(scenario.free.held.remaining, 1);
  assert.equal(scenario.free.held.reserved, true);
  assert.equal(scenario.free.released, true);
  assert.equal(scenario.free.releasedAllowance.used, 0);
  assert.equal(scenario.free.releasedAllowance.remaining, 1);
  assert.equal(scenario.free.releasedAllowance.reserved, false);
  assert.equal(scenario.free.secondAllowed, true);
  assert.equal(scenario.free.settled, true);
  assert.equal(scenario.free.settledAllowance.used, 1);
  assert.equal(scenario.free.settledAllowance.remaining, 0);
  assert.equal(scenario.free.settledAllowance.reserved, false);

  assert.equal(scenario.images.beforeSettlement.period, scenario.currentPeriod);
  assert.equal(scenario.images.beforeSettlement.used, 0);
  assert.equal(scenario.images.beforeSettlement.reserved, 0);
  assert.equal(scenario.images.beforeSettlement.reservations.imgres_cross_month.period, scenario.priorPeriod);
  assert.equal(scenario.images.settledImage.usageByPeriod[scenario.priorPeriod], 1000);
  assert.equal(scenario.images.afterSettlement.usageByPeriod[scenario.priorPeriod], 1000);
  assert.equal(scenario.images.afterSettlement.used, 0);
  assert.equal(scenario.images.afterSettlement.remaining, 1000);
  assert.equal(scenario.images.afterSettlement.reservations.imgres_cross_month, undefined);
});

test("Full image credits follow Recurrente's billing cycle and preserve legacy ledger evidence", () => {
  const scenario = runProviderCycleScenario();

  assert.equal(scenario.provider.stored.billingCycleKey, scenario.currentCycleKey);
  assert.match(scenario.provider.stored.currentPeriodStart, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(scenario.provider.stored.currentPeriodEnd, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(scenario.provider.before.period, scenario.currentCycleKey);
  assert.equal(scenario.provider.before.cycle.source, "provider");
  assert.equal(scenario.provider.before.limit, 1000);
  assert.equal(scenario.provider.before.remaining, 1000);
  assert.equal(scenario.provider.settled.usageByPeriod[scenario.currentCycleKey], 3);
  assert.equal(scenario.provider.settled.remaining, 997);

  assert.equal(scenario.cross.before.period, scenario.currentCycleKey);
  assert.equal(scenario.cross.before.used, 0);
  assert.equal(scenario.cross.before.reserved, 0);
  assert.equal(scenario.cross.before.reservations.imgres_provider_cycle.period, scenario.previousCycleKey);
  assert.equal(scenario.cross.settled.usageByPeriod[scenario.previousCycleKey], 1000);
  assert.equal(scenario.cross.after.used, 0);
  assert.equal(scenario.cross.after.remaining, 1000);

  assert.equal(scenario.fallback.state.period, scenario.fallback.expectedKey);
  assert.equal(scenario.fallback.state.cycle.source, "calendar");
  assert.equal(scenario.fallback.state.limit, 1000);
  assert.equal(scenario.migrated.period, scenario.currentCycleKey);
  assert.equal(scenario.migrated.used, 9);
  assert.equal(scenario.migrated.remaining, 991);
  assert.equal(scenario.migrated.usageByPeriod[scenario.currentCycleKey], 9);
});

test("every Free background job passes a reservation through to a settle-or-release boundary", () => {
  const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

  for (const [feature, worker] of [
    ["storyboard", "generateShotLists"],
    ["breakdown", "analyzeProject"],
    ["analysis", "runScriptAnalysis"],
  ]) {
    assert.match(server, new RegExp(`reserveFreeAllowance\\((?:sid|billingUserId), "${feature}"\\)`));
    assert.match(server, new RegExp(`async function ${worker}[^\\n]*freeAllowanceReservationId`));
    assert.match(server, new RegExp(`releaseFreeAllowanceReservation\\((?:sid|billingUserId), "${feature}", freeAllowanceReservationId\\)`));
    assert.match(server, new RegExp(`settleFreeAllowanceReservation\\((?:sid|billingUserId), "${feature}", freeAllowanceReservationId\\)`));
    assert.match(server, new RegExp(`releaseActiveFreeAllowanceReservation\\((?:sid|projectBillingOwnerId\\(scriptId\\) \\|\\| sid), "${feature}"\\)`));
  }
});
