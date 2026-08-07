const CALENDAR_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const PHASES = [
  { id: "development", name: "Development", color: "#7B61A8" },
  { id: "preproduction", name: "Preproduction", color: "#6E9DC6" },
  { id: "production", name: "Production", color: "#5B7A4A" },
  { id: "postproduction", name: "Postproduction", color: "#C98A49" },
  { id: "delivery", name: "Delivery", color: "#2C2C2A" },
];

const STATUS_VALUES = new Set(["not_started", "in_progress", "blocked", "done"]);

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])) return null;
  return date;
}

function dateFrom(value = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12));
  }
  return parseDate(value);
}

function toDateString(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(value, days) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));
  return date;
}

function isWorkday(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return Boolean(date) && date.getUTCDay() !== 0;
}

function normalizeWorkday(value, direction = 1) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  const step = direction < 0 ? -1 : 1;
  while (!isWorkday(date)) date.setUTCDate(date.getUTCDate() + step);
  return date;
}

function nextWorkday(value) {
  const date = addCalendarDays(value, 1);
  return normalizeWorkday(date, 1);
}

function previousWorkday(value) {
  const date = addCalendarDays(value, -1);
  return normalizeWorkday(date, -1);
}

function addWorkdays(value, amount) {
  const start = normalizeWorkday(value, amount < 0 ? -1 : 1);
  if (!start) return null;
  const date = new Date(start.getTime());
  let remaining = Math.abs(Math.trunc(amount));
  const direction = amount < 0 ? -1 : 1;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (isWorkday(date)) remaining -= 1;
  }
  return date;
}

function workdayDistance(fromValue, toValue) {
  const from = normalizeWorkday(fromValue, 1);
  const to = normalizeWorkday(toValue, 1);
  if (!from || !to) return 0;
  if (from.getTime() === to.getTime()) return 0;
  const direction = from < to ? 1 : -1;
  let cursor = new Date(from.getTime());
  let distance = 0;
  while ((direction > 0 && cursor < to) || (direction < 0 && cursor > to)) {
    cursor = direction > 0 ? nextWorkday(cursor) : previousWorkday(cursor);
    distance += direction;
  }
  return distance;
}

function nextMonday(referenceDate = new Date()) {
  const date = dateFrom(referenceDate) || dateFrom(new Date());
  if (date.getUTCDay() === 1) return date;
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  return addCalendarDays(date, daysUntilMonday);
}

