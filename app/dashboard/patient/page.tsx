import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { VideoSessionCard } from "@/components/dashboard/patient/VideoSessionCard";
import { DemoCallButton } from "@/components/demo/DemoCallButton";

export default async function PatientDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "PATIENT") {
        redirect("/dashboard");
    }

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
                <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Next Consultation</CardTitle>
                        <Calendar className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">No upcoming visits</div>
                        <p className="text-xs text-slate-500 mt-1">
                            Book a new appointment to get started.
                        </p>
                        <Link href="/book">
                            <Button className="w-full mt-4" variant="outline">
                                Schedule Now
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quick Intake</CardTitle>
                        <Clock className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Pending Actions</div>
                        <p className="text-xs text-slate-500 mt-1">
                            Complete your pre-visit forms.
                        </p>
                        <Link href="/book">
                            <Button className="w-full mt-4" variant="outline">
                                Start New Intake
                            </Button>
                        </Link>
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
