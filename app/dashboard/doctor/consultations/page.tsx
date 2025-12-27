import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import Link from "next/link";
import { getEffectiveStatus, isConsultationJoinable, isConsultationExpired } from "@/lib/consultation-utils";

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
                            consultations.map((c) => {
                                const now = Date.now();
                                const effectiveStatus = getEffectiveStatus(c, now);
                                const canJoin = isConsultationJoinable(c, now);
                                return (
                                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle whitespace-nowrap">
                                            {c.scheduledStartAt ? (
                                                <>
                                                    {new Date(c.scheduledStartAt).toLocaleDateString()} <br />
                                                    <span className="text-xs text-muted-foreground">{new Date(c.scheduledStartAt).toLocaleTimeString()}</span>
                                                </>
                                            ) : (
                                                <>
                                                    {new Date(c.createdAt).toLocaleDateString()} <br />
                                                    <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString()}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="font-medium">{c.patient.name}</div>
                                            <div className="text-xs text-muted-foreground">{c.patient.email}</div>
                                        </td>
                                        <td className="p-4 align-middle">{c.specialty}</td>
                                        <td className="p-4 align-middle">
                                            <Badge variant={
                                                effectiveStatus === 'COMPLETED' ? 'default' :
                                                    effectiveStatus === 'PAID' ? 'secondary' :
                                                        effectiveStatus === 'IN_CALL' ? 'destructive' :
                                                            effectiveStatus === 'EXPIRED' ? 'outline' : 'outline'
                                            }>
                                                {effectiveStatus}
                                            </Badge>
                                        </td>
                                        <td className="p-4 align-middle">
                                            {canJoin && (
                                                <Link href={`/video/${c.id}`}>
                                                    <Button size="sm" className="gap-2">
                                                        <Video className="h-4 w-4" /> {c.status === 'IN_CALL' ? 'Rejoin' : 'Join'}
                                                    </Button>
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
