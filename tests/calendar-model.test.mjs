import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustCalendarTaskTiming,
  computeCalendar,
  createCalendarTemplate,
  normalizeCalendar,
} from "../calendar-model.js";

const calendarWith = (tasks, projectStart = "2026-07-18") => ({
  version: 1,
  projectTitle: "Calendar test",
  settings: { projectStart },
  tasks: tasks.map((task) => ({
    phaseId: "development",
    owner: "",
    progress: 0,
    status: "not_started",
    constraintDate: "",
    milestone: false,
    kind: "task",
    notes: "",
    dependencies: [],
    ...task,
  })),
});

test("Calendar uses a Monday-to-Saturday production week and skips Sundays", () => {
  const result = computeCalendar(calendarWith([
    { id: "a", name: "A", durationDays: 2 },
    { id: "b", name: "B", durationDays: 1, dependencies: ["a"] },
  ]), "Calendar test", new Date("2026-07-16T12:00:00Z"));

  assert.equal(result.taskMap.get("a").startDate, "2026-07-18");
  assert.equal(result.taskMap.get("a").endDate, "2026-07-20");
  assert.equal(result.taskMap.get("b").startDate, "2026-07-21");
  assert.equal(result.taskMap.get("b").endDate, "2026-07-21");
});

test("Calendar computes dependencies, slack and the critical path", () => {
  const result = computeCalendar(calendarWith([
    { id: "a", name: "A", durationDays: 2 },
    { id: "b", name: "B", durationDays: 4, dependencies: ["a"] },
    { id: "c", name: "C", durationDays: 1, dependencies: ["a"] },
    { id: "d", name: "D", durationDays: 1, dependencies: ["b", "c"], kind: "delivery", milestone: true },
  ], "2026-07-20"), "Calendar test", new Date("2026-07-16T12:00:00Z"));

  assert.deepEqual(result.criticalTasks.map((task) => task.id), ["a", "b", "d"]);
  assert.equal(result.taskMap.get("c").critical, false);
  assert.equal(result.taskMap.get("c").slackDays, 3);
  assert.equal(result.deliveryDate, "2026-07-27");
});

test("Calendar honors a not-before constraint", () => {
  const result = computeCalendar(calendarWith([
    { id: "a", name: "A", durationDays: 1 },
    { id: "b", name: "B", durationDays: 2, dependencies: ["a"], constraintDate: "2026-08-03" },
  ], "2026-07-20"), "Calendar test", new Date("2026-07-16T12:00:00Z"));

  assert.equal(result.taskMap.get("b").startDate, "2026-08-03");
  assert.equal(result.taskMap.get("b").endDate, "2026-08-04");
});

test("Calendar timing adjustment moves a task in workdays without changing its duration", () => {
  const calendar = calendarWith([
    { id: "a", name: "A", durationDays: 3 },
  ], "2026-07-20");

  const moved = adjustCalendarTaskTiming(
    calendar,
    "a",
    "move",
    2,
    "Calendar test",
    new Date("2026-07-16T12:00:00Z"),
  );
  const result = computeCalendar(moved, "Calendar test", new Date("2026-07-16T12:00:00Z"));

  assert.equal(result.taskMap.get("a").startDate, "2026-07-22");
  assert.equal(result.taskMap.get("a").endDate, "2026-07-24");
  assert.equal(result.taskMap.get("a").durationDays, 3);
  assert.equal(result.calendar.tasks.find((task) => task.id === "a").constraintDate, "2026-07-22");
});

test("Calendar timing adjustment resizes either edge while preserving the opposite edge", () => {
  const calendar = calendarWith([
    { id: "a", name: "A", durationDays: 3, constraintDate: "2026-07-22" },
  ], "2026-07-20");
  const referenceDate = new Date("2026-07-16T12:00:00Z");
  const original = computeCalendar(calendar, "Calendar test", referenceDate).taskMap.get("a");

  const extendedEnd = adjustCalendarTaskTiming(
    calendar,
    "a",
    "resize-end",
    2,
    "Calendar test",
    referenceDate,
  );
  const endResult = computeCalendar(extendedEnd, "Calendar test", referenceDate).taskMap.get("a");
  assert.equal(endResult.startDate, original.startDate);
  assert.equal(endResult.endDate, "2026-07-27");
  assert.equal(endResult.durationDays, 5);

  const extendedStart = adjustCalendarTaskTiming(
    calendar,
    "a",
    "resize-start",
    -2,
    "Calendar test",
    referenceDate,
  );
  const startResult = computeCalendar(extendedStart, "Calendar test", referenceDate).taskMap.get("a");
  assert.equal(startResult.startDate, "2026-07-20");
  assert.equal(startResult.endDate, original.endDate);
  assert.equal(startResult.durationDays, 5);

  const shortenedStart = adjustCalendarTaskTiming(
    calendar,
    "a",
    "resize-start",
    1,
    "Calendar test",
    referenceDate,
  );
  const shortenedResult = computeCalendar(shortenedStart, "Calendar test", referenceDate).taskMap.get("a");
  assert.equal(shortenedResult.startDate, "2026-07-23");
  assert.equal(shortenedResult.endDate, original.endDate);
  assert.equal(shortenedResult.durationDays, 2);
});

