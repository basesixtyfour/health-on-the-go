"use client";

import { Activity, AlertCircle, Calendar, Users, Settings, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueueCard } from "@/components/dashboard/doctor/QueueCard";
import { ScheduleOverview } from "@/components/dashboard/doctor/ScheduleOverview";
import { StatCard } from "@/components/dashboard/doctor/StatCard";

export default function DoctorDashboard() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
                <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Main Widgets Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Queue - Takes up 1 slot */}
                <QueueCard />

                {/* Schedule - Takes up 2 slots visually in ScheduleOverview component logic if styled right, 
            but here we place it in grid. Let's adjust ScheduleOverview to be flexible or specific. 
            Actually, let's keep it simple: 4 columns.
            Queue: 1 col, Patients: 1 col, Alerts: 1 col, Status: 1 col?
            User asked for: Queue, Schedule, Status, Alerts.
            Let's do:
            [ Queue ] [ Schedule (2 cols? or 1) ] [ Status ] 
        */}

                {/* For now, uniform grid. ScheduleOverview header says "col-span-1 md:col-span-2" */}
                <ScheduleOverview />

                {/* <StatCard
                    title="Patient Status"
                    value="Active"
                    description="System fully operational"
                    icon={Activity}
                    status="success"
                />

                <StatCard
                    title="Alerts"
                    value="3 Alerts"
                    description="Check Alerts Dashboard"
                    icon={AlertCircle}
                    status="warning"
                /> */}
            </div>

            {/* Navigation Quick Links (Optional, but good for "My Patients", "Consultations" etc) */}
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
