'use client';

import { useState, useCallback } from 'react';

export interface ConsultationInfo {
    specialty?: string;
    patientName?: string;
    doctorName?: string;
}

export interface DailyFrameProps {
    joinUrl: string;
    onCallEnded?: () => void;
    consultationInfo?: ConsultationInfo;
}

/**
 * DailyFrame - Iframe wrapper for Daily Prebuilt video calls
 * 
 * Renders the Daily.co Prebuilt UI in a full-screen iframe with loading
 * and error states.
 */
export function DailyFrame({ 
    joinUrl, 
    onCallEnded: _onCallEnded,
    consultationInfo 
}: DailyFrameProps) {
    const [isLoading, setIsLoading] = useState(true);

    const handleIframeLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    // Error state: no joinUrl provided
    if (!joinUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white p-8">
                <div className="text-red-400 text-xl mb-4">
                    Unable to load video call
                </div>
                <p className="text-slate-400">
                    The video call URL could not be generated. Please try again.
                </p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-slate-900">
            {/* Loading indicator */}
            {isLoading && (
                <div 
                    data-testid="video-loading"
                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10"
                >
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-emerald-500 mb-4" />
                    <p className="text-slate-300">Connecting to video call...</p>
                </div>
            )}

            {/* Consultation info header */}
            {consultationInfo?.specialty && (
                <div className="absolute top-0 left-0 right-0 bg-slate-800/80 backdrop-blur-sm p-3 z-20">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <span className="text-white font-medium">
                            {consultationInfo.specialty}
                        </span>
                        {consultationInfo.doctorName && (
                            <span className="text-slate-300 text-sm">
                                {consultationInfo.doctorName}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Daily Prebuilt iframe */}
            <iframe
                title="Video Call"
                src={joinUrl}
                onLoad={handleIframeLoad}
                allow="camera; microphone; display-capture; autoplay; clipboard-write"
                className="absolute inset-0 w-full h-full border-0"
            />
        </div>
    );
}