test("Calendar resizing keeps linked successors in place and flags an overlap instead of rippling", () => {
  const calendar = calendarWith([
    { id: "a", name: "A", durationDays: 2 },
    { id: "b", name: "B", durationDays: 2, dependencies: ["a"] },
    { id: "c", name: "C", durationDays: 2, dependencies: ["b"] },
  ], "2026-07-20");
  const referenceDate = new Date("2026-07-16T12:00:00Z");
  const before = computeCalendar(calendar, "Calendar test", referenceDate);

  const resized = adjustCalendarTaskTiming(
    calendar,
    "a",
    "resize-end",
    2,
    "Calendar test",
    referenceDate,
  );
  const after = computeCalendar(resized, "Calendar test", referenceDate);

  assert.equal(after.taskMap.get("a").endDate, "2026-07-23");
  assert.equal(after.taskMap.get("b").startDate, before.taskMap.get("b").startDate);
  assert.equal(after.taskMap.get("b").endDate, before.taskMap.get("b").endDate);
  assert.equal(after.taskMap.get("c").startDate, before.taskMap.get("c").startDate);
  assert.equal(after.taskMap.get("c").endDate, before.taskMap.get("c").endDate);
  assert.deepEqual(after.calendar.tasks.find((task) => task.id === "b").dependencies, ["a"]);
  assert.equal(after.calendar.tasks.find((task) => task.id === "b").manualStartDate, "2026-07-22");
  assert.equal(after.taskMap.get("b").dependencyConflict, true);
  assert.deepEqual(after.taskMap.get("b").dependencyConflictIds, ["a"]);
  assert.equal(after.dependencyConflictCount, 1);
});

test("Calendar moving a task keeps linked successors fixed", () => {
  const calendar = calendarWith([
    { id: "a", name: "A", durationDays: 2 },
    { id: "b", name: "B", durationDays: 2, dependencies: ["a"] },
  ], "2026-07-20");
  const referenceDate = new Date("2026-07-16T12:00:00Z");
  const before = computeCalendar(calendar, "Calendar test", referenceDate);
  const moved = computeCalendar(
    adjustCalendarTaskTiming(calendar, "a", "move", 1, "Calendar test", referenceDate),
    "Calendar test",
    referenceDate,
  );

  assert.equal(moved.taskMap.get("a").startDate, "2026-07-21");
  assert.equal(moved.taskMap.get("b").startDate, before.taskMap.get("b").startDate);
  assert.equal(moved.taskMap.get("b").dependencyConflict, true);
});

test("Calendar normalization preserves a manual start date", () => {
  const normalized = normalizeCalendar(calendarWith([
    { id: "a", name: "A", durationDays: 2, manualStartDate: "2026-07-22" },
  ], "2026-07-20"), "Calendar test");
  const computed = computeCalendar(normalized, "Calendar test", new Date("2026-07-16T12:00:00Z"));

  assert.equal(normalized.tasks[0].manualStartDate, "2026-07-22");
  assert.equal(computed.taskMap.get("a").startDate, "2026-07-22");
});

