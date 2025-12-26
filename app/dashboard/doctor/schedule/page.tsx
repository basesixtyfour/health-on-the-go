import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ScheduleManager from "@/components/doctor/ScheduleManager";

export default async function DoctorSchedulePage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Schedule Management</h1>
                <p className="text-muted-foreground">Manage your availability for consultations.</p>
            </div>
            <ScheduleManager />
        </div>
    );
}
