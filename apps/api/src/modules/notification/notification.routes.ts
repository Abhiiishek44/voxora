import { Router } from "express";
import NotificationController from "./notification.controller";
import { authenticate, resolveOrganization } from "@shared/middleware/auth";

const router = Router({ mergeParams: true });

router.use(authenticate, resolveOrganization);

router.get("/", NotificationController.getNotifications);
router.get("/unread-count", NotificationController.getUnreadCount);
router.patch("/read-all", NotificationController.markAllAsRead);
router.patch("/:id/read", NotificationController.markAsRead);

export default router;
