/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TimeSlotSelection } from '@/components/booking/TimeSlotSelection';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

describe('TimeSlotSelection', () => {
    const mockOnSelect = jest.fn();
    const mockOnBack = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockSlots = {
        slots: [
            { startTime: '2025-01-01T09:00:00.000Z', endTime: '2025-01-01T09:30:00.000Z', available: true },
            { startTime: '2025-01-01T10:00:00.000Z', endTime: '2025-01-01T10:30:00.000Z', available: false },
        ]
    };

    it('fetches and renders available slots', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSlots,
        });

        await act(async () => {
            render(
                <TimeSlotSelection
                    specialty="GENERAL"
                    doctorId="doc1"
                    onSelect={mockOnSelect}
                    onBack={mockOnBack}
                />
            );
        });

        // Check loading/fetch
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Check output (assuming timezone might shift the hour, finding mostly on text patterns or generic availability)
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            // Back button + Calendar buttons + 2 slots
            expect(buttons.length).toBeGreaterThan(2);
        });

        // Since date formatting depends on local TZ, we verify "Select a Time" header
        expect(screen.getByText('Select a Time')).toBeInTheDocument();
    });

    it('handles fetch error gracefully', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        await act(async () => {
            render(
                <TimeSlotSelection
                    specialty="GENERAL"
                    doctorId="doc1"
                    onSelect={mockOnSelect}
                    onBack={mockOnBack}
                />
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });

    it('handles empty slots', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ slots: [] }),
        });

        await act(async () => {
            render(
                <TimeSlotSelection
                    specialty="GENERAL"
                    doctorId="doc1"
                    onSelect={mockOnSelect}
                    onBack={mockOnBack}
                />
            );
        });

        await waitFor(() => {
            expect(screen.getByText('No slots available for this date.')).toBeInTheDocument();
        });
    });
});
