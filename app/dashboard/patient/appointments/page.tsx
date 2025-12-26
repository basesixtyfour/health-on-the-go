import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Calendar, Clock, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";
import { PayButton } from "@/components/patient/PayButton";

export default async function AppointmentsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "PATIENT") {
        redirect("/dashboard");
    }

    // Fetch all consultations for this patient
    const consultations = await prisma.consultation.findMany({
        where: { patientId: session.user.id },
        include: {
            doctor: { select: { name: true, email: true } }
        },
        orderBy: { scheduledStartAt: 'desc' }
    });

    const now = new Date();

    // Split into categories
    const upcomingConsultations = consultations.filter(
        c => c.scheduledStartAt && c.scheduledStartAt > now && ['PAID', 'IN_CALL'].includes(c.status)
    );

    // Unpaid consultations (CREATED, PAYMENT_PENDING, PAYMENT_FAILED)
    const unpaidConsultations = consultations.filter(
        c => ['CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(c.status)
    );

    const pastConsultations = consultations.filter(
        c => c.status === 'COMPLETED' || c.status === 'CANCELLED' || c.status === 'EXPIRED'
    );

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'default';
            case 'PAID': return 'secondary';
            case 'IN_CALL': return 'destructive';
            case 'CANCELLED': return 'outline';
            case 'PAYMENT_FAILED': return 'destructive';
            case 'CREATED': return 'outline';
            case 'PAYMENT_PENDING': return 'outline';
            default: return 'outline';
        }
    };

    const formatDateTime = (date: Date | null) => {
        if (!date) return 'Not scheduled';
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
                <p className="text-slate-500 mt-1">View and manage your consultations.</p>
            </div>

            {/* Upcoming Appointments */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Upcoming Appointments
                </h2>

                {upcomingConsultations.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">No upcoming appointments.</p>
                            <Link href="/book">
                                <Button className="mt-4" variant="outline">Book a Consultation</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {upcomingConsultations.map((c) => (
                            <Card key={c.id} className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{c.specialty}</CardTitle>
                                        <Badge variant={getStatusVariant(c.status)}>{c.status}</Badge>
                                    </div>
                                    <CardDescription>
                                        Dr. {c.doctor?.name || 'TBD'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span>{formatDateTime(c.scheduledStartAt)}</span>
                                    </div>
                                    {['PAID', 'IN_CALL'].includes(c.status) && (
                                        <Link href={`/video/${c.id}`}>
                                            <Button className="w-full gap-2">
                                                <Video className="h-4 w-4" />
                                                {c.status === 'IN_CALL' ? 'Rejoin Call' : 'Join Consultation'}
                                            </Button>
                                        </Link>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Unpaid Appointments - Show first with alert */}
            {unpaidConsultations.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        Payment Required
                    </h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        {unpaidConsultations.map((c) => (
                            <Card key={c.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{c.specialty}</CardTitle>
                                        <Badge variant={getStatusVariant(c.status)}>
                                            {c.status === 'PAYMENT_FAILED' ? 'Payment Failed' : 'Awaiting Payment'}
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        Dr. {c.doctor?.name || 'TBD'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span>{formatDateTime(c.scheduledStartAt)}</span>
                                    </div>
                                    <PayButton consultationId={c.id} />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Appointments */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-500" />
                    Past Appointments
                </h2>

                {pastConsultations.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">No past appointments yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="rounded-md border bg-white dark:bg-slate-950 overflow-hidden">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b bg-slate-50 dark:bg-slate-900">
                                <tr className="border-b">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Specialty</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Doctor</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pastConsultations.map((c) => (
                                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">
                                            {c.scheduledStartAt ? new Date(c.scheduledStartAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-4 align-middle">{c.specialty}</td>
                                        <td className="p-4 align-middle">Dr. {c.doctor?.name || 'N/A'}</td>
                                        <td className="p-4 align-middle">
                                            <Badge variant={getStatusVariant(c.status)}>{c.status}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
