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
  for (const page of ["App.dc.html", "Editor v5.dc.html", "Subscription.dc.html"]) {
    const html = await fs.readFile(path.join(ROOT, page), "utf8");
    assert.match(html, /profile-onboarding\.js\?v=[^"']+/);
  }
  for (const page of ["App.dc.html", "Editor v5.dc.html"]) {
    const html = await fs.readFile(path.join(ROOT, page), "utf8");
    assert.match(html, /data-filmscript-open-profile/);
  }
});
