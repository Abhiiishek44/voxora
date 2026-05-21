import mongoose, { Document, Schema } from "mongoose";

export type EmailTemplateType =
  | "invite"
  | "password_reset"
  | "welcome"
  | "email_verification_link"
  | "email_verification_otp"
  | "password_reset_otp"
  | "notification"
  | "alert";

export interface IEmailTemplate extends Document {
  templateKey: string;
  type: EmailTemplateType;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
  isActive: boolean;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    templateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: [
        "invite",
        "password_reset",
        "welcome",
        "email_verification_link",
        "email_verification_otp",
        "password_reset_otp",
        "notification",
        "alert",
      ],
      required: true,
      unique: true,
      index: true,
    },
    subjectTemplate: { type: String, required: true },
    htmlTemplate: { type: String, required: true },
    textTemplate: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const EmailTemplate = mongoose.model<IEmailTemplate>(
  "EmailTemplate",
  EmailTemplateSchema,
);
