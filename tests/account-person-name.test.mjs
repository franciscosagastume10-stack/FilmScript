import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("account identity keeps Google names, supports legacy name clients, and never invents a name from email", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-name-"));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import Database from "better-sqlite3";
    import {
      DATABASE_PATH, connectGoogleIdentity, createSession, getUser,
      updateUserName, updateUserProfile,
    } from "./database.js";

    const googleSession = createSession();
    const googleUser = connectGoogleIdentity(googleSession.session.id, {
      sub: "google_named_user",
      email: "francisco@example.com",
      name: "Francisco Sagastume",
      given_name: "Francisco",
      family_name: "Sagastume",
      email_verified: true,
    });

    updateUserProfile(googleUser.id, { gender: "man", birthDate: "1990-07-14" });
    const completed = getUser(googleUser.id);

    // Older clients can still send a combined name. The public name field
    // remains combined while the new fields are derived deterministically.
    updateUserName(googleUser.id, "Daniel Reyes Mora");
    const legacyUpdated = getUser(googleUser.id);

    const unnamedSession = createSession();
    const unnamed = connectGoogleIdentity(unnamedSession.session.id, {
      sub: "google_unnamed_user",
      email: "email.prefix@example.com",
      email_verified: true,
    });

    // Repair a record created by a historical build that stored the email
    // prefix as its display name. A later verified Google name replaces it.
    const sqlite = new Database(DATABASE_PATH);
    sqlite.prepare("UPDATE users SET name = ?, first_name = ?, last_name = NULL WHERE id = ?")
      .run("email.prefix", "email.prefix", unnamed.id);
    sqlite.close();
    const staleEmailPrefix = getUser(unnamed.id);
    const repaired = connectGoogleIdentity(unnamedSession.session.id, {
      sub: "google_unnamed_user",
      email: "email.prefix@example.com",
      name: "Emily Rivera",
      given_name: "Emily",
      family_name: "Rivera",
      email_verified: true,
    });

    const mononymSession = createSession();
    const mononym = connectGoogleIdentity(mononymSession.session.id, {
      sub: "google_mononym_user",
      email: "artist@example.com",
      name: "Prince",
      email_verified: true,
    });
    updateUserProfile(mononym.id, { gender: "unspecified", birthDate: "1990-07-14" });

    console.log(JSON.stringify({ googleUser, completed, legacyUpdated, unnamed, staleEmailPrefix, repaired, mononym:getUser(mononym.id) }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.deepEqual(
    { name: data.googleUser.name, firstName: data.googleUser.firstName, lastName: data.googleUser.lastName },
    { name: "Francisco Sagastume", firstName: "Francisco", lastName: "Sagastume" },
  );
  assert.equal(data.completed.profileComplete, true);
  assert.deepEqual(
    { name: data.legacyUpdated.name, firstName: data.legacyUpdated.firstName, lastName: data.legacyUpdated.lastName },
    { name: "Daniel Reyes Mora", firstName: "Daniel", lastName: "Reyes Mora" },
  );
  assert.equal(data.unnamed.name, null);
  assert.equal(data.unnamed.firstName, null);
  assert.equal(data.staleEmailPrefix.name, null);
  assert.equal(data.staleEmailPrefix.firstName, null);
  assert.deepEqual(
    { name: data.repaired.name, firstName: data.repaired.firstName, lastName: data.repaired.lastName },
    { name: "Emily Rivera", firstName: "Emily", lastName: "Rivera" },
  );
  assert.equal(data.mononym.firstName, "Prince");
  assert.equal(data.mononym.lastName, null);
  assert.equal(data.mononym.profileComplete, false);
});

test("person-name migration backfills first token and remaining surname", async () => {
  const migration = await fs.readFile(path.join(ROOT, "migrations", "018_account_person_name.sql"), "utf8");
  assert.match(migration, /ADD COLUMN first_name TEXT/);
  assert.match(migration, /ADD COLUMN last_name TEXT/);
  assert.match(migration, /THEN TRIM\(name\)/);
  assert.match(migration, /SUBSTR\(TRIM\(name\), INSTR\(TRIM\(name\), ' '\) \+ 1\)/);
  assert.match(migration, /schema_version', '18'/);
});
