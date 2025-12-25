import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default async function AdminDashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

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

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white dark:bg-slate-800 shadow-sm border-red-100 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">Operational</div>
                        <p className="text-xs text-slate-500 mt-1">
                            All systems nominal
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
