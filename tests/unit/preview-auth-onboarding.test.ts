import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Worker M2: Preview Auth, Password Recovery & Onboarding Suite Audit", () => {
  const rootDir = process.cwd();
  const authPath = path.join(rootDir, "client/src/experimental/pages/PreviewAuth.tsx");
  const forgotPath = path.join(rootDir, "client/src/experimental/pages/PreviewForgotPassword.tsx");
  const resetPath = path.join(rootDir, "client/src/experimental/pages/PreviewResetPassword.tsx");
  const onboardingPath = path.join(rootDir, "client/src/experimental/pages/PreviewOnboarding.tsx");

  it("[M2-1.1] All 4 required preview auth & onboarding files exist in client/src/experimental/pages/", () => {
    assert.ok(fs.existsSync(authPath), "PreviewAuth.tsx must exist");
    assert.ok(fs.existsSync(forgotPath), "PreviewForgotPassword.tsx must exist");
    assert.ok(fs.existsSync(resetPath), "PreviewResetPassword.tsx must exist");
    assert.ok(fs.existsSync(onboardingPath), "PreviewOnboarding.tsx must exist");
  });

  it("[M2-1.2] PreviewAuth.tsx implements dual-mode sign in & register with chambers styling and bar council fields", () => {
    const src = fs.readFileSync(authPath, "utf-8");
    assert.ok(src.includes("preview-theme-scope"), "Must wrap in preview-theme-scope");
    assert.ok(src.includes("Playfair Display"), "Must include Playfair Display typography");
    assert.ok(src.includes('data-testid="input-email"'), "Must have input-email");
    assert.ok(src.includes('data-testid="input-password"'), "Must have input-password");
    assert.ok(src.includes('data-testid="button-toggle-password"'), "Must have password toggle button");
    assert.ok(src.includes('data-testid="input-first-name"'), "Must have input-first-name");
    assert.ok(src.includes('data-testid="input-last-name"'), "Must have input-last-name");
    assert.ok(src.includes('data-testid="input-phone-number"'), "Must have input-phone-number");
    assert.ok(src.includes('data-testid="input-bar-council"'), "Must have bar council enrollment input");
    assert.ok(src.includes('data-testid="input-accept-terms"'), "Must have terms acceptance checkbox");
    assert.ok(src.includes('data-testid="link-terms-signup"'), "Must have terms link");
    assert.ok(src.includes('data-testid="link-privacy-signup"'), "Must have privacy policy link");
    assert.ok(src.includes('data-testid="google-signin-button"'), "Must have Google OAuth trigger button");
    assert.ok(src.includes("alwakeelo_preview_user"), "Must save preview user session in localStorage");
    assert.ok(src.includes("alwakeelo_preview_auth"), "Must set alwakeelo_preview_auth");
    assert.ok(src.includes("/preview/forgot-password"), "Must route to /preview/forgot-password");
    assert.ok(src.includes("/preview/onboarding"), "Must route to /preview/onboarding");
    assert.ok(src.includes("/preview/dashboard"), "Must route to /preview/dashboard");
  });

  it("[M2-1.3] PreviewForgotPassword.tsx implements email recovery, OTP simulation, and countdown", () => {
    const src = fs.readFileSync(forgotPath, "utf-8");
    assert.ok(src.includes("preview-theme-scope"), "Must wrap in preview-theme-scope");
    assert.ok(src.includes('data-testid="input-forgot-email"'), "Must have input-forgot-email");
    assert.ok(src.includes('data-testid="button-submit-forgot"'), "Must have button-submit-forgot");
    assert.ok(src.includes('data-testid="input-otp-code"'), "Must have input-otp-code for OTP verification");
    assert.ok(src.includes('data-testid="button-verify-otp"'), "Must have button-verify-otp");
    assert.ok(src.includes('data-testid="link-reset-password"'), "Must have link-reset-password");
    assert.ok(src.includes('data-testid="button-resend-forgot"'), "Must have button-resend-forgot");
    assert.ok(src.includes('data-testid="link-back-to-login"'), "Must have link-back-to-login");
    assert.ok(src.includes("/preview/reset-password"), "Must link to /preview/reset-password");
    assert.ok(src.includes("/preview/auth"), "Must link to /preview/auth");
  });

  it("[M2-1.4] PreviewResetPassword.tsx implements token validation, strength meter, and success state", () => {
    const src = fs.readFileSync(resetPath, "utf-8");
    assert.ok(src.includes("preview-theme-scope"), "Must wrap in preview-theme-scope");
    assert.ok(src.includes('data-testid="input-new-password"'), "Must have input-new-password");
    assert.ok(src.includes('data-testid="input-confirm-password"'), "Must have input-confirm-password");
    assert.ok(src.includes('data-testid="button-toggle-new-password"'), "Must have button-toggle-new-password");
    assert.ok(src.includes('data-testid="button-toggle-confirm-password"'), "Must have button-toggle-confirm-password");
    assert.ok(src.includes('data-testid="button-submit-reset"'), "Must have button-submit-reset");
    assert.ok(src.includes('data-testid="link-go-to-login"'), "Must have link-go-to-login");
    assert.ok(src.includes('data-testid="link-request-new-reset"'), "Must have link-request-new-reset");
    assert.ok(src.includes("strength"), "Must compute password strength score");
    assert.ok(src.includes("passwordsMatch"), "Must check if passwords match");
    assert.ok(src.includes("/preview/auth"), "Must navigate to /preview/auth upon success");
  });

  it("[M2-1.5] PreviewOnboarding.tsx implements 3-step chamber setup tour with persistence", () => {
    const src = fs.readFileSync(onboardingPath, "utf-8");
    assert.ok(src.includes("preview-theme-scope"), "Must wrap in preview-theme-scope");
    assert.ok(src.includes('data-testid="input-chamber-name"'), "Must have input-chamber-name");
    assert.ok(src.includes('data-testid="input-principal-advocate"'), "Must have input-principal-advocate");
    assert.ok(src.includes('data-testid="input-bar-council-no"'), "Must have input-bar-council-no");
    assert.ok(src.includes('data-testid="select-chamber-city"'), "Must have select-chamber-city");
    assert.ok(src.includes('data-testid="select-primary-jurisdiction"'), "Must have select-primary-jurisdiction");
    assert.ok(src.includes('data-testid="button-onboarding-next"'), "Must have next button");
    assert.ok(src.includes('data-testid="button-onboarding-back"'), "Must have back button");
    assert.ok(src.includes('data-testid="button-onboarding-skip"'), "Must have skip button");
    assert.ok(src.includes("Civil Litigation & Land Laws"), "Must include Civil practice area");
    assert.ok(src.includes("Criminal Defense & Bail"), "Must include Criminal practice area");
    assert.ok(src.includes("Constitutional & Writ Jurisdiction"), "Must include Constitutional practice area");
    assert.ok(src.includes("Corporate, Commercial & Banking"), "Must include Corporate practice area");
    assert.ok(src.includes("Apex Legal RAG"), "Must feature Apex Legal RAG model option");
    assert.ok(src.includes("Turbo Intelligence"), "Must feature Turbo Intelligence model option");
    assert.ok(src.includes("alwakeelo_preview_chamber_profile"), "Must persist chamber profile in localStorage");
    assert.ok(src.includes("onboardingCompleted"), "Must mark onboarding completed in user profile");
    assert.ok(src.includes("/preview/dashboard"), "Must route to /preview/dashboard upon completion");
  });
});
