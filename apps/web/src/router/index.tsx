import { createBrowserRouter, Navigate } from "react-router";
import App from "../App";
import LoginPage from "../domains/auth/pages/login/page";
import SetupPage from "../domains/auth/pages/setup/page";
import PasswordRecoveryPage from "../domains/auth/pages/password-recovery/page";
import ResetPasswordPage from "../domains/auth/pages/reset-password/page";
import VerifyEmailPage from "../domains/auth/pages/verify-email/page";
import AcceptInvitePage from "../domains/auth/pages/accept-invite/page";
import { SelectOrgPage } from "@/domains/auth/pages/select-org/page";
import { DashboardHomePage } from "@/domains/dashboard/pages/page";

import { MembersPage } from "@/domains/member/pages/members-page";
import { RolesPage } from "@/domains/member/pages/roles-page";
import { ContactsPage } from "@/domains/contacts/pages/contacts-page";
import { AgentsPage } from "@/domains/agent/pages/page";
import { ContactSegmentsPage } from "@/domains/contacts/pages/segments-page";
import { WidgetPage } from "@/domains/widget/pages/page";
import { ConversationLayout } from "@/domains/conversation/components/conversation-layout";
import { ConversationsInboxPage } from "@/domains/conversation/pages/inbox-page";
import { ConversationChatPage } from "@/domains/conversation/pages/chat-page";
import { KnowledgeStaticPage } from "@/domains/knowledge/pages/static-page";
import { KnowledgeRealtimePage } from "@/domains/knowledge/pages/realtime-page";
import { GeneralSettingsPage } from "@/domains/settings/pages/general-page";
import { DangerZonePage } from "@/domains/settings/pages/danger-zone-page";
import { BillingPage } from "@/domains/settings/pages/billing-page";
import { BillingSuccessPage } from "@/domains/settings/pages/billing-success-page";
import { BillingFailedPage } from "@/domains/settings/pages/billing-failed-page";
import { WhiteLabelPage } from "@/domains/settings/pages/white-label-page";
import { CreateOrganizationPage } from "@/domains/organization/pages/create-organization-page";
import { DashboardLayout } from "@/shared/layouts/dashboard-layout";
import { ProtectedRoute } from "@/domains/auth/components/protected-route";
import { EeFeatureGate } from "@/shared/components/ee-feature-gate";
import QRCodeGeneratorPage from "@/domains/widget/pages/qr-generator-page";
import QRScannerLandingPage from "@/domains/widget/pages/qr-scanner-landing-page";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
    },
    {
        path: "/auth/login",
        element: <LoginPage />,
    },
    {
        path: "/auth/signup",
        element: <SetupPage />,
    },
    {
        path: "/auth/setup",
        element: <Navigate to="/auth/signup" replace />,
    },
    {
        path: "/auth/password-recovery",
        element: <PasswordRecoveryPage />,
    },
    {
        path: "/auth/reset-password",
        element: <ResetPasswordPage />,
    },
    {
        path: "/auth/verify-email",
        element: <VerifyEmailPage />,
    },
    {
        path: "/auth/accept-invite",
        element: <AcceptInvitePage />,
    },
    {
        path: "/select-org",
        element: <SelectOrgPage />,
    },
    {
        path: "/organizations/create",
        element: <CreateOrganizationPage />,
    },
    {
        path: "/dashboard",
        element: (
            <ProtectedRoute requiredRole="agent">
                <DashboardLayout>
                    <DashboardHomePage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },

    {
        path: "/dashboard/conversations",
        element: <Navigate to="/dashboard/conversations/inbox" replace />,
    },
    {
        path: "/dashboard/conversations/inbox",
        element: (
            <ProtectedRoute requiredRole="agent">
                <DashboardLayout>
                    <ConversationLayout>
                        <ConversationsInboxPage />
                    </ConversationLayout>
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/conversations/inbox/chat/:conversationId",
        element: (
            <ProtectedRoute requiredRole="agent">
                <DashboardLayout>
                    <ConversationLayout>
                        <ConversationChatPage />
                    </ConversationLayout>
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/agents",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <AgentsPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/members",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <MembersPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/members/roles",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <RolesPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/contacts/all-contacts",
        element: (
            <ProtectedRoute requiredRole="agent">
                <DashboardLayout>
                    <EeFeatureGate feature="contacts">
                        <ContactsPage />
                    </EeFeatureGate>
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/contacts/segments",
        element: (
            <ProtectedRoute requiredRole="agent">
                <DashboardLayout>
                    <EeFeatureGate feature="contacts">
                        <ContactSegmentsPage />
                    </EeFeatureGate>
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/widget",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <WidgetPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/widget/qr",
        element: (
            <ProtectedRoute requiredRole="founder">
                <DashboardLayout>
                    <QRCodeGeneratorPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/c/:publicKey",
        element: <QRScannerLandingPage />,
    },
    {
        path: "/dashboard/knowledge",
        element: (
            <DashboardLayout>
                <Navigate to="/dashboard/knowledge/static" replace />
            </DashboardLayout>
        ),
    },
    {
        path: "/dashboard/knowledge/static",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <KnowledgeStaticPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/knowledge/realtime",
        element: (
            <ProtectedRoute requiredRole="admin">
                <DashboardLayout>
                    <KnowledgeRealtimePage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/settings",
        element: (
            <DashboardLayout>
                <Navigate to="/dashboard/settings/general" replace />
            </DashboardLayout>
        ),
    },
    {
        path: "/dashboard/settings/general",
        element: (
            <ProtectedRoute requiredRole="founder">
                <DashboardLayout>
                    <GeneralSettingsPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/settings/billing",
        element: (
            <ProtectedRoute requiredRole="founder">
                <DashboardLayout>
                    <BillingPage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/settings/billing/success",
        element: (
            <DashboardLayout>
                <BillingSuccessPage />
            </DashboardLayout>
        ),
    },
    {
        path: "/dashboard/settings/billing/failed",
        element: (
            <DashboardLayout>
                <BillingFailedPage />
            </DashboardLayout>
        ),
    },
    {
        path: "/dashboard/settings/white-label",
        element: (
            <ProtectedRoute requiredRole="founder">
                <DashboardLayout>
                    <EeFeatureGate feature="white-label">
                        <WhiteLabelPage />
                    </EeFeatureGate>
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/settings/danger-zone",
        element: (
            <ProtectedRoute requiredRole="founder">
                <DashboardLayout>
                    <DangerZonePage />
                </DashboardLayout>
            </ProtectedRoute>
        ),
    },
    {
        path: "/dashboard/organizations/create",
        element: <Navigate to="/organizations/create" replace />,
    },
    {
        path: "/dashboard/*",
        element: (
            <DashboardLayout>
                <div className="flex h-screen w-full items-center justify-center">
                    <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
                </div>
            </DashboardLayout>
        ),
    },
    {
        path: "*",
        element: (
            <div className="flex h-screen w-full items-center justify-center">
                <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
            </div>
        )
    }
]);

export default router;
