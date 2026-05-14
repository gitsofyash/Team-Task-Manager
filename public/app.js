const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  projects: [],
  selectedProjectId: null,
  selectedProject: null,
  members: [],
  tasks: []
};

const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the server. Keep `npm.cmd run dev` running, then refresh this page.");
  }
  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", payload.token);
  localStorage.setItem("ttm_user", JSON.stringify(payload.user));
  renderAuthState();
  refreshAll();
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.projects = [];
  state.selectedProjectId = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
  renderAuthState();
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tabName);
  });

  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === tabName);
  });
}

function renderAuthState() {
  const authed = Boolean(state.token && state.user);
  $("#authView").classList.toggle("hidden", authed);
  $("#appView").classList.toggle("hidden", !authed);

  if (authed) {
    $("#welcomeTitle").textContent = `Welcome, ${state.user.name}`;
    $("#roleLabel").textContent = `${state.user.role} account`;
  }
}

function renderStats(stats = {}) {
  const items = [
    ["Total tasks", stats.total_tasks || 0, "ALL"],
    ["To do", stats.todo || 0, "NEW"],
    ["In progress", stats.in_progress || 0, "RUN"],
    ["Overdue", stats.overdue || 0, "DUE"]
  ];

  $("#stats").innerHTML = items
    .map(
      ([label, value, icon]) => `
        <article class="stat-card">
          <div>
            <span class="muted">${label}</span>
            <strong>${value}</strong>
          </div>
          <span class="stat-icon">${icon}</span>
        </article>
      `
    )
    .join("");
}

function renderProgress(projects = []) {
  $("#progressList").innerHTML =
    projects
      .map(
        (project) => `
          <div>
            <div class="section-head">
              <strong>${project.name}</strong>
              <span class="muted">${project.progress}%</span>
            </div>
            <div class="bar"><span style="width: ${project.progress}%"></span></div>
          </div>
        `
      )
      .join("") || `<p class="muted">No project progress yet.</p>`;
}

function renderProjects() {
  $("#projectsList").innerHTML =
    state.projects
      .map((project) => {
        const progress = project.task_count ? Math.round((project.done_count / project.task_count) * 100) : 0;
        const active = project.id === state.selectedProjectId ? "active" : "";
        return `
          <button class="project-row ${active}" data-project-id="${project.id}">
            <div>
              <strong>${project.name}</strong>
              <p class="muted">${project.task_count} tasks | ${progress}% done</p>
            </div>
          </button>
        `;
      })
      .join("") || `<p class="muted">Create a project to get started.</p>`;
}

function renderProjectDetail() {
  const project = state.selectedProject;
  $("#projectTitle").textContent = project ? project.name : "Select a project";
  $("#projectMeta").textContent = project?.description || "";

  $("#assigneeSelect").innerHTML =
    `<option value="">Unassigned</option>` +
    state.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join("");

  $("#membersList").innerHTML =
    state.members
      .map(
        (member) => `
          <div class="member-row">
            <div>
              <strong>${member.name}</strong>
              <p class="muted">${member.email}</p>
            </div>
            <span class="badge">${member.project_role}</span>
          </div>
        `
      )
      .join("") || `<p class="muted">No members yet.</p>`;

  $("#tasksList").innerHTML =
    state.tasks
      .map((task) => {
        const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < today();
        return `
          <article class="task-card ${overdue ? "overdue" : ""}">
            <div class="section-head">
              <div>
                <strong>${task.title}</strong>
                <p class="muted">${task.description || "No description"}</p>
              </div>
              <span class="badge ${task.status === "done" ? "done" : overdue ? "warn" : ""}">
                ${formatStatus(task.status)}
              </span>
            </div>
            <p class="muted">Assigned to ${task.assignee_name || "nobody"} | Due ${task.due_date || "not set"}</p>
            <div class="task-actions">
              <button class="small" data-status="todo" data-task-id="${task.id}">To do</button>
              <button class="small" data-status="in_progress" data-task-id="${task.id}">In progress</button>
              <button class="small" data-status="done" data-task-id="${task.id}">Done</button>
              ${canManageProject() ? `<button class="small ghost" data-delete-task-id="${task.id}">Delete</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("") || `<p class="muted">No tasks yet.</p>`;

  $("#memberForm").classList.toggle("hidden", !project || !canManageProject());
  $("#taskForm").classList.toggle("hidden", !project || !canManageProject());
}

function canManageProject() {
  return state.user?.role === "admin" || state.selectedProject?.membership_role === "owner";
}

function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatStatus(status) {
  return status.replace("_", " ");
}

async function refreshDashboard() {
  const dashboard = await api("/api/dashboard");
  renderStats(dashboard.stats);
  renderProgress(dashboard.projectProgress);
}

async function refreshProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects;
  if (!state.selectedProjectId && state.projects[0]) {
    state.selectedProjectId = state.projects[0].id;
  }
  renderProjects();
  if (state.selectedProjectId) {
    await loadProject(state.selectedProjectId);
  }
}

async function loadProject(id) {
  const data = await api(`/api/projects/${id}`);
  state.selectedProjectId = id;
  state.selectedProject = data.project;
  state.members = data.members;
  state.tasks = data.tasks;
  renderProjects();
  renderProjectDetail();
}

async function refreshAll() {
  if (!state.token) return;
  await Promise.all([refreshDashboard(), refreshProjects()]);
}

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setSession(await api("/api/auth/signup", { method: "POST", body: JSON.stringify(serializeForm(event.target)) }));
    event.target.reset();
  } catch (error) {
    showToast(error.message);
  }
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setSession(await api("/api/auth/login", { method: "POST", body: JSON.stringify(serializeForm(event.target)) }));
    event.target.reset();
  } catch (error) {
    showToast(error.message);
  }
});

$("#logoutButton").addEventListener("click", clearSession);

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
});

$("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/projects", { method: "POST", body: JSON.stringify(serializeForm(event.target)) });
    state.selectedProjectId = data.project.id;
    event.target.reset();
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
});

$("#projectsList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-project-id]");
  if (!button) return;
  await loadProject(button.dataset.projectId);
});

$("#memberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api(`/api/projects/${state.selectedProjectId}/members`, {
      method: "POST",
      body: JSON.stringify(serializeForm(event.target))
    });
    event.target.reset();
    await loadProject(state.selectedProjectId);
  } catch (error) {
    showToast(error.message);
  }
});

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = serializeForm(event.target);
  body.assigneeId = body.assigneeId || null;
  body.dueDate = body.dueDate || null;

  try {
    await api(`/api/projects/${state.selectedProjectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    event.target.reset();
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
});

$("#tasksList").addEventListener("click", async (event) => {
  const statusButton = event.target.closest("[data-status]");
  const deleteButton = event.target.closest("[data-delete-task-id]");

  try {
    if (statusButton) {
      await api(`/api/projects/${state.selectedProjectId}/tasks/${statusButton.dataset.taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusButton.dataset.status })
      });
    }

    if (deleteButton) {
      await api(`/api/projects/${state.selectedProjectId}/tasks/${deleteButton.dataset.deleteTaskId}`, {
        method: "DELETE"
      });
    }

    if (statusButton || deleteButton) {
      await refreshAll();
    }
  } catch (error) {
    showToast(error.message);
  }
});

renderAuthState();
refreshAll().catch((error) => {
  showToast(error.message);
  clearSession();
});
