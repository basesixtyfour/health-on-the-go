import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";

export default async function SettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "PATIENT") {
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

    // Get consultation stats
    const consultationCount = await prisma.consultation.count({
        where: { patientId: session.user.id }
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your account and preferences.</p>
            </div>

            {/* Profile Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Information
                    </CardTitle>
                    <CardDescription>Your account details and preferences.</CardDescription>
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
                                <Badge variant="secondary">{user.role}</Badge>
                                {user.emailVerified && (
                                    <Badge variant="outline" className="text-green-600 border-green-600">
                                        <Shield className="h-3 w-3 mr-1" />
                                        Verified
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                            <p className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(user.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Total Consultations</p>
                            <p className="text-2xl font-bold">{consultationCount}</p>
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
                                <p className="text-sm text-muted-foreground">Receive updates about your consultations</p>
                            </div>
                            <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b">
                            <div>
                                <p className="font-medium">SMS Reminders</p>
                                <p className="text-sm text-muted-foreground">Get text reminders before appointments</p>
                            </div>
                            <Badge variant="outline">Coming Soon</Badge>
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium">Two-Factor Authentication</p>
                                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                            </div>
                            <Badge variant="outline">Coming Soon</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
