import AdminLoginForm from "@/components/admin-login-form";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";

export const metadata = {
  title: "Login - OpenReply",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            OpenReply
          </h1>
          <p className="text-muted text-sm leading-relaxed mt-2">
            Sign in to manage your Instagram automations.
          </p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          <AdminLoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  );
}
