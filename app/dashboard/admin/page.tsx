import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Users, FileText, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/app/generated/prisma/client";

export default async function AdminDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const [userCount, doctorCount, consultationCount, auditCount] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: UserRole.DOCTOR } }),
        prisma.consultation.count(),
        prisma.auditEvent.count()
    ]);

    const stats = [
        {
            title: "Total Users",
            value: userCount,
            icon: Users,
            description: "Registered accounts"
        },
        {
            title: "Active Doctors",
            value: doctorCount,
            icon: Activity,
            description: "Verified practitioners"
        },
        {
            title: "Total Consultations",
            value: consultationCount,
            icon: FileText,
            description: "All time records"
        },
        {
            title: "System Events",
            value: auditCount,
            icon: ShieldCheck,
            description: "Audit log entries"
        }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Admin Dashboard
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    System administration and oversight.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={index} className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    {stat.title}
                                </CardTitle>
                                <Icon className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {stat.value.toLocaleString()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {stat.description}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
