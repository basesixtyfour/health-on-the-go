"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TimeSlotSelectionProps {
    doctorId: string;
    onSelect: (date: Date) => void;
    onBack: () => void;
}

interface TimeSlot {
    startTime: string; // ISO string
    endTime: string;
    available: boolean;
}

export function TimeSlotSelection({ doctorId, onSelect, onBack }: TimeSlotSelectionProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [slots, setSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSlots() {
            if (!selectedDate) return;

            try {
                setLoading(true);
                setError(null);
                // Format date as YYYY-MM-DD for the API
                const dateStr = format(selectedDate, "yyyy-MM-dd");
                // We pass the browser's timezone to ensure correct day interpretation
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                const res = await fetch(
                    `/api/v1/doctors/availability?doctorId=${doctorId}&date=${dateStr}&patientTimezone=${timeZone}`
                );

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || "Failed to fetch slots");
                }
                const data = await res.json();
                setSlots(data.slots || []);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Unable to load time slots.");
            } finally {
                setLoading(false);
            }
        }

        fetchSlots();
    }, [doctorId, selectedDate]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-semibold">Select a Time</h2>
                    <p className="text-gray-500">Choose a date and time for your consultation.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-none">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="rounded-md border shadow"
                    />
                </div>

                <div className="flex-1">
                    <h3 className="font-medium mb-4">
                        Available Slots for {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Selected Date"}
                    </h3>

                    {loading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}

                    {error && <div className="text-red-500 text-sm">{error}</div>}

                    {!loading && !error && slots.length === 0 && (
                        <div className="text-gray-500 text-sm">No slots available for this date.</div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {slots.map((slot, index) => {
                            const startTime = new Date(slot.startTime);
                            return (
                                <Button
                                    key={index}
                                    variant={slot.available ? "outline" : "ghost"}
                                    disabled={!slot.available}
                                    className={`w-full ${slot.available ? "hover:border-primary hover:bg-primary/5" : "opacity-50"}`}
                                    onClick={() => onSelect(startTime)}
                                >
                                    <Clock className="w-4 h-4 mr-2" />
                                    {format(startTime, "h:mm a")}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
