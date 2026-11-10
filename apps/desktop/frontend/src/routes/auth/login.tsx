import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useLogin, useVerifyTOTP } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { authInputCls, authInputStyle, AuthSubmit } from "@/components/auth/AuthField";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});

type LoginInput = z.infer<typeof LoginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();
  const { mutate: verifyTOTP, isPending: verifying, error: verifyError } = useVerifyTOTP();
  const [showPassword, setShowPassword] = useState(false);
  // Set when the password was right and the account owes a 2FA code.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  // "app" or "email": which second factor this account uses, as the
  // sign-in response reported it.
  const [factorMethod, setFactorMethod] = useState("app");
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = (data: LoginInput) => {
    login(data, {
      onSuccess: (res) => {
        const d = res as { totp_required?: boolean; pending_token?: string; method?: string };
        if (d?.totp_required && d.pending_token) {
          setPendingToken(d.pending_token);
          // Which factor this account uses. Empty means an authenticator: that
          // is what every account meant before codes by email existed.
          setFactorMethod(d.method ?? "app");
          return;
        }
        navigate({ to: "/app" });
      },
    });
  };

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    verifyTOTP(
      { pending_token: pendingToken, code, trust_device: trustDevice, backup: useBackup },
      { onSuccess: () => navigate({ to: "/app" }) }
    );
  };

  // Replaces the credentials form rather than sitting under it, so there is
  // one obvious thing to do.
  if (pendingToken) {
    const enough = code.trim().length >= (useBackup ? 8 : 6);
    return (
      <AuthShell
        mode="login"
        title="Two-factor authentication"
        subtitle={
          useBackup
            ? "Enter one of your backup codes"
            : factorMethod === "email"
              ? "We emailed you a 6-digit code. It expires in a few minutes."
              : "Enter the 6-digit code from your authenticator app"
        }
        errorMessage={
          verifyError ? ((verifyError as Error).message || "That code was not accepted") : undefined
        }
      >
        <form onSubmit={onVerify} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="totp-code" className="block text-sm font-medium">
              {useBackup ? "Backup code" : "Authentication code"}
            </label>
            <input
              id="totp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={authInputCls + " text-center tracking-[0.4em] text-lg"}
              style={authInputStyle}
              placeholder={useBackup ? "XXXXXXXX" : "000000"}
              inputMode={useBackup ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={useBackup ? 8 : 6}
              autoFocus
            />
          </div>

          {!useBackup && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Trust this device for 30 days
            </label>
          )}

          <AuthSubmit disabled={verifying || !enough}>
            {verifying ? (<><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>) : "Verify and sign in"}
          </AuthSubmit>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setUseBackup(!useBackup); setCode(""); }}
              className="text-accent hover:underline"
            >
              {useBackup ? "Use your authenticator app" : "Use a backup code"}
            </button>
            <button
              type="button"
              onClick={() => { setPendingToken(null); setCode(""); setUseBackup(false); }}
              className="text-text-secondary hover:underline"
            >
              Back
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to your account"
      errorMessage={error ? ((error as Error).message || "Invalid email or password") : undefined}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            className={authInputCls}
            style={authInputStyle}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-[#dc2626]">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={authInputCls + " pr-10"}
              style={authInputStyle}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-[#dc2626]">{errors.password.message}</p>}
        </div>

        <AuthSubmit disabled={isPending}>
          {isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>) : "Sign In"}
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
