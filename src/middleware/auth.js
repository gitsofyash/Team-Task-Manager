import jwt from "jsonwebtoken";
import { query } from "../db.js";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [payload.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}
