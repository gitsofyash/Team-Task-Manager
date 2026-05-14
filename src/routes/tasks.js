import { Router } from "express";
import { query } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { requireProjectAccess, requireProjectManager } from "../middleware/projects.js";
import { parseBody, taskSchema, taskUpdateSchema } from "../validators.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(authenticate, requireProjectAccess);

async function ensureAssigneeIsMember(projectId, assigneeId) {
  if (!assigneeId) return;
  const { rows } = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, assigneeId]
  );
  if (!rows[0]) {
    const error = new Error("Assignee must be a member of this project.");
    error.status = 400;
    throw error;
  }
}

tasksRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [req.project.id]
    );
    res.json({ tasks: rows });
  } catch (error) {
    next(error);
  }
});

tasksRouter.post("/", requireProjectManager, parseBody(taskSchema), async (req, res, next) => {
  try {
    const { title, description, assigneeId, status, dueDate } = req.validated;
    await ensureAssigneeIsMember(req.project.id, assigneeId);

    const { rows } = await query(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.project.id, title, description, assigneeId || null, status, dueDate || null, req.user.id]
    );

    res.status(201).json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch("/:taskId", parseBody(taskUpdateSchema), async (req, res, next) => {
  try {
    const taskResult = await query("SELECT * FROM tasks WHERE id = $1 AND project_id = $2", [
      req.params.taskId,
      req.project.id
    ]);
    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const canManage = req.user.role === "admin" || req.project.membership_role === "owner";
    const onlyStatus = Object.keys(req.validated).every((key) => key === "status");

    if (!canManage && !(onlyStatus && task.assignee_id === req.user.id)) {
      return res.status(403).json({
        message: "Members can only update the status of tasks assigned to them."
      });
    }

    if (req.validated.assigneeId !== undefined) {
      await ensureAssigneeIsMember(req.project.id, req.validated.assigneeId);
    }

    const nextTask = {
      title: req.validated.title ?? task.title,
      description: req.validated.description ?? task.description,
      assignee_id: req.validated.assigneeId === undefined ? task.assignee_id : req.validated.assigneeId,
      status: req.validated.status ?? task.status,
      due_date: req.validated.dueDate === undefined ? task.due_date : req.validated.dueDate
    };

    const { rows } = await query(
      `UPDATE tasks
       SET title = $1, description = $2, assignee_id = $3, status = $4, due_date = $5, updated_at = NOW()
       WHERE id = $6 AND project_id = $7
       RETURNING *`,
      [
        nextTask.title,
        nextTask.description,
        nextTask.assignee_id,
        nextTask.status,
        nextTask.due_date,
        req.params.taskId,
        req.project.id
      ]
    );

    res.json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

tasksRouter.delete("/:taskId", requireProjectManager, async (req, res, next) => {
  try {
    const { rowCount } = await query("DELETE FROM tasks WHERE id = $1 AND project_id = $2", [
      req.params.taskId,
      req.project.id
    ]);

    if (!rowCount) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
