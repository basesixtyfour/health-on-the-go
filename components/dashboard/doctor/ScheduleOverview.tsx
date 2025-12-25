"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export function ScheduleOverview() {
    // Placeholder static data
    const total_appointments = 8;
    const completed = 4;
    const remaining = 4;

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl font-bold">{total_appointments} Appointments</div>
                    <Link href="/dashboard/doctor/schedule" className="text-sm text-primary hover:underline">
                        View Calendar
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{completed} completed</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span>{remaining} remaining</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
