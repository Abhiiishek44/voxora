import { Membership, User, MembershipRole, IMembership, Organization } from "@shared/models";
import { publishRoleNotificationEvent } from "@modules/notification";
import { Types } from "mongoose";
import { enqueueInviteEmail } from "@shared/queues/email.queue";
import crypto from "crypto";

export class MembershipService {
    /**
     * List all members of an organization.
     */
    static async listMembers(organizationId: string) {
        const memberships = await Membership.find({
            organizationId,
            inviteStatus: { $in: ["active", "pending", "inactive"] },
        }).populate("userId", "name email avatar status lastSeen");

        return memberships.map((m) => ({
            membershipId: m._id,
            user: m.userId,
            role: m.role,
            inviteStatus: m.inviteStatus,
            invitedAt: m.invitedAt,
            activatedAt: m.activatedAt,
        }));
    }

    /**
     * Invite a user to our organization.
     * If they already have an account – reuse it.
     * If not – create a pending user record.
     */
    static async inviteMember(
        invitedByUserId: string,
        organizationId: string,
        data: {
            email: string;
            name: string;
            role: MembershipRole;
            password?: string;
        },
    ) {
        // Enforce role assignment rules
        // Only owners can invite other owners.
        const inviterMembership = await Membership.findOne({ userId: invitedByUserId, organizationId });
        if (data.role === "owner" && inviterMembership?.role !== "owner") {
            throw new Error("Admins cannot invite users as Owners");
        }

        // Check for existing membership
        let user = await User.findOne({ email: data.email.toLowerCase() });

        if (user) {
            const existing = await Membership.findOne({ userId: user._id, organizationId });
            if (existing) throw new Error("User is already a member of this organization");
        } else {
            // Create stub user
            user = new User({
                name: data.name,
                email: data.email.toLowerCase(),
                password: data.password ?? crypto.randomBytes(16).toString("hex"),
                isActive: true,
                emailVerified: false,
            });
            await user.save();
        }

        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const membership = await Membership.create({
            userId: user._id,
            organizationId: new Types.ObjectId(organizationId),
            role: data.role,
            inviteStatus: "pending",
            invitedBy: new Types.ObjectId(invitedByUserId),
            invitedAt: new Date(),
            inviteExpiresAt,
            permissions: this.defaultPermissionsForRole(data.role),
        });

        // Store token on user for invite verification
        await User.findByIdAndUpdate(user._id, {
            emailVerificationToken: inviteToken,
        });

        // Enqueue invite email — fires and forgets; worker handles delivery
        const org = await Organization.findById(organizationId).select("name").lean();
        const emailSent = await enqueueInviteEmail(
            data.email,
            org?.name || "Your Organization",
            data.role,
            inviteToken,
        );

        const inviter = await User.findById(invitedByUserId).select("name email").lean();
        const eventType =
          data.role === "admin"
            ? "ADMIN_INVITED"
            : data.role === "agent"
              ? "AGENT_INVITED"
              : null;

        if (eventType) {
            await publishRoleNotificationEvent({
                eventId: crypto.randomUUID(),
                type: eventType,
                organizationId,
                actor: {
                    id: invitedByUserId,
                    name: inviter?.name || "Someone",
                    email: inviter?.email || "",
                    role: inviterMembership?.role,
                },
                target: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: data.role,
                },
                metadata: {
                    membershipId: membership._id.toString(),
                },
            });
        }

