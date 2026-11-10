import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { setToken, deleteToken } from "@/lib/wails-bridge";
import type { User } from "@/lib/auth-provider";

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

// The API wraps auth payloads as:
//   { "data": { "user": {...}, "tokens": { access_token, refresh_token, expires_at } } }
// apiClient hands us the body, so mutationFn returns data.data — i.e. this shape.
// Reading access_token off the top level (the old bug) stored an undefined token,
// which made /app's beforeLoad bounce straight back to /auth/login after a
// *successful* login.
interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export function useMe() {
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await apiClient.get("/auth/me");
      return data.data;
    },
    retry: false,
  });
}

// A login ends either signed in, or holding a short-lived pending token
// because the account has 2FA on and this device is not trusted.
export interface TOTPChallenge {
  totp_required: true;
  pending_token: string;
}

function isChallenge(d: AuthResponse | TOTPChallenge): d is TOTPChallenge {
  return (d as TOTPChallenge).totp_required === true;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<AuthResponse | TOTPChallenge> => {
      const { data } = await apiClient.post("/auth/login", input);
      return data.data;
    },
    onSuccess: async (data) => {
      // Reading data.tokens unguarded is what used to break: on a 2FA account
      // that field does not exist, so the desktop app threw instead of asking
      // for a code, leaving those users unable to sign in at all.
      if (isChallenge(data)) return;
      await setToken("access_token", data.tokens.access_token);
      await setToken("refresh_token", data.tokens.refresh_token);
      qc.setQueryData(["me"], data.user);
    },
  });
}

// Completes a login that stopped at the 2FA prompt. An authenticator code and
// a backup code differ only by endpoint, so one hook covers both.
export function useVerifyTOTP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pending_token: string;
      code: string;
      trust_device?: boolean;
      backup?: boolean;
    }): Promise<AuthResponse> => {
      const path = input.backup
        ? "/auth/totp/backup-codes/verify"
        : "/auth/totp/verify";
      const { data } = await apiClient.post(path, {
        pending_token: input.pending_token,
        code: input.code.trim(),
        trust_device: input.trust_device ?? false,
      });
      return data.data;
    },
    onSuccess: async (data) => {
      await setToken("access_token", data.tokens.access_token);
      await setToken("refresh_token", data.tokens.refresh_token);
      qc.setQueryData(["me"], data.user);
    },
  });
}

/* ── Two-factor enrolment ──────────────────────────────────────────────
   The challenge half shipped first, which left desktop users able to sign in
   with 2FA but only able to turn it on from the admin panel. These close that.

   The QR is rendered server-side as a PNG data URI, so no QR encoder ships in
   the desktop bundle. */

export interface TOTPStatus {
  enabled: boolean;
  backup_codes_remaining: number;
  trusted_devices: number;
}

export function useTOTPStatus() {
  return useQuery({
    queryKey: ["totp-status"],
    queryFn: async (): Promise<TOTPStatus> => {
      const { data } = await apiClient.get("/auth/totp/status");
      return data.data;
    },
  });
}

export function useTOTPSetup() {
  return useMutation({
    mutationFn: async (): Promise<{ secret: string; uri: string; qr_code: string }> => {
      const { data } = await apiClient.post("/auth/totp/setup", {});
      return data.data;
    },
  });
}

export function useEnableTOTP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { secret: string; code: string }): Promise<{ backup_codes: string[] }> => {
      const { data } = await apiClient.post("/auth/totp/enable", {
        secret: input.secret,
        code: input.code.trim(),
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["totp-status"] }),
  });
}

export function useDisableTOTP() {
  const qc = useQueryClient();
  return useMutation({
    // Re-authenticating with a password is the point: an unlocked machine
    // should not be enough to take the second factor off an account.
    mutationFn: async (password: string) => {
      const { data } = await apiClient.post("/auth/totp/disable", { password });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["totp-status"] }),
  });
}

export function useRegenerateBackupCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ backup_codes: string[] }> => {
      const { data } = await apiClient.post("/auth/totp/backup-codes", {});
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["totp-status"] }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<AuthResponse> => {
      const { data } = await apiClient.post("/auth/register", input);
      return data.data;
    },
    onSuccess: async (data) => {
      await setToken("access_token", data.tokens.access_token);
      await setToken("refresh_token", data.tokens.refresh_token);
      qc.setQueryData(["me"], data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.post("/auth/logout");
      } catch {
        // Best-effort — continue cleanup even if server call fails
      }
      await deleteToken("access_token");
      await deleteToken("refresh_token");
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}