test("Calendar timing adjustment skips Sundays for move and both resize edges", () => {
  const referenceDate = new Date("2026-07-16T12:00:00Z");
  const saturdayTask = calendarWith([
    { id: "a", name: "A", durationDays: 1 },
  ], "2026-07-18");

  const moved = computeCalendar(
    adjustCalendarTaskTiming(saturdayTask, "a", "move", 1, "Calendar test", referenceDate),
    "Calendar test",
    referenceDate,
  ).taskMap.get("a");
  assert.equal(moved.startDate, "2026-07-20");
  assert.equal(moved.endDate, "2026-07-20");

  const resizedEnd = computeCalendar(
    adjustCalendarTaskTiming(saturdayTask, "a", "resize-end", 1, "Calendar test", referenceDate),
    "Calendar test",
    referenceDate,
  ).taskMap.get("a");
  assert.equal(resizedEnd.startDate, "2026-07-18");
  assert.equal(resizedEnd.endDate, "2026-07-20");

  const saturdayToMonday = calendarWith([
    { id: "a", name: "A", durationDays: 2 },
  ], "2026-07-18");
  const resizedStart = computeCalendar(
    adjustCalendarTaskTiming(saturdayToMonday, "a", "resize-start", 1, "Calendar test", referenceDate),
    "Calendar test",
    referenceDate,
  ).taskMap.get("a");
  assert.equal(resizedStart.startDate, "2026-07-20");
  assert.equal(resizedStart.endDate, "2026-07-20");
  assert.equal(resizedStart.durationDays, 1);
});

test("Calendar timing adjustment clamps a move to the dependency boundary", () => {
  const calendar = calendarWith([
    { id: "a", name: "A", durationDays: 2 },
    { id: "b", name: "B", durationDays: 3, dependencies: ["a"], constraintDate: "2026-07-27" },
  ], "2026-07-20");
  const referenceDate = new Date("2026-07-16T12:00:00Z");

  const adjusted = adjustCalendarTaskTiming(
    calendar,
    "b",
    "move",
    -20,
    "Calendar test",
    referenceDate,
  );
  const result = computeCalendar(adjusted, "Calendar test", referenceDate);

  assert.equal(result.taskMap.get("a").endDate, "2026-07-21");
  assert.equal(result.taskMap.get("b").startDate, "2026-07-22");
  assert.equal(result.taskMap.get("b").endDate, "2026-07-24");
  assert.equal(result.calendar.tasks.find((task) => task.id === "b").constraintDate, "");
});

test("Calendar milestones can move but cannot be resized", () => {
  const calendar = calendarWith([
    { id: "m", name: "Milestone", durationDays: 0, milestone: true, kind: "milestone" },
  ], "2026-07-20");
  const referenceDate = new Date("2026-07-16T12:00:00Z");

  for (const operation of ["resize-start", "resize-end"]) {
    const adjusted = adjustCalendarTaskTiming(
      calendar,
      "m",
      operation,
      operation === "resize-start" ? -2 : 2,
      "Calendar test",
      referenceDate,
    );
    const task = computeCalendar(adjusted, "Calendar test", referenceDate).taskMap.get("m");
    assert.equal(task.startDate, "2026-07-20");
    assert.equal(task.endDate, "2026-07-20");
    assert.equal(task.durationDays, 0);
  }

  const moved = adjustCalendarTaskTiming(
    calendar,
    "m",
    "move",
    1,
    "Calendar test",
    referenceDate,
  );
  const movedTask = computeCalendar(moved, "Calendar test", referenceDate).taskMap.get("m");
  assert.equal(movedTask.startDate, "2026-07-21");
  assert.equal(movedTask.endDate, "2026-07-21");
});

test("Calendar normalization removes self references and circular dependencies", () => {
  const normalized = normalizeCalendar(calendarWith([
    { id: "a", name: "A", durationDays: 1, dependencies: ["a", "b"] },
    { id: "b", name: "B", durationDays: 1, dependencies: ["a"] },
  ]), "Calendar test");

  assert.deepEqual(normalized.tasks.find((task) => task.id === "a").dependencies, ["b"]);
  assert.deepEqual(normalized.tasks.find((task) => task.id === "b").dependencies, []);
  assert.doesNotThrow(() => computeCalendar(normalized, "Calendar test"));
});

test("Calendar template covers development through final delivery", () => {
  const template = createCalendarTemplate("Feature film", new Date("2026-07-16T12:00:00Z"));
  const result = computeCalendar(template, "Feature film", new Date("2026-07-16T12:00:00Z"));

  assert.equal(result.calendar.settings.projectStart, "2026-07-20");
  assert.ok(result.tasks.length >= 40);
  assert.ok(result.tasks.some((task) => task.kind === "shoot"));
  assert.equal(result.tasks.at(-1).kind, "delivery");
  assert.ok(result.projectFinish >= result.shootingEnd);
});
