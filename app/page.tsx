import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginPage from "@/components/auth/LoginPage";

export default async function RootPage() {
  const session = await auth.api.getSession({
    headers: await headers(), // Ensure we use await headers() for new Next.js behavior
  });

  if (session) {
    redirect("/dashboard");
  }

  return <LoginPage />;
}