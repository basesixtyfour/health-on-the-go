"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string;
    description?: string;
    icon: LucideIcon;
    status?: "success" | "warning" | "error" | "default";
}

export function StatCard({ title, value, description, icon: Icon, status = "default" }: StatCardProps) {
    const statusColors = {
        success: "text-green-600",
        warning: "text-orange-600",
        error: "text-red-600",
        default: "text-foreground"
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${statusColors[status]}`}>{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
