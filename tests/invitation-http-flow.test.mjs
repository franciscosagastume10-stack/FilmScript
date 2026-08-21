import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

async function startServer(dataDir) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      API_URL: url,
      PUBLIC_APP_URL: url,
      CORS_ORIGINS: url,
      FILMSCRIPT_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) return { child, url };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  child.kill("SIGTERM");
  throw new Error("FilmScript server did not become ready.");
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function postJson(url, cookie, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await readJson(response) };
}

function objectKeysDeep(value, keys = []) {
  if (Array.isArray(value)) value.forEach((item) => objectKeysDeep(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      objectKeysDeep(item, keys);
    }
  }
  return keys;
}

function assertNoFinancialFields(value) {
  const financial = objectKeysDeep(value).filter((key) => /(?:cost|rate|price|amount|total|subtotal|budget|currency|quote|invoice|expense|funding|tax)/i.test(key));
  assert.deepEqual(financial, [], `unexpected financial fields: ${financial.join(", ")}`);
}

test("account invitation HTTP actions securely add or decline shared projects", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-invitation-http-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const ownerSession = createSession();
    const invitedSession = createSession();
    const otherSession = createSession();
    const owner = connectGoogleIdentity(ownerSession.session.id, {
      sub: "invitation_http_owner", email: "owner@invitation.test", name: "Invitation Owner", email_verified: true,
    });
    const invited = connectGoogleIdentity(invitedSession.session.id, {
      sub: "invitation_http_invited", email: "invited@invitation.test", name: "Invited Collaborator", email_verified: true,
    });
    const other = connectGoogleIdentity(otherSession.session.id, {
      sub: "invitation_http_other", email: "other@invitation.test", name: "Other Account", email_verified: true,
    });
    console.log(JSON.stringify({
      ownerToken: ownerSession.token,
      invitedToken: invitedSession.token,
      otherToken: otherSession.token,
      ownerId: owner.id,
      invitedId: invited.id,
      otherId: other.id,
    }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const identity = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const ownerCookie = `filmscript_sid=${encodeURIComponent(identity.ownerToken)}`;
  const invitedCookie = `filmscript_sid=${encodeURIComponent(identity.invitedToken)}`;
  const otherCookie = `filmscript_sid=${encodeURIComponent(identity.otherToken)}`;
  const running = await startServer(dataDir);

  t.after(async () => {
    await stopServer(running.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const createSeededProject = async (title, evidence) => {
    const created = await postJson(`${running.url}/api/scripts`, ownerCookie, { title });
    assert.equal(created.response.status, 201);
    const projectId = created.body.script.id;
    const seeded = await postJson(`${running.url}/api/scripts/${projectId}`, ownerCookie, {
      blocks: [
        { id: `blk_${projectId}_scene`, type: "scene", text: "INT. PRIVATE SET - DAY" },
        { id: `blk_${projectId}_action`, type: "action", text: evidence },
        { id: `blk_${projectId}_character`, type: "character", text: "MARA" },
        { id: `blk_${projectId}_dialogue`, type: "dialogue", text: "Keep this line inside the screenplay." },
      ],
    });
    assert.equal(seeded.response.status, 200, JSON.stringify(seeded.body));
    return projectId;
  };

  const unauthenticated = await fetch(`${running.url}/api/invitations`);
  assert.equal(unauthenticated.status, 401);

  const breakdownEvidence = "BREAKDOWN-ONLY-SCREENPLAY-EVIDENCE";
  const projectId = await createSeededProject("The Shared Breakdown", breakdownEvidence);

  const createdInvitation = await postJson(`${running.url}/api/projects/${projectId}/members`, ownerCookie, {
    email: "invited@invitation.test",
    projectRole: "editor",
    cinematicRole: "production",
    modulePermissions: {
      script: "no_access",
      analysis: "no_access",
      breakdown: "edit",
      stripboard: "no_access",
      shot_list: "no_access",
    },
  });
  assert.equal(createdInvitation.response.status, 201, JSON.stringify(createdInvitation.body));
  const invitationId = createdInvitation.body.invitation.id;
  assert.ok(invitationId?.startsWith("inv_"));
  assert.equal("token" in createdInvitation.body.invitation, false);

  const otherList = await fetch(`${running.url}/api/invitations`, { headers: { Cookie: otherCookie } });
  assert.equal(otherList.status, 200);
  assert.deepEqual((await readJson(otherList)).invitations, []);

  const wrongAccount = await postJson(`${running.url}/api/invitations/${invitationId}/accept`, otherCookie, {});
  assert.equal(wrongAccount.response.status, 404);
  assert.equal(wrongAccount.body.error, "invitation_not_found");

  const pendingResponse = await fetch(`${running.url}/api/invitations`, { headers: { Cookie: invitedCookie } });
  assert.equal(pendingResponse.status, 200);
  const pending = (await readJson(pendingResponse)).invitations;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, invitationId);
  assert.equal(pending[0].project.id, projectId);
  assert.equal(pending[0].project.title, "The Shared Breakdown");
  assert.equal(pending[0].project.owner.id, identity.ownerId);
  assert.equal(pending[0].project.owner.name, "Invitation Owner");
  assert.equal(pending[0].projectRole, "editor");

  const accepted = await postJson(`${running.url}/api/invitations/${invitationId}/accept`, invitedCookie, {});
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.membership.userId, identity.invitedId);
  assert.equal(accepted.body.membership.projectId, projectId);
  assert.equal(accepted.body.membership.projectRole, "editor");
  assert.equal(accepted.body.membership.status, "active");
  assert.equal(accepted.body.membership.modulePermissions.script, "no_access");
  assert.equal(accepted.body.membership.modulePermissions.breakdown, "edit");
  assert.equal(accepted.body.project.owner.id, identity.ownerId);
  assert.equal(accepted.body.project.owner.name, "Invitation Owner");
  assert.equal(accepted.body.project.access.projectRole, "editor");
  assert.equal(accepted.body.project.preferredView, "breakdown");
  assert.equal(accepted.body.project.canOpenScript, false);
  assert.equal(accepted.body.project.canOpenProject, true);

  const acceptedAgain = await postJson(`${running.url}/api/invitations/${invitationId}/accept`, invitedCookie, {});
  assert.equal(acceptedAgain.response.status, 200);
  assert.equal(acceptedAgain.body.membership.id, accepted.body.membership.id);
  assert.equal(acceptedAgain.body.membership.version, accepted.body.membership.version);

  const afterAccept = await fetch(`${running.url}/api/invitations`, { headers: { Cookie: invitedCookie } });
  assert.equal(afterAccept.status, 200);
  assert.deepEqual((await readJson(afterAccept)).invitations, []);

  const sharedScriptsResponse = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: invitedCookie } });
  assert.equal(sharedScriptsResponse.status, 200);
  const sharedProject = (await readJson(sharedScriptsResponse)).scripts.find((script) => script.id === projectId);
  assert.ok(sharedProject, "accepted project should appear in Scripts");
  assert.equal(sharedProject.owner.id, identity.ownerId);
  assert.equal(sharedProject.owner.name, "Invitation Owner");
  assert.equal(sharedProject.ownerName, "Invitation Owner");
  assert.equal(sharedProject.role, "editor");
  assert.equal(sharedProject.access.projectRole, "editor");
  assert.equal(sharedProject.access.modulePermissions.script, "no_access");
  assert.equal(sharedProject.access.modulePermissions.breakdown, "edit");
  assert.equal(sharedProject.preferredView, "breakdown");
  assert.equal(sharedProject.canOpenScript, false);
  assert.equal(sharedProject.canOpenProject, true);
  assert.equal("source" in sharedProject, false, "screenplay source metadata stays hidden without Script access");
  assert.equal("pages" in sharedProject, false, "screenplay page count stays hidden without Script access");

  const breakdownPreproductionResponse = await fetch(`${running.url}/api/scripts/${projectId}/preproduction`, { headers: { Cookie: invitedCookie } });
  assert.equal(breakdownPreproductionResponse.status, 200);
  const breakdownPreproduction = (await readJson(breakdownPreproductionResponse)).project;
  assert.equal(Array.isArray(breakdownPreproduction.scenes), true);
  assert.equal(breakdownPreproduction.scenes.length, 1);
  assert.equal("analysis" in breakdownPreproduction, true);
  assert.equal("shotAnalysis" in breakdownPreproduction, false);
  assert.equal("stripboardOrder" in breakdownPreproduction, false);
  assert.equal("breakdown" in breakdownPreproduction.scenes[0], true);
  for (const forbidden of ["text", "blocks", "knownCastNames", "contentHash", "previousText", "strip", "shots", "referenceAsset"]) {
    assert.equal(forbidden in breakdownPreproduction.scenes[0], false, `breakdown-only payload must hide ${forbidden}`);
  }
  assert.equal(JSON.stringify(breakdownPreproduction).includes(breakdownEvidence), false);
  assertNoFinancialFields(breakdownPreproduction);

  const inaccessibleScript = await fetch(`${running.url}/api/scripts/${projectId}`, { headers: { Cookie: invitedCookie } });
  assert.equal(inaccessibleScript.status, 404, "a breakdown-only collaborator must not receive screenplay text");

  const budgetOnlyProject = await postJson(`${running.url}/api/scripts`, ownerCookie, { title: "Budget Metadata Only" });
  assert.equal(budgetOnlyProject.response.status, 201);
  const budgetOnlyProjectId = budgetOnlyProject.body.script.id;
  const budgetOnlyInvitation = await postJson(`${running.url}/api/projects/${budgetOnlyProjectId}/members`, ownerCookie, {
    email: "other@invitation.test",
    projectRole: "department_editor",
    modulePermissions: { script: "no_access", budget: "view" },
    financialPermissions: ["financial.export"],
  });
  assert.equal(budgetOnlyInvitation.response.status, 201, JSON.stringify(budgetOnlyInvitation.body));
  const budgetOnlyAccept = await postJson(`${running.url}/api/invitations/${budgetOnlyInvitation.body.invitation.id}/accept`, otherCookie, {});
  assert.equal(budgetOnlyAccept.response.status, 200);
  assert.equal(budgetOnlyAccept.body.project.preferredView, null, "export-only financial access must not open Budget");
  assert.equal(budgetOnlyAccept.body.project.canOpenProject, false);
  const otherScripts = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: otherCookie } });
  const budgetOnlyCard = (await readJson(otherScripts)).scripts.find((script) => script.id === budgetOnlyProjectId);
  assert.equal(budgetOnlyCard.preferredView, null);
  assert.equal(budgetOnlyCard.canOpenProject, false);

  const stripboardEvidence = "STRIPBOARD-ONLY-SCREENPLAY-EVIDENCE";
  const stripboardProjectId = await createSeededProject("Shared Stripboard", stripboardEvidence);
  const stripboardInvitation = await postJson(`${running.url}/api/projects/${stripboardProjectId}/members`, ownerCookie, {
    email: "other@invitation.test",
    projectRole: "department_editor",
    modulePermissions: { script: "no_access", breakdown: "no_access", stripboard: "view", shot_list: "no_access" },
  });
  assert.equal(stripboardInvitation.response.status, 201, JSON.stringify(stripboardInvitation.body));
  const stripboardAccepted = await postJson(`${running.url}/api/invitations/${stripboardInvitation.body.invitation.id}/accept`, otherCookie, {});
  assert.equal(stripboardAccepted.response.status, 200);
  assert.equal(stripboardAccepted.body.project.preferredView, "stripboard");
  const stripboardScriptsResponse = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: otherCookie } });
  const stripboardCard = (await readJson(stripboardScriptsResponse)).scripts.find((script) => script.id === stripboardProjectId);
  assert.equal(stripboardCard.preferredView, "stripboard");
  const stripboardPreproductionResponse = await fetch(`${running.url}/api/scripts/${stripboardProjectId}/preproduction`, { headers: { Cookie: otherCookie } });
  assert.equal(stripboardPreproductionResponse.status, 200);
  const stripboardPreproduction = (await readJson(stripboardPreproductionResponse)).project;
  assert.equal("stripboardOrder" in stripboardPreproduction, true);
  assert.equal("analysis" in stripboardPreproduction, false);
  assert.equal("shotAnalysis" in stripboardPreproduction, false);
  assert.equal("manualShotScenes" in stripboardPreproduction, false);
  assert.equal("strip" in stripboardPreproduction.scenes[0], true);
  for (const forbidden of ["text", "blocks", "knownCastNames", "contentHash", "previousText", "breakdown", "breakdownForm", "shots", "referenceAsset"]) {
    assert.equal(forbidden in stripboardPreproduction.scenes[0], false, `stripboard-only payload must hide ${forbidden}`);
  }
  assert.equal(JSON.stringify(stripboardPreproduction).includes(stripboardEvidence), false);
  assertNoFinancialFields(stripboardPreproduction);

  const shotListEvidence = "SHOT-LIST-ONLY-SCREENPLAY-EVIDENCE";
  const shotListProjectId = await createSeededProject("Shared Shot List", shotListEvidence);
  const shotListInvitation = await postJson(`${running.url}/api/projects/${shotListProjectId}/members`, ownerCookie, {
    email: "invited@invitation.test",
    projectRole: "department_editor",
    modulePermissions: { script: "no_access", breakdown: "no_access", stripboard: "no_access", shot_list: "view" },
  });
  assert.equal(shotListInvitation.response.status, 201, JSON.stringify(shotListInvitation.body));
  const shotListAccepted = await postJson(`${running.url}/api/invitations/${shotListInvitation.body.invitation.id}/accept`, invitedCookie, {});
  assert.equal(shotListAccepted.response.status, 200);
  assert.equal(shotListAccepted.body.project.preferredView, "shotlist");
  const shotListScriptsResponse = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: invitedCookie } });
  const shotListCard = (await readJson(shotListScriptsResponse)).scripts.find((script) => script.id === shotListProjectId);
  assert.equal(shotListCard.preferredView, "shotlist");
  const shotListPreproductionResponse = await fetch(`${running.url}/api/scripts/${shotListProjectId}/preproduction`, { headers: { Cookie: invitedCookie } });
  assert.equal(shotListPreproductionResponse.status, 200);
  const shotListPreproduction = (await readJson(shotListPreproductionResponse)).project;
  assert.equal("shotAnalysis" in shotListPreproduction, true);
  assert.equal("manualShotScenes" in shotListPreproduction, true);
  assert.equal("analysis" in shotListPreproduction, false);
  assert.equal("stripboardOrder" in shotListPreproduction, false);
  assert.equal("shots" in shotListPreproduction.scenes[0], true);
  assert.equal("referenceAsset" in shotListPreproduction.scenes[0], true);
  for (const forbidden of ["text", "blocks", "knownCastNames", "contentHash", "previousText", "breakdown", "breakdownForm", "strip"]) {
    assert.equal(forbidden in shotListPreproduction.scenes[0], false, `shot-list-only payload must hide ${forbidden}`);
  }
  assert.equal(JSON.stringify(shotListPreproduction).includes(shotListEvidence), false);
  assertNoFinancialFields(shotListPreproduction);

  const locationProject = await postJson(`${running.url}/api/scripts`, ownerCookie, { title: "Location Access" });
  assert.equal(locationProject.response.status, 201);
  const locationProjectId = locationProject.body.script.id;
  const locationInvitation = await postJson(`${running.url}/api/projects/${locationProjectId}/members`, ownerCookie, {
    email: "invited@invitation.test",
    projectRole: "department_editor",
    modulePermissions: { location_plan: "edit" },
  });
  assert.equal(locationInvitation.response.status, 201, JSON.stringify(locationInvitation.body));
  const locationAccept = await postJson(`${running.url}/api/invitations/${locationInvitation.body.invitation.id}/accept`, invitedCookie, {});
  assert.equal(locationAccept.response.status, 200);
  assert.equal(locationAccept.body.project.preferredView, "location_plan");
  assert.equal(locationAccept.body.project.canOpenScript, false);
  assert.equal(locationAccept.body.project.canOpenProject, true);

  const membersResponse = await fetch(`${running.url}/api/projects/${projectId}/members`, { headers: { Cookie: ownerCookie } });
  assert.equal(membersResponse.status, 200);
  const acceptedMember = (await readJson(membersResponse)).members.find((member) => member.id === accepted.body.membership.id);
  assert.equal(acceptedMember.userId, identity.invitedId);
  assert.equal(acceptedMember.projectRole, "editor");

  const declinedProject = await postJson(`${running.url}/api/scripts`, ownerCookie, { title: "A Declined Project" });
  assert.equal(declinedProject.response.status, 201);
  const declinedProjectId = declinedProject.body.script.id;
  const declineInvitation = await postJson(`${running.url}/api/projects/${declinedProjectId}/members`, ownerCookie, {
    email: "invited@invitation.test",
    projectRole: "viewer",
  });
  assert.equal(declineInvitation.response.status, 201, JSON.stringify(declineInvitation.body));
  const declineInvitationId = declineInvitation.body.invitation.id;

  const wrongDecline = await postJson(`${running.url}/api/invitations/${declineInvitationId}/decline`, otherCookie, {});
  assert.equal(wrongDecline.response.status, 404);
  assert.equal(wrongDecline.body.error, "invitation_not_found");

  const declined = await postJson(`${running.url}/api/invitations/${declineInvitationId}/decline`, invitedCookie, {});
  assert.equal(declined.response.status, 200);
  assert.equal(declined.body.invitation.id, declineInvitationId);
  assert.equal(declined.body.invitation.status, "declined");
  const declinedAgain = await postJson(`${running.url}/api/invitations/${declineInvitationId}/decline`, invitedCookie, {});
  assert.equal(declinedAgain.response.status, 200);
  assert.equal(declinedAgain.body.invitation.status, "declined");

  const acceptDeclined = await postJson(`${running.url}/api/invitations/${declineInvitationId}/accept`, invitedCookie, {});
  assert.equal(acceptDeclined.response.status, 410);
  assert.equal(acceptDeclined.body.error, "invitation_unavailable");

  const scriptsAfterDecline = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: invitedCookie } });
  assert.equal(scriptsAfterDecline.status, 200);
  assert.equal((await readJson(scriptsAfterDecline)).scripts.some((script) => script.id === declinedProjectId), false);
});
