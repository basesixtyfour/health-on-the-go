"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";

interface AuditEvent {
    id: string;
    eventType: string;
    actor: { name: string; email: string } | null;
    createdAt: string;
}

export default function AuditPage() {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);

    async function fetchEvents() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            const res = await fetch(`/api/v1/admin/audit?${params}`);
            if (!res.ok) throw new Error("Failed to fetch audit logs");
            const raw = await res.json();
            setEvents(raw.data);
            setTotalPages(raw.meta.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchEvents();
    }, [page]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-muted-foreground">System activity logs.</p>
                </div>
            </div>

            <DataTable
                loading={loading}
                data={events}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                columns={[
                    { header: "ID", accessorKey: "id", cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.id.slice(-8)}</span> },
                    { header: "Event Type", accessorKey: "eventType", cell: (e) => <span className="font-mono font-medium">{e.eventType}</span> },
                    { header: "Actor", cell: (e) => e.actor ? <span>{e.actor.name}</span> : <span className="italic text-muted-foreground">System</span> },
                    { header: "Timestamp", cell: (e) => <span className="text-sm">{new Date(e.createdAt).toLocaleString()}</span> }
                ]}
            />
        </div>
    );
}
