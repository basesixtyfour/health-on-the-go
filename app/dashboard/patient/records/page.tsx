import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, User } from "lucide-react";
import { formatDoctorName } from "@/lib/api-utils";

export default async function MedicalRecordsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "PATIENT") {
        redirect("/dashboard");
    }

    // Fetch completed consultations
    const completedConsultations = await prisma.consultation.findMany({
        where: {
            patientId: session.user.id,
            status: 'COMPLETED'
        },
        include: {
            doctor: { select: { name: true } },
            patientIntake: true
        },
        orderBy: { endedAt: 'desc' }
    });

    // Fetch all consultations with intake forms
    const consultationsWithIntake = await prisma.consultation.findMany({
        where: {
            patientId: session.user.id,
            patientIntake: { isNot: null }
        },
        include: {
            patientIntake: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Medical Records</h1>
                <p className="text-slate-500 mt-1">Access your consultation history and intake forms.</p>
            </div>

            {/* Completed Consultations Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Completed Consultations
                </h2>

                {completedConsultations.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">No completed consultations yet.</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your consultation history will appear here after sessions are completed.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {completedConsultations.map((c) => (
                            <Card key={c.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{c.specialty} Consultation</CardTitle>
                                        <Badge variant="default">Completed</Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-4">
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {formatDoctorName(c.doctor?.name)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {c.endedAt ? new Date(c.endedAt).toLocaleDateString() :
                                                c.scheduledStartAt ? new Date(c.scheduledStartAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {c.patientIntake ? (
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Chief Complaint:</p>
                                            <p className="text-sm">{c.patientIntake.chiefComplaint || 'Not specified'}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">
                                            No intake information recorded for this consultation.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Intake Forms Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Intake Forms
                </h2>

                {consultationsWithIntake.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">No intake forms submitted yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {consultationsWithIntake.map((c) => (
                            <Card key={c.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">{c.specialty} Intake</CardTitle>
                                    <CardDescription>
                                        Submitted on {new Date(c.patientIntake!.createdAt).toLocaleDateString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-muted-foreground">Name/Alias:</span>
                                            <p>{c.patientIntake!.nameOrAlias}</p>
                                        </div>
                                        {c.patientIntake!.ageRange && (
                                            <div>
                                                <span className="font-medium text-muted-foreground">Age Range:</span>
                                                <p>{c.patientIntake!.ageRange}</p>
                                            </div>
                                        )}
                                        {c.patientIntake!.chiefComplaint && (
                                            <div>
                                                <span className="font-medium text-muted-foreground">Chief Complaint:</span>
                                                <p>{c.patientIntake!.chiefComplaint}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
