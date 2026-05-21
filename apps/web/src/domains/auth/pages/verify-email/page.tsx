import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle, AlertCircle } from "lucide-react";
import Logo from "@/shared/components/logo";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { authApi } from "../../api/auth.api";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address...");
  const [nextPath, setNextPath] = useState("/auth/login");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing or invalid.");
      return;
    }

    authApi.verifyEmailLink(token)
      .then((response) => {
        setStatus("success");
        const isActive = Boolean(response?.data?.isActive);
        setNextPath(isActive ? "/auth/login" : "/auth/signup");
        setMessage(
          isActive
            ? "Your email address has been verified. You can now sign in."
            : "Your email address has been verified. Return to your signup window to continue setup.",
        );
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.message || "This verification link is invalid or has expired.");
      });
  }, [token]);

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/40 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="flex items-center justify-center mb-4">
            <Logo size={52} animate={false} />
          </div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            {isSuccess ? (
              <CheckCircle className="h-7 w-7 text-primary" />
            ) : (
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <CardTitle>{isSuccess ? "Email Verified" : status === "loading" ? "Checking Link" : "Verification Failed"}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to={isSuccess ? nextPath : "/auth/signup"}>
            <Button className="w-full">
              {isSuccess ? (nextPath === "/auth/login" ? "Continue to Login" : "Return to Signup") : "Return to Signup"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
