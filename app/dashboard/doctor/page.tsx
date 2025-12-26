import { Activity, AlertCircle, Calendar, Users, Settings, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/doctor/StatCard";
import { DoctorVideoSessionCard } from "@/components/dashboard/doctor/DoctorVideoSessionCard";
import { DemoCallButton } from "@/components/demo/DemoCallButton";
import { requireAuth } from "@/lib/api-utils";
import { redirect } from "next/navigation";
import { UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export default async function DoctorDashboard() {
    const { session } = await requireAuth();

    if (!session) {
        redirect("/");
    }
    // Use UTC for consistent timezone handling
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    const doctorId = session.user.id;

    // Default values in case of DB errors
    let appointmentsToday = 0;
    let pendingConsultations = 0;
    let totalPatients = 0;
    let totalConsultations = 0;

    try {
        const results = await Promise.all([
            // Appointments today (IN_CALL or PAID/scheduled)
            prisma.consultation.count({
                where: {
                    doctorId: doctorId,
                    scheduledStartAt: {
                        gte: todayUTC,
                        lt: tomorrowUTC
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
            // Unique patients - efficient count using raw SQL
            prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(DISTINCT "patientId") as count 
                FROM "Consultation" 
                WHERE "doctorId" = ${doctorId}
            `.then(res => Number(res[0]?.count ?? 0)),
            // Completed consultations
            prisma.consultation.count({
                where: {
                    doctorId: doctorId,
                    status: "COMPLETED"
                }
            })
        ]);

        [appointmentsToday, pendingConsultations, totalPatients, totalConsultations] = results;
    } catch (error) {
        console.error("Doctor Dashboard: Failed to fetch stats", error);
        // Continue with default values (0s) so page still renders
    }

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

            {/* Active Video Sessions Section */}
            <div className="grid gap-4 md:grid-cols-2">
                <DoctorVideoSessionCard userId={session.user.id} />
                
                {/* Demo Mode Button - Only for hackathon demonstrations */}
                {process.env.DEMO_MODE === 'true' && <DemoCallButton />}
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