        return { membership, inviteToken, emailSent };
    }

    /**
     * Verify an invite token without accepting it.
     */
    static async verifyInvite(token: string) {
        const user = await User.findOne({ emailVerificationToken: token });
        if (!user) throw new Error("Invalid or expired invitation token");

        const membership = await Membership.findOne({
            userId: user._id,
            inviteStatus: "pending",
        }).populate("organizationId", "name slug");

        if (!membership) throw new Error("Invitation not found");

        if (membership.inviteExpiresAt && new Date() > membership.inviteExpiresAt) {
            throw new Error("Invitation has expired. Please request a new invite.");
        }

        return {
            email: user.email,
            name: user.name,
            requiresPassword: !user.emailVerified,
            organization: membership.organizationId
        };
    }

    /**
     * Accept an invite by token.
     */
    static async acceptInvite(token: string, password?: string) {
        const user = await User.findOne({
            emailVerificationToken: token,
        });

        if (!user) throw new Error("Invalid or expired invitation token");

        const membership = await Membership.findOne({
            userId: user._id,
            inviteStatus: "pending",
        });

        if (!membership) throw new Error("Invitation not found");

        if (membership.inviteExpiresAt && new Date() > membership.inviteExpiresAt) {
            throw new Error("Invitation has expired. Please request a new invite.");
        }

        membership.inviteStatus = "active";
        membership.activatedAt = new Date();
        await membership.save();

        if (!user.emailVerified) {
            if (!password) {
                throw new Error("Password is required to complete registration");
            }
            user.password = password; // The User model pre-save hook will hash this
        }

        user.emailVerificationToken = undefined;
        user.emailVerified = true;
        user.isActive = true;
        await user.save();

                const eventType =
                    membership.role === "admin"
                        ? "ADMIN_INVITE_ACCEPTED"
                        : membership.role === "agent"
                            ? "AGENT_INVITE_ACCEPTED"
                            : null;

                if (eventType) {
                        const inviter = membership.invitedBy
                            ? await User.findById(membership.invitedBy).select("name email").lean()
                            : null;
                        const inviterMembership = membership.invitedBy
                            ? await Membership.findOne({
                                    userId: membership.invitedBy,
                                    organizationId: membership.organizationId,
                                })
                                    .select("role")
                                    .lean()
                            : null;

                        await publishRoleNotificationEvent({
                                eventId: crypto.randomUUID(),
                                type: eventType,
                                organizationId: membership.organizationId.toString(),
                                actor: inviter
                                    ? {
                                            id: membership.invitedBy?.toString() || "",
                                            name: inviter.name || "Someone",
                                            email: inviter.email || "",
                                            role: inviterMembership?.role,
                                        }
                                    : undefined,
                                target: {
                                        id: user._id.toString(),
                                        name: user.name,
                                        email: user.email,
                                        role: membership.role,
                                },
                                metadata: {
                                        membershipId: membership._id.toString(),
                                },
                        });
                }

        return { user, membership };
    }

    /**
     * Resend an invitation to a pending member.
     */
    static async resendInvite(organizationId: string, memberId: string) {
        const membership = await Membership.findOne({ _id: memberId, organizationId });

        if (!membership) throw new Error("Membership not found");
        if (membership.inviteStatus !== "pending") {
            throw new Error("Can only resend invitations to pending members");
        }

        const user = await User.findById(membership.userId);
        if (!user) throw new Error("User not found");

        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        membership.inviteExpiresAt = inviteExpiresAt;
        await membership.save();

        user.emailVerificationToken = inviteToken;
        await user.save();

        // Enqueue invite email — fires and forgets; worker handles delivery
        const org = await Organization.findById(organizationId).select("name").lean();
        const emailSent = await enqueueInviteEmail(
          user.email,
          org?.name || "Your Organization",
          membership.role,
          inviteToken,
        );

        return { success: true, inviteToken, emailSent };
    }

    static async updateMemberRole(
        organizationId: string,
        targetMemberId: string,
        newRole: MembershipRole,
        requestingUserId: string,
    ) {
        const requester = await Membership.findOne({ userId: requestingUserId, organizationId });
        const targetMembership = await Membership.findOne({ _id: targetMemberId, organizationId });

        if (!targetMembership) throw new Error("Member not found");

        if (requestingUserId === targetMembership.userId.toString()) {
            throw new Error("Users cannot modify their own roles");
        }

        // Admins cannot modify owners or grant owner status
        if (requester?.role === "admin") {
            if (targetMembership.role === "owner") {
                throw new Error("Admins cannot modify owner roles");
            }
            if (newRole === "owner") {
                throw new Error("Admins cannot grant owner role");
            }
        }

                const previousRole = targetMembership.role;
                const membership = await Membership.findOneAndUpdate(
            { _id: targetMemberId, organizationId },
            { role: newRole },
            { new: true },
        );

                if (membership) {
                        const actor = await User.findById(requestingUserId).select("name email").lean();
                        const targetUser = await User.findById(membership.userId).select("name email").lean();
                        const eventType =
                            previousRole === "admin" || membership.role === "admin"
                                ? "ADMIN_ROLE_CHANGED"
                                : "AGENT_ROLE_CHANGED";

                        await publishRoleNotificationEvent({
                                eventId: crypto.randomUUID(),
                                type: eventType,
                                organizationId,
                                actor: actor
                                    ? {
                                            id: requestingUserId,
                                            name: actor.name || "Someone",
                                            email: actor.email || "",
                                            role: requester?.role,
                                        }
                                    : undefined,
                                target: targetUser
                                    ? {
                                            id: membership.userId.toString(),
                                            name: targetUser.name || "Member",
                                            email: targetUser.email || "",
                                            role: membership.role,
                                        }
                                    : undefined,
                                previousRole,
                                newRole: membership.role,
                                metadata: {
                                        membershipId: membership._id.toString(),
                                },
                        });
                }

        return membership;
    }

    /**
     * Suspend or Reactivate a member.
     */
    static async updateMemberStatus(
        organizationId: string,
        targetMemberId: string,
        newStatus: "active" | "inactive",
        requestingUserId: string,
    ) {
        const requester = await Membership.findOne({ userId: requestingUserId, organizationId });
        const targetMembership = await Membership.findOne({ _id: targetMemberId, organizationId });

        if (!targetMembership) throw new Error("Member not found");

        if (requestingUserId === targetMembership.userId.toString()) {
            throw new Error("Users cannot suspend or reactivate themselves");
        }

        if (targetMembership.role === "owner" && requestingUserId !== targetMembership.userId.toString()) {
            const ownerCount = await Membership.countDocuments({ organizationId, role: "owner", inviteStatus: "active" });
            // Let them suspend if they are an owner and there's another active owner
            if (ownerCount <= 1) {
                throw new Error("Cannot suspend the last active owner of an organization");
            }
        }

        if (requester?.role === "admin" && targetMembership.role === "owner") {
            throw new Error("Admins cannot modify owner status");
        }

                const membership = await Membership.findOneAndUpdate(
            { _id: targetMemberId, organizationId },
            { inviteStatus: newStatus },
            { new: true },
        );

                if (membership) {
                        const actor = await User.findById(requestingUserId).select("name email").lean();
                        const targetUser = await User.findById(membership.userId).select("name email").lean();
                        const isAdmin = membership.role === "admin";
                        const eventType = newStatus === "inactive"
                            ? isAdmin
                                ? "ADMIN_SUSPENDED"
                                : "AGENT_SUSPENDED"
                            : isAdmin
                                ? "ADMIN_REACTIVATED"
                                : "AGENT_REACTIVATED";

                        await publishRoleNotificationEvent({
                                eventId: crypto.randomUUID(),
                                type: eventType,
                                organizationId,
                                actor: actor
                                    ? {
                                            id: requestingUserId,
                                            name: actor.name || "Someone",
                                            email: actor.email || "",
                                            role: requester?.role,
                                        }
                                    : undefined,
                                target: targetUser
                                    ? {
                                            id: membership.userId.toString(),
                                            name: targetUser.name || "Member",
                                            email: targetUser.email || "",
                                            role: membership.role,
                                        }
                                    : undefined,
                                metadata: {
                                        membershipId: membership._id.toString(),
                                        status: newStatus,
                                },
                        });
                }

        return membership;
    }

    /**
     * Remove a member from an organization.
     */
    static async removeMember(organizationId: string, targetMemberId: string, requestingUserId: string) {
        const requester = await Membership.findOne({ userId: requestingUserId, organizationId });
        const targetMembership = await Membership.findOne({ _id: targetMemberId, organizationId });

        if (!targetMembership) throw new Error("Member not found");

        if (requestingUserId === targetMembership.userId.toString()) {
            throw new Error("Users cannot remove themselves from the organization");
        }

        if (requester?.role === "admin" && (targetMembership.role === "admin" || targetMembership.role === "owner")) {
            throw new Error("Admins cannot remove other Admins or Owners");
        }

        // Cannot remove the last owner of an organization
        if (targetMembership.role === "owner") {
            const ownerCount = await Membership.countDocuments({ organizationId, role: "owner" });
            if (ownerCount <= 1) {
                throw new Error("Cannot remove the last owner of an organization");
            }
        }

                const targetUser = await User.findById(targetMembership.userId).select("name email").lean();

                await Membership.findByIdAndDelete(targetMembership._id);

                const actor = await User.findById(requestingUserId).select("name email").lean();
                const eventType = targetMembership.role === "admin" ? "ADMIN_REMOVED" : "AGENT_REMOVED";

                await publishRoleNotificationEvent({
                        eventId: crypto.randomUUID(),
                        type: eventType,
                        organizationId,
                        actor: actor
                            ? {
                                    id: requestingUserId,
                                    name: actor.name || "Someone",
                                    email: actor.email || "",
                                    role: requester?.role,
                                }
                            : undefined,
                        target: targetUser
                            ? {
                                    id: targetMembership.userId.toString(),
                                    name: targetUser.name || "Member",
                                    email: targetUser.email || "",
                                    role: targetMembership.role,
                                }
                            : undefined,
                        metadata: {
                                membershipId: targetMembership._id.toString(),
                        },
                });
    }

    // ─── Helpers ───

    private static defaultPermissionsForRole(role: MembershipRole): string[] {
        if (role === "owner") {
            return ["manage_agents", "view_analytics", "manage_settings", "manage_members"];
        }
        if (role === "admin") {
            return ["manage_agents", "view_analytics", "manage_members"];
        }
        return [];
    }
}
