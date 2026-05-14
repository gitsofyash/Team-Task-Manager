import { pool } from "../db.js";
import { schemaSql } from "../schema.js";

try {
  await pool.query(schemaSql);
  console.log("Database initialized successfully.");
} catch (error) {
  console.error("Failed to initialize database.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
