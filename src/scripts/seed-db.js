import bcrypt from "bcryptjs";
import { pool, transaction } from "../db.js";
import { schemaSql } from "../schema.js";

const passwordHash = await bcrypt.hash("Password123", 12);

const demoUsers = [
  {
    name: "Aarav Admin",
    email: "admin@example.com",
    role: "admin"
  },
  {
    name: "Meera Sharma",
    email: "meera@example.com",
    role: "member"
  },
  {
    name: "Rohan Patel",
    email: "rohan@example.com",
    role: "member"
  },
  {
    name: "Priya Nair",
    email: "priya@example.com",
    role: "member"
  }
];

const demoProjects = [
  {
    name: "Website Redesign",
    description: "Refresh the marketing website, improve dashboard UX, and prepare launch assets.",
    members: ["meera@example.com", "rohan@example.com", "priya@example.com"],
    tasks: [
      {
        title: "Create landing page wireframe",
        description: "Draft the first responsive layout for the home page.",
        assignee: "meera@example.com",
        status: "done",
        dueOffset: -4
      },
      {
        title: "Build reusable task card component",
        description: "Implement the card states for todo, in-progress, done, and overdue.",
        assignee: "rohan@example.com",
        status: "in_progress",
        dueOffset: 3
      },
      {
        title: "Review brand colors and typography",
        description: "Check contrast, spacing, and font scale for the new interface.",
        assignee: "priya@example.com",
        status: "todo",
        dueOffset: 5
      }
    ]
  },
  {
    name: "Mobile App Launch",
    description: "Coordinate final QA, release checklist, and launch communication.",
    members: ["meera@example.com", "priya@example.com"],
    tasks: [
      {
        title: "Prepare release checklist",
        description: "List store assets, test accounts, and approval steps.",
        assignee: "meera@example.com",
        status: "in_progress",
        dueOffset: 1
      },
      {
        title: "Fix onboarding copy",
        description: "Simplify signup and empty-state text before launch.",
        assignee: "priya@example.com",
        status: "todo",
        dueOffset: -2
      },
      {
        title: "QA payment flow",
        description: "Verify checkout, invoices, failed payments, and retry behavior.",
        assignee: "meera@example.com",
        status: "todo",
        dueOffset: 7
      }
    ]
  }
];

function dateWithOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function upsertUser(client, user) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           role = EXCLUDED.role
     RETURNING id, name, email, role`,
    [user.name, user.email, passwordHash, user.role]
  );
  return rows[0];
}

async function upsertProject(client, project, ownerId) {
  const existing = await client.query(
    "SELECT id, name, description, owner_id FROM projects WHERE name = $1 AND owner_id = $2",
    [project.name, ownerId]
  );

  if (existing.rows[0]) {
    const { rows } = await client.query(
      "UPDATE projects SET description = $1 WHERE id = $2 RETURNING *",
      [project.description, existing.rows[0].id]
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO projects (name, description, owner_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [project.name, project.description, ownerId]
  );
  return rows[0];
}

async function addMembership(client, projectId, userId, role = "member") {
  await client.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [projectId, userId, role]
  );
}

async function upsertTask(client, projectId, ownerId, usersByEmail, task) {
  const assigneeId = usersByEmail.get(task.assignee)?.id || null;
  const existing = await client.query(
    "SELECT id FROM tasks WHERE project_id = $1 AND title = $2",
    [projectId, task.title]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE tasks
       SET description = $1,
           assignee_id = $2,
           status = $3,
           due_date = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [task.description, assigneeId, task.status, dateWithOffset(task.dueOffset), existing.rows[0].id]
    );
    return;
  }

  await client.query(
    `INSERT INTO tasks (project_id, title, description, assignee_id, status, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      projectId,
      task.title,
      task.description,
      assigneeId,
      task.status,
      dateWithOffset(task.dueOffset),
      ownerId
    ]
  );
}

try {
  await transaction(async (client) => {
    await client.query(schemaSql);

    const usersByEmail = new Map();
    for (const user of demoUsers) {
      const savedUser = await upsertUser(client, user);
      usersByEmail.set(savedUser.email, savedUser);
    }

    const owner = usersByEmail.get("admin@example.com");

    for (const projectSeed of demoProjects) {
      const project = await upsertProject(client, projectSeed, owner.id);
      await addMembership(client, project.id, owner.id, "owner");

      for (const email of projectSeed.members) {
        await addMembership(client, project.id, usersByEmail.get(email).id);
      }

      for (const task of projectSeed.tasks) {
        await upsertTask(client, project.id, owner.id, usersByEmail, task);
      }
    }
  });

  console.log("Demo data seeded successfully.");
  console.log("Login accounts:");
  console.log("  Admin:  admin@example.com / Password123");
  console.log("  Member: meera@example.com / Password123");
  console.log("  Member: rohan@example.com / Password123");
  console.log("  Member: priya@example.com / Password123");
} catch (error) {
  console.error("Failed to seed demo data.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
