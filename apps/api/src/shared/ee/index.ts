/**
 * Public API for the EE (Enterprise Edition) shared module.
 *
 * Import from "@shared/ee" — never import from sub-files directly in controllers
 * or middleware so that this barrel remains the single stable import boundary.
 *
 * Sub-module responsibilities:
 *   types.ts        — EeModule contract type (shape of the /ee JS plugin)
 *   policy.ts       — Plan tiers, feature policy, plan definitions
 *   audit.ts        — Structured audit logging for EE access events
 *   env.ts          — Deployment mode detection + license key validation
 *   loader.ts       — Dynamic require() of /ee, contract validation, status
 *   plan.ts         — Plan cache, resolution, catalog, limits
 *   entitlements.ts — Feature gating and entitlements payload
 */

// Types
export type { EeModule } from "./types";
export type { EeFeature, PlanTier, InteraOneMode, PlanDefinition, PlanLimitKey } from "./policy";

// Policy constants
export { EE_FEATURE_POLICY, PLAN_WEIGHT, PLAN_DEFINITIONS, OSS_CORE_CAPABILITIES } from "./policy";

// Audit
export { logEeAuditEvent } from "./audit";

// Environment / mode
export { getInteraOneMode, isEeEnabledByEnv } from "./env";

// Loader & status
export { isEeModulePresent, getEeStatus, loadEeModule, preflightEeContractCheck } from "./loader";

// Plan
export { normalizePlan, resolveOrganizationPlan, invalidateOrganizationPlanCache, getPlanCatalog, getPlanLimits } from "./plan";

// Entitlements
export { isFeatureEnabledForMode, canAccessFeatureByPlan, getRequiredPlanForFeature, resolvePlanEntitlements } from "./entitlements";
