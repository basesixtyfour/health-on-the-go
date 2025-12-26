import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ConsultationsPage from "@/components/admin/ConsultationsPage";

export default async function AdminConsultationsWrapper({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; filter?: string }>;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const params = await searchParams;

    return (
        <ConsultationsPage
            initialStatus={params.status}
            initialFilter={params.filter}
        />
    );
}
