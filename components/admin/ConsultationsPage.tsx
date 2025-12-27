"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEffectiveStatus } from "@/lib/consultation-utils";

interface Consultation {
    id: string;
    patient: { name: string; email: string };
    doctor: { name: string; email: string } | null;
    specialty: string;
    status: string;
    createdAt: string;
    scheduledStartAt: string | null;
}

interface ConsultationsPageProps {
    initialStatus?: string;
    initialFilter?: string; // 'today' for today's appointments
}

export default function ConsultationsPage({ initialStatus, initialFilter }: ConsultationsPageProps) {
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState(initialStatus || "");
    const [todayFilter, setTodayFilter] = useState(initialFilter === "today");

    async function fetchConsultations() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            if (statusFilter) {
                params.set('status', statusFilter);
            }
            if (todayFilter) {
                params.set('today', 'true');
            }
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
    }, [page, statusFilter, todayFilter]);

    // Determine title based on filters
    const getTitle = () => {
        if (todayFilter) return "Today's Appointments";
        if (statusFilter === "PAID") return "Paid Consultations";
        if (statusFilter === "PAYMENT_PENDING") return "Pending Payments";
        return "Consultations";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{getTitle()}</h1>
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
                        <option value="EXPIRED">Expired</option>
                    </select>
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
                <Button
                    variant={!todayFilter && !statusFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTodayFilter(false); setStatusFilter(""); setPage(1); }}
                >
                    All
                </Button>
                <Button
                    variant={todayFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTodayFilter(true); setStatusFilter(""); setPage(1); }}
                >
                    Today
                </Button>
                <Button
                    variant={statusFilter === "PAID" && !todayFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTodayFilter(false); setStatusFilter("PAID"); setPage(1); }}
                >
                    Paid
                </Button>
                <Button
                    variant={statusFilter === "PAYMENT_PENDING" && !todayFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTodayFilter(false); setStatusFilter("PAYMENT_PENDING"); setPage(1); }}
                >
                    Pending Payment
                </Button>
                <Button
                    variant={statusFilter === "COMPLETED" && !todayFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTodayFilter(false); setStatusFilter("COMPLETED"); setPage(1); }}
                >
                    Completed
                </Button>
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
                        cell: (c) => {
                            const effectiveStatus = getEffectiveStatus(c);
                            const getBadgeVariant = (status: string) => {
                                switch (status) {
                                    case 'COMPLETED': return 'default';
                                    case 'CANCELLED': return 'destructive';
                                    case 'PAID': return 'default';
                                    case 'IN_CALL': return 'destructive';
                                    case 'EXPIRED': return 'outline';
                                    default: return 'secondary';
                                }
                            };
                            return (
                                <Badge variant={getBadgeVariant(effectiveStatus)}>
                                    {effectiveStatus}
                                </Badge>
                            );
                        }
                    },
                    {
                        header: "Scheduled",
                        cell: (c) => c.scheduledStartAt
                            ? new Date(c.scheduledStartAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
                            : <span className="text-muted-foreground">-</span>
                    }
                ]}
            />
        </div>
    );
}
