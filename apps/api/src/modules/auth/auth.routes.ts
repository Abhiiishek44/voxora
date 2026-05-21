import { Router } from "express";
import * as AuthController from "./auth.controller";
import { authenticate, validateRequest, authRateLimit } from "@shared/middleware";
import { authSchema } from "./auth.schema";

const router = Router();

// ─── Bootstrap (public) ───────────────────────────────────────────────────────
router.get("/bootstrap-status", AuthController.bootstrapCheck);

router.post(
  "/setup",
  authRateLimit,
  validateRequest(authSchema.adminSignup),
  AuthController.adminSignup,
);

// ─── Multi-step Signup ────────────────────────────────────────────────────────
router.post(
  "/initiate-signup",
  authRateLimit,
  validateRequest(authSchema.initiateSignup),
  AuthController.initiateSignup,
);
router.post(
  "/complete-signup",
  authRateLimit,
  validateRequest(authSchema.completeSignup),
  AuthController.completeSignup,
);

// ─── Unified Login ────────────────────────────────────────────────────────────
router.post(
  "/login",
  authRateLimit,
  validateRequest(authSchema.login),
  AuthController.login,
);

// ─── OTP / Verification ───────────────────────────────────────────────────────
router.post("/resend-otp", authRateLimit, AuthController.resendOTP);
router.post("/verify-otp", authRateLimit, AuthController.verifyOTP);
router.post(
  "/reset-password-otp",
  authRateLimit,
  validateRequest(authSchema.resetPasswordWithOTP),
  AuthController.resetPasswordWithOTP,
);


// ─── Password Reset ───────────────────────────────────────────────────────────
router.post("/forgot-password", authRateLimit, validateRequest(authSchema.forgotPassword), AuthController.forgotPassword);
router.get("/reset-password/validate", authRateLimit, AuthController.validateResetPasswordToken);
router.post(
  "/reset-password",
  authRateLimit,
  validateRequest(authSchema.resetPassword),
  AuthController.resetPassword,
);

router.post("/refresh-token", AuthController.refreshToken);

// ─── Protected ────────────────────────────────────────────────────────────────
router.use(authenticate);

router.post("/logout", AuthController.logout);
router.get("/profile", AuthController.getProfile);

export { router as authRouter };
export default router;
