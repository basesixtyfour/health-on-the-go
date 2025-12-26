import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield, Stethoscope, Users, Activity } from "lucide-react";

export default async function DoctorSettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/dashboard");
    }

    // Fetch user details
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            createdAt: true,
            emailVerified: true
        }
    });

    if (!user) {
        redirect("/dashboard");
    }

    // Get doctor stats
    const [totalConsultations, completedConsultations, uniquePatients] = await Promise.all([
        prisma.consultation.count({
            where: { doctorId: session.user.id }
        }),
        prisma.consultation.count({
            where: { doctorId: session.user.id, status: 'COMPLETED' }
        }),
        prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT "patientId") as count 
            FROM "Consultation" 
            WHERE "doctorId" = ${session.user.id}
        `.then(res => Number(res[0]?.count ?? 0))
    ]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your profile and preferences.</p>
            </div>

            {/* Profile Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Information
                    </CardTitle>
                    <CardDescription>Your account details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={user.image || ""} />
                            <AvatarFallback className="text-2xl">{user.name?.charAt(0) ?? '?'}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{user.name}</h3>
                            <p className="text-muted-foreground flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {user.email}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    <Stethoscope className="h-3 w-3" />
                                    {user.role}
                                </Badge>
                                {user.emailVerified && (
                                    <Badge variant="outline" className="text-green-600 border-green-600">
                                        <Shield className="h-3 w-3 mr-1" />
                                        Verified
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Practice Statistics</CardTitle>
                    <CardDescription>Your consultation metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Member Since
                            </p>
                            <p className="text-lg font-semibold">
                                {new Date(user.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short'
                                })}
                            </p>
                        </div>
                        <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Total Consultations
                            </p>
                            <p className="text-2xl font-bold">{totalConsultations}</p>
                        </div>
                        <div className="space-y-1 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Completed
                            </p>
                            <p className="text-2xl font-bold text-green-600">{completedConsultations}</p>
                        </div>
                        <div className="space-y-1 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Unique Patients
                            </p>
                            <p className="text-2xl font-bold text-blue-600">{uniquePatients}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b">
                            <div>
                                <p className="font-medium">Email Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive updates about consultations</p>
                            </div>
                            <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b">
                            <div>
                                <p className="font-medium">New Patient Alerts</p>
                                <p className="text-sm text-muted-foreground">Get notified when assigned new patients</p>
                            </div>
                            <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium">Availability Calendar Sync</p>
                                <p className="text-sm text-muted-foreground">Sync with external calendar apps</p>
                            </div>
                            <Badge variant="outline">Coming Soon</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
