import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ConsultationsPage from "@/components/admin/ConsultationsPage";

export default async function AdminConsultationsWrapper() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    return <ConsultationsPage />;
}
