import type { NextFunction, Request, Response } from "express";
import { dbAvailable, dbUnavailableReason } from "../db";

export function requireDatabase(_req: Request, res: Response, next: NextFunction) {
  if (dbAvailable) {
    return next();
  }

  return res.status(503).json({
    message: "Database unavailable",
    code: "DB_UNAVAILABLE",
    reason: dbUnavailableReason,
  });
}
