"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    LogOut,
    FileText,
    Video,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface AppSidebarProps {
    user: {
        name: string;
        email: string;
        image?: string | null;
        role?: string | null;
    }
}

export function AppSidebar({ user }: AppSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const role = user.role?.toUpperCase() || "PATIENT";

    const patientLinks = [
        { href: "/dashboard/patient", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/patient/appointments", label: "Appointments", icon: Calendar },
        { href: "/dashboard/patient/records", label: "Medical Records", icon: FileText },
        { href: "/dashboard/patient/settings", label: "Settings", icon: Settings },
    ];

    const doctorLinks = [
        { href: "/dashboard/doctor", label: "Dashboard", icon: LayoutDashboard },
        { href: "/dashboard/doctor/schedule", label: "Schedule", icon: Calendar },
        { href: "/dashboard/doctor/patients", label: "My Patients", icon: Users },
        { href: "/dashboard/doctor/consultations", label: "Consultations", icon: Video },
        { href: "/dashboard/doctor/settings", label: "Settings", icon: Settings },
    ];

    const links = role === "DOCTOR" ? doctorLinks : patientLinks;

    const handleLogout = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/");
                }
            }
        });
    };

    return (
        <div className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
                <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <div className="h-6 w-6 rounded-md bg-blue-600" />
                    <span>HealthGo</span>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto py-6">
                <nav className="space-y-1 px-3">
                    {links.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                    {user.image ? (
                        <img src={user.image} alt={user.name} className="h-8 w-8 rounded-full" />
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                            {user.name.charAt(0)}
                        </div>
                    )}
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</span>
                        <span className="truncate text-xs text-slate-500 dark:text-slate-400 capitalize">{role.toLowerCase()}</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
