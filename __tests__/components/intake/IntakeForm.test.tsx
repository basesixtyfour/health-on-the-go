/**
 * @jest-environment jsdom
 * Tests for IntakeForm Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IntakeForm from '@/components/intake/IntakeForm';

// Mock the constants module
jest.mock('@/lib/constants', () => ({
  SPECIALTIES: [
    { id: 'GENERAL', label: 'General', icon: 'Stethoscope' },
    { id: 'CARDIOLOGY', label: 'Cardiology', icon: 'Heart' },
    { id: 'DERMATOLOGY', label: 'Dermatology', icon: 'Activity' },
    { id: 'PEDIATRICS', label: 'Pediatrics', icon: 'Baby' },
  ],
  AGE_RANGES: ['0-17', '18-39', '40-64', '65+'],
}));

describe('IntakeForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render form title', () => {
      render(<IntakeForm />);
      expect(screen.getByText('Patient Intake')).toBeInTheDocument();
    });

    it('should render name input field', () => {
      render(<IntakeForm />);
      const nameInput = screen.getByPlaceholderText('John Doe');
      expect(nameInput).toBeInTheDocument();
    });

    it('should show fee when specialty is pre-selected', () => {
      render(<IntakeForm defaultSpecialty="CARDIOLOGY" />);
      expect(screen.getByText('$50')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data', async () => {
      render(<IntakeForm onSubmit={mockOnSubmit} defaultSpecialty="CARDIOLOGY" />);
      
      const nameInput = screen.getByPlaceholderText('John Doe');
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      
      const form = nameInput.closest('form');
      if (form) {
        fireEvent.submit(form);
        
        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalled();
        });
      }
    });
  });
});