import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/settings/account-form";

export default async function AccountSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <AccountForm
      initialData={{
        name: session.user.name || "",
        email: session.user.email,
      }}
    />
  );
}
