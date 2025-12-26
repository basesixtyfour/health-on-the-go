import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function DoctorPatientsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/dashboard");
    }

    // Fetch unique patients for this doctor
    const consultations = await prisma.consultation.findMany({
        where: { doctorId: session.user.id },
        select: {
            patient: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true
                }
            },
            createdAt: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // Deduplicate patients
    const patientMap = new Map();
    consultations.forEach(c => {
        if (!patientMap.has(c.patient.id)) {
            patientMap.set(c.patient.id, {
                ...c.patient,
                lastVisit: c.createdAt
            });
        }
    });

    const patients = Array.from(patientMap.values());

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Patients</h1>
                <p className="text-muted-foreground">List of patients you have consulted with.</p>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-950">
                <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Patient</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Last Visit</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-muted-foreground">No patients found.</td>
                            </tr>
                        ) : (
                            patients.map((patient) => (
                                <tr key={patient.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={patient.image || ""} />
                                                <AvatarFallback>{patient.name?.charAt(0) ?? '?'}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{patient.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">{patient.email}</td>
                                    <td className="p-4 align-middle">{new Date(patient.lastVisit).toLocaleDateString()}</td>
                                    <td className="p-4 align-middle">{new Date(patient.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
