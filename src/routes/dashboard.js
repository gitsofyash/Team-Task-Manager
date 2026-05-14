import { Router } from "express";
import { query } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const scope = req.user.role === "admin" ? "" : "AND (t.assignee_id = $1 OR pm.user_id = $1)";
    const params = req.user.role === "admin" ? [] : [req.user.id];

    const stats = await query(
      `SELECT
        COUNT(DISTINCT t.id)::int AS total_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'todo')::int AS todo,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done')::int AS done,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < CURRENT_DATE)::int AS overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE 1=1 ${scope}`,
      params
    );

    const tasks = await query(
      `SELECT DISTINCT t.id, t.title, t.status, t.due_date, p.name AS project_name,
        u.name AS assignee_name, t.created_at
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE t.status <> 'done' ${scope}
       ORDER BY t.due_date NULLS LAST, t.created_at DESC
       LIMIT 8`,
      params
    );

    const projects = await query(
      `SELECT p.id, p.name,
        COUNT(t.id)::int AS total,
        COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE 1=1 ${req.user.role === "admin" ? "" : "AND pm.user_id = $1"}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 6`,
      params
    );

    res.json({
      stats: stats.rows[0],
      upcomingTasks: tasks.rows,
      projectProgress: projects.rows.map((project) => ({
        ...project,
        progress: project.total ? Math.round((project.done / project.total) * 100) : 0
      }))
    });
  } catch (error) {
    next(error);
  }
});
