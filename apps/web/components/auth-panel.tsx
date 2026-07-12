"use client";

import { Check, LoaderCircle, Mail, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  consumeStoredAuthRedirect,
  isSafeInternalRedirect,
  storeAuthRedirect,
} from "@/lib/auth-redirect";
import { db } from "@/lib/services";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { KinoLogo } from "@/components/kino-logo";

type AuthTab = "sign-in" | "register";
type LoginMethod = "password" | "magic-link";
type LoadingAction = "login" | "magic-link" | "register" | "google" | null;

const passwordRequirements = [
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "digit",
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
  {
    id: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
] as const;

export function AuthPanel({
  initialTab = "sign-in",
}: {
  initialTab?: AuthTab;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithOtp = useAuthStore((state) => state.signInWithOtp);
  const signUpWithEmail = useAuthStore((state) => state.signUpWithEmail);
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [username, setUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const passwordState = useMemo(
    () =>
      passwordRequirements.map((requirement) => ({
        ...requirement,
        satisfied: requirement.test(registerPassword),
      })),
    [registerPassword],
  );
  const registerPasswordValid = passwordState.every(
    (requirement) => requirement.satisfied,
  );
  const cleanUsername = username.trim();
  const cleanRegisterEmail = registerEmail.trim();
  const cleanLoginEmail = loginEmail.trim();
  const loginEmailValid = isEmail(cleanLoginEmail);
  const registerEmailValid = isEmail(cleanRegisterEmail);
  const usernameError = getUsernameError(cleanUsername);
  const confirmPasswordError =
    confirmPassword && registerPassword !== confirmPassword
      ? "Passwords do not match."
      : null;
  const canSubmitLogin =
    loginEmailValid &&
    (loginMethod === "magic-link" || loginPassword.length > 0) &&
    !loadingAction;
  const canSubmitRegister =
    !usernameError &&
    registerEmailValid &&
    registerPasswordValid &&
    confirmPassword.length > 0 &&
    registerPassword === confirmPassword &&
    !loadingAction;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function resetFeedback() {
    setSubmitted(false);
    setError(null);
    setMessage(null);
  }

  function getRedirectTarget() {
    return isSafeInternalRedirect(pathname) ? pathname : "/discover";
  }

  function prepareAuthRedirect() {
    storeAuthRedirect(getRedirectTarget());
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    setMessage(null);
    if (!canSubmitLogin) return;

    try {
      prepareAuthRedirect();
      const action = loginMethod === "magic-link" ? "magic-link" : "login";
      setLoadingAction(action);
      if (loginMethod === "magic-link") {
        await signInWithOtp(cleanLoginEmail);
        setMessage("Check your inbox for a secure sign-in link.");
      } else {
        await signInWithEmail(cleanLoginEmail, loginPassword);
        router.replace(consumeStoredAuthRedirect("/discover"));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    setMessage(null);
    if (!canSubmitRegister) return;

    try {
      setLoadingAction("register");
      const existingProfiles = await db.searchUsers(cleanUsername);
      const usernameTaken = existingProfiles.some(
        (profile) =>
          profile.username?.toLowerCase() === cleanUsername.toLowerCase(),
      );
      if (usernameTaken) throw new Error("That username is already taken.");

      prepareAuthRedirect();
      await signUpWithEmail(
        cleanRegisterEmail,
        registerPassword,
        cleanUsername,
      );
      setMessage("Check your inbox to verify your Kino account.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the account.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setMessage(null);
    try {
      setLoadingAction("google");
      prepareAuthRedirect();
      await signInWithGoogle();
    } catch (caught) {
      setLoadingAction(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start Google sign-in.",
      );
    }
  }

  return (
    <Card className="border-white/[0.12] bg-kino-surface/95 shadow-[0_24px_80px_rgb(0_0_0_/_0.35)]">
      <CardHeader className="p-6 pb-4">
        <CardTitle>
          <KinoLogo priority width={132} />
        </CardTitle>
        <CardDescription>
          Sign in or create your account to sync your library across devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <Tabs
          onValueChange={(value) => {
            setTab(value as AuthTab);
            resetFeedback();
          }}
          value={tab}
        >
          <TabsList className="mb-5 grid grid-cols-2">
            <TabsTrigger value="sign-in">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form className="grid gap-4" onSubmit={handleLogin}>
              <AuthField
                autoComplete="email"
                error={
                  submitted && !loginEmailValid
                    ? "Enter a valid email address."
                    : null
                }
                id="login-email"
                label="Email"
                onChange={setLoginEmail}
                type="email"
                value={loginEmail}
              />
              {loginMethod === "password" ? (
                <AuthField
                  autoComplete="current-password"
                  error={
                    submitted && !loginPassword ? "Enter your password." : null
                  }
                  id="login-password"
                  label="Password"
                  onChange={setLoginPassword}
                  type="password"
                  value={loginPassword}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-kino-muted">
                  <input
                    checked={rememberMe}
                    className="size-4 accent-kino-accent"
                    onChange={(event) => setRememberMe(event.target.checked)}
                    type="checkbox"
                  />
                  Remember me
                </label>
                <button
                  className="font-semibold text-kino-accent hover:text-kino-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kino-accent"
                  onClick={() => {
                    setLoginMethod((current) =>
                      current === "password" ? "magic-link" : "password",
                    );
                    resetFeedback();
                  }}
                  type="button"
                >
                  {loginMethod === "password"
                    ? "Forgot password?"
                    : "Use password instead"}
                </button>
              </div>

              <StatusMessage error={error} message={message} />

              <Button disabled={!canSubmitLogin} type="submit">
                {loadingAction === "login" || loadingAction === "magic-link" ? (
                  <Skeleton className="size-4 rounded-full bg-black/20" />
                ) : (
                  <Mail size={16} />
                )}
                {loginMethod === "magic-link"
                  ? loadingAction === "magic-link"
                    ? "Sending link..."
                    : "Email me a magic link"
                  : loadingAction === "login"
                    ? "Signing in..."
                    : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form className="grid gap-4" onSubmit={handleRegister}>
              <AuthField
                autoComplete="username"
                error={submitted ? usernameError : null}
                id="register-username"
                label="Username"
                onChange={setUsername}
                value={username}
              />
              <AuthField
                autoComplete="email"
                error={
                  submitted && !registerEmailValid
                    ? "Enter a valid email address."
                    : null
                }
                id="register-email"
                label="Email"
                onChange={setRegisterEmail}
                type="email"
                value={registerEmail}
              />
              <AuthField
                autoComplete="new-password"
                error={
                  submitted && !registerPasswordValid
                    ? "Complete all password requirements."
                    : null
                }
                id="register-password"
                label="Password"
                onChange={setRegisterPassword}
                type="password"
                value={registerPassword}
              />
              <PasswordChecklist requirements={passwordState} />
              <AuthField
                autoComplete="new-password"
                error={submitted ? confirmPasswordError : null}
                id="register-confirm-password"
                label="Confirm password"
                onChange={setConfirmPassword}
                type="password"
                value={confirmPassword}
              />

              <StatusMessage error={error} message={message} />

              <Button disabled={!canSubmitRegister} type="submit">
                {loadingAction === "register" ? (
                  <Skeleton className="size-4 rounded-full bg-black/20" />
                ) : (
                  <Check size={16} />
                )}
                {loadingAction === "register"
                  ? "Creating account..."
                  : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="grid gap-3 p-6 pt-0">
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-kino-subtle">
          <span className="h-px flex-1 bg-white/10" />
          Or continue with
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <Button
          disabled={Boolean(loadingAction)}
          onClick={handleGoogleSignIn}
          type="button"
          variant="secondary"
        >
          {loadingAction === "google" ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loadingAction === "google"
            ? "Opening Google..."
            : "Continue with Google"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function AuthField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  type?: string;
  autoComplete?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <label
      className="grid gap-2 text-sm font-semibold text-kino-text"
      htmlFor={id}
    >
      {label}
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={cn(
          "min-h-11 rounded-md border bg-white/[0.04] px-3 text-base text-kino-text outline-none transition-colors placeholder:text-kino-muted/60 focus:border-kino-accent",
          error ? "border-red-400/60" : "border-white/10",
        )}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? (
        <span
          className="text-xs font-semibold text-red-300"
          id={errorId}
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

function PasswordChecklist({
  requirements,
}: {
  requirements: Array<
    (typeof passwordRequirements)[number] & { satisfied: boolean }
  >;
}) {
  return (
    <div
      className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3"
      aria-live="polite"
    >
      {requirements.map((requirement) => (
        <div
          className={cn(
            "flex items-center gap-2 text-xs font-semibold transition-colors",
            requirement.satisfied ? "text-kino-accent" : "text-kino-muted",
          )}
          key={requirement.id}
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full border transition-colors",
              requirement.satisfied
                ? "border-kino-accent bg-kino-accent text-white"
                : "border-white/10 bg-white/[0.04]",
            )}
          >
            {requirement.satisfied ? <Check size={12} /> : <X size={12} />}
          </span>
          {requirement.label}
        </div>
      ))}
    </div>
  );
}

function StatusMessage({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  if (!error && !message) return null;

  return (
    <p
      className={cn(
        "text-sm font-semibold",
        error ? "text-red-300" : "text-kino-accent",
      )}
      role="status"
    >
      {error || message}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.805 10.023h-9.58v3.955h5.502c-.237 1.275-.958 2.356-2.04 3.074v2.552h3.302c1.932-1.778 3.047-4.397 3.047-7.498 0-.717-.064-1.409-.231-2.083Z"
        fill="#4285F4"
      />
      <path
        d="M12.225 22c2.759 0 5.075-.914 6.766-2.477l-3.302-2.552c-.915.613-2.086.973-3.464.973-2.664 0-4.919-1.796-5.724-4.211H3.09v2.634C4.772 19.703 8.224 22 12.225 22Z"
        fill="#34A853"
      />
      <path
        d="M6.501 13.733a5.998 5.998 0 0 1-.313-1.91c0-.662.114-1.306.313-1.91V7.279H3.09A9.986 9.986 0 0 0 2.036 11.823c0 1.637.392 3.184 1.054 4.544l3.411-2.634Z"
        fill="#FBBC05"
      />
      <path
        d="M12.225 5.703c1.501 0 2.849.516 3.909 1.531l2.931-2.927C17.294 2.658 14.984 1.64 12.225 1.64c-4 0-7.453 2.297-9.135 5.639l3.411 2.634c.805-2.415 3.06-4.21 5.724-4.21Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getUsernameError(value: string) {
  if (!value) return "Choose a username.";
  if (value.length < 3) return "Username must be at least 3 characters.";
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    return "Use only letters, numbers, hyphens, and underscores.";
  return null;
}
