import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/");
    }

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            <AppSidebar user={session.user} />
            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-4 md:hidden">
                    {/* Placeholder for Mobile Trigger if AppSidebar doesn't include it. 
                        Usually AppSidebar handles its own mobile state or we need a trigger.
                        Let's assume we need a trigger if using shadcn/sidebar 
                    */}
                </div>
                <div className="container mx-auto p-4 md:p-8">{children}</div>
            </main>
        </div>
    );
}
