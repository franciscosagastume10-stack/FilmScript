import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("authenticated pages load the private profile onboarding flow", async () => {
  const onboarding = await fs.readFile(path.join(ROOT, "profile-onboarding.js"), "utf8");
  assert.match(onboarding, /profile_skipped/);
  assert.match(onboarding, /birthday_greeted/);
  assert.match(onboarding, /Happy birthday/);
  assert.match(onboarding, /value="man"/);
  assert.match(onboarding, /value="woman"/);
  assert.match(onboarding, /type="date"/);
  assert.match(onboarding, /name="firstName"[^>]*autocomplete="given-name"[^>]*required/);
  assert.match(onboarding, /name="lastName"[^>]*autocomplete="family-name"[^>]*required/);
  assert.match(onboarding, /id="fs-profile-email"[^>]*type="email"[^>]*readonly/);
  assert.match(onboarding, /identityComplete = Boolean\(identity\.firstName && identity\.lastName\)/);
  assert.match(onboarding, /firstName: firstName\.value\.trim\(\)/);
  assert.match(onboarding, /lastName: lastName\.value\.trim\(\)/);
  assert.match(onboarding, /backdrop-filter: blur\(38px\) saturate\(1\.36\)/);
  assert.match(onboarding, /-webkit-backdrop-filter: blur\(38px\) saturate\(1\.36\)/);
  assert.match(onboarding, /prefers-reduced-transparency/);
  assert.match(onboarding, /prefers-reduced-motion/);
  assert.match(onboarding, /state\.inerted\.forEach/);
  assert.match(onboarding, /event\.key !== 'Tab'/);
  for (const page of ["App.dc.html", "Editor v5.dc.html", "Subscription.dc.html"]) {
    const html = await fs.readFile(path.join(ROOT, page), "utf8");
    assert.match(html, /profile-onboarding\.js\?v=[^"']+/);
  }
  assert.match(onboarding, /filmscript:profile-onboarding-resolved/);
  assert.match(onboarding, /filmscript:profile-open/);
  const account = await fs.readFile(path.join(ROOT, "platform-client.js"), "utf8");
  assert.match(account, /How should we refer to you\?/);
  assert.match(account, /name="birthDate"/);
  assert.match(account, /name="firstName"[^>]*autocomplete="given-name"[^>]*required/);
  assert.match(account, /name="lastName"[^>]*autocomplete="family-name"[^>]*required/);
  assert.match(account, /class="fs-account-email-field"/);
  assert.doesNotMatch(account, /<input[^>]*name="email"/);
  assert.match(account, /updateMe\(\{ firstName:String\(data\.get\('firstName'\)/);
  assert.doesNotMatch(account, /localStorage\.setItem\('filmscript_account_first_name'/);
  const handoff = await fs.readFile(path.join(ROOT, "auth-complete.html"), "utf8");
  assert.match(handoff, /data\.firstName/);
  assert.doesNotMatch(handoff, /localStorage\.setItem\('filmscript_account_first_name'/);
  assert.match(handoff, /sessionStorage\.setItem\('filmscript_auth_handoff_identity_v1'/);
  assert.match(handoff, /userId/);
  const billing = await fs.readFile(path.join(ROOT, "billing-client.js"), "utf8");
  assert.match(billing, /localStorage\.removeItem\('filmscript_account_first_name'\)/);
});
