import { Router } from "express";
import * as AuthController from "./auth.controller";
import { authenticate, validateRequest, loginRateLimit, signupRateLimit, otpRateLimit } from "@shared/middleware";
import { authSchema } from "./auth.schema";

const router = Router();

// ─── Bootstrap (public) ───────────────────────────────────────────────────────
router.get("/bootstrap-status", AuthController.bootstrapCheck);

router.post(
  "/setup",
  signupRateLimit,
  validateRequest(authSchema.adminSignup),
  AuthController.adminSignup,
);

// ─── Multi-step Signup ────────────────────────────────────────────────────────
router.post(
  "/initiate-signup",
  signupRateLimit,
  validateRequest(authSchema.initiateSignup),
  AuthController.initiateSignup,
);
router.post(
  "/complete-signup",
  signupRateLimit,
  validateRequest(authSchema.completeSignup),
  AuthController.completeSignup,
);

// ─── Unified Login ────────────────────────────────────────────────────────────
router.post(
  "/login",
  loginRateLimit,
  validateRequest(authSchema.login),
  AuthController.login,
);

// ─── OTP / Verification ───────────────────────────────────────────────────────
router.post("/resend-otp", otpRateLimit, AuthController.resendOTP);
router.post("/verify-otp", otpRateLimit, AuthController.verifyOTP);
router.post(
  "/reset-password-otp",
  otpRateLimit,
  validateRequest(authSchema.resetPasswordWithOTP),
  AuthController.resetPasswordWithOTP,
);


// ─── Password Reset ───────────────────────────────────────────────────────────
router.post("/forgot-password", validateRequest(authSchema.forgotPassword), AuthController.forgotPassword);
router.get("/reset-password/validate", AuthController.validateResetPasswordToken);
router.post(
  "/reset-password",
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
