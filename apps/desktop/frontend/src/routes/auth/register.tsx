import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useRegister } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { authInputCls, authInputStyle, AuthSubmit } from "@/components/auth/AuthField";
import { PasswordStrength } from "@/components/password-strength";

export const Route = createFileRoute("/auth/register")({
  component: RegisterPage,
});

const RegisterSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Minimum 8 characters"),
});

type RegisterInput = z.infer<typeof RegisterSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const { mutate: registerUser, isPending, error } = useRegister();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = (data: RegisterInput) => {
    registerUser(data, { onSuccess: () => navigate({ to: "/app" }) });
  };

  return (
    <AuthShell
      mode="sign-up"
      title="Create your account"
      subtitle="Get started in less than a minute"
      errorMessage={error ? ((error as Error).message || "Could not create your account") : undefined}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">First name</label>
            <input type="text" placeholder="Jane" className={authInputCls} style={authInputStyle} {...register("first_name")} />
            {errors.first_name && <p className="text-xs text-[#dc2626]">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Last name</label>
            <input type="text" placeholder="Doe" className={authInputCls} style={authInputStyle} {...register("last_name")} />
            {errors.last_name && <p className="text-xs text-[#dc2626]">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Email</label>
          <input type="email" autoComplete="username" placeholder="you@example.com" className={authInputCls} style={authInputStyle} {...register("email")} />
          {errors.email && <p className="text-xs text-[#dc2626]">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Password</label>
          <input type="password" autoComplete="new-password" aria-describedby="password-strength" placeholder="At least 8 characters" className={authInputCls} style={authInputStyle} {...register("password")} />
          {errors.password && <p className="text-xs text-[#dc2626]">{errors.password.message}</p>}
          <PasswordStrength
            value={watch("password") ?? ""}
            about={[watch("email") ?? "", watch("first_name") ?? "", watch("last_name") ?? ""]}
          />
        </div>

        <AuthSubmit disabled={isPending}>
          {isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>) : "Create account"}
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
