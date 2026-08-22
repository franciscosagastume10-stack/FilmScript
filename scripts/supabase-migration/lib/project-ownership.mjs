export function validateProjectOwnershipGraph({ scripts, memberships }) {
  if (!Array.isArray(scripts) || !Array.isArray(memberships)) {
    throw new Error("Project ownership validation requires scripts and project_memberships rows");
  }

  const scriptsById = new Map(scripts.map((script) => [script.id, script]));
  const activeOwnersByProject = new Map();
  for (const membership of memberships) {
    if (membership.project_role !== "owner") continue;
    if (!scriptsById.has(membership.project_id)) {
      throw new Error(`Project ownership invalid: owner membership ${membership.id} references nonexistent project ${membership.project_id}`);
    }
    if (membership.status !== "active") continue;
    const owners = activeOwnersByProject.get(membership.project_id) || [];
    owners.push(membership);
    activeOwnersByProject.set(membership.project_id, owners);
  }

  for (const script of scripts) {
    const owners = activeOwnersByProject.get(script.id) || [];
    if (owners.length !== 1) {
      throw new Error(`Project ownership invalid: project ${script.id} has ${owners.length} active owner memberships; expected exactly 1`);
    }
    if (owners[0].user_id !== script.user_id) {
      throw new Error(`Project ownership invalid: project ${script.id} owner membership does not match scripts.user_id`);
    }
  }

  return { projectCount: scripts.length, activeOwnerCount: scripts.length };
}
