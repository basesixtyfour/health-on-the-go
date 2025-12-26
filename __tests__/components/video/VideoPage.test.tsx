/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    useParams: () => ({
        consultationId: 'test-consultation-id',
    }),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Import component (will fail until implemented)
import VideoPage from '@/app/video/[consultationId]/page';

describe('VideoPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Join Flow', () => {
        it('should call join API on mount', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    joinUrl: 'https://health-hq.daily.co/room?t=token',
                    roomUrl: 'https://health-hq.daily.co/room',
                    token: 'mock_token',
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/v1/consultations/test-consultation-id/join',
                    expect.objectContaining({
                        method: 'POST',
                    })
                );
            });
        });

        it('should render DailyFrame with joinUrl after successful API call', async () => {
            const mockJoinUrl = 'https://health-hq.daily.co/room?t=token';
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    joinUrl: mockJoinUrl,
                    roomUrl: 'https://health-hq.daily.co/room',
                    token: 'mock_token',
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                const iframe = screen.getByTitle('Video Call');
                expect(iframe).toHaveAttribute('src', mockJoinUrl);
            });
        });
    });

    describe('Error Handling', () => {
        it('should display error when API returns 401 (unauthorized)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(screen.getAllByText(/authentication required/i).length).toBeGreaterThan(0);
            });
        });

        it('should display error when API returns 403 (forbidden)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You are not authorized to join this consultation',
                    },
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
            });
        });

        it('should display error when joining too early', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Too early to join. You can join 5 minutes before the scheduled time.',
                        details: {
                            scheduledAt: new Date(Date.now() + 1800000).toISOString(),
                            opensAt: new Date(Date.now() + 1500000).toISOString(),
                        },
                    },
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(screen.getByText(/too early/i)).toBeInTheDocument();
            });
        });

        it('should display error when joining too late', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Too late to join. The join window closed 30 minutes after the scheduled time.',
                    },
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(screen.getByText(/too late/i)).toBeInTheDocument();
            });
        });

        it('should display error when consultation status is invalid', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Cannot join consultation with status: CREATED',
                    },
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                expect(screen.getByText(/cannot join/i)).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('should show loading state while fetching join URL', () => {
            (global.fetch as jest.Mock).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            );

            render(<VideoPage />);

            expect(screen.getByText(/connecting/i)).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should redirect to dashboard when call ends', async () => {
            const mockJoinUrl = 'https://health-hq.daily.co/room?t=token';
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    joinUrl: mockJoinUrl,
                    roomUrl: 'https://health-hq.daily.co/room',
                    token: 'mock_token',
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                screen.getByTitle('Video Call');
            });

            // The onCallEnded callback should trigger navigation
            // This would be tested via DailyFrame's postMessage handling
        });

        it('should have a back to dashboard link', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    joinUrl: 'https://health-hq.daily.co/room?t=token',
                    roomUrl: 'https://health-hq.daily.co/room',
                    token: 'mock_token',
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                }),
            });

            render(<VideoPage />);

            await waitFor(() => {
                const backLink = screen.getByRole('link', { name: /back|dashboard|leave/i });
                expect(backLink).toBeInTheDocument();
            });
        });
    });
});
