import { ZodError } from "zod";

export function notFound(req, res) {
  res.status(404).json({ message: "Route not found." });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed.",
      errors: error.errors.map((item) => ({
        path: item.path.join("."),
        message: item.message
      }))
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({ message: "A record with this value already exists." });
  }

  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Server error." });
}
