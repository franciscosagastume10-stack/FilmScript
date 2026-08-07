import {
  PHASES,
  addCalendarDays,
  adjustCalendarTaskTiming,
  computeCalendar,
  createCalendarId,
  normalizeCalendar,
  parseDate,
  pinCalendarSuccessors,
  toDateString,
  workdayDistance,
} from "./calendar-model.js?v=20260716-timeline5";

const TIMELINE_TASK_COLUMN_WIDTH = 240;
const TIMELINE_BASE_WEEK_WIDTH = 88;
const TIMELINE_WORKDAYS_PER_WEEK = 6;
const TIMELINE_MIN_ZOOM = 0.01;
const TIMELINE_MAX_ZOOM = 1.8;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const localDateString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const statusLabel = (status) => ({
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
})[status] || "Not started";

const statusClass = (status) => ({
  not_started: "is-idle",
  in_progress: "is-progress",
  blocked: "is-blocked",
  done: "is-done",
})[status] || "is-idle";

class FilmScriptCalendar extends HTMLElement {
  static get observedAttributes() { return ["script-id", "project-title"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.view = "overview";
    this.loading = true;
    this.error = "";
    this.authRequired = false;
    this.saveStatus = "";
    this.search = "";
    this.phaseFilter = "all";
    this.criticalOnly = false;
    this.timelineZoom = 1;
    this.timelineAnnouncement = "";
    this.openRowMenuId = "";
    this.activeGroupId = "";
    this.draft = null;
    this.draftIsNew = false;
    this.dependencyChoice = "";
    this._saveRevision = 0;
    this._animateView = true;
    this._animateModal = false;
    this._timelineGesture = null;
    this._timelineScrollOverride = null;
    this._timelineScrollFrame = 0;
    this._suppressTimelineClickUntil = 0;
    this._onWindowResize = () => {
      if (this.view !== "timeline" || this.timelineZoom > 0) return;
      this.applyTimelineGeometry(0, null, { fit: true });
    };
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("input", this._onInput);
    this.shadowRoot.addEventListener("change", this._onChange);
    this.shadowRoot.addEventListener("keydown", this._onKeyDown);
    this.shadowRoot.addEventListener("pointerdown", this._onPointerDown);
    this.shadowRoot.addEventListener("pointermove", this._onPointerMove);
    this.shadowRoot.addEventListener("pointerup", this._onPointerUp);
    this.shadowRoot.addEventListener("pointercancel", this._onPointerCancel);
    this.shadowRoot.addEventListener("wheel", this._onWheel, { passive: false });
    this.shadowRoot.addEventListener("scroll", this._onScroll, true);
    window.addEventListener("resize", this._onWindowResize);
    window.filmscriptSounds?.preload("formatControl");
    this.load();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onClick);
    this.shadowRoot.removeEventListener("input", this._onInput);
    this.shadowRoot.removeEventListener("change", this._onChange);
    this.shadowRoot.removeEventListener("keydown", this._onKeyDown);
    this.shadowRoot.removeEventListener("pointerdown", this._onPointerDown);
    this.shadowRoot.removeEventListener("pointermove", this._onPointerMove);
    this.shadowRoot.removeEventListener("pointerup", this._onPointerUp);
    this.shadowRoot.removeEventListener("pointercancel", this._onPointerCancel);
    this.shadowRoot.removeEventListener("wheel", this._onWheel);
    this.shadowRoot.removeEventListener("scroll", this._onScroll, true);
    window.removeEventListener("resize", this._onWindowResize);
    cancelAnimationFrame(this._timelineScrollFrame);
    clearTimeout(this._saveTimer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // The DC runtime can hydrate a custom element in two steps: first it
    // creates the element, then it resolves the interpolated script id. The
    // old guard ignored the initial `null -> scr_...` transition, leaving the
    // workspace permanently stuck on “Calendar could not be opened”.
    if (name === "script-id" && newValue && oldValue !== newValue && this.isConnected) this.load();
    if (name === "project-title" && oldValue !== newValue && this.calendar) {
      this.calendar = normalizeCalendar(this.calendar, this.projectTitle);
      this.render();
    }
  }

  get scriptId() { return this.getAttribute("script-id") || ""; }
  get projectTitle() { return this.getAttribute("project-title") || "Untitled screenplay"; }

  async load() {
    if (!this.scriptId || !window.filmscriptCalendar) {
      this.loading = false;
      this.error = "Calendar is not available for this screenplay.";
      this.authRequired = false;
      this.render();
      return;
    }
    this.loading = true;
    this.error = "";
    this.authRequired = false;
    this.render();
    try {
      const result = await window.filmscriptCalendar.get(this.scriptId);
      this.calendar = normalizeCalendar(result.calendar, this.projectTitle);
      this.loading = false;
      this.saveStatus = result.storage === "local" ? "Saved on this device" : "";
      this.render();
    } catch (error) {
      this.loading = false;
      this.error = error.message || "Could not load this calendar.";
      this.authRequired = error.code === "google_sign_in_required";
      this.render();
    }
  }

  queueSave() {
    if (!this.calendar || !this.scriptId) return;
    this.calendar.updatedAt = new Date().toISOString();
    this.saveStatus = "Saving";
    const revision = ++this._saveRevision;
    clearTimeout(this._saveTimer);
    this.render();
    this._saveTimer = window.setTimeout(async () => {
      try {
        const result = await window.filmscriptCalendar.save(this.scriptId, this.calendar);
        if (revision !== this._saveRevision) return;
        this.calendar = normalizeCalendar(result.calendar, this.projectTitle);
        this.saveStatus = result.storage === "local" ? "Saved on this device" : "Saved";
        this.error = "";
        this.render();
        window.dispatchEvent(new CustomEvent("filmscript:calendar-updated", {
          detail: { scriptId: this.scriptId },
        }));
      } catch (error) {
        if (revision !== this._saveRevision) return;
        this.saveStatus = "Save failed";
        this.error = error.message || "Could not save this calendar.";
        this.render();
      }
    }, 420);
  }

  computed() {
    return computeCalendar(this.calendar, this.projectTitle);
  }

  locale() {
    return window.filmscriptLanguage?.get?.() === "es" ? "es-GT" : "en-US";
  }

  formatDate(value, withYear = false) {
    const date = parseDate(value);
    if (!date) return "Not scheduled";
    return new Intl.DateTimeFormat(this.locale(), {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(date);
  }

  formatDateRange(start, end, withYear = false) {
    if (!start) return "Not scheduled";
    if (!end || start === end) return this.formatDate(start, withYear);
    return `${this.formatDate(start, withYear)} – ${this.formatDate(end, withYear)}`;
  }

  timelineWeekWidth(value = this.timelineZoom) {
    if (finite(value, 1) <= 0) return 0;
    const zoom = Math.max(TIMELINE_MIN_ZOOM, Math.min(TIMELINE_MAX_ZOOM, finite(value, 1)));
    return Math.round(TIMELINE_BASE_WEEK_WIDTH * zoom * 1000) / 1000;
  }

  captureTimelineScroll(anchorClientX = null) {
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    if (!scroll) return null;
    const weekWidth = Math.max(1, finite(scroll.dataset.weekWidth, this.timelineWeekWidth()));
    const rect = scroll.getBoundingClientRect();
    const anchorX = anchorClientX == null
      ? scroll.clientWidth / 2
      : Math.max(0, Math.min(scroll.clientWidth, anchorClientX - rect.left));
    return {
      anchorWeeks: (scroll.scrollLeft + anchorX) / weekWidth,
      anchorX,
      top: scroll.scrollTop,
    };
  }

  restoreTimelineScroll(state) {
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    if (!scroll) return;
    const weekWidth = Math.max(1, finite(scroll.dataset.weekWidth, this.timelineWeekWidth()));
    if (state) {
      scroll.scrollLeft = Math.max(0, state.anchorWeeks * weekWidth - state.anchorX);
      scroll.scrollTop = state.top;
      this.syncTimelinePan();
      return;
    }
    const zeroOffset = finite(scroll.dataset.zeroOffset, -1);
    if (zeroOffset >= 0) {
      scroll.scrollLeft = Math.max(0, zeroOffset * weekWidth - (scroll.clientWidth - TIMELINE_TASK_COLUMN_WIDTH) / 2 + weekWidth / 2);
    }
    this.syncTimelinePan();
  }

  applyTimelineGeometry(value, anchorClientX = null, { fit = false, animate = false } = {}) {
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    const raw = finite(value, 1);
    const fitMode = fit || raw <= 0.05;
    const next = fitMode ? 0 : Math.max(TIMELINE_MIN_ZOOM, Math.min(TIMELINE_MAX_ZOOM, raw));
    if (!scroll) {
      this.timelineZoom = next;
      return;
    }
    const previousWeekWidth = Math.max(0.001, finite(scroll.dataset.weekWidth, this.timelineWeekWidth()));
    const rect = scroll.getBoundingClientRect();
    const anchorX = anchorClientX == null
      ? scroll.clientWidth / 2
      : Math.max(0, Math.min(scroll.clientWidth, anchorClientX - rect.left));
    const anchorWeeks = (scroll.scrollLeft + anchorX) / previousWeekWidth;
    const weekCount = Math.max(1, finite(scroll.dataset.weekCount, 1));
    const taskColumnWidth = Math.max(0, finite(scroll.dataset.taskColumnWidth, TIMELINE_TASK_COLUMN_WIDTH));
    const available = Math.max(1, finite(scroll.clientWidth, 960) - taskColumnWidth);
    const weekWidth = fitMode
      ? Math.max(1, available / weekCount)
      : this.timelineWeekWidth(next);
    const dayWidth = weekWidth / TIMELINE_WORKDAYS_PER_WEEK;
    const timelineWidth = weekCount * weekWidth;

    this.timelineZoom = next;
    scroll.dataset.weekWidth = String(weekWidth);
    scroll.dataset.fitMode = fitMode ? "true" : "false";
    scroll.style.setProperty("--week", `${weekWidth}px`);
    scroll.style.setProperty("--day", `${dayWidth}px`);
    scroll.style.setProperty("--timeline", `${timelineWidth}px`);
    scroll.style.setProperty("--task-column", `${taskColumnWidth}px`);
    const shell = scroll.querySelector(".timeline-shell");
    if (shell) shell.style.minWidth = `${taskColumnWidth + timelineWidth}px`;
    scroll.querySelectorAll("[data-timeline-grid]").forEach((element) => {
      element.style.gridTemplateColumns = `${taskColumnWidth}px ${timelineWidth}px`;
    });
    const weeks = scroll.querySelector(".weeks");
    if (weeks) weeks.style.gridTemplateColumns = `repeat(${weekCount},${weekWidth}px)`;

    const shootOffset = finite(scroll.dataset.zeroOffset, -1);
    scroll.querySelectorAll(".timeline-track").forEach((track) => {
      track.style.width = `${timelineWidth}px`;
      track.style.setProperty("--week", `${weekWidth}px`);
      track.style.setProperty("--day", `${dayWidth}px`);
      if (shootOffset >= 0) {
        track.style.setProperty("--zero-start", `${shootOffset * weekWidth}px`);
        track.style.setProperty("--zero-end", `${(shootOffset + 1) * weekWidth}px`);
      }
      const todayLine = track.querySelector(".today-line");
      if (todayLine) {
        const todayOffset = finite(todayLine.dataset.todayDays) / TIMELINE_WORKDAYS_PER_WEEK * weekWidth;
        todayLine.style.left = `${todayOffset}px`;
        todayLine.hidden = todayOffset < 0 || todayOffset > timelineWidth;
      }
      const bar = track.querySelector("[data-timeline-bar]");
      if (!bar) return;
      const startDays = Math.max(0, finite(bar.dataset.startDays));
      const startOffset = startDays / TIMELINE_WORKDAYS_PER_WEEK * weekWidth;
      const left = Math.min(Math.max(3, startOffset + 3), Math.max(3, timelineWidth - 16));
      bar.style.left = `${left}px`;
      if (bar.dataset.milestone === "true") {
        const width = Math.max(22, Math.min(44, weekWidth * 0.46));
        bar.style.width = `${Math.min(width, Math.max(22, timelineWidth - left - 3))}px`;
      } else {
        const spanDays = Math.max(1, finite(bar.dataset.spanDays, 1));
        const width = Math.max(18, spanDays / TIMELINE_WORKDAYS_PER_WEEK * weekWidth - 7);
        bar.style.width = `${Math.min(width, Math.max(18, timelineWidth - left - 3))}px`;
      }
    });

    const slider = this.shadowRoot.querySelector("[data-timeline-zoom]");
    const output = this.shadowRoot.querySelector("[data-zoom-output]");
    if (slider) slider.value = String(next);
    if (output) output.textContent = `${Math.round(next * 100)}%`;
    if (animate) {
      const card = this.shadowRoot.querySelector(".timeline-card");
      card?.classList.remove("is-fitting");
      requestAnimationFrame(() => card?.classList.add("is-fitting"));
      window.setTimeout(() => card?.classList.remove("is-fitting"), 260);
    }
    scroll.scrollLeft = fit ? 0 : Math.max(0, anchorWeeks * weekWidth - anchorX);
    this.syncTimelinePan();
    requestAnimationFrame(() => this.syncTimelinePan());
    window.setTimeout(() => this.syncTimelinePan(), 220);
  }

  setTimelineZoom(value, anchorClientX = null, options = {}) {
    this.applyTimelineGeometry(value, anchorClientX, options);
  }

  fitTimeline() {
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    const weekCount = Math.max(1, finite(scroll?.dataset.weekCount, 1));
    const taskColumnWidth = Math.max(0, finite(scroll?.dataset.taskColumnWidth, TIMELINE_TASK_COLUMN_WIDTH));
    const available = Math.max(1, finite(scroll?.clientWidth, 960) - taskColumnWidth - 4);
    this.setTimelineZoom(available / (weekCount * TIMELINE_BASE_WEEK_WIDTH), null, { fit: true, animate: true });
  }

  syncTimelinePan() {
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    const pan = this.shadowRoot.querySelector("[data-timeline-pan]");
    if (!scroll || !pan) return;
    const maximum = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    pan.max = String(Math.max(1, maximum));
    pan.value = String(Math.min(maximum, Math.max(0, scroll.scrollLeft)));
    pan.disabled = maximum < 1;
    pan.style.setProperty("--pan-progress", `${maximum > 0 ? scroll.scrollLeft / maximum * 100 : 100}%`);
  }

  applyTimelineAdjustment(taskId, operation, deltaWorkdays) {
    if (!this.calendar) return false;
    const current = this.computed().taskMap.get(taskId);
    const nextCalendar = adjustCalendarTaskTiming(
      this.calendar,
      taskId,
      operation,
      deltaWorkdays,
      this.projectTitle,
    );
    const next = computeCalendar(nextCalendar, this.projectTitle).taskMap.get(taskId);
    if (!current || !next || (current.startDate === next.startDate && current.endDate === next.endDate)) return false;
    this.calendar = nextCalendar;
    this.timelineAnnouncement = `${next.name}: ${this.formatDateRange(next.startDate, next.endDate, true)}`;
    this.queueSave();
    return true;
  }

  switchView(nextView) {
    if (!["overview", "timeline"].includes(nextView) || nextView === this.view) return;
    this.view = nextView;
    this.openRowMenuId = "";
    this._animateView = true;
    window.filmscriptSounds?.play("formatControl", { volume: 0.18 });
    this.render();
  }

  openTask(taskId = "", options = {}) {
    const task = taskId ? this.calendar?.tasks?.find((entry) => entry.id === taskId) : null;
    this.draftIsNew = !task;
    this.draft = task
      ? { ...task, dependencies: [...task.dependencies] }
      : {
          id: createCalendarId("cal"),
          name: "",
          phaseId: options.phaseId || (this.phaseFilter !== "all" ? this.phaseFilter : "development"),
          durationDays: 6,
          dependencies: [],
          owner: "",
          progress: 0,
          status: "not_started",
          constraintDate: "",
          milestone: false,
          kind: "task",
          notes: "",
          groupId: options.groupId || this.activeGroupId || "",
        };
    this.dependencyChoice = "";
    this._animateModal = true;
    this.render();
    requestAnimationFrame(() => this.shadowRoot.querySelector("[data-draft='name']")?.focus());
  }

  closeTask() {
    this.draft = null;
    this.draftIsNew = false;
    this.dependencyChoice = "";
    this.openRowMenuId = "";
    this.activeGroupId = "";
    this.render();
  }

  dependencyWouldCycle(dependencyId) {
    if (!this.draft || this.draftIsNew) return false;
    const successors = new Map((this.calendar?.tasks || []).map((task) => [task.id, []]));
    for (const task of this.calendar?.tasks || []) {
      for (const dependency of task.dependencies || []) successors.get(dependency)?.push(task.id);
    }
    const pending = [this.draft.id];
    const seen = new Set();
    while (pending.length) {
      const current = pending.pop();
      if (current === dependencyId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const successor of successors.get(current) || []) pending.push(successor);
    }
    return false;
  }

  dependencyCandidates() {
    if (!this.draft) return [];
    const selected = new Set(this.draft.dependencies || []);
    return (this.calendar?.tasks || []).filter((task) =>
      task.id !== this.draft.id && !selected.has(task.id) && !this.dependencyWouldCycle(task.id));
  }

  addDependency() {
    if (!this.draft || !this.dependencyChoice) return;
    if (!this.draft.dependencies.includes(this.dependencyChoice)) this.draft.dependencies.push(this.dependencyChoice);
    this.dependencyChoice = "";
    this.render();
  }

  removeDependency(dependencyId) {
    if (!this.draft) return;
    this.draft.dependencies = this.draft.dependencies.filter((id) => id !== dependencyId);
    this.render();
  }

  saveTask() {
    if (!this.draft || !this.calendar) return;
    const name = String(this.draft.name || "").trim().replace(/\s+/g, " ").slice(0, 140);
    if (!name) {
      this.shadowRoot.querySelector("[data-draft='name']")?.focus();
      return;
    }
    const milestone = this.draft.kind === "delivery" || Boolean(this.draft.milestone);
    const progress = this.draft.status === "done" ? 100 : Math.max(0, Math.min(100, Math.round(finite(this.draft.progress))));
    const task = {
      ...this.draft,
      name,
      owner: String(this.draft.owner || "").trim().replace(/\s+/g, " ").slice(0, 100),
      notes: String(this.draft.notes || "").trim().slice(0, 800),
      durationDays: milestone ? 0 : Math.max(1, Math.min(312, Math.round(finite(this.draft.durationDays, 1)))),
      milestone,
      kind: ["shoot", "delivery"].includes(this.draft.kind)
        ? this.draft.kind
        : milestone ? "milestone" : "task",
      progress,
      status: progress >= 100 ? "done" : this.draft.status === "done"
        ? "in_progress"
        : this.draft.status,
      dependencies: [...new Set(this.draft.dependencies || [])],
      groupId: String(this.draft.groupId || "").trim(),
    };
    const existing = this.draftIsNew ? null : this.calendar.tasks.find((entry) => entry.id === task.id);
    const sameDependencies = existing
      ? [...existing.dependencies].sort().join("|") === [...task.dependencies].sort().join("|")
      : true;
    const durationChanged = Boolean(existing)
      && (existing.durationDays !== task.durationDays || existing.milestone !== task.milestone);
    const scheduleRuleChanged = Boolean(existing)
      && (existing.constraintDate !== task.constraintDate || !sameDependencies);
    let workingCalendar = this.calendar;
    if (existing && (durationChanged || scheduleRuleChanged)) {
      const currentStart = this.computed().taskMap.get(task.id)?.startDate || "";
      workingCalendar = pinCalendarSuccessors(this.calendar, task.id, this.projectTitle);
      if (durationChanged && !scheduleRuleChanged && currentStart) task.manualStartDate = currentStart;
      if (scheduleRuleChanged) task.manualStartDate = "";
    }
    const tasks = this.draftIsNew
      ? [...workingCalendar.tasks, task]
      : workingCalendar.tasks.map((entry) => entry.id === task.id ? task : entry);
    this.calendar = normalizeCalendar({ ...workingCalendar, tasks }, this.projectTitle);
    this.draft = null;
    this.draftIsNew = false;
    this.queueSave();
  }

  deleteTask(taskId = this.draft?.id) {
    const task = this.calendar?.tasks?.find((entry) => entry.id === taskId);
    if (!task) return;
    const prompt = `Delete “${task.name}”? This cannot be undone.`;
    const translated = window.filmscriptLanguage?.t?.(prompt) || prompt;
    if (!window.confirm(translated)) return;
    const tasks = this.calendar.tasks
      .filter((entry) => entry.id !== task.id)
      .map((entry) => ({ ...entry, dependencies: entry.dependencies.filter((dependency) => dependency !== task.id) }));
    this.calendar = normalizeCalendar({ ...this.calendar, tasks }, this.projectTitle);
    this.draft = null;
    this.draftIsNew = false;
    this.queueSave();
  }

  completeTask(taskId) {
    if (!this.calendar) return;
    this.calendar.tasks = this.calendar.tasks.map((task) => task.id === taskId
      ? { ...task, progress: 100, status: "done" }
      : task);
    this.calendar = normalizeCalendar(this.calendar, this.projectTitle);
    this.queueSave();
  }

  toggleTaskComplete(taskId) {
    const task = this.calendar?.tasks?.find((entry) => entry.id === taskId);
    if (!task) return;
    if (task.status === "done") {
      this.calendar.tasks = this.calendar.tasks.map((entry) => entry.id === taskId
        ? { ...entry, progress: Math.min(95, Math.max(0, finite(entry.progress, 0))), status: "in_progress" }
        : entry);
      this.calendar = normalizeCalendar(this.calendar, this.projectTitle);
      this.queueSave();
      return;
    }
    this.completeTask(taskId);
  }

  createGroup(phaseId = "development") {
    if (!this.calendar) return;
    const phase = PHASES.find((entry) => entry.id === phaseId) || PHASES[0];
    const prompt = `Name the new ${phase.name} group`;
    const name = window.prompt?.(window.filmscriptLanguage?.t?.(prompt) || prompt);
    const cleanName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 100);
    if (!cleanName) {
      this.render();
      return;
    }
    const group = { id: createCalendarId("group"), name: cleanName, phaseId: phase.id, collapsed: false };
    this.calendar = normalizeCalendar({
      ...this.calendar,
      groups: [...(this.calendar.groups || []), group],
    }, this.projectTitle);
    this.activeGroupId = group.id;
    this.timelineAnnouncement = `${cleanName}: group created`;
    this.queueSave();
    this.openTask("", { phaseId: phase.id, groupId: group.id });
  }

  updateProjectStart(value) {
    if (!parseDate(value) || !this.calendar) return;
    this.calendar.settings.projectStart = value;
    this.calendar = normalizeCalendar(this.calendar, this.projectTitle);
    this.queueSave();
  }

  _onPointerDown = (event) => {
    const bar = event.target.closest("[data-timeline-bar]");
    if (!bar || event.button !== 0 || this._timelineGesture) return;
    const resizeHandle = event.target.closest("[data-resize-edge]");
    const operation = resizeHandle ? `resize-${resizeHandle.dataset.resizeEdge}` : "move";
    if (bar.dataset.milestone === "true" && operation !== "move") return;
    const task = this.computed().taskMap.get(bar.dataset.timelineBar);
    const scroll = this.shadowRoot.querySelector(".timeline-scroll");
    if (!task || !scroll) return;

    this._timelineGesture = {
      pointerId: event.pointerId,
      taskId: task.id,
      operation,
      task,
      bar,
      scroll,
      startClientX: event.clientX,
      initialScrollLeft: scroll.scrollLeft,
      weekWidth: Math.max(0.001, finite(scroll.dataset.weekWidth, this.timelineWeekWidth())),
      originalLeft: finite(bar.style.left),
      originalWidth: bar.offsetWidth,
      originalStyle: bar.getAttribute("style") || "",
      originalDateText: this.shadowRoot.querySelector(`[data-timeline-date="${task.id}"]`)?.textContent || "",
      lastDelta: null,
      previewCalendar: null,
      previewTask: null,
      changed: false,
      pointerMoved: false,
      startedOnHandle: Boolean(resizeHandle),
    };
    try { bar.setPointerCapture(event.pointerId); } catch {}
    bar.classList.add("is-editing");
    bar.setAttribute("aria-grabbed", "true");
    if (resizeHandle) event.preventDefault();
  };

  _onPointerMove = (event) => {
    const gesture = this._timelineGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const rect = gesture.scroll.getBoundingClientRect();
    const edge = 42;
    if (event.clientX > rect.right - edge) gesture.scroll.scrollLeft += Math.min(24, event.clientX - (rect.right - edge));
    if (event.clientX < rect.left + edge) gesture.scroll.scrollLeft -= Math.min(24, (rect.left + edge) - event.clientX);

    const totalPixels = event.clientX - gesture.startClientX
      + gesture.scroll.scrollLeft - gesture.initialScrollLeft;
    if (Math.abs(totalPixels) > 4) gesture.pointerMoved = true;
    if (!gesture.pointerMoved && !gesture.startedOnHandle) return;
    event.preventDefault();

    // A timeline gesture is intentionally magnetic: one snap equals one
    // production workday (Monday–Saturday), never a half-day or free pixel.
    // Keep the day grid explicit for the editor contract: weekWidth / 6 workdays.
    const dayWidth = Math.max(0.1, gesture.weekWidth / TIMELINE_WORKDAYS_PER_WEEK);
    const delta = Math.round(totalPixels / dayWidth);
    if (delta === gesture.lastDelta) return;
    gesture.lastDelta = delta;
    const previewCalendar = adjustCalendarTaskTiming(
      this.calendar,
      gesture.taskId,
      gesture.operation,
      delta,
      this.projectTitle,
    );
    const previewTask = computeCalendar(previewCalendar, this.projectTitle).taskMap.get(gesture.taskId);
    if (!previewTask) return;

    const appliedDelta = gesture.operation === "resize-end"
      ? previewTask.durationDays - gesture.task.durationDays
      : workdayDistance(gesture.task.startDate, previewTask.startDate);
    const pixels = appliedDelta * dayWidth;
    gesture.previewCalendar = previewCalendar;
    gesture.previewTask = previewTask;
    gesture.changed = previewTask.startDate !== gesture.task.startDate || previewTask.endDate !== gesture.task.endDate;

    gesture.bar.setAttribute("style", gesture.originalStyle);
    gesture.bar.classList.add("is-editing");
    gesture.bar.setAttribute("aria-grabbed", "true");
    if (gesture.operation === "move") gesture.bar.style.setProperty("--drag-x", `${pixels}px`);
    if (gesture.operation === "resize-start") {
      gesture.bar.style.left = `${gesture.originalLeft + pixels}px`;
      gesture.bar.style.width = `${Math.max(18, gesture.originalWidth - pixels)}px`;
    }
    if (gesture.operation === "resize-end") {
      gesture.bar.style.width = `${Math.max(18, gesture.originalWidth + pixels)}px`;
    }
    gesture.bar.dataset.dragLabel = this.formatDateRange(previewTask.startDate, previewTask.endDate);
    const date = this.shadowRoot.querySelector(`[data-timeline-date="${gesture.taskId}"]`);
    if (date) date.textContent = this.formatDateRange(previewTask.startDate, previewTask.endDate);
  };

  finishTimelineGesture(commit = false, event = null) {
    const gesture = this._timelineGesture;
    if (!gesture) return;
    try {
      if (gesture.bar.hasPointerCapture?.(gesture.pointerId)) gesture.bar.releasePointerCapture(gesture.pointerId);
    } catch {}
    if (gesture.pointerMoved || gesture.startedOnHandle) {
      this._suppressTimelineClickUntil = performance.now() + 320;
      event?.preventDefault?.();
    }
    this._timelineGesture = null;

    if (commit && gesture.changed && gesture.previewCalendar && gesture.previewTask) {
      this.calendar = gesture.previewCalendar;
      this.timelineAnnouncement = `${gesture.previewTask.name}: ${this.formatDateRange(gesture.previewTask.startDate, gesture.previewTask.endDate, true)}`;
      window.filmscriptSounds?.play("formatControl", { volume: 0.14 });
      this.queueSave();
      return;
    }

    gesture.bar.setAttribute("style", gesture.originalStyle);
    gesture.bar.classList.remove("is-editing");
    gesture.bar.removeAttribute("aria-grabbed");
    delete gesture.bar.dataset.dragLabel;
    const date = this.shadowRoot.querySelector(`[data-timeline-date="${gesture.taskId}"]`);
    if (date) date.textContent = gesture.originalDateText;
  }

  _onPointerUp = (event) => {
    if (!this._timelineGesture || event.pointerId !== this._timelineGesture.pointerId) return;
    this.finishTimelineGesture(true, event);
  };

  _onPointerCancel = (event) => {
    if (!this._timelineGesture || event.pointerId !== this._timelineGesture.pointerId) return;
    this.finishTimelineGesture(false, event);
  };

  _onWheel = (event) => {
    if ((!event.ctrlKey && !event.metaKey) || !event.target.closest(".timeline-scroll")) return;
    event.preventDefault();
    this.setTimelineZoom(this.timelineZoom + (event.deltaY < 0 ? 0.1 : -0.1), event.clientX);
  };

  _onScroll = (event) => {
    if (!event.target?.matches?.(".timeline-scroll")) return;
    cancelAnimationFrame(this._timelineScrollFrame);
    this._timelineScrollFrame = requestAnimationFrame(() => this.syncTimelinePan());
  };

  _onClick = (event) => {
    if (event.target.closest("[data-timeline-bar]") && performance.now() < this._suppressTimelineClickUntil) {
      event.preventDefault();
      return;
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      this.switchView(viewButton.dataset.view);
      return;
    }
    const target = event.target.closest("[data-action]");
    if (!target) {
      if (this.openRowMenuId) {
        this.openRowMenuId = "";
        this.render();
      }
      return;
    }
    const action = target.dataset.action;
    if (action === "row-menu") {
      this.openRowMenuId = this.openRowMenuId === target.dataset.task ? "" : target.dataset.task;
      this.render();
      return;
    }
    if (action === "add-row" || action === "add-group") {
      this.openRowMenuId = "";
      const phaseId = target.dataset.phase || (this.phaseFilter !== "all" ? this.phaseFilter : "development");
      if (action === "add-group") {
        this.createGroup(phaseId);
        return;
      }
      this.openTask("", { phaseId, groupId: target.dataset.group || "" });
      return;
    }
    if (action === "row-complete") {
      this.openRowMenuId = "";
      this.toggleTaskComplete(target.dataset.task);
      return;
    }
    if (action === "row-delete") {
      this.openRowMenuId = "";
      this.deleteTask(target.dataset.task);
      return;
    }
    if (action === "add-task") { this.openRowMenuId = ""; this.openTask(); }
    if (action === "edit-task") { this.openRowMenuId = ""; this.openTask(target.dataset.task); }
    if (action === "close-modal") this.closeTask();
    if (action === "save-task") this.saveTask();
    if (action === "delete-task") this.deleteTask(target.dataset.task);
    if (action === "complete-task") this.completeTask(target.dataset.task);
    if (action === "add-dependency") this.addDependency();
    if (action === "remove-dependency") this.removeDependency(target.dataset.dependency);
    if (action === "open-timeline") this.switchView("timeline");
    if (action === "zoom-in") this.setTimelineZoom(this.timelineZoom + 0.1, null, { animate: true });
    if (action === "zoom-out") this.setTimelineZoom(this.timelineZoom - 0.1, null, { animate: true });
    if (action === "zoom-reset") this.setTimelineZoom(1, null, { animate: true });
    if (action === "zoom-fit") this.fitTimeline();
    if (action === "toggle-critical") {
      this.criticalOnly = !this.criticalOnly;
      this.render();
    }
    if (action === "retry") this.load();
    if (action === "sign-in") {
      const pathname = window.location?.protocol === "file:"
        ? `/${String(window.location.pathname || "").split("/").pop()}`
        : window.location.pathname;
      const returnTo = `${pathname}${window.location.search}${window.location.hash}`;
      const signInUrl = window.filmscriptBilling?.googleSignInUrl?.(returnTo)
        || `${window.filmscriptApiUrl ? window.filmscriptApiUrl("/auth/google") : "/auth/google"}?returnTo=${encodeURIComponent(returnTo)}`;
      window.location.href = signInUrl;
    }
    if (action === "close-modal" || action === "save-task" || action === "delete-task") event.preventDefault();
  };

  _onInput = (event) => {
    const pan = event.target.closest("[data-timeline-pan]");
    if (pan) {
      const scroll = this.shadowRoot.querySelector(".timeline-scroll");
      if (scroll) scroll.scrollLeft = Math.max(0, finite(pan.value));
      this.syncTimelinePan();
      return;
    }
    const zoom = event.target.closest("[data-timeline-zoom]");
    if (zoom) {
      this.setTimelineZoom(zoom.value);
      return;
    }
    const search = event.target.closest("[data-calendar-search]");
    if (search) {
      this.search = search.value;
      this.render();
      requestAnimationFrame(() => {
        const next = this.shadowRoot.querySelector("[data-calendar-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(this.search.length, this.search.length);
        }
      });
      return;
    }
    const input = event.target.closest("[data-draft]");
    if (!input || !this.draft) return;
    const field = input.dataset.draft;
    if (field === "progress") {
      this.draft.progress = Math.max(0, Math.min(100, Math.round(finite(input.value))));
      if (this.draft.progress >= 100) this.draft.status = "done";
      else if (this.draft.progress > 0 && this.draft.status === "not_started") this.draft.status = "in_progress";
      const output = this.shadowRoot.querySelector("[data-progress-output]");
      if (output) output.textContent = `${this.draft.progress}%`;
      return;
    }
    if (field === "durationDays") this.draft[field] = input.value;
    else this.draft[field] = input.value;
  };

  _onChange = (event) => {
    const zoom = event.target.closest("[data-timeline-zoom]");
    if (zoom) {
      this.setTimelineZoom(zoom.value, null, { animate: true });
      return;
    }
    const projectStart = event.target.closest("[data-project-start]");
    if (projectStart) {
      this.updateProjectStart(projectStart.value);
      return;
    }
    const phase = event.target.closest("[data-phase-filter]");
    if (phase) {
      this.phaseFilter = phase.value;
      this.render();
      return;
    }
    const dependency = event.target.closest("[data-dependency-choice]");
    if (dependency) {
      this.dependencyChoice = dependency.value;
      return;
    }
    const input = event.target.closest("[data-draft]");
    if (!input || !this.draft) return;
    const field = input.dataset.draft;
    if (field === "milestone") {
      if (this.draft.kind === "delivery") return;
      this.draft.milestone = input.checked;
      if (input.checked) {
        this.draft.durationDays = 0;
        if (!["shoot", "delivery"].includes(this.draft.kind)) this.draft.kind = "milestone";
      } else {
        this.draft.durationDays = Math.max(1, finite(this.draft.durationDays, 1));
        if (this.draft.kind === "milestone") this.draft.kind = "task";
      }
      this.render();
      return;
    }
    if (field === "status") {
      this.draft.status = input.value;
      if (input.value === "done") this.draft.progress = 100;
      else if (this.draft.progress >= 100) this.draft.progress = 95;
      this.render();
      return;
    }
    if (field === "phaseId") {
      this.draft[field] = input.value;
      this.draft.groupId = "";
      this.render();
      return;
    }
    this.draft[field] = input.value;
  };

  _onKeyDown = (event) => {
    if (event.key === "Escape" && this._timelineGesture) {
      event.preventDefault();
      this.finishTimelineGesture(false, event);
      return;
    }
    if (event.key === "Escape" && this.draft) {
      event.preventDefault();
      this.closeTask();
      return;
    }
    const timelineBar = event.target.closest("[data-timeline-bar]");
    if (timelineBar && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const operation = event.ctrlKey ? "resize-start" : event.shiftKey ? "resize-end" : "move";
      this.applyTimelineAdjustment(timelineBar.dataset.timelineBar, operation, direction);
      return;
    }
    if (this.view === "timeline"
      && !event.target.matches("input,select,textarea")
      && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.setTimelineZoom(this.timelineZoom + 0.1);
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        this.setTimelineZoom(this.timelineZoom - 0.1);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        this.setTimelineZoom(1);
        return;
      }
    }
    const tab = event.target.closest(".tabs [data-view]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const tabs = Array.from(this.shadowRoot.querySelectorAll(".tabs [data-view]"));
      const current = tabs.indexOf(tab);
      if (current < 0) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
        : event.key === "ArrowRight" ? (current + 1) % tabs.length
        : (current - 1 + tabs.length) % tabs.length;
      tabs[nextIndex]?.focus();
      this.switchView(tabs[nextIndex]?.dataset.view);
    }
    if (event.key === "Enter" && event.target.matches("[data-dependency-choice]")) {
      event.preventDefault();
      this.dependencyChoice = event.target.value;
      this.addDependency();
    }
  };

  renderKpi(label, value, note, tone = "") {
    return `<article class="kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }

  renderOverview(computed) {
    const today = localDateString();
    const deliveryDistance = workdayDistance(today, computed.deliveryDate);
    const deliveryNote = deliveryDistance < 0
      ? `${Math.abs(deliveryDistance)} workdays late`
      : deliveryDistance === 0 ? "Delivery day" : `${deliveryDistance} workdays remaining`;
    const riskNote = computed.atRiskCount
      ? `${computed.atRiskCount} task${computed.atRiskCount === 1 ? " needs" : "s need"} attention`
      : "No critical task is slipping";
    const phaseRibbon = computed.phases.map((phase) => {
      const duration = Math.max(1, workdayDistance(phase.startDate, phase.endDate) + 1);
      return `<div style="--phase:${phase.color};flex-grow:${duration}"><span>${escapeHtml(phase.name)}</span><small>${escapeHtml(this.formatDateRange(phase.startDate, phase.endDate))}</small></div>`;
    }).join("");
    const phaseCards = computed.phases.map((phase) => `<article class="phase-card" style="--phase:${phase.color}">
      <div class="phase-card-head"><span>${escapeHtml(phase.name)}</span><strong>${phase.progress}%</strong></div>
      <div class="phase-progress"><i style="width:${phase.progress}%"></i></div>
      <small>${escapeHtml(this.formatDateRange(phase.startDate, phase.endDate))} · ${phase.taskCount} task${phase.taskCount === 1 ? "" : "s"}</small>
    </article>`).join("");
    const criticalRows = computed.criticalTasks.slice(0, 8).map((task, index) => `<button type="button" class="focus-row" data-action="edit-task" data-task="${task.id}">
      <span class="focus-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="focus-copy"><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(this.formatDateRange(task.startDate, task.endDate))}${task.owner ? ` · ${escapeHtml(task.owner)}` : ""}</small></span>
      <span class="risk-badge ${task.atRisk ? "is-risk" : ""}">${task.atRisk ? "At risk" : "Critical"}</span>
    </button>`).join("");
    const upcomingRows = computed.upcoming.map((task) => `<article class="upcoming-row">
      <span class="upcoming-date"><strong>${escapeHtml(this.formatDate(task.startDate))}</strong><small>${escapeHtml(this.formatDate(task.endDate))}</small></span>
      <button type="button" class="upcoming-main" data-action="edit-task" data-task="${task.id}"><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(PHASES.find((phase) => phase.id === task.phaseId)?.name || "Production")}${task.owner ? ` · ${escapeHtml(task.owner)}` : ""}</small></button>
      <span class="status ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
      ${task.status === "done" ? "" : `<button type="button" class="complete" data-action="complete-task" data-task="${task.id}" aria-label="Mark ${escapeHtml(task.name)} complete">✓</button>`}
    </article>`).join("");

    return `<section class="view overview-view">
      <header class="calendar-hero">
        <div class="hero-lockup"><span class="calendar-glyph" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M9 11.5h24v22H9zM9 17h24M15 8v7M27 8v7M14 22h4M22 22h5M14 27h4M22 27h5"/></svg></span><div><span class="eyebrow">Production calendar</span><h2>Calendar</h2><p>The route from script lock to final delivery, recalculated every time the plan changes.</p></div></div>
        <label class="start-control"><span>Project starts</span><input type="date" data-project-start value="${escapeHtml(computed.projectStart)}"><small>Monday–Saturday workweek</small></label>
      </header>
      <div class="kpi-grid">
        ${this.renderKpi("Final delivery", this.formatDate(computed.deliveryDate, true), deliveryNote, computed.overdueCount ? "danger" : "delivery")}
        ${this.renderKpi("Main shoot", this.formatDateRange(computed.shootingStart, computed.shootingEnd, true), "Connected to Budget shooting dates", "shoot")}
        ${this.renderKpi("Critical path", `${computed.criticalCount} tasks`, riskNote, computed.atRiskCount ? "danger" : "critical")}
        ${this.renderKpi("Overall progress", `${computed.progress}%`, `${computed.completedCount} of ${computed.tasks.length} tasks complete`, "progress")}
      </div>
      <article class="panel phase-panel">
        <div class="panel-head"><div><span>Production path</span><h3>One timeline, five connected phases</h3></div><small>${computed.durationWorkdays} production days</small></div>
        <div class="phase-ribbon">${phaseRibbon}</div>
        <div class="phase-card-grid">${phaseCards}</div>
      </article>
      <div class="overview-grid">
        <article class="panel critical-panel">
          <div class="panel-head"><div><span>Zero-slack work</span><h3>Critical path</h3></div><button type="button" class="text-action" data-action="open-timeline">Open timeline</button></div>
          <div class="focus-list">${criticalRows || '<div class="quiet-empty">Add dependencies to reveal the critical path.</div>'}</div>
        </article>
        <article class="panel upcoming-panel">
          <div class="panel-head"><div><span>Next up</span><h3>Upcoming work</h3></div><small>${computed.atRiskCount ? `${computed.atRiskCount} need attention` : "Plan is on track"}</small></div>
          <div class="upcoming-list">${upcomingRows || '<div class="quiet-empty">Everything in this plan is complete.</div>'}</div>
        </article>
      </div>
      <aside class="calendar-note"><span class="note-mark" aria-hidden="true"></span><div><strong>Sundays stay protected.</strong><p>FilmScript schedules production work from Monday through Saturday and automatically carries unfinished durations into the next working day.</p></div></aside>
    </section>`;
  }

  timelineWeeks(computed) {
    const start = parseDate(computed.projectStart);
    const finish = parseDate(computed.projectFinish);
    if (!start || !finish) return { start: computed.projectStart, weeks: [], clipped: false };
    const day = start.getUTCDay();
    const monday = addCalendarDays(start, day === 0 ? -6 : 1 - day);
    const weeks = [];
    let cursor = monday;
    while (cursor <= finish && weeks.length < 156) {
      const weekStart = toDateString(cursor);
      const weekEnd = toDateString(addCalendarDays(cursor, 5));
      weeks.push({ start: weekStart, end: weekEnd });
      cursor = addCalendarDays(cursor, 7);
    }
    return { start: toDateString(monday), weeks, clipped: cursor <= finish };
  }

  renderTimeline(computed) {
    const query = this.search.trim().toLowerCase();
    const visibleTasks = computed.tasks.filter((task) => {
      if (this.phaseFilter !== "all" && task.phaseId !== this.phaseFilter) return false;
      if (this.criticalOnly && !task.critical) return false;
      if (!query) return true;
      const phase = PHASES.find((entry) => entry.id === task.phaseId)?.name || "";
      return [task.name, task.owner, phase].some((value) => String(value || "").toLowerCase().includes(query));
    });
    const timeline = this.timelineWeeks(computed);
    const fitMode = this.timelineZoom <= 0;
    const taskColumnWidth = TIMELINE_TASK_COLUMN_WIDTH;
    const weekWidth = fitMode ? 1 : this.timelineWeekWidth();
    const timelineWidth = Math.max(1, timeline.weeks.length * weekWidth);
    const rawShootOffset = computed.shootingStart
      ? Math.floor(workdayDistance(timeline.start, computed.shootingStart) / TIMELINE_WORKDAYS_PER_WEEK)
      : -1;
    const shootOffset = rawShootOffset >= 0 && rawShootOffset < timeline.weeks.length ? rawShootOffset : -1;
    const today = localDateString();
    const todayOffset = workdayDistance(timeline.start, today) / TIMELINE_WORKDAYS_PER_WEEK * weekWidth;
    const weekHeaders = timeline.weeks.map((week, index) => {
      const relative = shootOffset < 0 ? index + 1 : index - shootOffset;
      const zone = shootOffset < 0 ? "zone-pre" : relative < 0 ? "zone-pre" : relative === 0 ? "zone-zero" : "zone-post";
      const label = fitMode ? `W${index + 1}` : relative === 0 ? "Week 0" : `W${relative > 0 ? "+" : "−"}${Math.abs(relative)}`;
      const weekStart = parseDate(week.start);
      const dayLabels = fitMode ? "" : Array.from({ length: TIMELINE_WORKDAYS_PER_WEEK }, (_, dayIndex) => {
        const day = weekStart ? addCalendarDays(weekStart, dayIndex) : null;
        return `<span>${day ? day.getUTCDate() : ""}</span>`;
      }).join("");
      return `<div class="week-cell ${zone} ${fitMode ? "is-fit" : ""}"><strong>${label}</strong><small>${escapeHtml(this.formatDateRange(week.start, week.end))}</small>${fitMode ? "" : `<div class="week-days" aria-hidden="true">${dayLabels}</div>`}</div>`;
    }).join("");
    const phaseOptions = [`<option value="all">All phases</option>`, ...PHASES.map((phase) =>
      `<option value="${phase.id}" ${this.phaseFilter === phase.id ? "selected" : ""}>${escapeHtml(phase.name)}</option>`)].join("");
    const rows = PHASES.map((phase) => {
      const tasks = visibleTasks.filter((task) => task.phaseId === phase.id);
      const phaseGroups = (this.calendar?.groups || []).filter((group) => group.phaseId === phase.id);
      if (!tasks.length && !phaseGroups.length) return "";
      const phaseBand = `<div class="phase-band" data-timeline-grid style="grid-template-columns:${taskColumnWidth}px ${timelineWidth}px"><div><i></i><strong>${escapeHtml(phase.name)}</strong><span>${tasks.length}</span></div><span></span></div>`;
      const shownGroups = new Set();
      const taskRows = tasks.map((task) => {
        const startDays = Math.max(0, workdayDistance(timeline.start, task.startDate));
        const startOffset = startDays / TIMELINE_WORKDAYS_PER_WEEK * weekWidth;
        const spanDays = task.milestone ? 0 : workdayDistance(task.startDate, task.endDate) + 1;
        const width = task.milestone ? 15 : Math.max(18, spanDays / TIMELINE_WORKDAYS_PER_WEEK * weekWidth - 7);
        const left = Math.min(Math.max(3, startOffset + 3), Math.max(3, timelineWidth - 16));
        const barWidth = Math.min(width, Math.max(18, timelineWidth - left - 3));
        const conflictLabel = task.dependencyConflict ? " Dependency overlap; linked tasks were not moved." : "";
        const timingLabel = `${task.name}, ${this.formatDateRange(task.startDate, task.endDate)}. Drag to move${task.milestone ? "." : " or use either edge to resize."}${conflictLabel}`;
        const bar = task.milestone
          ? `<button type="button" class="task-bar milestone-bar ${task.critical ? "is-critical" : ""} ${task.status === "done" ? "is-complete" : ""} ${task.dependencyConflict ? "is-conflict" : ""}" data-action="edit-task" data-task="${task.id}" data-timeline-bar="${task.id}" data-milestone="true" data-snap="day" data-snap-unit="workday" data-start-days="${startDays}" data-span-days="0" style="left:${left}px;width:${Math.max(22, Math.min(44, weekWidth * 0.46))}px" aria-label="${escapeHtml(timingLabel)}" title="${task.dependencyConflict ? "Dependency overlap" : ""}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"><b>Lock</b></button>`
          : `<button type="button" class="task-bar ${task.critical ? "is-critical" : ""} ${task.status === "done" ? "is-complete" : ""} ${task.atRisk ? "is-risk" : ""} ${task.dependencyConflict ? "is-conflict" : ""}" data-action="edit-task" data-task="${task.id}" data-timeline-bar="${task.id}" data-milestone="false" data-snap="day" data-snap-unit="workday" data-start-days="${startDays}" data-span-days="${spanDays}" style="left:${left}px;width:${barWidth}px" aria-label="${escapeHtml(timingLabel)}" title="${task.dependencyConflict ? "Dependency overlap" : ""}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight">
              <span class="task-progress" style="width:${task.progress}%"></span>
              <span class="resize-handle is-start" data-resize-edge="start" aria-hidden="true"></span>
              <b>${task.progress > 0 ? `${task.progress}%` : ""}</b>
              <span class="resize-handle is-end" data-resize-edge="end" aria-hidden="true"></span>
            </button>`;
        const zoneStyle = shootOffset >= 0
          ? `--zero-start:${shootOffset * weekWidth}px;--zero-end:${(shootOffset + 1) * weekWidth}px;`
          : "";
        const rowMenu = this.openRowMenuId === task.id
          ? `<div class="timeline-row-menu" role="menu" aria-label="${escapeHtml(task.name)} actions">
              <button type="button" data-action="edit-task" data-task="${task.id}" role="menuitem">Edit task</button>
              <button type="button" data-action="row-complete" data-task="${task.id}" role="menuitem">${task.status === "done" ? "Mark active" : "Mark complete"}</button>
              <button type="button" data-action="row-delete" data-task="${task.id}" role="menuitem" class="is-danger">Delete</button>
            </div>`
          : "";
        const group = phaseGroups.find((entry) => entry.id === task.groupId);
        const groupBand = group && !shownGroups.has(group.id)
          ? `<div class="timeline-group-band" data-timeline-grid style="grid-template-columns:${taskColumnWidth}px ${timelineWidth}px"><div><i></i><strong>${escapeHtml(group.name)}</strong><span>${tasks.filter((entry) => entry.groupId === group.id).length}</span></div><span></span></div>`
          : "";
        if (group) shownGroups.add(group.id);
        return `${groupBand}<div class="timeline-row" data-timeline-grid data-phase="${escapeHtml(phase.id)}" data-group="${escapeHtml(task.groupId || "")}" style="grid-template-columns:${taskColumnWidth}px ${timelineWidth}px">
          <div class="timeline-task">
            <button type="button" class="timeline-task-main" data-action="edit-task" data-task="${task.id}">
            <span class="task-state ${statusClass(task.status)}"></span>
            <span class="task-copy"><strong>${escapeHtml(task.name)}</strong><small data-timeline-date="${task.id}">${escapeHtml(this.formatDateRange(task.startDate, task.endDate))}</small></span>
            </button>
            <div class="timeline-row-tools" role="toolbar" aria-label="Task row actions">
              <button type="button" class="row-tool-icon" data-action="row-menu" data-task="${task.id}" aria-label="More actions for ${escapeHtml(task.name)}" aria-haspopup="menu" aria-expanded="${this.openRowMenuId === task.id}">⋯</button>
              <button type="button" class="row-tool" data-action="add-row" data-phase="${phase.id}" data-group="${escapeHtml(task.groupId || "")}">+ Add Row</button>
              <button type="button" class="row-tool" data-action="add-group" data-phase="${phase.id}">+ Add Group</button>
            </div>
            ${rowMenu}
          </div>
          <div class="timeline-track ${shootOffset >= 0 ? "has-week-zero" : ""}" style="width:${timelineWidth}px;--week:${weekWidth}px;--day:${weekWidth / TIMELINE_WORKDAYS_PER_WEEK}px;${zoneStyle}">${todayOffset >= 0 && todayOffset <= timelineWidth ? `<span class="today-line" data-today-days="${workdayDistance(timeline.start, today)}" style="left:${todayOffset}px"></span>` : ""}${bar}</div>
        </div>`;
      }).join("");
      const emptyGroupRows = phaseGroups.filter((group) => !shownGroups.has(group.id)).map((group) =>
        `<div class="timeline-group-band" data-timeline-grid style="grid-template-columns:${taskColumnWidth}px ${timelineWidth}px"><div><i></i><strong>${escapeHtml(group.name)}</strong><span>0</span></div><span></span></div>`).join("");
      return phaseBand + taskRows + emptyGroupRows;
    }).join("");

    return `<section class="view timeline-view">
      <header class="section-head"><div><span class="eyebrow">Route to delivery</span><h2>Production timeline</h2><p>Move or resize one task at a time. Linked overlaps are flagged without shifting the rest.</p></div><button type="button" class="primary" data-action="add-task">Add task</button></header>
      <div class="timeline-tools">
        <label><span>Search</span><input data-calendar-search value="${escapeHtml(this.search)}" placeholder="Search tasks"></label>
        <label><span>Phase</span><select data-phase-filter>${phaseOptions}</select></label>
        <button type="button" class="critical-filter ${this.criticalOnly ? "is-active" : ""}" data-action="toggle-critical" aria-pressed="${this.criticalOnly}"><i></i><span>Critical only</span></button>
        <div class="zoom-control" aria-label="Timeline zoom">
          <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
          <input type="range" min="0" max="${TIMELINE_MAX_ZOOM}" step="0.01" value="${this.timelineZoom}" data-timeline-zoom aria-label="Timeline zoom">
          <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
          <button type="button" class="zoom-value" data-action="zoom-reset" title="Reset zoom"><output data-zoom-output>${Math.round(this.timelineZoom * 100)}%</output></button>
          <button type="button" class="zoom-fit" data-action="zoom-fit">Fit</button>
        </div>
      </div>
      <article class="timeline-card">
        <input type="range" min="0" max="1" step="1" value="0" data-timeline-pan aria-hidden="true" tabindex="-1" hidden>
        <div class="timeline-scroll" data-week-width="${weekWidth}" data-week-count="${timeline.weeks.length}" data-zero-offset="${shootOffset}" data-task-column-width="${taskColumnWidth}" style="--week:${weekWidth}px;--day:${weekWidth / TIMELINE_WORKDAYS_PER_WEEK}px;--timeline:${timelineWidth}px;--task-column:${taskColumnWidth}px">
          <div class="timeline-shell" style="min-width:${taskColumnWidth + timelineWidth}px">
            <div class="timeline-head" data-timeline-grid style="grid-template-columns:${taskColumnWidth}px ${timelineWidth}px"><div class="task-head">Task</div><div class="weeks" style="grid-template-columns:repeat(${timeline.weeks.length},${weekWidth}px)">${weekHeaders}</div></div>
            ${rows || '<div class="timeline-empty"><strong>No tasks match this view.</strong><span>Clear the filters or add a new task.</span></div>'}
          </div>
        </div>
        ${timeline.clipped ? '<div class="timeline-clipped">This plan extends beyond the three-year timeline preview.</div>' : ""}
      </article>
      <div class="timeline-live" aria-live="polite">${escapeHtml(this.timelineAnnouncement)}</div>
    </section>`;
  }

  renderTaskModal(computed) {
    if (!this.draft) return "";
    const phaseOptions = PHASES.map((phase) =>
      `<option value="${phase.id}" ${this.draft.phaseId === phase.id ? "selected" : ""}>${escapeHtml(phase.name)}</option>`).join("");
    const phaseGroups = (this.calendar?.groups || []).filter((group) => group.phaseId === this.draft.phaseId);
    const groupOptions = `<option value="">No group</option>${phaseGroups.map((group) =>
      `<option value="${group.id}" ${this.draft.groupId === group.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}`;
    const statusOptions = [
      ["not_started", "Not started"],
      ["in_progress", "In progress"],
      ["blocked", "Blocked"],
      ["done", "Done"],
    ].map(([value, label]) => `<option value="${value}" ${this.draft.status === value ? "selected" : ""}>${label}</option>`).join("");
    const taskMap = new Map((this.calendar?.tasks || []).map((task) => [task.id, task]));
    const dependencyChips = (this.draft.dependencies || []).map((dependencyId) => {
      const task = taskMap.get(dependencyId);
      return task ? `<span class="dependency-chip"><span>${escapeHtml(task.name)}</span><button type="button" data-action="remove-dependency" data-dependency="${dependencyId}" aria-label="Remove dependency ${escapeHtml(task.name)}">×</button></span>` : "";
    }).join("");
    const candidates = this.dependencyCandidates();
    const dependencyOptions = `<option value="">Choose a task</option>${candidates.map((task) => `<option value="${task.id}">${escapeHtml(task.name)}</option>`).join("")}`;
    const previewCalendar = normalizeCalendar({
      ...this.calendar,
      tasks: this.draftIsNew
        ? [...this.calendar.tasks, this.draft]
        : this.calendar.tasks.map((task) => task.id === this.draft.id ? this.draft : task),
    }, this.projectTitle);
    const preview = computeCalendar(previewCalendar, this.projectTitle).taskMap.get(this.draft.id);
    const lockedDelivery = this.draft.kind === "delivery";
    return `<div class="modal-backdrop ${this._animateModal ? "is-entering" : ""}" role="presentation">
      <div class="task-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-task-title">
        <header class="modal-head"><div><span>${this.draftIsNew ? "New production task" : "Edit production task"}</span><h3 id="calendar-task-title">${escapeHtml(this.draft.name || "Untitled task")}</h3><p>${preview ? `${escapeHtml(this.formatDateRange(preview.startDate, preview.endDate, true))}${preview.critical ? " · Critical path" : ` · ${preview.slackDays} days of slack`}` : "Dates update after the task is saved."}</p></div><button type="button" class="icon" data-action="close-modal" aria-label="Close task editor">×</button></header>
        <div class="modal-body">
          <div class="form-grid">
            <label class="field-wide"><span>Task name</span><input data-draft="name" value="${escapeHtml(this.draft.name)}" maxlength="140" placeholder="What needs to happen?"></label>
            <label><span>Phase</span><select data-draft="phaseId">${phaseOptions}</select></label>
            <label><span>Group</span><select data-draft="groupId">${groupOptions}</select></label>
            <label><span>Owner</span><input data-draft="owner" value="${escapeHtml(this.draft.owner)}" maxlength="100" placeholder="Department or person"></label>
            <label><span>Status</span><select data-draft="status">${statusOptions}</select></label>
            <label><span>Start no earlier than</span><input type="date" data-draft="constraintDate" value="${escapeHtml(this.draft.constraintDate)}"><small>Optional. Dependencies still apply.</small></label>
            <label class="milestone-field"><span>Task type</span><span class="switch-row"><input type="checkbox" data-draft="milestone" ${this.draft.milestone || lockedDelivery ? "checked" : ""} ${lockedDelivery ? "disabled" : ""}><span class="switch"><i></i></span><strong>${lockedDelivery ? "Delivery milestone" : "Milestone"}</strong></span></label>
            <label><span>Duration</span><span class="duration-input"><input type="number" min="1" max="312" step="1" data-draft="durationDays" value="${this.draft.milestone || lockedDelivery ? 0 : escapeHtml(this.draft.durationDays)}" ${this.draft.milestone || lockedDelivery ? "disabled" : ""}><b>days</b></span></label>
            <label class="progress-field field-wide"><span>Progress <output data-progress-output>${Math.round(finite(this.draft.progress))}%</output></span><input type="range" min="0" max="100" step="5" data-draft="progress" value="${Math.round(finite(this.draft.progress))}"></label>
            <label class="field-wide"><span>Notes</span><textarea data-draft="notes" maxlength="800" placeholder="Decision, deliverable or production context">${escapeHtml(this.draft.notes)}</textarea></label>
          </div>
          <section class="dependency-panel">
            <div class="dependency-head"><div><span>Dependencies</span><strong>What must finish first?</strong></div><small>FilmScript prevents circular links.</small></div>
            <div class="dependency-chips">${dependencyChips || '<span class="dependency-empty">No dependencies yet.</span>'}</div>
            <div class="dependency-add"><select data-dependency-choice>${dependencyOptions}</select><button type="button" class="secondary" data-action="add-dependency" ${candidates.length ? "" : "disabled"}>Add dependency</button></div>
          </section>
        </div>
        <footer class="modal-foot">
          <div>${this.draftIsNew ? "" : `<button type="button" class="danger-text" data-action="delete-task" data-task="${this.draft.id}">Delete task</button>`}</div>
          <div><button type="button" class="secondary" data-action="close-modal">Cancel</button><button type="button" class="primary" data-action="save-task">${this.draftIsNew ? "Add task" : "Save changes"}</button></div>
        </footer>
      </div>
    </div>`;
  }

  styles() {
    return `<style>
      :host{--fs-font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;--fs-font-display:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
      :host(.filmscript-theme-transition),:host(.filmscript-theme-transition) *{transition-property:color,background-color,border-color,box-shadow,opacity,fill,stroke,outline-color!important;transition-duration:240ms!important;transition-timing-function:cubic-bezier(.22,.7,.25,1)!important}:host(.filmscript-theme-fading){opacity:.72}@media(prefers-reduced-motion:reduce){:host(.filmscript-theme-transition),:host(.filmscript-theme-transition) *{transition-duration:.01ms!important}:host(.filmscript-theme-fading){opacity:1!important}}
      :host,:host *{font-family:var(--fs-font-text)!important}
      :host h1,:host h2,:host h3,:host h4,:host h5,:host h6{font-family:var(--fs-font-display)!important}:host h1,:host h2{font-weight:900!important}:host h3{font-weight:800!important}
      :host{display:block;min-width:0;width:100%;--cal-critical:#C74440;--cal-positive:#2E7D5B;--cal-blue:#4A6B8A;color:var(--ink,#2C2C2A);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
      *{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}.fs-calendar{padding:24px 0 72px}.calendar-nav{position:sticky;top:-38px;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:26px;padding:10px 0;border-bottom:1px solid var(--hair,#E7E4DA);background:color-mix(in srgb,var(--bg,#F5F0E8) 96%,transparent);backdrop-filter:blur(10px)}.tabs{display:flex;gap:4px}.tabs button{min-height:38px;padding:0 13px;border:1px solid transparent;border-radius:10px 8px 11px 7px;background:transparent;color:var(--muted,#888780);white-space:nowrap;transition:transform .14s ease,color .14s ease,background .14s ease,border-color .14s ease}.tabs button:hover{transform:translateY(-1px);color:var(--ink,#2C2C2A);background:color-mix(in srgb,var(--surface,#FFFEF9) 72%,transparent)}.tabs button[aria-pressed="true"]{border-color:color-mix(in srgb,var(--ink,#2C2C2A) 25%,transparent);background:var(--surface,#FFFEF9);color:var(--ink,#2C2C2A);box-shadow:1px 2px 0 var(--hair,#E7E4DA)}.calendar-actions{display:flex;align-items:center;gap:10px}.calendar-actions>span{font-size:10.5px;color:var(--muted,#888780)}.primary,.secondary,.icon,.text-action,.complete,.critical-filter{border-radius:12px 10px 13px 9px / 10px 13px 9px 12px;transition:transform .16s cubic-bezier(.2,.8,.2,1),background-color .16s ease,border-color .16s ease}.primary{min-height:40px;padding:0 16px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 58%,transparent);background:var(--accent,#FFB703);color:#181816;font-weight:780;box-shadow:inset 0 0 0 3px color-mix(in srgb,#fff 25%,transparent),1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 20%,transparent)}.secondary{min-height:38px;padding:0 14px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 28%,transparent);background:var(--surface,#FFFEF9);font-weight:700}.icon{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--hair,#E7E4DA);background:transparent;color:var(--muted,#888780);font-size:20px}.primary:hover,.secondary:hover,.icon:hover{transform:translateY(-1px)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent,#FFB703);outline-offset:2px}.view{animation:none}.view.is-entering{animation:calendarViewIn .2s cubic-bezier(.2,.8,.2,1) both}@keyframes calendarViewIn{from{opacity:0;transform:translateY(7px) scale(.997)}to{opacity:1;transform:none}}.calendar-hero,.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px}.hero-lockup{display:flex;align-items:flex-start;gap:15px}.calendar-glyph{position:relative;display:grid;place-items:center;width:46px;height:46px;flex:0 0 46px;color:var(--accent,#FFB703)}.calendar-glyph svg{width:38px;height:38px;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.calendar-glyph:after{content:"";position:absolute;left:6px;right:3px;bottom:0;border-bottom:1.5px solid currentColor;border-radius:50%;transform:rotate(-1deg);opacity:.62}.eyebrow,.panel-head>div>span,.dependency-head>div>span,.modal-head>div>span{display:block;color:var(--accent,#FFB703);font-size:9.5px;font-weight:800;letter-spacing:1.45px;text-transform:uppercase}h2{margin:6px 0 0;font-size:29px;line-height:1.08;letter-spacing:-.8px}h3{margin:5px 0 0;font-size:17px;letter-spacing:-.25px}.calendar-hero p,.section-head p,.modal-head p{max-width:680px;margin:7px 0 0;color:var(--muted,#888780);font-size:12px;line-height:1.5}.start-control{display:grid;min-width:210px;gap:6px}.start-control>span,.timeline-tools label>span,.form-grid label>span{color:var(--muted,#888780);font-size:9.5px;font-weight:750}.start-control small,.form-grid label>small{color:var(--muted,#888780);font-size:9px}.start-control input,input,select,textarea{min-height:38px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 27%,transparent);border-radius:10px 8px 11px 7px;background:var(--surface,#FFFEF9);padding:0 10px;outline:none;box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--ink,#2C2C2A) 10%,transparent)}textarea{min-height:88px;padding:10px;resize:vertical}.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpi,.panel,.timeline-card,.task-modal,.loading,.empty{position:relative;isolation:isolate;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 29%,transparent);border-radius:20px 17px 22px 16px / 18px 21px 17px 20px;background:var(--surface,#FFFEF9);box-shadow:1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 14%,transparent)}.kpi:after,.panel:after,.timeline-card:after,.task-modal:after,.loading:after,.empty:after{content:"";position:absolute;z-index:5;pointer-events:none;inset:3px 4px 3px 3px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 25%,transparent);border-radius:17px 15px 18px 14px / 15px 18px 14px 17px;opacity:.35;transform:rotate(.06deg)}.kpi{min-height:124px;padding:18px 18px 16px;overflow:hidden}.kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent,#FFB703)}.kpi.shoot:before{background:#5B7A4A}.kpi.critical:before,.kpi.danger:before{background:var(--cal-critical)}.kpi.progress:before{background:var(--cal-blue)}.kpi span{display:block;color:var(--muted,#888780);font-size:10px;font-weight:750}.kpi strong{display:block;margin-top:16px;font-size:20px;line-height:1.12;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.kpi small{display:block;margin-top:8px;color:var(--muted,#888780);font-size:10.5px;line-height:1.35}.panel{padding:20px}.phase-panel{margin-top:14px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.panel-head>small{color:var(--muted,#888780);font-size:10px}.phase-ribbon{display:flex;align-items:stretch;gap:4px;margin-top:21px;min-height:52px}.phase-ribbon>div{position:relative;min-width:92px;padding:9px 10px;border-top:3px solid var(--phase);border-radius:9px 8px 10px 7px;background:color-mix(in srgb,var(--phase) 11%,var(--surface,#FFFEF9))}.phase-ribbon span,.phase-ribbon small{display:block}.phase-ribbon span{font-size:10.5px;font-weight:800}.phase-ribbon small{margin-top:5px;color:var(--muted,#888780);font-size:9px}.phase-card-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:12px}.phase-card{padding:13px;border:1px solid var(--hair,#E7E4DA);border-radius:13px 11px 15px 10px;background:var(--bg,#F5F0E8)}.phase-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.phase-card-head span,.phase-card-head strong{font-size:10.5px}.phase-progress{height:5px;margin:10px 0 8px;border-radius:99px;background:var(--hair,#E7E4DA);overflow:hidden}.phase-progress i{display:block;height:100%;border-radius:99px;background:var(--phase)}.phase-card small{display:block;color:var(--muted,#888780);font-size:9px;line-height:1.35}.overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.text-action{min-height:32px;padding:0 10px;border:0;background:transparent;color:var(--accent,#FFB703);font-size:10.5px;font-weight:800}.focus-list,.upcoming-list{display:grid;margin-top:16px}.focus-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:11px 2px;border:0;border-bottom:1px solid var(--hair,#E7E4DA);background:transparent;text-align:left}.focus-row:last-child,.upcoming-row:last-child{border-bottom:0}.focus-row:hover,.upcoming-row:hover{background:color-mix(in srgb,var(--soft,#EFEBE1) 68%,transparent)}.focus-index{color:var(--cal-critical);font-size:9px;font-weight:850}.focus-copy strong,.focus-copy small,.upcoming-main strong,.upcoming-main small{display:block}.focus-copy strong,.upcoming-main strong{font-size:11.5px}.focus-copy small,.upcoming-main small{margin-top:4px;color:var(--muted,#888780);font-size:9.5px}.risk-badge,.status{display:inline-flex;align-items:center;min-height:23px;padding:0 8px;border-radius:99px;border:1px solid color-mix(in srgb,var(--cal-critical) 40%,var(--hair,#E7E4DA));background:color-mix(in srgb,var(--cal-critical) 7%,var(--surface,#FFFEF9));color:var(--cal-critical);font-size:8.5px;font-weight:850}.risk-badge.is-risk{background:color-mix(in srgb,var(--cal-critical) 15%,var(--surface,#FFFEF9))}.upcoming-row{display:grid;grid-template-columns:68px minmax(0,1fr) auto 28px;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--hair,#E7E4DA)}.upcoming-date strong,.upcoming-date small{display:block;font-size:9.5px}.upcoming-date small{margin-top:3px;color:var(--muted,#888780)}.upcoming-main{padding:0;border:0;background:transparent;text-align:left}.status{border-color:var(--hair,#E7E4DA);background:var(--soft,#EFEBE1);color:var(--muted,#888780)}.status.is-progress{color:var(--cal-blue)}.status.is-blocked{color:var(--cal-critical)}.status.is-done{color:var(--cal-positive)}.complete{display:grid;place-items:center;width:27px;height:27px;padding:0;border:1px solid var(--hair,#E7E4DA);background:transparent;color:var(--cal-positive);font-weight:850}.calendar-note{display:flex;align-items:flex-start;gap:14px;margin-top:14px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 45%,var(--hair,#E7E4DA));border-radius:14px 12px 15px 11px;background:color-mix(in srgb,var(--accent,#FFB703) 8%,var(--surface,#FFFEF9))}.note-mark{position:relative;width:30px;height:30px;flex:0 0 30px;border:1.5px solid var(--accent,#FFB703);border-radius:50%}.note-mark:before{content:"";position:absolute;left:14px;top:3px;bottom:3px;border-left:1.5px solid var(--accent,#FFB703);transform:rotate(18deg)}.calendar-note strong{font-size:11.5px}.calendar-note p{margin:5px 0 0;color:var(--muted,#888780);font-size:10.5px;line-height:1.5}.quiet-empty{padding:28px 12px;text-align:center;color:var(--muted,#888780);font-size:11px}.timeline-tools{display:grid;grid-template-columns:minmax(240px,1fr) 180px auto auto;align-items:end;gap:12px;margin-bottom:14px}.timeline-tools label{display:grid;gap:6px}.critical-filter{display:flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 12px;border:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9);font-size:10.5px;font-weight:750}.critical-filter i{width:8px;height:8px;border-radius:50%;background:var(--muted,#888780)}.critical-filter.is-active{border-color:var(--cal-critical);color:var(--cal-critical)}.critical-filter.is-active i{background:var(--cal-critical)}.timeline-legend{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-height:38px;color:var(--muted,#888780);font-size:9px;white-space:nowrap}.timeline-legend span{display:flex;align-items:center;gap:5px}.timeline-legend i{width:15px;height:7px;border-radius:3px}.legend-critical{background:var(--cal-critical)}.legend-flex{background:#6E9DC6}.legend-done{background:repeating-linear-gradient(135deg,var(--cal-positive) 0 3px,transparent 3px 5px);border:1px solid var(--cal-positive)}.timeline-card{overflow:hidden}.timeline-scroll{overflow:auto;max-height:calc(100vh - 260px);min-height:420px}.timeline-shell{position:relative}.timeline-head,.timeline-row,.phase-band{display:grid}.timeline-head{position:sticky;top:0;z-index:12;min-height:58px;border-bottom:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9)}.task-head{position:sticky;left:0;z-index:14;display:flex;align-items:center;padding:0 16px;border-right:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9);color:var(--muted,#888780);font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase}.weeks{display:grid}.week-cell{display:grid;align-content:center;justify-items:center;border-right:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9);text-align:center}.week-cell.is-shoot{background:color-mix(in srgb,#5B7A4A 11%,var(--surface,#FFFEF9))}.week-cell strong{font-size:9px}.week-cell small{margin-top:4px;color:var(--muted,#888780);font-size:8px}.phase-band{min-height:34px;border-bottom:1px solid var(--hair,#E7E4DA);background:var(--soft,#EFEBE1)}.phase-band>div{position:sticky;left:0;z-index:9;display:flex;align-items:center;gap:8px;padding:0 14px;border-right:1px solid var(--hair,#E7E4DA);background:var(--soft,#EFEBE1)}.phase-band i{width:8px;height:8px;border-radius:3px}.phase-band strong{font-size:10px}.phase-band span{color:var(--muted,#888780);font-size:8.5px}.timeline-row{min-height:58px;border-bottom:1px solid var(--hair,#E7E4DA)}.timeline-task{position:sticky;left:0;z-index:8;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 12px;border:0;border-right:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9);text-align:left}.timeline-task:hover{background:var(--soft,#EFEBE1)}.task-state{width:7px;height:7px;border-radius:50%;background:var(--muted,#888780)}.task-state.is-progress{background:var(--cal-blue)}.task-state.is-blocked{background:var(--cal-critical)}.task-state.is-done{background:var(--cal-positive)}.task-copy strong,.task-copy small{display:block}.task-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}.task-copy small{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted,#888780);font-size:8.5px}.task-meta{color:var(--muted,#888780);font-size:8px;font-weight:750}.timeline-track{position:relative;min-height:58px;background:repeating-linear-gradient(to right,transparent 0,transparent calc(var(--week) - 1px),var(--hair,#E7E4DA) calc(var(--week) - 1px),var(--hair,#E7E4DA) var(--week))}.today-line{position:absolute;z-index:3;top:0;bottom:0;border-left:1px dashed var(--accent,#FFB703);opacity:.75}.task-bar{position:absolute;z-index:4;top:16px;height:27px;min-width:18px;overflow:hidden;border:1px solid color-mix(in srgb,var(--phase) 72%,var(--ink,#2C2C2A));border-radius:8px 10px 7px 9px;background:color-mix(in srgb,var(--phase) 76%,var(--surface,#FFFEF9));box-shadow:1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 15%,transparent);text-align:left}.task-bar>span{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--ink,#2C2C2A) 20%,transparent)}.task-bar>b{position:relative;z-index:1;display:block;padding:0 8px;overflow:hidden;color:#fff;font-size:8px;line-height:25px;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 1px rgba(0,0,0,.2)}.task-bar.is-critical{border-color:#8F2F2B;background:var(--task-cream)}.task-bar.is-risk{box-shadow:0 0 0 2px color-mix(in srgb,var(--cal-critical) 24%,transparent),1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 15%,transparent)}.task-bar.is-complete{background:var(--task-cream);border-color:#A96A23}.milestone{position:absolute;z-index:4;top:21px;width:15px;height:15px;padding:0;border:0;background:transparent;transform:rotate(45deg)}.milestone>span{display:block;width:100%;height:100%;border:1px solid color-mix(in srgb,var(--phase) 72%,var(--ink,#2C2C2A));border-radius:3px;background:var(--phase);box-shadow:1px 1px 0 color-mix(in srgb,var(--ink,#2C2C2A) 20%,transparent)}.milestone.is-critical>span{border-color:#8F2F2B;background:var(--task-cream-strong)}.milestone.is-complete>span{background:var(--task-cream);border-color:#A96A23}.timeline-empty{display:grid;justify-items:center;gap:6px;padding:70px 20px;color:var(--muted,#888780)}.timeline-empty strong{color:var(--ink,#2C2C2A);font-size:13px}.timeline-empty span{font-size:10.5px}.timeline-clipped{padding:10px 14px;border-top:1px solid var(--hair,#E7E4DA);color:var(--muted,#888780);font-size:9.5px}.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(20,20,19,.56)}.task-modal{width:min(760px,100%);max-height:min(820px,92vh);overflow:auto}.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:21px 22px;border-bottom:1px solid var(--hair,#E7E4DA)}.modal-head h3{font-size:20px}.modal-body{padding:20px 22px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.form-grid label{display:grid;align-content:start;gap:6px}.field-wide{grid-column:1 / -1}.duration-input{display:grid;grid-template-columns:1fr 48px}.duration-input input{border-radius:10px 0 0 8px}.duration-input b{display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 27%,transparent);border-left:0;border-radius:0 8px 10px 0;background:var(--soft,#EFEBE1);font-size:9px}.progress-field>span{display:flex;justify-content:space-between}.progress-field output{color:var(--accent,#FFB703);font-weight:850}.progress-field input{min-height:24px;padding:0;border:0;background:transparent;box-shadow:none}.switch-row{display:flex;align-items:center;gap:9px;min-height:38px}.switch-row>input{position:absolute;opacity:0;pointer-events:none}.switch{position:relative;width:36px;height:21px;border-radius:99px;background:var(--hair,#E7E4DA);transition:background .16s ease}.switch i{position:absolute;left:3px;top:3px;width:15px;height:15px;border-radius:50%;background:var(--surface,#FFFEF9);box-shadow:0 1px 3px rgba(0,0,0,.22);transition:transform .16s ease}.switch-row>input:checked+.switch{background:var(--accent,#FFB703)}.switch-row>input:checked+.switch i{transform:translateX(15px)}.switch-row strong{font-size:10.5px}.dependency-panel{margin-top:18px;padding:16px;border:1px solid var(--hair,#E7E4DA);border-radius:15px 12px 16px 11px;background:var(--soft,#EFEBE1)}.dependency-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.dependency-head strong{display:block;margin-top:4px;font-size:12px}.dependency-head>small{color:var(--muted,#888780);font-size:9px}.dependency-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.dependency-chip{display:inline-flex;align-items:center;gap:5px;min-height:29px;padding:0 5px 0 10px;border:1px solid var(--hair,#E7E4DA);border-radius:99px;background:var(--surface,#FFFEF9);font-size:9.5px}.dependency-chip button{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted,#888780)}.dependency-empty{color:var(--muted,#888780);font-size:9.5px}.dependency-add{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.modal-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 22px;border-top:1px solid var(--hair,#E7E4DA)}.modal-foot>div{display:flex;gap:8px}.danger-text{min-height:36px;padding:0;border:0;background:transparent;color:var(--cal-critical);font-size:10.5px;font-weight:800}.modal-backdrop.is-entering{animation:calendarBackdropIn .14s ease-out both}.modal-backdrop.is-entering .task-modal{animation:calendarModalIn .18s cubic-bezier(.2,.8,.2,1) both}@keyframes calendarBackdropIn{from{opacity:0}to{opacity:1}}@keyframes calendarModalIn{from{opacity:0;transform:translateY(8px) scale(.986)}to{opacity:1;transform:none}}.notice{margin-bottom:14px;padding:11px 13px;border:1px solid color-mix(in srgb,var(--cal-critical) 38%,var(--hair,#E7E4DA));border-radius:12px 10px 13px 9px;background:color-mix(in srgb,var(--cal-critical) 8%,var(--surface,#FFFEF9));color:var(--cal-critical);font-size:10.5px}.loading,.empty{display:grid;justify-items:center;max-width:560px;margin:48px auto;padding:42px;text-align:center}.loading>span{width:27px;height:27px;border:2px solid var(--hair,#E7E4DA);border-top-color:var(--accent,#FFB703);border-radius:50%;animation:calendarSpin .72s linear infinite}@keyframes calendarSpin{to{transform:rotate(360deg)}}.loading strong,.empty strong{margin-top:14px;font-size:16px}.loading small,.empty p{margin:7px 0 0;color:var(--muted,#888780);font-size:11px}.empty .primary{margin-top:17px}
      @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.phase-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.timeline-tools{grid-template-columns:minmax(220px,1fr) 160px auto}.timeline-legend{grid-column:1 / -1;justify-content:flex-start}.overview-grid{grid-template-columns:1fr}}
      @media(max-width:700px){.fs-calendar{padding-top:10px}.calendar-nav{align-items:flex-start;flex-direction:column;top:-24px}.calendar-actions{width:100%;justify-content:space-between}.calendar-hero,.section-head{align-items:flex-start;flex-direction:column}.start-control{width:100%}.kpi-grid,.phase-card-grid{grid-template-columns:1fr}.phase-ribbon{overflow:auto}.phase-ribbon>div{flex:0 0 150px}.timeline-tools{grid-template-columns:1fr}.timeline-legend{overflow:auto}.form-grid{grid-template-columns:1fr}.field-wide{grid-column:auto}.modal-backdrop{padding:10px}.modal-foot{align-items:stretch;flex-direction:column}.modal-foot>div{justify-content:flex-end}.dependency-add{grid-template-columns:1fr}.upcoming-row{grid-template-columns:62px minmax(0,1fr) 28px}.upcoming-row .status{display:none}}
      @media(prefers-reduced-motion:reduce){.view.is-entering,.modal-backdrop.is-entering,.modal-backdrop.is-entering .task-modal,.loading>span{animation:none!important}.tabs button,.primary,.secondary,.icon,.critical-filter,.switch,.switch i,.task-bar,.resize-handle,.zoom-control button{transition-duration:.01ms!important}}
      :host{--zone-pre:color-mix(in srgb,#BA7517 6%,var(--surface,#FFFEF9));--zone-zero:color-mix(in srgb,#5B7A4A 16%,var(--surface,#FFFEF9));--zone-post:color-mix(in srgb,#4A6B8A 8%,var(--surface,#FFFEF9));--task-cream:color-mix(in srgb,var(--accent,#FFB703) 38%,var(--surface,#FFFEF9));--task-cream-strong:color-mix(in srgb,var(--accent,#FFB703) 57%,var(--surface,#FFFEF9))}
      .timeline-view .section-head{margin-bottom:18px}.timeline-tools{grid-template-columns:minmax(220px,1fr) 156px auto minmax(280px,auto);align-items:end;gap:10px;margin-bottom:12px}.timeline-tools input,.timeline-tools select{min-height:36px}.critical-filter{min-height:36px;padding:0 11px;border-color:color-mix(in srgb,var(--ink,#2C2C2A) 16%,var(--hair,#E7E4DA));box-shadow:none}.critical-filter i{width:6px;height:6px}.zoom-control{display:grid;grid-template-columns:34px minmax(90px,1fr) 34px 49px 42px;align-items:center;gap:5px;min-height:36px;padding:3px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 18%,var(--hair,#E7E4DA));border-radius:12px 10px 13px 9px;background:color-mix(in srgb,var(--surface,#FFFEF9) 88%,transparent)}.zoom-control button{display:grid;place-items:center;min-width:0;height:28px;padding:0;border:0;border-radius:8px 7px 9px 6px;background:transparent;color:var(--muted,#888780);font-size:14px;font-weight:760}.zoom-control button:hover{background:var(--soft,#EFEBE1);color:var(--ink,#2C2C2A)}.zoom-control .zoom-value{font-size:8.5px;font-variant-numeric:tabular-nums}.zoom-control .zoom-fit{border-left:1px solid var(--hair,#E7E4DA);border-radius:0 7px 9px 0;font-size:8.5px}.zoom-control input[type="range"]{width:100%;min-height:24px;padding:0;border:0;background:transparent;box-shadow:none;accent-color:var(--accent,#FFB703)}
      .timeline-pan{display:grid;grid-template-columns:12px minmax(0,1fr) 12px;align-items:center;gap:6px;margin:-2px 5px 8px;color:color-mix(in srgb,var(--muted,#888780) 72%,transparent);font-size:12px}.timeline-pan input{width:100%;min-height:16px;padding:0;border:0;background:transparent;box-shadow:none;accent-color:var(--accent,#FFB703);cursor:ew-resize}.timeline-pan input:disabled{opacity:.34;cursor:default}.timeline-pan span:last-child{text-align:right}.timeline-pan:focus-within{color:var(--accent,#FFB703)}
      .timeline-card{border-color:color-mix(in srgb,var(--ink,#2C2C2A) 22%,transparent);box-shadow:1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 10%,transparent)}.timeline-card:after{opacity:.2}.timeline-card.is-fitting{animation:calendarFitSnap .24s cubic-bezier(.22,.8,.24,1)}@keyframes calendarFitSnap{0%{transform:scale(.996);filter:saturate(.94)}55%{transform:scale(1.002);filter:saturate(1.04)}100%{transform:none;filter:none}}.timeline-scroll{max-height:calc(100vh - 238px);min-height:390px;scrollbar-gutter:stable}.timeline-shell{width:max-content;min-width:100%}.timeline-head{min-height:52px}.task-head{padding:0 16px}.week-cell{overflow:hidden;border-right-color:color-mix(in srgb,var(--ink,#2C2C2A) 10%,var(--hair,#E7E4DA))}.week-cell.zone-pre{background:var(--zone-pre)}.week-cell.zone-zero{position:relative;background:var(--zone-zero);box-shadow:inset 1px 0 0 color-mix(in srgb,#5B7A4A 34%,transparent),inset -1px 0 0 color-mix(in srgb,#5B7A4A 34%,transparent)}.week-cell.zone-post{background:var(--zone-post)}.week-cell strong{font-size:8.5px;letter-spacing:.15px}.week-cell.zone-zero strong{font-weight:900}.week-cell small{font-size:7.5px;opacity:.82}
      .phase-band{min-height:30px;background:color-mix(in srgb,var(--soft,#EFEBE1) 74%,var(--surface,#FFFEF9))}.phase-band>div{gap:7px;padding:0 16px;background:color-mix(in srgb,var(--soft,#EFEBE1) 74%,var(--surface,#FFFEF9))}.phase-band i{width:7px;height:7px;border-radius:50%;background:var(--task-cream-strong)!important;border:1px solid color-mix(in srgb,#A96A23 60%,transparent)}.phase-band strong{font-size:9.5px}.phase-band span{font-size:8px}
      .timeline-group-band{min-height:26px;border-bottom:1px solid color-mix(in srgb,var(--hair,#E7E4DA) 80%,transparent);background:color-mix(in srgb,var(--accent,#FFB703) 5%,var(--surface,#FFFEF9))}.timeline-group-band>div{position:sticky;left:0;z-index:9;display:flex;align-items:center;gap:7px;padding:0 21px;border-right:1px solid var(--hair,#E7E4DA);background:color-mix(in srgb,var(--accent,#FFB703) 5%,var(--surface,#FFFEF9))}.timeline-group-band i{width:5px;height:5px;border-radius:2px;background:var(--task-cream-strong);border:1px solid color-mix(in srgb,#A96A23 60%,transparent)}.timeline-group-band strong{font-size:8.5px;font-weight:760}.timeline-group-band span{font-size:7.5px;color:var(--muted,#888780)}
      .week-days{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));width:100%;margin-top:5px;padding:0 5px;color:color-mix(in srgb,var(--muted,#888780) 78%,transparent);font-size:7px;font-variant-numeric:tabular-nums}.week-days span{display:grid;place-items:center;min-width:0}.week-cell{align-content:center;padding-top:4px}.week-cell small{white-space:nowrap}
      .timeline-row{min-height:52px}.timeline-task{grid-template-columns:7px minmax(0,1fr);gap:9px;padding:7px 16px;background:var(--surface,#FFFEF9)}.timeline-task:hover{background:color-mix(in srgb,var(--accent,#FFB703) 4%,var(--surface,#FFFEF9))}.task-state,.task-state.is-progress,.task-state.is-blocked,.task-state.is-done{width:6px;height:6px;background:var(--task-cream-strong)}.task-state.is-blocked{box-shadow:0 0 0 2px color-mix(in srgb,#A96A23 22%,transparent)}.task-state.is-done{opacity:.48}.task-copy strong{font-size:10px;font-weight:720}.task-copy small{margin-top:3px;font-size:8px}.task-meta{display:none}
      .timeline-task{position:sticky;z-index:8;display:block;min-width:0;overflow:visible;padding:0;border-right:1px solid var(--hair,#E7E4DA);background:var(--surface,#FFFEF9)}.timeline-task-main{display:grid;grid-template-columns:7px minmax(0,1fr);align-items:center;gap:9px;width:100%;height:100%;min-height:52px;padding:7px 16px;border:0;background:transparent;text-align:left}.timeline-task-main:hover,.timeline-task-main:focus-visible{background:color-mix(in srgb,var(--accent,#FFB703) 5%,var(--surface,#FFFEF9))}.timeline-row-tools{position:absolute;z-index:20;inset-inline-end:7px;top:50%;display:flex;align-items:center;gap:3px;padding:3px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 16%,var(--hair,#E7E4DA));border-radius:9px 7px 10px 6px;background:color-mix(in srgb,var(--surface,#FFFEF9) 97%,transparent);box-shadow:0 2px 10px color-mix(in srgb,var(--ink,#2C2C2A) 10%,transparent);opacity:0;pointer-events:none;transform:translateY(-50%) translateX(4px);transition:opacity .16s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.timeline-row:hover .timeline-row-tools,.timeline-row:focus-within .timeline-row-tools,.timeline-row-tools:focus-within{opacity:1;pointer-events:auto;transform:translateY(-50%)}.row-tool,.row-tool-icon{min-height:23px;padding:0 6px;border:0;border-radius:6px 5px 7px 4px;background:transparent;color:var(--muted,#888780);font-size:7.5px;font-weight:760;white-space:nowrap}.row-tool:hover,.row-tool:focus-visible{background:var(--soft,#EFEBE1);color:var(--ink,#2C2C2A)}.row-tool-icon{display:grid;place-items:center;width:23px;padding:0;font-size:15px;line-height:1}.timeline-row-menu{position:absolute;z-index:40;top:calc(100% - 2px);inset-inline-end:7px;display:grid;min-width:142px;padding:5px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 22%,var(--hair,#E7E4DA));border-radius:10px 8px 11px 7px;background:var(--surface,#FFFEF9);box-shadow:2px 4px 14px color-mix(in srgb,var(--ink,#2C2C2A) 16%,transparent);animation:calendarRowMenuIn .14s cubic-bezier(.2,.8,.2,1) both}.timeline-row-menu button{min-height:28px;padding:0 9px;border:0;border-radius:6px 5px 7px 4px;background:transparent;text-align:left;font-size:9px}.timeline-row-menu button:hover,.timeline-row-menu button:focus-visible{background:var(--soft,#EFEBE1)}.timeline-row-menu .is-danger{color:var(--cal-critical)}@keyframes calendarRowMenuIn{from{opacity:0;transform:translateY(-3px) scale(.98)}to{opacity:1;transform:none}}
      .timeline-track{min-height:52px;background:repeating-linear-gradient(to right,transparent 0,transparent calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 9%,var(--hair,#E7E4DA)) calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 9%,var(--hair,#E7E4DA)) var(--week)),var(--surface,#FFFEF9)}.timeline-track.has-week-zero{background:repeating-linear-gradient(to right,transparent 0,transparent calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 9%,var(--hair,#E7E4DA)) calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 9%,var(--hair,#E7E4DA)) var(--week)),linear-gradient(to right,var(--zone-pre) 0,var(--zone-pre) var(--zero-start),var(--zone-zero) var(--zero-start),var(--zone-zero) var(--zero-end),var(--zone-post) var(--zero-end),var(--zone-post) 100%)}.today-line{z-index:5;border-left-color:color-mix(in srgb,var(--accent,#FFB703) 78%,#7E5811)}
      .timeline-track{background:repeating-linear-gradient(to right,transparent 0,max(0px,calc(var(--day) - 1px)),color-mix(in srgb,var(--ink,#2C2C2A) 6%,var(--hair,#E7E4DA)) max(0px,calc(var(--day) - 1px)),color-mix(in srgb,var(--ink,#2C2C2A) 6%,var(--hair,#E7E4DA)) var(--day)),repeating-linear-gradient(to right,transparent 0,transparent calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 12%,var(--hair,#E7E4DA)) calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 12%,var(--hair,#E7E4DA)) var(--week)),var(--surface,#FFFEF9)}.timeline-track.has-week-zero{background:repeating-linear-gradient(to right,transparent 0,max(0px,calc(var(--day) - 1px)),color-mix(in srgb,var(--ink,#2C2C2A) 6%,transparent) max(0px,calc(var(--day) - 1px)),color-mix(in srgb,var(--ink,#2C2C2A) 6%,transparent) var(--day)),repeating-linear-gradient(to right,transparent 0,transparent calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 12%,transparent) calc(var(--week) - 1px),color-mix(in srgb,var(--ink,#2C2C2A) 12%,transparent) var(--week)),linear-gradient(to right,var(--zone-pre) 0,var(--zone-pre) var(--zero-start),var(--zone-zero) var(--zero-start),var(--zone-zero) var(--zero-end),var(--zone-post) var(--zero-end),var(--zone-post) 100%)}
      .task-bar{top:13px;height:26px;overflow:visible;border:1px solid color-mix(in srgb,#A96A23 72%,var(--ink,#2C2C2A));border-radius:8px 10px 7px 9px;background:color-mix(in srgb,var(--accent,#FFB703) 38%,var(--surface,#FFFEF9));box-shadow:0 1px 0 color-mix(in srgb,var(--ink,#2C2C2A) 12%,transparent);color:var(--ink,#2C2C2A);cursor:grab;touch-action:pan-y;user-select:none;transform:translateX(var(--drag-x,0px));transition:box-shadow .14s ease-in-out,filter .14s ease-in-out,left .18s cubic-bezier(.22,.8,.24,1),width .18s cubic-bezier(.22,.8,.24,1)}.task-bar>.task-progress{position:absolute;z-index:0;inset:0 auto 0 0;border-radius:inherit;background:var(--task-cream-strong);opacity:.48;pointer-events:none}.task-bar>b{position:relative;z-index:2;display:block;padding:0 10px;color:color-mix(in srgb,var(--ink,#2C2C2A) 78%,#6E4516);font-size:7.5px;line-height:24px;text-shadow:none}.task-bar>.resize-handle{position:absolute;z-index:6;top:2px;bottom:2px;width:9px;inset-inline:auto;background:transparent;cursor:ew-resize;opacity:.42;touch-action:none}.task-bar>.resize-handle:after{content:"";position:absolute;top:6px;bottom:6px;border-left:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 48%,transparent)}.task-bar>.resize-handle.is-start{left:-2px}.task-bar>.resize-handle.is-start:after{left:4px}.task-bar>.resize-handle.is-end{right:-2px}.task-bar>.resize-handle.is-end:after{right:4px}.task-bar:hover>.resize-handle,.task-bar:focus-visible>.resize-handle,.task-bar.is-editing>.resize-handle{opacity:1}.task-bar.is-critical{border-color:color-mix(in srgb,var(--cal-critical) 72%,#A96A23);background:var(--task-cream);box-shadow:inset 3px 0 0 var(--cal-critical)}.task-bar.is-risk{box-shadow:inset 3px 0 0 var(--cal-critical),0 0 0 2px color-mix(in srgb,var(--cal-critical) 14%,transparent)}.task-bar.is-conflict{outline:1px dashed var(--cal-critical);outline-offset:2px}.task-bar.is-complete{border-color:color-mix(in srgb,#A96A23 55%,var(--hair,#E7E4DA));background:color-mix(in srgb,var(--task-cream) 70%,var(--surface,#FFFEF9));opacity:.72}.task-bar.is-complete b:before{content:"✓";margin-right:4px}.task-bar.is-editing{z-index:20;cursor:grabbing;filter:saturate(1.08);box-shadow:0 7px 18px color-mix(in srgb,#7B501F 20%,transparent);transition:box-shadow .14s ease-in-out,filter .14s ease-in-out}.task-bar.is-editing:after{content:attr(data-drag-label);position:absolute;left:50%;bottom:calc(100% + 7px);z-index:30;width:max-content;max-width:180px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 22%,transparent);border-radius:7px 6px 8px 5px;background:var(--ink,#2C2C2A);color:var(--surface,#FFFEF9);font-size:8px;font-weight:700;transform:translateX(-50%);pointer-events:none}
      .milestone{top:19px;cursor:grab;touch-action:pan-y;transform:translateX(var(--drag-x,0px)) rotate(45deg);transition:left .18s cubic-bezier(.22,.8,.24,1),filter .14s ease-in-out}.milestone>span{border-color:color-mix(in srgb,#A96A23 76%,var(--ink,#2C2C2A));background:var(--task-cream-strong)}.milestone.is-critical>span{border-color:var(--cal-critical);background:var(--task-cream-strong);box-shadow:inset 2px 0 0 var(--cal-critical)}.milestone.is-conflict>span{outline:1px dashed var(--cal-critical);outline-offset:2px}.milestone.is-complete>span{border-color:#A96A23;background:var(--task-cream);opacity:.65}.milestone.is-editing{z-index:20;cursor:grabbing;filter:saturate(1.08);box-shadow:none;transition:filter .14s ease-in-out}
      .task-bar,.task-bar.is-critical,.task-bar.is-risk,.task-bar.is-conflict,.task-bar.is-complete{border-color:color-mix(in srgb,#A96A23 72%,var(--ink,#2C2C2A));background:var(--task-cream);box-shadow:0 1px 0 color-mix(in srgb,var(--ink,#2C2C2A) 12%,transparent);opacity:1}.task-bar.is-risk,.task-bar.is-conflict{outline:0}.task-bar>.task-progress{background:var(--task-cream-strong);opacity:.58}.task-bar.is-complete b:before{content:"✓";margin-right:4px;color:color-mix(in srgb,var(--ink,#2C2C2A) 58%,transparent)}.task-bar.milestone-bar{min-width:22px;overflow:hidden}.task-bar.milestone-bar b{padding:0 8px;font-size:7px}
      .timeline-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.phase-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.timeline-tools{grid-template-columns:minmax(220px,1fr) 156px auto}.zoom-control{grid-column:1 / -1;justify-self:end;width:min(360px,100%)}.overview-grid{grid-template-columns:1fr}}
      @media(max-width:700px){.fs-calendar{padding-top:10px}.calendar-nav{align-items:flex-start;flex-direction:column;top:-24px}.calendar-actions{width:100%;justify-content:space-between}.calendar-hero,.section-head{align-items:flex-start;flex-direction:column}.start-control{width:100%}.kpi-grid,.phase-card-grid{grid-template-columns:1fr}.phase-ribbon{overflow:auto}.phase-ribbon>div{flex:0 0 150px}.timeline-tools{grid-template-columns:1fr}.timeline-legend{overflow:auto}.form-grid{grid-template-columns:1fr}.field-wide{grid-column:auto}.modal-backdrop{padding:10px}.modal-foot{align-items:stretch;flex-direction:column}.modal-foot>div{justify-content:flex-end}.dependency-add{grid-template-columns:1fr}.upcoming-row{grid-template-columns:62px minmax(0,1fr) 28px}.upcoming-row .status{display:none}}
      :host{display:block;height:100%;min-height:0}
      .fs-calendar{height:100%;min-height:0;display:flex;flex-direction:column}
      .fs-calendar>.calendar-nav{flex:0 0 auto}
      .timeline-view{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;height:auto}
      .timeline-view>.section-head,.timeline-view>.timeline-tools{flex:0 0 auto}
      .timeline-view>.timeline-card{display:flex;flex:1 1 auto;flex-direction:column;min-height:0}
      .timeline-view .timeline-scroll{flex:1 1 auto;min-height:0;max-height:none;overscroll-behavior:contain}
      .timeline-view .timeline-pan-sync{display:none!important}
      .timeline-card>[data-timeline-pan]{display:none!important}
      @media(max-width:700px){.timeline-view{min-height:0}.timeline-view>.timeline-card{min-height:clamp(420px,calc(100dvh - 230px),900px)}}
      @media(prefers-reduced-motion:reduce){.view.is-entering,.modal-backdrop.is-entering,.modal-backdrop.is-entering .task-modal,.loading>span{animation:none!important}.tabs button,.primary,.secondary,.icon,.critical-filter,.switch,.switch i{transition-duration:.01ms!important}}
    </style>`;
  }

  render() {
    const timelineScrollState = this.view === "timeline"
      ? this._timelineScrollOverride || this.captureTimelineScroll()
      : null;
    this._timelineScrollOverride = null;
    const styles = this.styles();
    if (this.loading) {
      this.shadowRoot.innerHTML = `${styles}<div class="fs-calendar"><div class="loading" role="status"><span></span><strong>Loading Calendar</strong><small>Building the route from script to delivery.</small></div></div>`;
      return;
    }
    if (this.error && !this.calendar) {
      const action = this.authRequired
        ? `<button type="button" class="primary" data-action="sign-in">Continue with Google</button><button type="button" class="secondary" data-action="retry">Try again</button>`
        : `<button type="button" class="primary" data-action="retry">Try again</button>`;
      this.shadowRoot.innerHTML = `${styles}<div class="fs-calendar"><div class="empty"><strong>Calendar could not be opened</strong><p>${escapeHtml(this.error)}</p><div class="empty-actions" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:17px">${action}</div></div></div>`;
      return;
    }
    const computed = this.computed();
    const tabs = [["overview", "Overview"], ["timeline", "Timeline"]]
      .map(([id, label]) => `<button type="button" data-view="${id}" aria-pressed="${this.view === id}" role="tab">${label}</button>`).join("");
    const content = this.view === "timeline" ? this.renderTimeline(computed) : this.renderOverview(computed);
    const shouldAnimate = this._animateView;
    this.shadowRoot.innerHTML = `${styles}<div class="fs-calendar">
      <div class="calendar-nav"><div class="tabs" role="tablist" aria-label="Calendar views">${tabs}</div><div class="calendar-actions"><span aria-live="polite">${escapeHtml(this.saveStatus)}</span>${this.view === "timeline" ? "" : '<button type="button" class="primary" data-action="add-task">Add task</button>'}</div></div>
      ${this.error ? `<div class="notice">${escapeHtml(this.error)}</div>` : ""}
      ${content}
      ${this.renderTaskModal(computed)}
    </div>`;
    if (this.view === "timeline") {
      this.restoreTimelineScroll(timelineScrollState);
      if (this.timelineZoom <= 0) requestAnimationFrame(() => this.applyTimelineGeometry(0, null, { fit: true }));
    }
    if (shouldAnimate) {
      this.shadowRoot.querySelector(".view")?.classList.add("is-entering");
      this.shadowRoot.querySelector('.tabs button[aria-pressed="true"]')?.classList.add("is-switching");
      this._animateView = false;
    }
    this._animateModal = false;
  }
}

if (!customElements.get("filmscript-calendar")) customElements.define("filmscript-calendar", FilmScriptCalendar);
