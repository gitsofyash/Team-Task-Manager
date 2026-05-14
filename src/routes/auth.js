import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { authenticate, signToken } from "../middleware/auth.js";
import { loginSchema, parseBody, signupSchema } from "../validators.js";

export const authRouter = Router();

authRouter.post("/signup", parseBody(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.validated;
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role]
    );

    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", parseBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    res.json({ user: safeUser, token: signToken(safeUser) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});
