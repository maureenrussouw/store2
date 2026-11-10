import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User as UserIcon, Briefcase, Lock, Upload, Loader2, Save, Trash2, ShieldCheck, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PasswordStrength } from "@/components/password-strength";
import { useConfirm } from "@/components/confirm-dialog";
import {
  useMe,
  useLogout,
  useTOTPStatus,
  useTOTPSetup,
  useEnableTOTP,
  useDisableTOTP,
  useRegenerateBackupCodes,
} from "@/hooks/use-auth";
import { apiClient, uploadFile } from "@/lib/api-client";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const cardCls = "rounded-xl border border-border bg-surface p-6";

function Section({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className={cardCls}>
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          <p className="text-[12px] text-foreground-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* Recovery codes exist for exactly one render - the server keeps only hashes.
   The panel therefore refuses to close until they have been copied or saved,
   because "grab them later" is not something the API can honour. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
    } catch {
      // Clipboard access can be refused. Mark them saved anyway - refusing
      // would trap the user in a panel with no exit, and Download still works.
    }
    setSaved(true);
  };

  const download = () => {
    const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/[0.06] p-4">
      <p className="mb-1 text-[13px] font-semibold text-foreground">Save your backup codes</p>
      <p className="mb-3 text-[12px] text-foreground-muted">
        Each code works once, if you lose your authenticator. This is the only time they are
        shown.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-[13px]">
        {codes.map((c) => (
          <div key={c} className="rounded bg-surface-2 px-3 py-1.5 text-center tracking-wider">
            {c}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-hover">
          {saved ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
        </button>
        <button onClick={download} className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-hover">
          Download
        </button>
        <button
          onClick={onDone}
          disabled={!saved}
          title={saved ? undefined : "Copy or download them first"}
          className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          I have saved them
        </button>
      </div>
    </div>
  );
}

function TwoFactorSection() {
  const { data: status, isLoading } = useTOTPStatus();
  const setup = useTOTPSetup();
  const enable = useEnableTOTP();
  const disable = useDisableTOTP();
  const regenerate = useRegenerateBackupCodes();

  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errText = (e: unknown) =>
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? "Something went wrong";

  const startSetup = () => {
    setError(null);
    setup.mutate(undefined, {
      onSuccess: (d) => { setSecret(d.secret); setQr(d.qr_code); },
      onError: (e) => setError(errText(e)),
    });
  };

  const confirmEnable = () => {
    if (!secret) return;
    setError(null);
    enable.mutate({ secret, code }, {
      onSuccess: (d) => { setCodes(d.backup_codes); setSecret(null); setQr(null); setCode(""); },
      onError: (e) => setError(errText(e)),
    });
  };

  return (
    <Section
      icon={ShieldCheck}
      title="Two-factor authentication"
      description={
        isLoading
          ? "Checking..."
          : status?.enabled
            ? "On - a code from your authenticator app is required to sign in."
            : "Off - your password alone signs you in."
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}

        {codes && <BackupCodes codes={codes} onDone={() => setCodes(null)} />}

        {!isLoading && !status?.enabled && !secret && !codes && (
          <button
            onClick={startSetup}
            disabled={setup.isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {setup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Turn on two-factor
          </button>
        )}

        {secret && qr && (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            {/* Rendered by the API, so no QR encoder ships in this bundle. */}
            <div className="rounded-lg border border-border bg-white p-3">
              <img src={qr} alt="Two-factor setup QR code" width={168} height={168} />
            </div>
            <div className="min-w-0 space-y-3">
              <p className="text-[12px] text-foreground-muted">
                Scan this with Google Authenticator, 1Password, Authy or similar. Cannot scan?
                Enter this key by hand:
              </p>
              <code className="block break-all rounded bg-surface-2 px-3 py-2 font-mono text-[11px] text-foreground">
                {secret}
              </code>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-32 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center font-mono tracking-[0.3em] text-foreground outline-none focus:border-accent"
                />
                <button
                  onClick={confirmEnable}
                  disabled={enable.isPending || code.trim().length !== 6}
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Verify and turn on
                </button>
                <button
                  onClick={() => { setSecret(null); setQr(null); setCode(""); }}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {status?.enabled && !codes && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[12px] text-foreground-muted">
                {status.backup_codes_remaining} backup code
                {status.backup_codes_remaining === 1 ? "" : "s"} left
              </span>
              <button
                onClick={() => regenerate.mutate(undefined, {
                  onSuccess: (d) => setCodes(d.backup_codes),
                  onError: (e) => setError(errText(e)),
                })}
                disabled={regenerate.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-hover disabled:opacity-50"
              >
                Generate new codes
              </button>
            </div>

            <div className="border-t border-border pt-4">
              {disabling ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-56 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => {
                      setError(null);
                      disable.mutate(password, {
                        onSuccess: () => { setDisabling(false); setPassword(""); },
                        onError: (e) => setError(errText(e)),
                      });
                    }}
                    disabled={disable.isPending || !password}
                    className="rounded-lg bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Turn off two-factor
                  </button>
                  <button
                    onClick={() => { setDisabling(false); setPassword(""); }}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setDisabling(true)} className="text-[13px] text-danger hover:underline">
                  Turn off two-factor authentication
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function ProfilePage() {
  const { data: user } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const askConfirm = useConfirm();
  const avatarRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setEmail(user.email ?? "");
    setJobTitle((user as any).job_title ?? "");
    setBio((user as any).bio ?? "");
  }, [user]);

  const update = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.put("/profile", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
  const del = useMutation({
    mutationFn: () => apiClient.delete("/profile"),
    onSuccess: () => logout(undefined, { onSuccess: () => navigate({ to: "/auth/login" }) }),
  });

  const onAvatar = async (file: File) => {
    setUploading(true);
    try {
      const ref = await uploadFile(file);
      update.mutate({ avatar: ref.url });
    } finally {
      setUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const savePassword = () => {
    setPwError("");
    if (password.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setPwError("Passwords do not match"); return; }
    update.mutate({ password }, { onSuccess: () => { setPassword(""); setConfirm(""); } });
  };

  const avatarUrl = (user as any)?.avatar as string | undefined;

  return (
    <div>
      <PageHeader title="Profile" description="Manage your personal details, job profile, and password." />

      <div className="mt-6 max-w-3xl space-y-4">
        {/* Profile picture */}
        <div className={cardCls}>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-accent/20">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xl font-semibold text-accent">{user?.first_name?.charAt(0)?.toUpperCase() || "?"}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
              <p className="text-[13px] text-foreground-secondary">{user?.email}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">{user?.role}</p>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAvatar(f); }} />
            <button onClick={() => avatarRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload new
            </button>
          </div>
        </div>

        {/* Personal */}
        <Section icon={UserIcon} title="Personal information" description="Your name and primary email address.">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">First name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">Last name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">Email</label>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button onClick={() => update.mutate({ first_name: firstName, last_name: lastName, email })} disabled={update.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                <Save className="h-4 w-4" /> Save changes
              </button>
            </div>
          </div>
        </Section>

        {/* Professional */}
        <Section icon={Briefcase} title="Professional information" description="What you do, and a short bio teammates and customers can see.">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">Job title</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Software Engineer" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="A short bio about yourself..." className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button onClick={() => update.mutate({ job_title: jobTitle, bio })} disabled={update.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                <Save className="h-4 w-4" /> Save changes
              </button>
            </div>
          </div>
        </Section>

        {/* Password */}
        <Section icon={Lock} title="Password" description="Choose a new password that's at least 8 characters long.">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">New password</label>
                <input type="password" autoComplete="new-password" aria-describedby="password-strength" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-foreground-muted">Confirm password</label>
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" className={inputCls} />
              </div>
            </div>
            <PasswordStrength value={password} />
            {pwError && <p className="text-[12px] text-danger">{pwError}</p>}
            <div className="flex justify-end">
              <button onClick={savePassword} disabled={update.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                <Lock className="h-4 w-4" /> Update password
              </button>
            </div>
          </div>
        </Section>

        <TwoFactorSection />

        {/* Delete account */}
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Delete account</h3>
              <p className="text-[12px] text-foreground-muted">Permanently remove your account and all associated data. This action cannot be undone.</p>
            </div>
            <button onClick={async () => { if (await askConfirm({ title: "Delete account", message: "Permanently remove your account and all associated data. This action cannot be undone.", danger: true, confirmLabel: "Delete account" })) del.mutate(); }} className="flex shrink-0 items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-[13px] font-semibold text-danger hover:bg-danger/10">
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
