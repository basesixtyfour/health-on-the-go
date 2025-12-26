"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Consultation {
    id: string;
    patient: { name: string; email: string };
    doctor: { name: string; email: string } | null;
    specialty: string;
    status: string;
    createdAt: string;
}

export default function ConsultationsPage() {
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState("");

    async function fetchConsultations() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(statusFilter && { status: statusFilter })
            });
            const res = await fetch(`/api/v1/admin/consultations?${params}`);
            if (!res.ok) throw new Error("Failed to fetch consultations");
            const raw = await res.json();
            setConsultations(raw.data);
            setTotalPages(raw.meta.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchConsultations();
    }, [page, statusFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Consultations</h1>
                    <p className="text-muted-foreground">View and manage system consultations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={statusFilter}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            setPage(1);
                            setStatusFilter(e.target.value);
                        }}
                    >
                        <option value="">All Statuses</option>
                        <option value="CREATED">Created</option>
                        <option value="PAYMENT_PENDING">Payment Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="IN_CALL">In Call</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>
            </div>

            <DataTable
                loading={loading}
                data={consultations}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                columns={[
                    { header: "ID", accessorKey: "id", cell: (c) => <span className="font-mono text-xs">{c.id.slice(-6)}</span> },
                    { header: "Patient", cell: (c) => <div><div className="font-medium">{c.patient.name}</div><div className="text-xs text-muted-foreground">{c.patient.email}</div></div> },
                    { header: "Doctor", cell: (c) => c.doctor ? <div><div className="font-medium">{c.doctor.name}</div><div className="text-xs text-muted-foreground">{c.doctor.email}</div></div> : <span className="text-muted-foreground italic">Unassigned</span> },
                    { header: "Specialty", accessorKey: "specialty" },
                    {
                        header: "Status",
                        accessorKey: "status",
                        cell: (c) => (
                            <Badge variant={c.status === "COMPLETED" ? "default" : c.status === "CANCELLED" ? "destructive" : "secondary"}>
                                {c.status}
                            </Badge>
                        )
                    },
                    { header: "Created At", cell: (c) => new Date(c.createdAt).toLocaleDateString() }
                ]}
            />
        </div>
    );
}
