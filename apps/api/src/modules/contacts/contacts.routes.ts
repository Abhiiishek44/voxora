import { Router } from "express";
import {
	authenticate,
	resolveOrganization,
	requireRole,
	requireEeFeature,
	validateRequest,
} from "@shared/security/middleware";
import { ContactsController } from "./contacts.controller";
import { contactsSchema } from "./contacts.schema";

const router = Router();

// Internal endpoint called by AI tool (authenticated by shared secret header).
router.post(
	"/ai/upsert",
	validateRequest(contactsSchema.upsertFromAI),
	ContactsController.upsertFromAI,
);

router.use(authenticate);
router.use(resolveOrganization);
router.use(requireEeFeature("contacts"));

router.get(
	"/",
	validateRequest(contactsSchema.listContactsQuery, "query"),
	requireRole("agent"),
	ContactsController.listContacts,
);

export default router;