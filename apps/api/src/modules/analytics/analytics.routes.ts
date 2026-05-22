import { Router } from "express";
import { AnalyticsController } from "./analytics.controller";
import { authenticate, resolveOrganization, requireRole } from "@shared/security/middleware";

const analyticsRouter = Router();

// Ensure user is authenticated and belongs to the organization
analyticsRouter.use(authenticate, resolveOrganization);

// Only admins and owners can view analytics
analyticsRouter.get("/summary", requireRole("admin"), AnalyticsController.getSummary);
analyticsRouter.get("/trends", requireRole("admin"), AnalyticsController.getTrends);

export { analyticsRouter };