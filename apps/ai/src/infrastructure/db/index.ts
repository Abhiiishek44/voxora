import mongoose from "mongoose";
import { connectDB } from "./mongo.client";





const KnowledgeSchema = new mongoose.Schema({}, { strict: false });

export const KnowledgeModel =
  (mongoose.models["Knowledge"] as mongoose.Model<mongoose.Document> | undefined) ??
  mongoose.model("Knowledge", KnowledgeSchema);





const MessageSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

export const MessageModel =
  (mongoose.models["Message"] as mongoose.Model<mongoose.Document> | undefined) ??
  mongoose.model("Message", MessageSchema);




const ConversationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    visitor: {
      sessionId: { type: String },
      name: { type: String },
      email: { type: String },
      isAnonymous: { type: Boolean },
      providedInfoAt: { type: Date },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { strict: false, timestamps: true },
);

export const ConversationModel =
  (mongoose.models["Conversation"] as mongoose.Model<mongoose.Document> | undefined) ??
  mongoose.model("Conversation", ConversationSchema);




const ContactSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    status: { type: String, default: "active" },
    source: { type: String, default: "ai" },
    tags: [{ type: String }],
    lastActivityAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { strict: false, timestamps: true },
);

export const ContactModel =
  (mongoose.models["Contact"] as mongoose.Model<mongoose.Document> | undefined) ??
  mongoose.model("Contact", ContactSchema);

export { connectDB };
