/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import component (will fail until implemented)
import { DailyFrame } from '@/components/video/DailyFrame';

describe('DailyFrame', () => {
    const mockJoinUrl = 'https://health-hq.daily.co/test-room?t=mock_token';
    const mockOnCallEnded = jest.fn();

    beforeEach(() => {
        mockOnCallEnded.mockClear();
    });

    describe('Rendering', () => {
        it('should render an iframe with the joinUrl as src', () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            const iframe = screen.getByTitle('Video Call');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', mockJoinUrl);
        });

        it('should render iframe with full-screen dimensions', () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            const iframe = screen.getByTitle('Video Call');
            expect(iframe).toHaveClass('w-full', 'h-full');
        });

        it('should have allow attributes for camera, microphone, and display-capture', () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            const iframe = screen.getByTitle('Video Call');
            const allowAttr = iframe.getAttribute('allow');
            
            expect(allowAttr).toContain('camera');
            expect(allowAttr).toContain('microphone');
            expect(allowAttr).toContain('display-capture');
        });
    });

    describe('Loading State', () => {
        it('should show loading indicator while iframe loads', () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            expect(screen.getByTestId('video-loading')).toBeInTheDocument();
        });

        it('should hide loading indicator after iframe loads', async () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            const iframe = screen.getByTitle('Video Call');
            
            // Simulate iframe load event
            iframe.dispatchEvent(new Event('load'));

            await waitFor(() => {
                expect(screen.queryByTestId('video-loading')).not.toBeInTheDocument();
            });
        });
    });

    describe('Error State', () => {
        it('should show error message when joinUrl is empty', () => {
            render(
                <DailyFrame 
                    joinUrl="" 
                    onCallEnded={mockOnCallEnded} 
                />
            );

            expect(screen.getByText(/unable to load video call/i)).toBeInTheDocument();
        });
    });

    describe('Consultation Info', () => {
        it('should display consultation info when provided', () => {
            render(
                <DailyFrame 
                    joinUrl={mockJoinUrl} 
                    onCallEnded={mockOnCallEnded}
                    consultationInfo={{
                        specialty: 'Cardiology',
                        patientName: 'John Doe',
                        doctorName: 'Dr. Smith',
                    }}
                />
            );

            expect(screen.getByText('Cardiology')).toBeInTheDocument();
        });
    });
});
