/**
 * @jest-environment jsdom
 * Tests for Calendar Component
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Calendar } from '@/components/ui/calendar';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronLeft: () => <div data-testid="chevron-left">Left</div>,
  ChevronRight: () => <div data-testid="chevron-right">Right</div>,
}));

describe('Calendar Component', () => {
  describe('Rendering', () => {
    it('should render calendar component', () => {
      const { container } = render(<Calendar />);
      expect(container.querySelector('.rdp')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<Calendar className="custom-calendar" />);
      const calendar = container.querySelector('.rdp');
      expect(calendar).toHaveClass('custom-calendar');
    });

    it('should include default padding', () => {
      const { container } = render(<Calendar />);
      const calendar = container.querySelector('.rdp');
      expect(calendar).toHaveClass('p-3');
    });
  });

  describe('Props Forwarding', () => {
    it('should forward DayPicker props', () => {
      const fromDate = new Date(2024, 0, 1);
      const toDate = new Date(2024, 11, 31);
      const { container } = render(<Calendar fromDate={fromDate} toDate={toDate} />);
      expect(container.querySelector('.rdp')).toBeInTheDocument();
    });

    it('should support range mode', () => {
      const { container } = render(<Calendar mode="range" />);
      expect(container.querySelector('.rdp')).toBeInTheDocument();
    });
  });

  describe('Display Name', () => {
    it('should have correct display name', () => {
      expect(Calendar.displayName).toBe('Calendar');
    });
  });
});