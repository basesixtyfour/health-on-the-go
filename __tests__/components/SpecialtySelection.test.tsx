/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpecialtySelection } from '@/components/booking/SpecialtySelection';
import '@testing-library/jest-dom';

// Mock Lucide icons to avoid ESM issues or rendering complexity
jest.mock('lucide-react', () => ({
    Stethoscope: () => <div data-testid="icon-stethoscope" />,
    Heart: () => <div data-testid="icon-heart" />,
    Activity: () => <div data-testid="icon-activity" />,
    Baby: () => <div data-testid="icon-baby" />,
    Brain: () => <div data-testid="icon-brain" />,
    Bone: () => <div data-testid="icon-bone" />,
}));

describe('SpecialtySelection', () => {
    const mockOnSelect = jest.fn();

    beforeEach(() => {
        mockOnSelect.mockClear();
    });

    it('renders all specialties', () => {
        render(<SpecialtySelection onSelect={mockOnSelect} />);

        expect(screen.getByText('General')).toBeInTheDocument();
        expect(screen.getByText('Cardiology')).toBeInTheDocument();
        expect(screen.getByText('Dermatology')).toBeInTheDocument();
        expect(screen.getByText('Pediatrics')).toBeInTheDocument();
        expect(screen.getByText('Psychiatry')).toBeInTheDocument();
        expect(screen.getByText('Orthopedics')).toBeInTheDocument();
    });

    it('calls onSelect with correct specialty when clicked', () => {
        render(<SpecialtySelection onSelect={mockOnSelect} />);

        const cardiologyButton = screen.getByText('Cardiology').closest('button');
        expect(cardiologyButton).toBeInTheDocument();

        if (cardiologyButton) {
            fireEvent.click(cardiologyButton);
        }

        expect(mockOnSelect).toHaveBeenCalledWith('CARDIOLOGY');
    });

    it('renders descriptions for specialties', () => {
        render(<SpecialtySelection onSelect={mockOnSelect} />);
        expect(screen.getByText('Heart health and cardiovascular care.')).toBeInTheDocument();
    });
});
