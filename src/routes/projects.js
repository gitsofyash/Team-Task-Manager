import { Router } from "express";
import { query, transaction } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { requireProjectAccess, requireProjectManager } from "../middleware/projects.js";
import { memberSchema, parseBody, projectSchema } from "../validators.js";

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.name, p.description, p.owner_id, p.created_at, pm.role AS membership_role,
        COUNT(t.id)::int AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done_count
       FROM projects p
       ${req.user.role === "admin" ? "LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1" : "JOIN project_members pm ON pm.project_id = p.id"}
       LEFT JOIN tasks t ON t.project_id = p.id
       ${req.user.role === "admin" ? "" : "WHERE pm.user_id = $1"}
       GROUP BY p.id, pm.role
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ projects: rows });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/", parseBody(projectSchema), async (req, res, next) => {
  try {
    const project = await transaction(async (client) => {
      const projectResult = await client.query(
        `INSERT INTO projects (name, description, owner_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.validated.name, req.validated.description, req.user.id]
      );
      await client.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')",
        [projectResult.rows[0].id, req.user.id]
      );
      return projectResult.rows[0];
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", requireProjectAccess, async (req, res, next) => {
  try {
    const [members, tasks] = await Promise.all([
      query(
        `SELECT u.id, u.name, u.email, u.role, pm.role AS project_role
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY pm.role DESC, u.name`,
        [req.project.id]
      ),
      query(
        `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = $1
         ORDER BY t.created_at DESC`,
        [req.project.id]
      )
    ]);

    res.json({ project: req.project, members: members.rows, tasks: tasks.rows });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post(
  "/:id/members",
  requireProjectAccess,
  requireProjectManager,
  parseBody(memberSchema),
  async (req, res, next) => {
    try {
      const userResult = await query("SELECT id, name, email, role FROM users WHERE email = $1", [
        req.validated.email
      ]);

      if (!userResult.rows[0]) {
        return res.status(404).json({ message: "No user found with that email." });
      }

      const member = userResult.rows[0];
      await query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [req.project.id, member.id]
      );

      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  }
);
