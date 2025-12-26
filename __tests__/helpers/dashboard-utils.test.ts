/**
 * Tests for Dashboard Utility Functions
 */

describe('Dashboard Utilities', () => {
  describe('formatDateTime', () => {
    const formatDateTime = (date: Date) => {
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (days === 0) {
        if (hours === 0) return "Starting soon";
        return `In ${hours} hour${hours > 1 ? 's' : ''}`;
      } else if (days === 1) {
        return "Tomorrow";
      } else {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
    };

    it('should show "Starting soon" for appointments within an hour', () => {
      const now = new Date();
      const soonDate = new Date(now.getTime() + 30 * 60 * 1000);
      expect(formatDateTime(soonDate)).toBe("Starting soon");
    });

    it('should show hours for same day appointments', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      expect(formatDateTime(futureDate)).toBe("In 3 hours");
    });

    it('should show "Tomorrow" for next day', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatDateTime(tomorrow)).toBe("Tomorrow");
    });

    it('should handle singular hour', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      expect(formatDateTime(futureDate)).toBe("In 1 hour");
    });
  });

  describe('getStatusVariant', () => {
    const getStatusVariant = (status: string) => {
      switch (status) {
        case 'COMPLETED': return 'default';
        case 'PAID': return 'secondary';
        case 'IN_CALL': return 'destructive';
        case 'CANCELLED': return 'outline';
        case 'PAYMENT_FAILED': return 'destructive';
        case 'CREATED': return 'outline';
        case 'PAYMENT_PENDING': return 'outline';
        default: return 'outline';
      }
    };

    it('should return correct variant for each status', () => {
      expect(getStatusVariant('COMPLETED')).toBe('default');
      expect(getStatusVariant('PAID')).toBe('secondary');
      expect(getStatusVariant('IN_CALL')).toBe('destructive');
      expect(getStatusVariant('CANCELLED')).toBe('outline');
      expect(getStatusVariant('PAYMENT_FAILED')).toBe('destructive');
    });

    it('should return outline for unknown status', () => {
      expect(getStatusVariant('UNKNOWN_STATUS')).toBe('outline');
      expect(getStatusVariant('')).toBe('outline');
    });
  });
});