function createCalendarId(prefix = "task") {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "")
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random.slice(0, 24)}`;
}

const templateTask = (id, name, phaseId, durationDays, dependencies = [], owner = "", options = {}) => ({
  id,
  name,
  phaseId,
  durationDays,
  dependencies,
  owner,
  progress: 0,
  status: "not_started",
  constraintDate: "",
  milestone: durationDays === 0,
  kind: options.kind || "task",
  notes: options.notes || "",
  groupId: options.groupId || "",
});

function createCalendarTemplate(projectTitle = "Untitled screenplay", referenceDate = new Date()) {
  const tasks = [
    templateTask("cal_script_review", "Script review and lock", "development", 6, [], "Writer / Director"),
    templateTask("cal_breakdown", "Script breakdown", "development", 6, ["cal_script_review"], "Production"),
    templateTask("cal_creative_proposals", "Creative proposals", "development", 6, ["cal_script_review"], "Director"),
    templateTask("cal_technical_script", "Technical script", "development", 6, ["cal_breakdown", "cal_creative_proposals"], "Director / DP"),
    templateTask("cal_preliminary_schedule", "Preliminary shooting plan", "development", 6, ["cal_breakdown"], "Assistant Director"),
    templateTask("cal_location_scouting", "Location scouting", "development", 18, ["cal_breakdown"], "Locations"),
    templateTask("cal_department_estimates", "Department estimates", "development", 12, ["cal_breakdown"], "Production"),
    templateTask("cal_production_budget", "Production budget", "development", 12, ["cal_preliminary_schedule", "cal_department_estimates"], "Producer"),
    templateTask("cal_financing", "Financing", "development", 24, ["cal_production_budget"], "Producer"),
    templateTask("cal_greenlight", "Production package and greenlight", "development", 3, ["cal_technical_script", "cal_location_scouting", "cal_financing"], "Producer"),

    templateTask("cal_crew_confirmation", "Crew confirmation", "preproduction", 12, ["cal_greenlight"], "Producer"),
    templateTask("cal_location_contracts", "Location confirmation and contracts", "preproduction", 6, ["cal_location_scouting", "cal_greenlight"], "Locations"),
    templateTask("cal_casting", "Casting", "preproduction", 12, ["cal_greenlight"], "Casting"),
    templateTask("cal_cast_contracts", "Cast contracts", "preproduction", 6, ["cal_casting"], "Production"),
    templateTask("cal_department_design", "Department design", "preproduction", 18, ["cal_greenlight"], "Department Heads"),
    templateTask("cal_art_build", "Art and set dressing", "preproduction", 18, ["cal_department_design", "cal_location_contracts"], "Art"),
    templateTask("cal_wardrobe", "Wardrobe design and rentals", "preproduction", 18, ["cal_casting", "cal_department_design"], "Wardrobe"),
    templateTask("cal_makeup_tests", "Makeup and hair tests", "preproduction", 6, ["cal_casting", "cal_department_design"], "Makeup / Hair"),
    templateTask("cal_rehearsals", "Cast rehearsals", "preproduction", 6, ["cal_cast_contracts"], "Director"),
    templateTask("cal_tech_scout", "Technical scout", "preproduction", 6, ["cal_crew_confirmation", "cal_location_contracts", "cal_department_design"], "Production"),
    templateTask("cal_camera_tests", "Camera tests", "preproduction", 6, ["cal_crew_confirmation", "cal_casting"], "Camera"),
    templateTask("cal_equipment_check", "Equipment check", "preproduction", 3, ["cal_tech_scout", "cal_camera_tests"], "Camera / Grip"),
    templateTask("cal_final_meeting", "Final production meeting", "preproduction", 1, ["cal_art_build", "cal_wardrobe", "cal_makeup_tests", "cal_rehearsals", "cal_equipment_check"], "Producer"),

  templateTask("cal_principal_photography", "Main shoot", "production", 3, ["cal_final_meeting"], "Production", { kind: "shoot" }),

    templateTask("cal_media_sync", "Media offload, proxies and sound sync", "postproduction", 3, ["cal_principal_photography"], "Editorial"),
    templateTask("cal_production_close", "Production expense close", "postproduction", 6, ["cal_principal_photography"], "Production"),
    templateTask("cal_picture_edit", "Picture edit", "postproduction", 18, ["cal_media_sync"], "Editorial"),
    templateTask("cal_first_cut", "First cut review", "postproduction", 3, ["cal_picture_edit"], "Director / Producer"),
    templateTask("cal_fine_cut", "Fine cut", "postproduction", 12, ["cal_first_cut"], "Editorial"),
    templateTask("cal_picture_lock", "Picture lock", "postproduction", 0, ["cal_fine_cut"], "Director / Producer", { kind: "milestone" }),
    templateTask("cal_conform", "Conform and turnover", "postproduction", 3, ["cal_picture_lock"], "Post Supervisor"),
    templateTask("cal_color", "Color correction", "postproduction", 6, ["cal_conform"], "Color"),
    templateTask("cal_vfx", "Visual effects", "postproduction", 6, ["cal_conform"], "VFX"),
    templateTask("cal_sound_design", "Sound edit and design", "postproduction", 12, ["cal_conform"], "Sound"),
    templateTask("cal_adr", "ADR", "postproduction", 3, ["cal_picture_lock"], "Sound"),
    templateTask("cal_music", "Music", "postproduction", 6, ["cal_picture_lock"], "Music"),
    templateTask("cal_final_mix", "Final mix", "postproduction", 3, ["cal_sound_design", "cal_adr", "cal_music"], "Sound"),
    templateTask("cal_online", "Online finish", "postproduction", 6, ["cal_color", "cal_vfx", "cal_final_mix"], "Post Supervisor"),

    templateTask("cal_subtitles", "Translation and subtitles", "delivery", 3, ["cal_picture_lock"], "Delivery"),
    templateTask("cal_masters", "Masters and quality control", "delivery", 3, ["cal_online", "cal_subtitles"], "Post Supervisor"),
    templateTask("cal_legal_materials", "Legal and release materials", "delivery", 6, ["cal_production_close", "cal_masters"], "Producer"),
    templateTask("cal_final_delivery", "Final delivery", "delivery", 0, ["cal_legal_materials"], "Producer", { kind: "delivery" }),
  ];

  return {
    version: CALENDAR_VERSION,
    projectTitle: String(projectTitle || "Untitled screenplay").slice(0, 180),
    settings: {
      projectStart: toDateString(nextMonday(referenceDate)),
      workweek: [1, 2, 3, 4, 5, 6],
    },
    tasks,
    groups: [],
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeTaskId(value, index, used) {
  const candidate = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  let id = candidate || `cal_task_${index + 1}`;
  let suffix = 2;
  while (used.has(id)) id = `${candidate || `cal_task_${index + 1}`}_${suffix++}`.slice(0, 80);
  used.add(id);
  return id;
}

function removeCircularDependencies(tasks) {
  const validIds = new Set(tasks.map((task) => task.id));
  const successors = new Map(tasks.map((task) => [task.id, new Set()]));
  const reaches = (from, target) => {
    const pending = [from];
    const seen = new Set();
    while (pending.length) {
      const current = pending.pop();
      if (current === target) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of successors.get(current) || []) pending.push(next);
    }
    return false;
  };

  return tasks.map((task) => {
    const dependencies = [];
    const seen = new Set();
    for (const dependency of task.dependencies) {
      if (!validIds.has(dependency) || dependency === task.id || seen.has(dependency)) continue;
      if (reaches(task.id, dependency)) continue;
      seen.add(dependency);
      dependencies.push(dependency);
      successors.get(dependency)?.add(task.id);
    }
    return { ...task, dependencies };
  });
}

function normalizeCalendar(value, projectTitle = "Untitled screenplay", referenceDate = new Date()) {
  const base = createCalendarTemplate(projectTitle, referenceDate);
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;

  const projectStart = normalizeWorkday(value.settings?.projectStart || base.settings.projectStart, 1);
  const phaseIds = new Set(PHASES.map((phase) => phase.id));
  const groupIds = new Set();
  const groups = (Array.isArray(value.groups) ? value.groups : [])
    .slice(0, 80)
    .flatMap((rawGroup, index) => {
      if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) return [];
      const id = sanitizeTaskId(rawGroup.id || `cal_group_${index + 1}`, index, groupIds);
      const name = String(rawGroup.name || `Group ${index + 1}`).trim().replace(/\s+/g, " ").slice(0, 100);
      if (!name) return [];
      return [{
        id,
        name,
        phaseId: phaseIds.has(rawGroup.phaseId) ? rawGroup.phaseId : "development",
        collapsed: Boolean(rawGroup.collapsed),
      }];
    });
  const validGroupIds = new Set(groups.map((group) => group.id));
  const rawTasks = Array.isArray(value.tasks) ? value.tasks.slice(0, 240) : base.tasks;
  const used = new Set();
  const normalized = rawTasks.flatMap((rawTask, index) => {
    if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) return [];
    const id = sanitizeTaskId(rawTask.id, index, used);
    const milestone = Boolean(rawTask.milestone) || finite(rawTask.durationDays) === 0 || rawTask.kind === "milestone" || rawTask.kind === "delivery";
    const progress = clamp(Math.round(finite(rawTask.progress)), 0, 100);
    let status = STATUS_VALUES.has(rawTask.status) ? rawTask.status : progress >= 100 ? "done" : progress > 0 ? "in_progress" : "not_started";
    if (progress >= 100) status = "done";
    if (status === "done" && progress < 100) status = progress > 0 ? "in_progress" : "not_started";
    const constraint = parseDate(rawTask.constraintDate);
    return [{
      id,
      name: String(rawTask.name || `Task ${index + 1}`).trim().replace(/\s+/g, " ").slice(0, 140) || `Task ${index + 1}`,
      phaseId: phaseIds.has(rawTask.phaseId) ? rawTask.phaseId : "development",
      durationDays: milestone ? 0 : clamp(Math.round(finite(rawTask.durationDays, 1)), 1, 312),
      dependencies: Array.isArray(rawTask.dependencies) ? rawTask.dependencies.map((entry) => String(entry || "").trim()) : [],
      owner: String(rawTask.owner || "").trim().replace(/\s+/g, " ").slice(0, 100),
      progress,
      status,
      constraintDate: constraint ? toDateString(normalizeWorkday(constraint, 1)) : "",
      manualStartDate: parseDate(rawTask.manualStartDate)
        ? toDateString(normalizeWorkday(rawTask.manualStartDate, 1))
        : "",
      milestone,
      kind: ["task", "milestone", "shoot", "delivery"].includes(rawTask.kind)
        ? rawTask.kind
        : milestone ? "milestone" : "task",
      notes: String(rawTask.notes || "").trim().slice(0, 800),
      groupId: validGroupIds.has(String(rawTask.groupId || "")) ? String(rawTask.groupId) : "",
    }];
  });

  const tasks = removeCircularDependencies(normalized);
  return {
    version: CALENDAR_VERSION,
    projectTitle: String(projectTitle || value.projectTitle || base.projectTitle).trim().slice(0, 180) || base.projectTitle,
    settings: {
      projectStart: toDateString(projectStart || nextMonday(referenceDate)),
      workweek: [1, 2, 3, 4, 5, 6],
    },
    tasks,
    groups,
    updatedAt: String(value.updatedAt || base.updatedAt).slice(0, 40),
  };
}

function topologicalOrder(tasks) {
  const index = new Map(tasks.map((task, taskIndex) => [task.id, taskIndex]));
  const indegree = new Map(tasks.map((task) => [task.id, task.dependencies.length]));
  const successors = new Map(tasks.map((task) => [task.id, []]));
  tasks.forEach((task) => task.dependencies.forEach((dependency) => successors.get(dependency)?.push(task.id)));
  const ready = tasks.filter((task) => indegree.get(task.id) === 0).map((task) => task.id);
  ready.sort((a, b) => index.get(a) - index.get(b));
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const successor of successors.get(id) || []) {
      indegree.set(successor, indegree.get(successor) - 1);
      if (indegree.get(successor) === 0) {
        ready.push(successor);
        ready.sort((a, b) => index.get(a) - index.get(b));
      }
    }
  }
  for (const task of tasks) if (!order.includes(task.id)) order.push(task.id);
  return { order, successors };
}

function computeExpectedProgress(task, today) {
  if (task.milestone) return today >= parseDate(task.startDate) ? 100 : 0;
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  if (!start || !end || today < start) return 0;
  if (today > end) return 100;
  return clamp(Math.round(((workdayDistance(start, today) + 1) / Math.max(1, task.durationDays)) * 100), 0, 100);
}

function computeCalendar(value, projectTitle = "Untitled screenplay", referenceDate = new Date()) {
  const calendar = normalizeCalendar(value, projectTitle, referenceDate);
  const tasks = calendar.tasks;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const { order, successors } = topologicalOrder(tasks);
  const projectStart = normalizeWorkday(calendar.settings.projectStart, 1) || nextMonday(referenceDate);
  const scheduled = new Map();

  for (const id of order) {
    const task = byId.get(id);
    let start = new Date(projectStart.getTime());
    for (const dependency of task.dependencies) {
      const predecessor = scheduled.get(dependency);
      if (!predecessor) continue;
      const candidate = nextWorkday(predecessor.end);
      if (candidate > start) start = candidate;
    }
    const constraint = normalizeWorkday(task.constraintDate, 1);
    if (constraint && constraint > start) start = constraint;
    const manualStart = normalizeWorkday(task.manualStartDate, 1);
    if (manualStart && manualStart >= projectStart) start = manualStart;
    const end = task.milestone ? new Date(start.getTime()) : addWorkdays(start, task.durationDays - 1);
    scheduled.set(id, { start, end });
  }

  const projectFinish = order.reduce((latest, id) => {
    const end = scheduled.get(id)?.end;
    return end && (!latest || end > latest) ? end : latest;
  }, new Date(projectStart.getTime()));

  const backward = new Map();
  for (const id of [...order].reverse()) {
    const task = byId.get(id);
    const nextTasks = successors.get(id) || [];
    let latestFinish = new Date(projectFinish.getTime());
    if (nextTasks.length) {
      latestFinish = nextTasks.reduce((earliest, successorId) => {
        const successor = backward.get(successorId);
        const candidate = successor ? previousWorkday(successor.latestStart) : projectFinish;
        return !earliest || candidate < earliest ? candidate : earliest;
      }, null) || latestFinish;
    }
    const latestStart = task.milestone ? new Date(latestFinish.getTime()) : addWorkdays(latestFinish, -(task.durationDays - 1));
    backward.set(id, { latestStart, latestFinish });
  }

  const today = normalizeWorkday(dateFrom(referenceDate) || dateFrom(new Date()), 1);
  const computedTasks = order.map((id, sequence) => {
    const task = byId.get(id);
    const forward = scheduled.get(id);
    const late = backward.get(id);
    const startDate = toDateString(forward.start);
    const endDate = toDateString(forward.end);
    const latestStartDate = toDateString(late.latestStart);
    const latestEndDate = toDateString(late.latestFinish);
    const slackDays = Math.max(0, workdayDistance(forward.start, late.latestStart));
    const critical = slackDays === 0;
    const dependencyConflictIds = task.dependencies.filter((dependencyId) => {
      const predecessor = scheduled.get(dependencyId);
      return Boolean(predecessor && nextWorkday(predecessor.end) > forward.start);
    });
    const dependencyConflict = dependencyConflictIds.length > 0;
    const overdue = task.status !== "done" && forward.end < today;
    const expectedProgress = computeExpectedProgress({ ...task, startDate, endDate }, today);
    const atRisk = dependencyConflict || task.status === "blocked" || overdue
      || (critical && task.status !== "done" && task.progress + 20 < expectedProgress);
    return {
      ...task,
      sequence,
      startDate,
      endDate,
      latestStartDate,
      latestEndDate,
      slackDays,
      critical,
      dependencyConflict,
      dependencyConflictIds,
      overdue,
      atRisk,
      expectedProgress,
      successorIds: [...(successors.get(id) || [])],
    };
  });

  const computedById = new Map(computedTasks.map((task) => [task.id, task]));
  const phases = PHASES.map((phase) => {
    const phaseTasks = computedTasks.filter((task) => task.phaseId === phase.id);
    const start = phaseTasks.reduce((earliest, task) => !earliest || task.startDate < earliest ? task.startDate : earliest, "");
    const end = phaseTasks.reduce((latest, task) => !latest || task.endDate > latest ? task.endDate : latest, "");
    const weight = phaseTasks.reduce((sum, task) => sum + Math.max(1, task.durationDays), 0);
    const progress = weight
      ? Math.round(phaseTasks.reduce((sum, task) => sum + Math.max(1, task.durationDays) * task.progress, 0) / weight)
      : 0;
    return {
      ...phase,
      startDate: start,
      endDate: end,
      progress,
      taskCount: phaseTasks.length,
      criticalCount: phaseTasks.filter((task) => task.critical).length,
      completedCount: phaseTasks.filter((task) => task.status === "done").length,
    };
  }).filter((phase) => phase.taskCount > 0);

  const shootTask = computedTasks.find((task) => task.kind === "shoot")
    || computedTasks.find((task) => task.phaseId === "production");
  const deliveryTask = computedTasks.find((task) => task.kind === "delivery")
    || [...computedTasks].reverse().find((task) => task.phaseId === "delivery")
    || computedTasks.at(-1);
  const criticalTasks = computedTasks.filter((task) => task.critical);
  const completedCount = computedTasks.filter((task) => task.status === "done").length;
  const totalWeight = computedTasks.reduce((sum, task) => sum + Math.max(1, task.durationDays), 0);
  const progress = totalWeight
    ? Math.round(computedTasks.reduce((sum, task) => sum + Math.max(1, task.durationDays) * task.progress, 0) / totalWeight)
    : 0;
  const upcoming = computedTasks
    .filter((task) => task.status !== "done" && parseDate(task.endDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.sequence - b.sequence)
    .slice(0, 6);

  return {
    calendar,
    tasks: computedTasks,
    taskMap: computedById,
    phases,
    criticalTasks,
    upcoming,
    projectStart: toDateString(projectStart),
    projectFinish: toDateString(projectFinish),
    shootingStart: shootTask?.startDate || "",
    shootingEnd: shootTask?.endDate || "",
    deliveryDate: deliveryTask?.endDate || toDateString(projectFinish),
    durationWorkdays: workdayDistance(projectStart, projectFinish) + 1,
    criticalCount: criticalTasks.length,
    completedCount,
    overdueCount: computedTasks.filter((task) => task.overdue).length,
    atRiskCount: computedTasks.filter((task) => task.atRisk).length,
    dependencyConflictCount: computedTasks.filter((task) => task.dependencyConflict).length,
    progress,
  };
}

function pinCalendarSuccessors(
  value,
  taskId,
  projectTitle = "Untitled screenplay",
  referenceDate = new Date(),
) {
  const calendar = normalizeCalendar(value, projectTitle, referenceDate);
  const computed = computeCalendar(calendar, projectTitle, referenceDate);
  const tasks = calendar.tasks.map((task) => {
    if (!task.dependencies.includes(taskId)) return task;
    const current = computed.taskMap.get(task.id);
    return current ? { ...task, manualStartDate: current.startDate } : task;
  });
  return normalizeCalendar({ ...calendar, tasks }, projectTitle, referenceDate);
}

function adjustCalendarTaskTiming(
  value,
  taskId,
  operation,
  deltaWorkdays,
  projectTitle = "Untitled screenplay",
  referenceDate = new Date(),
) {
  const calendar = normalizeCalendar(value, projectTitle, referenceDate);
  const task = calendar.tasks.find((entry) => entry.id === taskId);
  const delta = clamp(Math.round(finite(deltaWorkdays)), -936, 936);
  if (!task || !["move", "resize-start", "resize-end"].includes(operation) || delta === 0) return calendar;
  if (task.milestone && operation !== "move") return calendar;

  const current = computeCalendar(calendar, projectTitle, referenceDate).taskMap.get(taskId);
  if (!current) return calendar;
  const pinnedCalendar = pinCalendarSuccessors(calendar, taskId, projectTitle, referenceDate);

  if (operation === "resize-end") {
    const durationDays = clamp(current.durationDays + delta, 1, 312);
    if (durationDays === current.durationDays) return calendar;
    return normalizeCalendar({
      ...pinnedCalendar,
      tasks: pinnedCalendar.tasks.map((entry) => entry.id === taskId
        ? { ...entry, durationDays, manualStartDate: current.startDate }
        : entry),
    }, projectTitle, referenceDate);
  }

  const automaticCalendar = normalizeCalendar({
    ...calendar,
    tasks: calendar.tasks.map((entry) => entry.id === taskId
      ? { ...entry, constraintDate: "", manualStartDate: "" }
      : entry),
  }, projectTitle, referenceDate);
  const automatic = computeCalendar(automaticCalendar, projectTitle, referenceDate).taskMap.get(taskId);
  const automaticStart = parseDate(automatic?.startDate || current.startDate);
  const currentStart = parseDate(current.startDate);
  const currentEnd = parseDate(current.endDate);
  if (!automaticStart || !currentStart || !currentEnd) return calendar;

  let nextStart = addWorkdays(currentStart, delta);
  if (!nextStart) return calendar;
  if (nextStart < automaticStart) nextStart = automaticStart;

  let durationDays = current.durationDays;
  if (operation === "resize-start") {
    const earliestForMaximumDuration = addWorkdays(currentEnd, -(312 - 1));
    if (earliestForMaximumDuration && nextStart < earliestForMaximumDuration) nextStart = earliestForMaximumDuration;
    if (nextStart > currentEnd) nextStart = currentEnd;
    durationDays = clamp(workdayDistance(nextStart, currentEnd) + 1, 1, 312);
  }

  const nextStartDate = toDateString(nextStart);
  const constraintDate = nextStartDate === automatic?.startDate ? "" : nextStartDate;
  return normalizeCalendar({
    ...pinnedCalendar,
    tasks: pinnedCalendar.tasks.map((entry) => entry.id === taskId
      ? { ...entry, constraintDate, manualStartDate: nextStartDate, durationDays }
      : entry),
  }, projectTitle, referenceDate);
}

export {
  CALENDAR_VERSION,
  PHASES,
  addCalendarDays,
  addWorkdays,
  adjustCalendarTaskTiming,
  computeCalendar,
  createCalendarId,
  createCalendarTemplate,
  isWorkday,
  nextMonday,
  nextWorkday,
  normalizeCalendar,
  normalizeWorkday,
  pinCalendarSuccessors,
  parseDate,
  previousWorkday,
  toDateString,
  workdayDistance,
};
