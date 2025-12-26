"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PatientData {
    id: string;
    name: string;
    email: string;
    image: string | null;
    lastVisit: string;
}

export default function PatientsPage() {
    const [patients, setPatients] = useState<PatientData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchPatients() {
            setLoading(true);
            setError(null);
            try {
                // Fetch consultations from admin endpoint (doctor sees their own via session)
                // Note: If auth is needed, this endpoint may not work for doctors directly.
                // Ideally, we'd have /api/v1/doctors/patients or use server component.
                // For now, try /api/v1/admin/consultations which may return relevant data if authorized.
                const res = await fetch("/api/v1/admin/consultations?limit=100");

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `HTTP ${res.status}`);
                }

                const json = await res.json();
                const consultations = json.data || [];

                // Extract unique patients from consultations
                const patientMap = new Map<string, PatientData>();
                for (const c of consultations) {
                    if (c.patient && !patientMap.has(c.patient.id)) {
                        patientMap.set(c.patient.id, {
                            id: c.patient.id,
                            name: c.patient.name || "Unknown",
                            email: c.patient.email || "",
                            image: c.patient.image || null,
                            lastVisit: c.createdAt || new Date().toISOString()
                        });
                    }
                }

                if (isMounted) {
                    setPatients(Array.from(patientMap.values()));
                }
            } catch (err: any) {
                console.error("Failed to fetch patients:", err);
                if (isMounted) {
                    setError(err.message || "Failed to load patients");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchPatients();

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-red-500 font-medium">{error}</p>
                <p className="text-muted-foreground text-sm mt-2">
                    Note: This page requires Admin access or a dedicated Doctor API endpoint.
                </p>
            </div>
        );
    }

    if (patients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground">No patients found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Patients</h1>
                    <p className="text-muted-foreground">
                        <Badge variant="secondary">{patients.length}</Badge> unique patients
                    </p>
                </div>
            </div>

            <DataTable
                loading={false}
                data={patients}
                page={1}
                totalPages={1}
                onPageChange={() => { }}
                columns={[
                    {
                        header: "Patient",
                        accessorKey: "name",
                        cell: (p) => (
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={p.image || ""} />
                                    <AvatarFallback>{p.name?.charAt(0) ?? "?"}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{p.name}</span>
                            </div>
                        )
                    },
                    { header: "Email", accessorKey: "email" },
                    {
                        header: "Last Visit",
                        accessorKey: "lastVisit",
                        cell: (p) => <span>{new Date(p.lastVisit).toLocaleDateString()}</span>
                    }
                ]}
            />
        </div>
    );
}
