import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ActiveSessions } from "@/components/settings/active-sessions";

export default async function SecuritySettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Fetch active sessions for this user
  const sessions = await auth.api.listSessions({
    headers: await headers(),
  });

  const currentSessionToken = session.session.token;

  return (
    <div className="space-y-6">
      <ChangePasswordForm />
      <ActiveSessions
        sessions={sessions ?? []}
        currentSessionToken={currentSessionToken}
      />
    </div>
  );
}
