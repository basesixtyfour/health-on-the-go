import { Calendar, Users, Settings, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorVideoSessionCard } from "@/components/dashboard/doctor/DoctorVideoSessionCard";
import { DemoCallButton } from "@/components/demo/DemoCallButton";
import { requireAuth } from "@/lib/api-utils";
import { redirect } from "next/navigation";

export default async function DoctorDashboard() {
    const { session } = await requireAuth();

    if (!session) {
        redirect("/");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
                <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Active Video Sessions Section */}
            <div className="grid gap-4 md:grid-cols-2">
                <DoctorVideoSessionCard userId={session.user.id} />

                {/* Demo Mode Button - Only for hackathon demonstrations */}
                {process.env.DEMO_MODE === 'true' && <DemoCallButton />}
            </div>

            {/* Navigation Quick Links */}
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
