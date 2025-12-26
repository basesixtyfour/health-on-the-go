import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video } from "lucide-react";
import { VideoSessionCard } from "@/components/dashboard/patient/VideoSessionCard";
import { DemoCallButton } from "@/components/demo/DemoCallButton";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@/app/generated/prisma/client";

export default async function PatientDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "PATIENT") {
        redirect("/dashboard");
    }

    const userId = session.user.id;

    // Fetch upcoming consultations (PAID status, scheduled in the future)
    const upcomingConsultations = await prisma.consultation.findMany({
        where: {
            patientId: userId,
            status: { in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL] },
            scheduledStartAt: { gte: new Date() }
        },
        include: {
            doctor: { select: { name: true } }
        },
        orderBy: { scheduledStartAt: 'asc' },
        take: 1
    });

    // Fetch pending consultations (CREATED or PAYMENT_PENDING - need action)
    const pendingConsultations = await prisma.consultation.findMany({
        where: {
            patientId: userId,
            status: { in: [ConsultationStatus.CREATED, ConsultationStatus.PAYMENT_PENDING] }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    const nextConsultation = upcomingConsultations[0];
    const pendingCount = pendingConsultations.length;

    // Format the next consultation date/time
    const formatDateTime = (date: Date) => {
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days === 0) {
            if (hours === 0) return "Starting soon";
            return `In ${hours} hour${hours > 1 ? 's' : ''}`;
        } else if (days === 1) {
            return "Tomorrow";
        } else {
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Welcome back, {session.user.name}
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    Manage your health journey from here.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Next Consultation Card */}
                <Card className={`shadow-sm ${nextConsultation ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${nextConsultation ? 'text-blue-800 dark:text-blue-200' : ''}`}>
                            Next Consultation
                        </CardTitle>
                        <Calendar className={`h-4 w-4 ${nextConsultation ? 'text-blue-600' : 'text-slate-500'}`} />
                    </CardHeader>
                    <CardContent>
                        {nextConsultation ? (
                            <>
                                <div className={`text-2xl font-bold ${nextConsultation ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                                    {formatDateTime(nextConsultation.scheduledStartAt!)}
                                </div>
                                <p className={`text-xs mt-1 ${nextConsultation ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}>
                                    {nextConsultation.specialty}
                                    {nextConsultation.doctor?.name && ` • ${nextConsultation.doctor.name}`}
                                </p>
                                <Link href={`/video/${nextConsultation.id}`}>
                                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700" variant="default">
                                        <Video className="h-4 w-4 mr-2" />
                                        View Details
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">No upcoming visits</div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Book a new appointment to get started.
                                </p>
                                <Link href="/book">
                                    <Button className="w-full mt-4" variant="outline">
                                        Schedule Now
                                    </Button>
                                </Link>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Pending Actions Card */}
                <Card className={`shadow-sm ${pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${pendingCount > 0 ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                            Pending Actions
                        </CardTitle>
                        <Clock className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                    </CardHeader>
                    <CardContent>
                        {pendingCount > 0 ? (
                            <>
                                <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-900 dark:text-amber-100' : ''}`}>
                                    {pendingCount} Pending
                                </div>
                                <p className={`text-xs mt-1 ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}`}>
                                    Complete payment to confirm booking.
                                </p>
                                <Link href="/book">
                                    <Button className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white" variant="default">
                                        Complete Booking
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">All Clear!</div>
                                <p className="text-xs text-slate-500 mt-1">
                                    No pending actions at this time.
                                </p>
                                <Link href="/book">
                                    <Button className="w-full mt-4" variant="outline">
                                        Start New Intake
                                    </Button>
                                </Link>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Video Sessions - Dynamic based on user's consultations */}
                <VideoSessionCard userId={session.user.id} />

                {/* Demo Mode Button - Only for hackathon demonstrations */}
                {process.env.DEMO_MODE === 'true' && <DemoCallButton />}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/dashboard/patient/appointments">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <CardHeader>
                            <CardTitle>Appointments</CardTitle>
                            <CardDescription>View your history</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
                <Link href="/dashboard/patient/records">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <CardHeader>
                            <CardTitle>Medical Records</CardTitle>
                            <CardDescription>Access your documents</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
                <Link href="/dashboard/patient/settings">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>Manage account</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}

