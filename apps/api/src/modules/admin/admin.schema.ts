import Joi from "joi";

const appearanceSchema = Joi.object({
  theme: Joi.string().valid("dark", "light").required(),
  welcomeMessage: Joi.string().min(1).max(500).required(),
}).options({ stripUnknown: true });

const behaviorSchema = Joi.object({
  autoOpen: Joi.boolean().required(),
  showOnMobile: Joi.boolean().required(),
  showOnDesktop: Joi.boolean().required(),
});

const aiSchema = Joi.object({
  enabled: Joi.boolean().required(),
  model: Joi.string().min(1).max(120).required(),
  fallbackToAgent: Joi.boolean().required(),
});

const conversationSchema = Joi.object({
  collectUserInfo: Joi.object({
    name: Joi.boolean().required(),
    email: Joi.boolean().required(),
    phone: Joi.boolean(),
  }).required(),
});

const featuresSchema = Joi.object({
  endUserDomAccess: Joi.boolean().required(),
});

export const adminSchema = {


  inviteAgent: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid("agent", "admin").required(),
  }),

  updateAgent: Joi.object({
    name: Joi.string().min(2).max(50),
    email: Joi.string().email(),
    role: Joi.string().valid("agent", "admin"),
    isActive: Joi.boolean(),
    status: Joi.string().valid("online", "offline", "busy", "away"),
  }),

  createWidget: Joi.object({
    displayName: Joi.string().min(1).max(50).required(),

    appearance: appearanceSchema,
    behavior: behaviorSchema,
    ai: aiSchema,
    conversation: conversationSchema,
    features: featuresSchema,
  }).options({ stripUnknown: true }),

  updateWidget: Joi.object({
    displayName: Joi.string().min(1).max(50),

    appearance: appearanceSchema,
    behavior: behaviorSchema,
    ai: aiSchema,
    conversation: conversationSchema,
    features: featuresSchema,
    _id: Joi.string().optional(),
    userId: Joi.string().optional(),
    createdAt: Joi.date().optional(),
    updatedAt: Joi.date().optional(),
    __v: Joi.number().optional(),
  }).options({ stripUnknown: true }),

  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    search: Joi.string().max(100).allow(""),
  }),

  agentFiltersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    role: Joi.string().valid("agent", "admin"),
    status: Joi.string().valid("online", "offline", "busy", "away"),
    search: Joi.string().max(100).allow(""),
  }),
};
