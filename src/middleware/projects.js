import { query } from "../db.js";

export async function requireProjectAccess(req, res, next) {
  const projectId = req.params.projectId || req.params.id;

  const { rows } =
    req.user.role === "admin"
      ? await query(
          `SELECT p.*, COALESCE(pm.role, 'owner') AS membership_role
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
           WHERE p.id = $1`,
          [projectId, req.user.id]
        )
      : await query(
          `SELECT p.*, pm.role AS membership_role
           FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE p.id = $1 AND pm.user_id = $2`,
          [projectId, req.user.id]
        );

  if (!rows[0]) {
    return res.status(404).json({ message: "Project not found or access denied." });
  }

  req.project = rows[0];
  next();
}

export function requireProjectManager(req, res, next) {
  if (req.user.role === "admin" || req.project.membership_role === "owner") {
    return next();
  }

  return res.status(403).json({ message: "Project owner or admin access required." });
}
