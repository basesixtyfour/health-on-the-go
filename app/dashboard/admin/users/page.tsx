import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UsersPage from "@/components/admin/UsersPage";

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ role?: string; query?: string }>;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const params = await searchParams;
    const roleFilter = params.role as "PATIENT" | "DOCTOR" | "ADMIN" | undefined;
    const searchQuery = params.query;

    return <UsersPage initialRoleFilter={roleFilter} initialSearch={searchQuery} />;
}
