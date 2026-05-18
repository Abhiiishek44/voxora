import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import config from "@shared/config";
import logger from "@shared/utils/logger";

export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many login attempts, please try again later." },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

export const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many signup attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  message: { success: false, message: "Too many OTP attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: { success: false, message: "Too many password reset attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const billingWebhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many webhook requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  logger.error("Error occurred:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = (error as any).statusCode || 500;
  const message =
    config.app.env === "production" ? "Something went wrong!" : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.app.env !== "production" && { stack: error.stack }),
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
