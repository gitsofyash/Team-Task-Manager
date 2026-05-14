const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const stamp = Date.now();

const admin = {
  name: "Smoke Admin",
  email: `smoke.admin.${stamp}@example.com`,
  password: "Password123",
  role: "admin"
};

const member = {
  name: "Smoke Member",
  email: `smoke.member.${stamp}@example.com`,
  password: "Password123",
  role: "member"
};

const checks = [];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${data?.message || text}`);
  }

  return data;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function check(name, callback) {
  try {
    await callback();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", error: error.message });
  }
}

let adminToken;
let memberToken;
let projectId;
let taskId;

await check("Health endpoint", async () => {
  const data = await request("/health");
  if (!data.ok) throw new Error("Health endpoint did not return ok=true.");
});

await check("Signup admin and member", async () => {
  const adminSignup = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(admin)
  });
  const memberSignup = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(member)
  });
  adminToken = adminSignup.token;
  memberToken = memberSignup.token;
  if (adminSignup.user.role !== "admin" || memberSignup.user.role !== "member") {
    throw new Error("Roles were not saved correctly.");
  }
});

await check("Login works", async () => {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: admin.email, password: admin.password })
  });
  if (!data.token) throw new Error("Login did not return token.");
});

await check("Protected /me works", async () => {
  const data = await request("/api/auth/me", {
    headers: auth(adminToken)
  });
  if (data.user.email !== admin.email) throw new Error("/me returned the wrong user.");
});

await check("Project creation works", async () => {
  const data = await request("/api/projects", {
    method: "POST",
    headers: auth(adminToken),
    body: JSON.stringify({
      name: `Smoke Project ${stamp}`,
      description: "Project created by automated smoke test."
    })
  });
  projectId = data.project.id;
  if (!projectId) throw new Error("Project id missing.");
});

await check("Team member add works", async () => {
  await request(`/api/projects/${projectId}/members`, {
    method: "POST",
    headers: auth(adminToken),
    body: JSON.stringify({ email: member.email })
  });

  const data = await request(`/api/projects/${projectId}`, {
    headers: auth(adminToken)
  });
  if (!data.members.some((user) => user.email === member.email)) {
    throw new Error("Member was not added to the project.");
  }
});

await check("Task creation and assignment works", async () => {
  const project = await request(`/api/projects/${projectId}`, {
    headers: auth(adminToken)
  });
  const assignee = project.members.find((user) => user.email === member.email);
  const data = await request(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: auth(adminToken),
    body: JSON.stringify({
      title: `Smoke Task ${stamp}`,
      description: "Assigned task created by automated smoke test.",
      assigneeId: assignee.id,
      status: "todo",
      dueDate: "2026-05-20"
    })
  });
  taskId = data.task.id;
  if (data.task.assignee_id !== assignee.id) throw new Error("Task was not assigned to member.");
});

await check("Member can update own task status", async () => {
  const data = await request(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: auth(memberToken),
    body: JSON.stringify({ status: "in_progress" })
  });
  if (data.task.status !== "in_progress") throw new Error("Task status did not update.");
});

await check("RBAC blocks member from creating task", async () => {
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...auth(memberToken)
    },
    body: JSON.stringify({
      title: "Forbidden member task",
      status: "todo"
    })
  });
  if (response.status !== 403) {
    throw new Error(`Expected 403, received ${response.status}.`);
  }
});

await check("Dashboard returns stats and progress", async () => {
  const data = await request("/api/dashboard", {
    headers: auth(adminToken)
  });
  if (!data.stats || !Array.isArray(data.projectProgress)) {
    throw new Error("Dashboard response shape is invalid.");
  }
});

console.table(checks);

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length) {
  console.error("\nFailures:");
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.error}`);
  }
  process.exit(1);
}

console.log(`\nAll smoke tests passed against ${baseUrl}`);
