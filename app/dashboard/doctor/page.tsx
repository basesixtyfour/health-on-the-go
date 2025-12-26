import { Activity, AlertCircle, Calendar, Users, Settings, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/doctor/StatCard";
import { requireAuth } from "@/lib/api-utils";
import { redirect } from "next/navigation";
import { UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export default async function DoctorDashboard() {
    const { session } = await requireAuth();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const doctorId = session!.user.id;

    const [appointmentsToday, pendingConsultations, totalPatients, totalConsultations] = await Promise.all([
        // Appointments today (IN_CALL or PAID/scheduled)
        prisma.consultation.count({
            where: {
                doctorId: doctorId,
                scheduledStartAt: {
                    gte: today,
                    lt: tomorrow
                }
            }
        }),
        // Pending consults (PAYMENT_PENDING or PAID but not started)
        prisma.consultation.count({
            where: {
                doctorId: doctorId,
                status: { in: ["PAYMENT_PENDING", "PAID"] }
            }
        }),
        // Unique patients (approximate count of unique patientIds)
        prisma.consultation.findMany({
            where: { doctorId: doctorId },
            select: { patientId: true },
            distinct: ['patientId']
        }).then(res => res.length),
        // Completed consultations
        prisma.consultation.count({
            where: {
                doctorId: doctorId,
                status: "COMPLETED"
            }
        })
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
                <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Main Widgets Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Appointments Today"
                    value={appointmentsToday.toString()}
                    description="Scheduled for today"
                    icon={Calendar}
                />
                <StatCard
                    title="Pending Reviews"
                    value={pendingConsultations.toString()}
                    description="Requires attention"
                    icon={AlertCircle}
                    status={pendingConsultations > 0 ? "warning" : "success"}
                />
                <StatCard
                    title="Total Patients"
                    value={totalPatients.toString()}
                    description="All time unique patients"
                    icon={Users}
                />
                <StatCard
                    title="Consultations"
                    value={totalConsultations.toString()}
                    description="Completed sessions"
                    icon={Activity}
                />
            </div>

            {/* Navigation Quick Links (Optional, but good for "My Patients", "Consultations" etc) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/dashboard/doctor/schedule">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calendar className="h-5 w-5" /> Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Manage appointments and availability.</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/doctor/patients">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" /> My Patients
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">View patient records and history.</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/doctor/consultations">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Consultations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Access past consultation reports.</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/doctor/settings">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings className="h-5 w-5" /> Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Configure profile and preferences.</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
