import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../../email";
import { dbAvailable, dbUnavailableReason } from "../../db";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password, firstName, lastName } = parsed.data;

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await authStorage.upsertUser({
        email,
        firstName,
        lastName,
        passwordHash,
        authProvider: "email",
      });

      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { passwordHash: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (!dbAvailable) {
        return res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE", reason: dbUnavailableReason });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password } = parsed.data;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.authProvider === "google") {
        return res.status(401).json({ message: "This account uses Google sign-in. Please use the Google login button." });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { passwordHash: _, ...safeUser } = user;
        res.json(safeUser);
      });
    } catch (error) {
      console.error("Login error:", error);
      if (!dbAvailable) {
        return res.status(503).json({ message: "Database unavailable", code: "DB_UNAVAILABLE", reason: dbUnavailableReason });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "No credential provided" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ message: "Google sign-in is not configured" });
      }

      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!verifyRes.ok) {
        return res.status(401).json({ message: "Invalid Google token" });
      }

      const payload = await verifyRes.json();

      if (payload.aud !== clientId) {
        return res.status(401).json({ message: "Token audience mismatch" });
      }

      const email = payload.email;
      const firstName = payload.given_name || payload.name?.split(" ")[0] || "";
      const lastName = payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "";
      const profileImageUrl = payload.picture || null;

      let user = await authStorage.getUserByEmail(email);

      if (user) {
        if (user.authProvider === "email") {
          return res.status(409).json({ message: "An account with this email already exists using email/password. Please sign in with your email and password." });
        }
      } else {
        user = await authStorage.upsertUser({
          email,
          firstName,
          lastName,
          profileImageUrl,
          authProvider: "google",
        });
      }

      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { passwordHash: _, ...safeUser } = user!;
        res.json(safeUser);
      });
    } catch (error) {
      console.error("Google token auth error:", error);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  app.get("/api/auth/google/status", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    res.json({ available: !!clientId, clientId });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please provide a valid email address" });
      }

      const user = await authStorage.getUserByEmail(parsed.data.email);

      if (!user || user.authProvider !== "email") {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await authStorage.createPasswordResetToken(user.id, token, expiresAt);

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

      const emailSent = await sendPasswordResetEmail(parsed.data.email, resetUrl, user.firstName);

      if (emailSent) {
        res.json({ message: "A password reset link has been sent to your email address." });
      } else {
        res.json({
          message: "If an account with that email exists, a password reset link has been sent.",
          resetUrl,
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const resetToken = await authStorage.getValidResetToken(parsed.data.token);
      if (!resetToken) {
        return res.status(400).json({ message: "This reset link has expired or is invalid. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await authStorage.updateUserPassword(resetToken.userId, passwordHash);
      await authStorage.markResetTokenUsed(resetToken.id);

      res.json({ message: "Password has been reset successfully. You can now sign in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
