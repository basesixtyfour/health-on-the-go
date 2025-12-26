'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clapperboard, Loader2 } from 'lucide-react';

/**
 * Demo Instant Call Button
 * 
 * 🎬 HACKATHON DEMO ONLY
 * Creates an instant video call bypassing the normal booking/payment flow.
 * Only visible when DEMO_MODE=true in environment.
 */
export function DemoCallButton() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDemoCall = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/v1/demo/instant-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error?.message || 'Failed to create demo call');
                return;
            }

            // Redirect to video page
            router.push(`/video/${data.consultationId}`);
        } catch {
            setError('Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/90">
                    🎬 Demo Mode
                </CardTitle>
                <Clapperboard className="h-4 w-4 text-white/70" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-white">
                    Instant Call
                </div>
                <p className="text-xs text-white/70 mt-1">
                    Skip booking & payment for demo
                </p>
                {error && (
                    <p className="text-xs text-red-200 mt-2 bg-red-500/20 p-2 rounded">
                        {error}
                    </p>
                )}
                <Button 
                    onClick={handleDemoCall}
                    disabled={isLoading}
                    className="w-full mt-4 bg-white text-purple-600 hover:bg-white/90 font-semibold"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        '🚀 Start Demo Call'
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
