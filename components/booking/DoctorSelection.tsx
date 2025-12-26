"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Specialty } from "@/lib/types";
import { ArrowLeft, User, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DoctorSelectionProps {
    specialty: Specialty;
    onSelect: (doctorId: string) => void;
    onBack: () => void;
}

interface Doctor {
    doctorId: string;
    doctorName: string;
    specialties: Specialty[];
    timezone: string;
    // We'll calculate next availability from slots if needed, but for now just list doctors
}

export function DoctorSelection({ specialty, onSelect, onBack }: DoctorSelectionProps) {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDoctors() {
            try {
                setLoading(true);
                // We use the availability endpoint to find doctors for this specialty
                // We pass a dummy date to ensure we get doctor lists, though ideally we'd have a separate /doctors endpoint
                // For now, this works as our availability endpoint returns "doctors" list in multi-mode
                const res = await fetch(`/api/v1/doctors/availability?specialty=${specialty}`);
                if (!res.ok) throw new Error("Failed to fetch doctors");
                const data = await res.json();
                setDoctors(data.doctors || []);
            } catch (err) {
                console.error(err);
                setError("Unable to load doctors. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        fetchDoctors();
    }, [specialty]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-semibold">Select a {specialty.toLowerCase()} Doctor</h2>
                    <p className="text-gray-500">Choose a specialist for your consultation.</p>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-md text-center">
                    {error}
                </div>
            )}

            {!loading && !error && doctors.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No doctors found for this specialty.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map((doctor) => (
                    <Card
                        key={doctor.doctorId}
                        role="button"
                        tabIndex={0}
                        className="hover:border-primary transition-colors cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none"
                        onClick={() => onSelect(doctor.doctorId)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(doctor.doctorId);
                            }
                        }}
                    >
                        <CardContent className="p-6 flex items-start gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.doctorId}`} />
                                <AvatarFallback>{doctor.doctorName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-lg">{doctor.doctorName}</h3>
                                <p className="text-sm text-gray-500">{doctor.specialties.join(", ")}</p>
                                <div className="flex items-center text-xs text-muted-foreground mt-2">
                                    <CalendarIcon className="w-3 h-3 mr-1" />
                                    Available Today
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
