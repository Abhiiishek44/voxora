import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";
import { Label } from "@/shared/ui/label";
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/shared/lib/validation";
import { useInitiateSignup, useCompleteSignup } from "../hooks/useSignup";
import { OTPInput } from "./otp-input.tsx";
import { ResendOTPTimer } from "./resend-otp-timer.tsx";
import { authApi } from "../api/auth.api";

type FieldName = "name" | "email" | "password" | "confirmPassword" | "companyName";
type FieldErrors = Partial<Record<FieldName, string>>;
type TouchedFields = Record<FieldName, boolean>;

const totalSteps = 4;

const stepVariants = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.03, filter: "blur(8px)" },
};

const stepTransition = {
  duration: 0.4,
  ease: [0.23, 1, 0.32, 1] as const,
};

function validateCompanyName(companyName: string) {
  if (!companyName) {
    return "Organization is required";
  }
  if (companyName.length < 2) {
    return "Organization name must be at least 2 characters";
  }
  return null;
}

function getFieldError(field: FieldName, formData: any) {
  switch (field) {
    case "name":
      return validateName(formData.name);
    case "email":
      return validateEmail(formData.email);
    case "password":
      return validatePassword(formData.password);
    case "confirmPassword":
      return validatePasswordConfirmation(formData.password, formData.confirmPassword);
    case "companyName":
      return validateCompanyName(formData.companyName);
    default:
      return null;
  }
}

export function SignupForm() {
  const { mutate: initiateSignup, isPending: isInitiating } = useInitiateSignup();
  const { mutate: completeSignup, isPending: isCompleting } = useCompleteSignup();

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    companyName: false,
  });

  const passwordChecks = useMemo(
    () => [
      { label: "8+ characters", isValid: formData.password.length >= 8 },
      { label: "Uppercase letter", isValid: /[A-Z]/.test(formData.password) },
      { label: "Lowercase letter", isValid: /[a-z]/.test(formData.password) },
      { label: "Number", isValid: /[0-9]/.test(formData.password) },
      { label: "Special character", isValid: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
    ],
    [formData.password]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name as FieldName]) {
      const fieldError = getFieldError(name as FieldName, { ...formData, [name]: value });
      setFieldErrors((prev) => ({ ...prev, [name]: fieldError || undefined }));
    }
  };

  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldError = getFieldError(field, formData);
    setFieldErrors((prev) => ({ ...prev, [field]: fieldError || undefined }));
  };

  const isStepValid = (step: number) => {
    if (step === 1) {
      return !validateName(formData.name) && !validateEmail(formData.email);
    }
    if (step === 2) {
      return otp.length === 6;
    }
    if (step === 3) {
      return !validateCompanyName(formData.companyName);
    }
    if (step === 4) {
      return (
        !validatePassword(formData.password) &&
        !validatePasswordConfirmation(formData.password, formData.confirmPassword)
      );
    }
    return true;
  };

  const goToNextStep = async () => {
    setError(null);
    if (currentStep === 1) {
      initiateSignup(
        { name: formData.name, email: formData.email },
        {
          onSuccess: () => setCurrentStep(2),
          onError: (err: any) => setError(err.message || "Failed to start signup"),
        }
      );
    } else if (currentStep === 2) {
      setIsVerifying(true);
      try {
        await authApi.verifyOTP(formData.email, otp, "email_verification");
        setCurrentStep(3);
      } catch (err: any) {
        setError(err.message || "Invalid or expired code");
      } finally {
        setIsVerifying(false);
      }
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 4) {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    completeSignup(
      {
        email: formData.email,
        organizationName: formData.companyName,
        password: formData.password,
      },
      {
        onError: (err: any) => setError(err.message || "Final setup failed"),
      }
    );
  };

  const handleResendOTP = async () => {
    await authApi.resendOTP(formData.email, "email_verification");
  };

  return (
    <div className="w-full max-w-md mx-auto md:mx-0">
      <div className="space-y-2 mb-6 sm:mb-8 text-center md:text-left">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Create Account
        </h2>
        <p className="text-muted-foreground font-medium">
          Start your journey with InteraOne today.
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex flex-col gap-5 sm:gap-7">
          <div
            className="grid grid-cols-4 gap-2"
            aria-label={`Signup progress: ${currentStep} of ${totalSteps}`}
            aria-live="polite"
          >
            {Array.from({ length: totalSteps }, (_, index) => {
              const stepNumber = index + 1;
              const isActive = currentStep >= stepNumber;

              return (
                <div
                  key={stepNumber}
                  className="h-1.5 overflow-hidden rounded-full border border-border/5 bg-muted/25"
                >
                  <motion.div
                    className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                    initial={false}
                    animate={{ width: isActive ? "100%" : "0%" }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              );
            })}
          </div>

          <div className="relative flex-1 min-h-[220px] sm:min-h-[300px] flex flex-col no-scrollbar overflow-y-auto pt-2">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-3 text-destructive text-sm mb-6 shrink-0"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="font-medium">{error}</p>
              </motion.div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        name="name"
                        placeholder="Enter full name"
                        className="pl-10 h-11"
                        value={formData.name}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("name")}
                        disabled={isInitiating}
                      />
                    </div>
                    {touched.name && fieldErrors.name && (
                      <p className="text-xs text-destructive">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10 h-11"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("email")}
                        disabled={isInitiating}
                      />
                    </div>
                    {touched.email && fieldErrors.email && (
                      <p className="text-xs text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <ShieldCheck className="h-10 w-10 text-primary mx-auto opacity-80" />
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit code to{" "}
                      <span className="text-foreground font-bold">{formData.email}</span>
                    </p>
                  </div>
                  <OTPInput value={otp} onChange={setOtp} disabled={isVerifying} />
                  <ResendOTPTimer onResend={handleResendOTP} disabled={isVerifying} />
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Organization Name</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        name="companyName"
                        placeholder="Acme Inc."
                        className="pl-10 h-11"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("companyName")}
                      />
                    </div>
                    {touched.companyName && fieldErrors.companyName && (
                      <p className="text-xs text-destructive">{fieldErrors.companyName}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11"
                        value={formData.password}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-1">
                    {passwordChecks.map((check) => (
                      <div
                        key={check.label}
                        className={`flex items-center gap-2 transition-colors ${check.isValid ? "text-primary" : "text-muted-foreground/30"
                          }`}
                      >
                        <CheckCircle2 className={`h-3 w-3 ${check.isValid ? "opacity-100" : "opacity-40"}`} />
                        <span className="text-[10px] font-medium tracking-tight">{check.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur("confirmPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-4 pt-4 border-t border-border/5 mt-auto">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isVerifying || isCompleting}
                  className="flex-1 h-12 font-semibold"
                >
                  Back
                </Button>
              )}

              <Button
                onClick={goToNextStep}
                disabled={!isStepValid(currentStep) || isInitiating || isVerifying || isCompleting}
                className="flex-1 h-12 font-semibold"
              >
                {isInitiating || isVerifying || isCompleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {currentStep === 4 ? "Complete Setup" : currentStep === 2 ? "Verify Email" : "Continue"}
              </Button>
            </div>

            {currentStep === 1 && (
              <p className="text-center text-sm text-muted-foreground font-medium">
                Already have an account?{" "}
                <Link to="/auth/login" className="text-primary hover:primary/80 font-bold">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
