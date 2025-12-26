"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Patient {
    id: string;
    patient: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        createdAt: string;
    };
    lastConsultationDate: string;
}

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchPatients() {
            setLoading(true);
            try {
                // In a real app, we'd have a specific endpoint for unique patients
                // For now, we can re-use fetching consultations and unique-ify them client-side or add an endpoint
                // Let's assume we fetch recent consultations and extract patients
                const res = await fetch("/api/v1/doctors/consultations?limit=50");
                // Note: We need to create this /api/v1/doctors/consultations endpoint or recycle admin one
                // Since user didn't ask for new API endpoints, we might have to use what we have or mock it.
                // But wait, the user asked to "work on doctor dashboard". 
                // Detailed data fetching implies we probably need new endpoints or server components.
                // I will update this file to be a Server Component to fetch directly from Prisma for simplicity/speed.

                if (isMounted) {
                    // Placeholder for setting state if we actually had data logic here
                    // setPatients(data);
                }
            } catch (error) {
                if (isMounted) console.error(error);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchPatients();

        return () => {
            isMounted = false;
        };
    }, []);

    // Switching to Server Component pattern in the wrapper is better.
    // Let's make this just a skeletal client component for now while I build the server wrapper.
    return <div>Loading...</div>;
}

// Actually, let's implement the Server Component approach directly in the page.tsx to avoid API creation overhead
