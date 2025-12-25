"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Specialty } from "@/lib/types";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

// Step Components (Placeholders for now)
import { SpecialtySelection } from "./SpecialtySelection";
import { DoctorSelection } from "./DoctorSelection";
import { TimeSlotSelection } from "./TimeSlotSelection";
import IntakeForm from "@/components/intake/IntakeForm";

type BookingStep = "SPECIALTY" | "DOCTOR" | "TIME" | "INTAKE" | "CONFIRMATION";

export function BookingWizard() {
    const [step, setStep] = useState<BookingStep>("SPECIALTY");
    const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);

    const { data: session } = useSession();
    const router = useRouter();

    const handleSpecialtySelect = (specialty: Specialty) => {
        setSelectedSpecialty(specialty);
        setStep("DOCTOR");
    };

    const handleDoctorSelect = (doctorId: string) => {
        setSelectedDoctorId(doctorId);
        setStep("TIME");
    };

    const [isBooking, setIsBooking] = useState(false);

    const handleTimeSelect = (date: Date) => {
        setSelectedTimeSlot(date);
        setStep("INTAKE");
    };

    const handleIntakeSubmit = async (intakeData: any) => {
        try {
            setIsBooking(true);

            // 1. Create Consultation
            const bookingRes = await fetch("/api/v1/consultations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    specialty: selectedSpecialty,
                    doctorId: selectedDoctorId,
                    scheduledStartAt: selectedTimeSlot?.toISOString(),
                    intake: intakeData
                })
            });

            if (!bookingRes.ok) throw new Error("Booking failed");
            const booking = await bookingRes.json();

            // 2. Create Payment Session
            const paymentRes = await fetch("/api/v1/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consultationId: booking.id })
            });

            if (!paymentRes.ok) throw new Error("Payment initialization failed");
            const payment = await paymentRes.json();

            // 3. Redirect
            window.location.href = payment.url;

        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
            setIsBooking(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case "SPECIALTY":
                return <SpecialtySelection onSelect={handleSpecialtySelect} />;
            case "DOCTOR":
                return <DoctorSelection specialty={selectedSpecialty!} onSelect={handleDoctorSelect} onBack={() => setStep("SPECIALTY")} />;
            case "TIME":
                return <TimeSlotSelection doctorId={selectedDoctorId!} onSelect={handleTimeSelect} onBack={() => setStep("DOCTOR")} />;
            case "INTAKE":
                return (
                    <IntakeForm
                        defaultSpecialty={selectedSpecialty!}
                        onSubmit={handleIntakeSubmit}
                        isSubmitting={isBooking}
                    />
                );
            case "CONFIRMATION":
                return <div className="p-8 text-center text-green-600 font-bold">Booking Confirmed! Redirecting...</div>;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Book a Consultation</h1>
                <div className="text-sm text-gray-500">
                    Step {step === "SPECIALTY" ? 1 : step === "DOCTOR" ? 2 : step === "TIME" ? 3 : 4} of 4
                </div>
            </div>

            {/* Progress Bar could go here */}

            <Card className="min-h-[400px]">
                {renderStep()}
            </Card>
        </div>
    );
}
