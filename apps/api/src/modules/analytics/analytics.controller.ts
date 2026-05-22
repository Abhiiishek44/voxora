import { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service";
import { AuthenticatedRequest } from "@shared/security/middleware";

export class AnalyticsController {
  static async getSummary(req: Request, res: Response) {
    try {
      const { activeOrganizationId } = (req as AuthenticatedRequest).user;
      const data = await AnalyticsService.getSummary(activeOrganizationId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  static async getTrends(req: Request, res: Response) {
    try {
      const { activeOrganizationId } = (req as AuthenticatedRequest).user;
      const { days } = req.query;
      const data = await AnalyticsService.getTrends(
        activeOrganizationId, 
        days ? parseInt(days as string) : 7
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}