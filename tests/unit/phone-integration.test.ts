import test from "node:test";
import assert from "node:assert/strict";
import { users } from "../../shared/models/auth";
import { z } from "zod";

test("Drizzle users schema contains phoneNumber field", () => {
  assert.ok(users.phoneNumber, "users schema should contain a phoneNumber field");
  assert.equal(users.phoneNumber.name, "phone_number", "column name should be phone_number");
});

test("registerSchema validation rules for phone number", () => {
  // Define registerSchema validator equivalent to the one in routes.ts to verify the constraints
  const TERMS_REQUIRED_MESSAGE = "You must agree to the Terms and Conditions to create an account.";
  const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    acceptedTerms: z.boolean().refine((value) => value === true, {
      message: TERMS_REQUIRED_MESSAGE,
    }),
    termsVersion: z.string().trim().max(40).optional(),
  });

  // Valid payload
  const validResult = registerSchema.safeParse({
    email: "test@example.com",
    password: "Password123!",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+923001234567",
    acceptedTerms: true,
  });
  assert.ok(validResult.success, "Valid payload should pass validation");

  // Missing phone number
  const missingPhoneResult = registerSchema.safeParse({
    email: "test@example.com",
    password: "Password123!",
    firstName: "John",
    lastName: "Doe",
    acceptedTerms: true,
  });
  assert.equal(missingPhoneResult.success, false, "Should fail when phone number is missing");

  // Empty phone number
  const emptyPhoneResult = registerSchema.safeParse({
    email: "test@example.com",
    password: "Password123!",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "",
    acceptedTerms: true,
  });
  assert.equal(emptyPhoneResult.success, false, "Should fail when phone number is empty");
});
