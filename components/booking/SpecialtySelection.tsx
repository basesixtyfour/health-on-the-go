"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VALID_SPECIALTIES, Specialty } from "@/lib/types";
import { Stethoscope, Heart, Brain, Bone, Activity, Baby } from "lucide-react";

interface SpecialtySelectionProps {
    onSelect: (specialty: Specialty) => void;
}

const SPECIALTY_ICONS: Record<Specialty, React.ReactNode> = {
    GENERAL: <Stethoscope className="w-8 h-8 mb-2" />,
    CARDIOLOGY: <Heart className="w-8 h-8 mb-2" />,
    DERMATOLOGY: <Activity className="w-8 h-8 mb-2" />, // Use generic activity for now
    PEDIATRICS: <Baby className="w-8 h-8 mb-2" />,
    PSYCHIATRY: <Brain className="w-8 h-8 mb-2" />,
    ORTHOPEDICS: <Bone className="w-8 h-8 mb-2" />,
};

const SPECIALTY_DESCRIPTIONS: Record<Specialty, string> = {
    GENERAL: "Primary care and general health checkups.",
    CARDIOLOGY: "Heart health and cardiovascular care.",
    DERMATOLOGY: "Skin, hair, and nail conditions.",
    PEDIATRICS: "Medical care for infants, children, and adolescents.",
    PSYCHIATRY: "Mental health and emotional well-being.",
    ORTHOPEDICS: "Bone, joint, and muscle care.",
};

export function SpecialtySelection({ onSelect }: SpecialtySelectionProps) {
    return (
        <div className="p-6">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold">Choose a Specialty</h2>
                <p className="text-gray-500">Select the type of care you need to get started.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {VALID_SPECIALTIES.map((specialty) => (
                    <Button
                        key={specialty}
                        variant="outline"
                        className="h-auto py-6 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-all"
                        onClick={() => onSelect(specialty)}
                    >
                        <div className="text-primary">
                            {SPECIALTY_ICONS[specialty]}
                        </div>
                        <div className="font-semibold text-lg mb-1">
                            {specialty.charAt(0) + specialty.slice(1).toLowerCase()}
                        </div>
                        <p className="text-xs text-muted-foreground px-2">
                            {SPECIALTY_DESCRIPTIONS[specialty]}
                        </p>
                    </Button>
                ))}
            </div>
        </div>
    );
}
