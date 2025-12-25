import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, Activity } from "lucide-react";

export default async function DoctorDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Doctor Dashboard
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    Overview of your schedule and patient queue.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white dark:bg-slate-800 shadow-sm border-blue-100 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Queue</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">3 Patients</div>
                        <p className="text-xs text-slate-500 mt-1">
                            Waiting for consultation
                        </p>
                        <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                            Start Next Visit
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8 Appointments</div>
                        <p className="text-xs text-slate-500 mt-1">
                            4 completed, 4 remaining
                        </p>
                        <Button className="w-full mt-4" variant="outline">
                            View Calendar
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Patient Status</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Active</div>
                        <p className="text-xs text-slate-500 mt-1">
                            System fully operational
                        </p>
                        <Button className="w-full mt-4" variant="ghost">
                            Check Alerts
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
