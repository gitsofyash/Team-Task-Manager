import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { pool } from "./db.js";
import { schemaSql } from "./schema.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(publicDir));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projects/:projectId/tasks", tasksRouter);
app.use("/api/projects", projectsRouter);

app.use("/api", notFound);

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use(errorHandler);

async function start() {
  await pool.query(schemaSql);

  app.listen(port, () => {
    console.log(`Team Task Manager running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server.");
  console.error(error);
  process.exit(1);
});
