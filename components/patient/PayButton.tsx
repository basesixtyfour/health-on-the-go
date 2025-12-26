"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface PayButtonProps {
    consultationId: string;
}

export function PayButton({ consultationId }: PayButtonProps) {
    const [loading, setLoading] = useState(false);

    const handlePay = async () => {
        try {
            setLoading(true);

            // Create payment session
            const res = await fetch("/api/v1/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consultationId }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || "Failed to initiate payment");
            }

            const payment = await res.json();

            // Redirect to payment page
            window.location.href = payment.url;
        } catch (error) {
            console.error("Payment error:", error);
            alert(error instanceof Error ? error.message : "Failed to initiate payment. Please try again.");
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <CreditCard className="h-4 w-4" />
            )}
            {loading ? "Processing..." : "Pay Now"}
        </Button>
    );
}
