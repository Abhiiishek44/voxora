import { User, Organization, Membership, MembershipRole, Widget } from "@shared/models";
import { generateTokens } from "@shared/utils/auth";
import { redisClient } from "@shared/config/redis";
import { isEmailEnabled } from "@shared/utils/email";
import {
  enqueuePasswordResetEmail,
  enqueueWelcomeEmail,
  enqueueEmailVerificationLinkEmail,
  enqueueEmailVerificationOTPEmail,
  enqueueForgotPasswordOTPEmail
} from "@shared/queues/email.queue";
import { generateOTP, hashOTP, verifyOTP as checkOTP } from "@shared/utils/otp";
import { OrganizationService } from "@modules/organization/organization.service";
import crypto from "crypto";
import { DEFAULT_WIDGET_SUGGESTIONS } from "@shared/constants/widget-defaults";

export class AuthService {
  // ─────────────────────────────────────────────────────────────────
  //  PUBLIC SIGNUP
  // ─────────────────────────────────────────────────────────────────

  /**
   * Legacy one-step signup endpoint. Creates a user, organization, and owner membership.
   */
  async adminSignup(data: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
  }) {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      return { success: false, message: "Email already registered", statusCode: 400 };
    }

    // Create the user
    const user = new User({
      name: data.name,
      email: data.email.toLowerCase(),
      password: data.password,
      isActive: true,
      emailVerified: true,
    });
    await user.save();

    // Create the organization + owner membership
    const slug = await OrganizationService.generateAvailableSlug(data.organizationName);
    const organization = new Organization({ name: data.organizationName, slug });
    await organization.save();

    await Membership.create({
      userId: user._id,
      organizationId: organization._id,
      role: "owner" as MembershipRole,
      inviteStatus: "active",
      activatedAt: new Date(),
      permissions: [
        "manage_teams",
        "manage_agents",
        "view_analytics",
        "manage_settings",
        "manage_members",
      ],
    });

    // Auto-create default widget for the organization
    await Widget.create({
      organizationId: organization._id,
      displayName: "InteraOne AI",
      logoUrl: "",
      backgroundColor: "#845C6C",
      appearance: {
        theme: "dark",
        primaryColor: "#845C6C",
        welcomeMessage: "Hi there! How can we help you today?",
        logoUrl: "",
      },
      behavior: { autoOpen: false, showOnMobile: true, showOnDesktop: true },
      ai: { enabled: true, fallbackToAgent: true },
      conversation: { collectUserInfo: { name: true, email: true, phone: false } },
      features: { endUserDomAccess: false },
      suggestions: DEFAULT_WIDGET_SUGGESTIONS,
      publicKey: crypto.randomBytes(16).toString("hex"),
    });

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      activeOrganizationId: organization._id.toString(),
    });

    await this._storeRefreshToken(user._id.toString(), organization._id.toString(), tokens.refreshToken);

    return {
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          whiteLabelEnabled: organization.whiteLabelEnabled,
        },
        role: "owner",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  /**
   * Step 1 of the new Signup Flow.
   * Creates a pending user record and sends an OTP.
   */
  async initiateSignup(data: { name: string; email: string }) {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      if (existingUser.isActive && existingUser.emailVerified) {
        return { success: false, message: "Email already registered", statusCode: 400 };
      }
      // If user exists but is pending/unverified, we can reuse and resend OTP
      existingUser.name = data.name;
      await existingUser.save();
    } else {
      // Create a pending user
      await User.create({
        name: data.name,
        email: data.email.toLowerCase(),
        isActive: false, // Not active until signup completion
        emailVerified: false,
      });
    }

    return this.sendEmailVerification(data.email);
  }

  /**
   * Step 4 of the new Signup Flow.
   * Finalizes account creation (password + org).
   */
  async completeSignup(data: {
    email: string;
    organizationName: string;
    password: string;
  }) {
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      return { success: false, message: "User not found", statusCode: 404 };
    }

    if (!user.emailVerified) {
      return { success: false, message: "Email not verified", statusCode: 403 };
    }

    if (user.isActive) {
      return { success: false, message: "Email already registered", statusCode: 400 };
    }

    // Set password and activate
    user.password = data.password;
    user.isActive = true;
    await user.save();

    // Create the organization
    const slug = await OrganizationService.generateAvailableSlug(data.organizationName);
    const organization = new Organization({ name: data.organizationName, slug });
    await organization.save();

    // Create Membership (Owner)
    await Membership.create({
      userId: user._id,
      organizationId: organization._id,
      role: "owner" as MembershipRole,
      inviteStatus: "active",
      activatedAt: new Date(),
      permissions: [
        "manage_teams",
        "manage_agents",
        "view_analytics",
        "manage_settings",
        "manage_members",
      ],
    });

    // Create default widget
    await Widget.create({
      organizationId: organization._id,
      displayName: "InteraOne AI",
      backgroundColor: "#845C6C",
      appearance: {
        theme: "dark",
        primaryColor: "#845C6C",
        welcomeMessage: "Hi there! How can we help you today?",
      },
      behavior: { autoOpen: false, showOnMobile: true, showOnDesktop: true },
      ai: { enabled: true, fallbackToAgent: true },
      conversation: { collectUserInfo: { name: true, email: true, phone: false } },
      features: { endUserDomAccess: false },
      suggestions: DEFAULT_WIDGET_SUGGESTIONS,
      publicKey: crypto.randomBytes(16).toString("hex"),
    });

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      activeOrganizationId: organization._id.toString(),
    });

    await this._storeRefreshToken(user._id.toString(), organization._id.toString(), tokens.refreshToken);

    return {
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
        },
        role: "owner",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  LOGIN  (unified — returns memberships for org selector if needed)
  // ─────────────────────────────────────────────────────────────────

  async login(loginData: { email: string; password: string }) {
    const { email, password } = loginData;

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return { success: false, message: "Invalid email or password", statusCode: 401 };
    }

    if (!user.emailVerified) {
      return {
        success: false,
        message: "Please verify your email before logging in",
        statusCode: 403,
        requiresVerification: true
      };
    }

    // Load all active memberships
    const memberships = await Membership.find({
      userId: user._id,
      inviteStatus: "active",
    }).populate("organizationId", "name slug logoUrl plan whiteLabelEnabled");

    if (memberships.length === 0) {
      return {
        success: false,
        message: "You do not belong to any organization. Please contact your administrator.",
        statusCode: 403,
      };
    }

    user.status = "online";
    user.lastSeen = new Date();
    await User.findByIdAndUpdate(user._id, { status: "online", lastSeen: new Date() });

    // Single org — auto-select and return tokens
    if (memberships.length === 1) {
      const membership = memberships[0];
      const orgId = (membership.organizationId as any)._id.toString();

      const tokens = generateTokens({
        userId: user._id.toString(),
        email: user.email,
        activeOrganizationId: orgId,
      });

      await this._storeRefreshToken(user._id.toString(), orgId, tokens.refreshToken);

      return {
        success: true,
        data: {
          requiresOrgSelection: false,
          user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
          role: membership.role,
          organization: membership.organizationId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };
    }

    // Multiple orgs — return memberships list for org selector UI
    return {
      success: true,
      data: {
        requiresOrgSelection: true,
        user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
        memberships: memberships.map((m) => ({
          organization: m.organizationId,
          role: m.role,
        })),
        // Provide a short-lived selection token to complete login
        selectionToken: generateTokens({
          userId: user._id.toString(),
          email: user.email,
          activeOrganizationId: "pending",
        }).accessToken,
      },
    };
  }


  // ─────────────────────────────────────────────────────────────────
  //  LOGOUT
  // ─────────────────────────────────────────────────────────────────

  async logout(userId: string, activeOrganizationId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { status: "offline", lastSeen: new Date() });
    await redisClient.del(`org:${activeOrganizationId}:refresh_token:${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────
  //  PASSWORD MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  async forgotPassword(email: string, verificationMethod: "link" | "otp" = "link") {
    if (!isEmailEnabled()) {
      return {
        success: false,
        message: "Password reset is unavailable — no email provider is configured. Contact your administrator.",
        statusCode: 503,
      };
    }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });

    if (!user) {
      return { success: true }; // Silent failure for security
    }

    if (verificationMethod === "otp") {
      await this.generateAndSendOTP(user.email, "password_reset");
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = this._hashResetToken(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = undefined;
    await user.save();

    await enqueuePasswordResetEmail(user.email, user.name, resetToken);
    return { success: true, data: { isActive: user.isActive } };
  }

  async sendEmailVerification(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: "User not found", statusCode: 404 };
    if (user.emailVerified) return { success: true, message: "Email is already verified" };

    return this.generateAndSendOTP(user.email, "email_verification");
  }

  async generateAndSendOTP(email: string, type: "email_verification" | "password_reset") {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: "User not found", statusCode: 404 };

    // Cooldown check (2 minutes)
    if (user.otp && user.otp.lastSentAt && Date.now() - user.otp.lastSentAt.getTime() < 2 * 60 * 1000) {
      return {
        success: false,
        message: "Please wait before requesting another OTP",
        statusCode: 429
      };
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    user.otp = {
      code: hashedOtp,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      attempts: 0,
      lastSentAt: new Date(),
      type,
    };
    await user.save();

    if (type === "email_verification") {
      await enqueueEmailVerificationOTPEmail(user.email, user.name, otp);
    } else {
      await enqueueForgotPasswordOTPEmail(user.email, user.name, otp);
    }

    return { 
      success: true, 
      message: type === "password_reset" 
        ? "Password reset code sent" 
        : "OTP sent to your email" 
    };
  }

  async verifyOTP(email: string, code: string, type: "email_verification" | "password_reset") {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.otp || user.otp.type !== type) {
      return { success: false, message: "Invalid request", statusCode: 400 };
    }

    if (user.otp.expiresAt < new Date()) {
      return { success: false, message: "OTP has expired", statusCode: 400 };
    }

    if (user.otp.attempts >= 5) {
      return { success: false, message: "Too many attempts. Please request a new OTP.", statusCode: 429 };
    }

    const isValid = await checkOTP(code, user.otp.code);
    if (!isValid) {
      user.otp.attempts += 1;
      await user.save();
      return { success: false, message: "Invalid OTP", statusCode: 400 };
    }

    // Success - specific handling based on type
    if (type === "email_verification") {
      user.emailVerified = true;
      // Send welcome email after verification
      const memberships = await Membership.find({ userId: user._id });
      const role = memberships.length > 0 ? memberships[0].role : "user";
      await enqueueWelcomeEmail(user.email, user.name, role);
    }

    // Email verification is complete here. Password reset OTPs are consumed
    // only after the new password is saved.
    if (type === "email_verification") {
      user.otp = undefined;
    }
    await user.save();

    return { success: true };
  }

  async resendOTP(email: string, type: "email_verification" | "password_reset") {
    return this.generateAndSendOTP(email, type);
  }

  async resetPasswordWithOTP(email: string, code: string, newPassword: string) {
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+password");
    if (!user) return { success: false, message: "User not found", statusCode: 404 };

    // Prevent password reuse
    if (await user.comparePassword(newPassword)) {
      return { success: false, message: "New password cannot be the same as current password", statusCode: 400 };
    }

    const result = await this.verifyOTP(email, code, "password_reset");
    if (!result.success) return result;

    user.password = newPassword;
    user.otp = undefined;
    await user.save();

    return { success: true };
  }

  async validatePasswordResetToken(token: string) {
    if (!token) {
      return { success: false, message: "Reset link is missing or invalid", statusCode: 400 };
    }

    const user = await User.findOne({
      passwordResetToken: this._hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
      isActive: true,
    });

    if (!user) {
      return { success: false, message: "Reset link is invalid or has expired", statusCode: 400 };
    }

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token) {
      return { success: false, message: "Reset link is missing or invalid", statusCode: 400 };
    }

    const user = await User.findOne({
      passwordResetToken: this._hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
      isActive: true,
    }).select("+password");

    if (!user) {
      return { success: false, message: "Reset link is invalid or has expired", statusCode: 400 };
    }

    if (await user.comparePassword(newPassword)) {
      return { success: false, message: "New password cannot be the same as current password", statusCode: 400 };
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    user.otp = undefined;
    await user.save();

    return { success: true };
  }



  // ─────────────────────────────────────────────────────────────────
  //  BOOTSTRAP CHECK  (frontend uses this to decide setup vs login page)
  // ─────────────────────────────────────────────────────────────────

  static async isBootstrapRequired(): Promise<boolean> {
    const count = await Organization.countDocuments();
    return count === 0;
  }

  // ─────────────────────────────────────────────────────────────────
  //  INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async _storeRefreshToken(userId: string, orgId: string, refreshToken: string) {
    await redisClient.setEx(
      `org:${orgId}:refresh_token:${userId}`,
      30 * 24 * 60 * 60,
      refreshToken,
    );
  }

  private _hashResetToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // ─────────────────────────────────────────────────────────────────
  //  STATIC SHORTHAND (used in places that don't instantiate the class)
  // ─────────────────────────────────────────────────────────────────

  static async register(userData: { name: string; email: string; password: string }) {
    throw new Error("Use the signup flow endpoints to create an account.");
  }
}
