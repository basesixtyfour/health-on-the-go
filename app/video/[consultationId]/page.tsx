'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DailyFrame } from '@/components/video/DailyFrame';
import { ArrowLeft } from 'lucide-react';

interface JoinResponse {
    joinUrl: string;
    roomUrl: string;
    token: string;
    expiresAt: string;
    userRole?: string;
    isDoctor?: boolean;
}

interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

type PageState =
    | { status: 'loading' }
    | { status: 'success'; data: JoinResponse }
    | { status: 'error'; message: string; code: string };

/**
 * Video Call Page
 * 
 * Fetches join token from API and renders the Daily Prebuilt iframe.
 * Handles error states for authentication, authorization, and time window issues.
 */
export default function VideoPage() {
    const params = useParams();
    const router = useRouter();
    const consultationId = params?.consultationId as string;

    const [state, setState] = useState<PageState>({ status: 'loading' });
    const [isEnding, setIsEnding] = useState(false);

    // Fetch join URL from API
    useEffect(() => {
        async function fetchJoinUrl() {
            if (!consultationId) {
                setState({
                    status: 'error',
                    message: 'Invalid consultation ID',
                    code: 'VALIDATION_ERROR'
                });
                return;
            }

            try {
                const response = await fetch(`/api/v1/consultations/${consultationId}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData: ErrorResponse = await response.json();
                    setState({
                        status: 'error',
                        message: errorData.error.message,
                        code: errorData.error.code
                    });
                    return;
                }

                const data: JoinResponse = await response.json();
                setState({ status: 'success', data });
            } catch {
                setState({
                    status: 'error',
                    message: 'Failed to connect to video service',
                    code: 'INTERNAL_ERROR'
                });
            }
        }

        fetchJoinUrl();
    }, [consultationId]);

    // Handle call ended
    const handleCallEnded = useCallback(() => {
        router.push('/dashboard');
    }, [router]);

    // Handle end consultation (doctor only)
    const handleEndConsultation = useCallback(async () => {
        if (!consultationId || isEnding) return;

        setIsEnding(true);
        try {
            const response = await fetch(`/api/v1/consultations/${consultationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'COMPLETED' }),
            });

            if (response.ok) {
                router.push('/dashboard');
            } else {
                const errorData = await response.json();
                alert(`Failed to end consultation: ${errorData.error?.message || 'Unknown error'}`);
                setIsEnding(false);
            }
        } catch {
            alert('Failed to end consultation. Please try again.');
            setIsEnding(false);
        }
    }, [consultationId, router, isEnding]);

    // Loading state
    if (state.status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-600 border-t-emerald-500 mb-6" />
                <p className="text-slate-300 text-xl">Connecting to your consultation...</p>
                <p className="text-slate-500 mt-2">Please allow camera and microphone access</p>
            </div>
        );
    }

    // Error state
    if (state.status === 'error') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
                <div className="max-w-md text-center">
                    <div className="text-red-400 text-6xl mb-6">⚠️</div>
                    <h1 className="text-white text-2xl font-bold mb-4">
                        {state.code === 'UNAUTHORIZED' ? 'Authentication Required' :
                            state.code === 'FORBIDDEN' ? 'Access Denied' :
                                'Unable to Join Call'}
                    </h1>
                    <p className="text-slate-400 mb-8">
                        {state.message}
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Success state - render video call
    return (
        <div className="h-screen bg-slate-900 flex flex-col">
            {/* Header with back button */}
            <div className="bg-slate-800 border-b border-slate-700 p-4 flex-shrink-0">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Leave Call
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="text-slate-500 text-sm">
                            Consultation ID: {consultationId.slice(0, 8)}...
                        </div>
                        {state.data.isDoctor && (
                            <button
                                onClick={handleEndConsultation}
                                disabled={isEnding}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                {isEnding ? 'Ending...' : 'End Consultation'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Video frame - takes remaining height */}
            <div className="flex-1 min-h-0 relative">
                <DailyFrame
                    joinUrl={state.data.joinUrl}
                    onCallEnded={handleCallEnded}
                />
            </div>
        </div>
    );
}
