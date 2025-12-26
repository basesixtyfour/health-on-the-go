/**
 * Tests for PayButton Component
 * 
 * Tests the payment initiation button including:
 * - Payment flow initiation
 * - Error handling
 * - Loading states
 * - User interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PayButton } from '@/components/patient/PayButton';

// Mock window.location
const mockLocationAssign = jest.fn();
delete (window as any).location;
window.location = { href: '' } as any;
Object.defineProperty(window.location, 'href', {
  writable: true,
  value: '',
});

// Mock window.alert
global.alert = jest.fn();

// Mock fetch
global.fetch = jest.fn();

describe('PayButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (global.alert as jest.Mock).mockClear();
  });

  describe('Rendering', () => {
    it('should render pay button with correct text', () => {
      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button', { name: /pay now/i });
      expect(button).toBeInTheDocument();
    });

    it('should render credit card icon', () => {
      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have correct styling classes', () => {
      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
      expect(button).toHaveClass('gap-2');
      expect(button).toHaveClass('bg-amber-600');
      expect(button).toHaveClass('hover:bg-amber-700');
    });
  });

  describe('Payment Flow', () => {
    it('should initiate payment on button click', async () => {
      const mockPaymentResponse = {
        url: 'https://square.example.com/checkout/abc123',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentResponse,
      });

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button', { name: /pay now/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/payments',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consultationId: 'consult_123' }),
          })
        );
      });
    });

    it('should redirect to payment URL on success', async () => {
      const mockPaymentResponse = {
        url: 'https://square.example.com/checkout/abc123',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentResponse,
      });

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(window.location.href).toBe('https://square.example.com/checkout/abc123');
      });
    });

    it('should show loading state during payment initiation', async () => {
      let resolvePayment: any;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(paymentPromise);

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Button should show loading state
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Button should be disabled during loading
      expect(button).toBeDisabled();

      // Resolve payment
      resolvePayment({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });
    });

    it('should show loader icon during loading', async () => {
      let resolvePayment: any;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(paymentPromise);

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const loaderIcon = button.querySelector('.animate-spin');
        expect(loaderIcon).toBeInTheDocument();
      });

      resolvePayment({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on payment API error', async () => {
      const mockError = {
        error: {
          message: 'Payment processing failed',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      });

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Payment processing failed');
      });
    });

    it('should show generic error message when API error has no message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initiate payment')
        );
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Network error');
      });
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initiate payment. Please try again.')
        );
      });
    });

    it('should re-enable button after error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalled();
      });

      // Button should be enabled again after error
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Payment error:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Multiple Clicks', () => {
    it('should prevent multiple simultaneous payment initiations', async () => {
      let resolvePayment: any;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValue(paymentPromise);

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      
      // Click multiple times rapidly
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      resolvePayment({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });
    });
  });

  describe('Consultation ID Handling', () => {
    it('should send correct consultation ID to payment API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });

      render(<PayButton consultationId="special_consult_789" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/payments',
          expect.objectContaining({
            body: JSON.stringify({ consultationId: 'special_consult_789' }),
          })
        );
      });
    });

    it('should handle different consultation ID formats', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });

      const { rerender } = render(<PayButton consultationId="uuid-format-123-456" />);
      
      let button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/payments',
          expect.objectContaining({
            body: JSON.stringify({ consultationId: 'uuid-format-123-456' }),
          })
        );
      });

      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });

      rerender(<PayButton consultationId="cuid_abcdef123" />);
      
      button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/payments',
          expect.objectContaining({
            body: JSON.stringify({ consultationId: 'cuid_abcdef123' }),
          })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should properly disable button during loading', async () => {
      let resolvePayment: any;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValue(paymentPromise);

      render(<PayButton consultationId="consult_123" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('disabled');
      });

      resolvePayment({
        ok: true,
        json: async () => ({ url: 'https://example.com/pay' }),
      });
    });
  });
});