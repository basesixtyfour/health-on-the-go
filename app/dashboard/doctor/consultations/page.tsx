import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import Link from "next/link";

export default async function DoctorConsultationsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/dashboard");
    }

    const consultations = await prisma.consultation.findMany({
        where: { doctorId: session.user.id },
        include: {
            patient: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Consultations</h1>
                <p className="text-muted-foreground">History of your consultations.</p>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-950 overflow-hidden">
                <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b bg-slate-50 dark:bg-slate-900">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Patient</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Specialty</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {consultations.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">No consultations found.</td>
                            </tr>
                        ) : (
                            consultations.map((c) => (
                                <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle whitespace-nowrap">
                                        {new Date(c.createdAt).toLocaleDateString()} <br />
                                        <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="font-medium">{c.patient.name}</div>
                                        <div className="text-xs text-muted-foreground">{c.patient.email}</div>
                                    </td>
                                    <td className="p-4 align-middle">{c.specialty}</td>
                                    <td className="p-4 align-middle">
                                        <Badge variant={
                                            c.status === 'COMPLETED' ? 'default' :
                                                c.status === 'PAID' ? 'secondary' :
                                                    c.status === 'IN_CALL' ? 'destructive' : 'outline'
                                        }>
                                            {c.status}
                                        </Badge>
                                    </td>
                                    <td className="p-4 align-middle">
                                        {['PAID', 'IN_CALL'].includes(c.status) && (
                                            <Link href={`/consultations/${c.id}/room`}>
                                                <Button size="sm" className="gap-2">
                                                    <Video className="h-4 w-4" /> Join
                                                </Button>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
