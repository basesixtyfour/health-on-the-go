import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/");
    }

    const role = session.user.role?.toUpperCase();

    if (role === "DOCTOR") {
        redirect("/dashboard/doctor");
    } else if (role === "PATIENT") {
        redirect("/dashboard/patient");
    } else if (role === "ADMIN") {
        redirect("/dashboard/admin");
    } else {
        // Fallback or error page
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <h1 className="text-2xl font-bold text-red-500">Access Error</h1>
                <p className="mt-2 text-slate-600">
                    Your account does not have a recognized role. Please contact support.
                </p>
            </div>
        );
    }
}
