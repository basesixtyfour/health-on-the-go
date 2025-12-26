import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    ShieldCheck,
    Users,
    FileText,
    Activity,
    DollarSign,
    UserPlus,
    Calendar,
    Clock,
    ArrowRight,
    Stethoscope,
    ClipboardList
} from "lucide-react";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { prisma } from "@/lib/prisma";
import { UserRole, ConsultationStatus, PaymentStatus } from "@/app/generated/prisma/client";
import { formatDistanceToNow } from "date-fns";

export default async function AdminDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    // Fetch all stats in parallel
    const [
        userCount,
        doctorCount,
        patientCount,
        consultationCount,
        todayConsultations,
        totalRevenue,
        pendingPayments,
        recentConsultations,
        recentUsers
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: UserRole.DOCTOR } }),
        prisma.user.count({ where: { role: UserRole.PATIENT } }),
        prisma.consultation.count(),
        prisma.consultation.count({
            where: {
                scheduledStartAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }
        }),
        prisma.payment.aggregate({
            _sum: { amount: true },
            where: { status: PaymentStatus.PAID }
        }),
        prisma.payment.count({
            where: { status: PaymentStatus.PENDING }
        }),
        prisma.consultation.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                patient: { select: { name: true } },
                doctor: { select: { name: true } }
            }
        }),
        prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        })
    ]);

    const revenueInDollars = Number(totalRevenue._sum.amount || 0) / 100;

    const stats = [
        {
            title: "Total Users",
            value: userCount,
            icon: Users,
            color: "text-blue-600 bg-blue-100",
            href: "/dashboard/admin/users"
        },
        {
            title: "Doctors",
            value: doctorCount,
            icon: Stethoscope,
            color: "text-purple-600 bg-purple-100",
            href: "/dashboard/admin/users?role=DOCTOR"
        },
        {
            title: "Patients",
            value: patientCount,
            icon: UserPlus,
            color: "text-green-600 bg-green-100",
            href: "/dashboard/admin/users?role=PATIENT"
        },
        {
            title: "Total Consultations",
            value: consultationCount,
            icon: FileText,
            color: "text-indigo-600 bg-indigo-100",
            href: "/dashboard/admin/consultations"
        },
        {
            title: "Today's Appointments",
            value: todayConsultations,
            icon: Calendar,
            color: "text-amber-600 bg-amber-100",
            href: "/dashboard/admin/consultations?filter=today"
        },
        {
            title: "Total Revenue",
            value: `$${revenueInDollars.toLocaleString()}`,
            icon: DollarSign,
            color: "text-emerald-600 bg-emerald-100",
            href: "/dashboard/admin/consultations?status=PAID"
        },
        {
            title: "Pending Payments",
            value: pendingPayments,
            icon: Clock,
            color: "text-red-600 bg-red-100",
            href: "/dashboard/admin/consultations?status=PAYMENT_PENDING"
        },
        {
            title: "System Health",
            value: "Active",
            icon: Activity,
            color: "text-teal-600 bg-teal-100",
            href: "/dashboard/admin/audit"
        }
    ];

    const quickActions = [
        { label: "Manage Users", href: "/dashboard/admin/users", icon: Users },
        { label: "View Consultations", href: "/dashboard/admin/consultations", icon: ClipboardList },
        { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ShieldCheck },
    ];

    const getStatusColor = (status: ConsultationStatus) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-700';
            case 'COMPLETED': return 'bg-blue-100 text-blue-700';
            case 'IN_CALL': return 'bg-purple-100 text-purple-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case 'ADMIN': return 'bg-red-100 text-red-700';
            case 'DOCTOR': return 'bg-purple-100 text-purple-700';
            case 'PATIENT': return 'bg-green-100 text-green-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="space-y-8">
            {/* Header with Search */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Admin Dashboard
                    </h1>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                        System overview and administration
                    </p>
                </div>

                {/* Search Bar */}
                <AdminSearchBar />
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Link key={index} href={stat.href}>
                            <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${stat.color}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{stat.title}</p>
                                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
                {quickActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                        <Link key={index} href={action.href}>
                            <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer group">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                            <Icon className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">{action.label}</span>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {/* Activity Sections */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Consultations */}
                <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold">Recent Consultations</CardTitle>
                            <Link href="/dashboard/admin/consultations" className="text-sm text-blue-600 hover:underline">
                                View all
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {recentConsultations.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No consultations yet</p>
                        ) : (
                            recentConsultations.map((consultation) => (
                                <div key={consultation.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {consultation.patient?.name || 'Unknown Patient'}
                                            </p>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(consultation.status)}`}>
                                                {consultation.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            with Dr. {consultation.doctor?.name || 'Unassigned'} • {consultation.specialty}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-2">
                                        {formatDistanceToNow(consultation.createdAt, { addSuffix: true })}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Recent Users */}
                <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold">Recent Registrations</CardTitle>
                            <Link href="/dashboard/admin/users" className="text-sm text-blue-600 hover:underline">
                                View all
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {recentUsers.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No users yet</p>
                        ) : (
                            recentUsers.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {user.name || 'Unknown'}
                                            </p>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                                            {user.email}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-2">
                                        {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
