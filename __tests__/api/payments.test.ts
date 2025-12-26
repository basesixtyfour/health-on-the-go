/**
 * Tests for POST /api/v1/payments
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockConsultation, resetFactories, UserRole, ConsultationStatus } from '../helpers/factories';
import { createMockSession } from '../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../helpers/prisma-mock';

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
    auth: {
        api: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
    },
}));

// Mock Square Client
const mockCreatePaymentLink = jest.fn();
jest.mock('@/lib/square', () => ({
    squareClient: {
        checkout: {
            createPaymentLink: (...args: unknown[]) => mockCreatePaymentLink(...args),
        },
    },
}));

// Mock crypto.randomUUID
jest.mock('crypto', () => ({
    randomUUID: () => 'mock-uuid',
}));

import { POST } from '@/app/api/v1/payments/route';

describe('POST /api/v1/payments', () => {
    beforeEach(() => {
        resetFactories();
        resetPrismaMock();
        setupPrismaMock();
        mockGetSession.mockReset();
        mockCreatePaymentLink.mockReset();

        // Setup default env vars
        process.env.SQUARE_LOCATION_ID = 'loc_123';
        process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    });

    const originalEnv = process.env;
    afterEach(() => {
        process.env = originalEnv;
    });

    function createRequest(body: object): NextRequest {
        return new NextRequest('http://localhost:3000/api/v1/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    describe('Authentication', () => {
        it('should return 401 when not authenticated', async () => {
            mockGetSession.mockResolvedValue(null);
            const request = createRequest({ consultationId: '123' });
            const response = await POST(request);
            expect(response.status).toBe(401);
        });
    });

    describe('Validation', () => {
        it('should return 400 when usage is invalid (missing consultationId)', async () => {
            const patient = createMockUser();
            mockGetSession.mockResolvedValue(createMockSession(patient));

            const request = createRequest({});
            const response = await POST(request);
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Business Logic', () => {
        it('should return 404 when consultation not found', async () => {
            const patient = createMockUser();
            mockGetSession.mockResolvedValue(createMockSession(patient));
            prismaMock.consultation.findUnique.mockResolvedValue(null);

            const request = createRequest({ consultationId: 'missing-id' });
            const response = await POST(request);

            expect(response.status).toBe(404);
        });

        it('should return 403 when user is not the patient', async () => {
            const patient = createMockUser({ id: 'patient-1' });
            const otherUser = createMockUser({ id: 'other-2' });
            mockGetSession.mockResolvedValue(createMockSession(otherUser));

            const consultation = createMockConsultation({ patientId: patient.id });
            prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

            const request = createRequest({ consultationId: consultation.id });
            const response = await POST(request);

            expect(response.status).toBe(403);
        });

        it('should return 409 when payment already exists', async () => {
            const patient = createMockUser();
            mockGetSession.mockResolvedValue(createMockSession(patient));

            const consultation = createMockConsultation({ patientId: patient.id });
            prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

            prismaMock.payment.findFirst.mockResolvedValue({ id: 'payment-1', status: 'PENDING' } as any);

            const request = createRequest({ consultationId: consultation.id });
            const response = await POST(request);

            expect(response.status).toBe(409);
        });

        it('should create payment link and return 201 on success', async () => {
            const patient = createMockUser();
            mockGetSession.mockResolvedValue(createMockSession(patient));

            const consultation = createMockConsultation({
                patientId: patient.id,
                specialty: 'DERMATOLOGY' // Ensure specialty is set for line item name
            });
            prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
            prismaMock.payment.findFirst.mockResolvedValue(null); // No existing payment

            mockCreatePaymentLink.mockResolvedValue({
                result: {
                    paymentLink: {
                        id: 'pl_123',
                        url: 'https://square.com/pay/pl_123',
                        order_id: 'order_123'
                    }
                }
            });

            prismaMock.payment.create.mockResolvedValue({
                id: 'pay_jb123',
                consultationId: consultation.id,
                status: 'PENDING'
            } as any);

            const request = createRequest({ consultationId: consultation.id });
            const response = await POST(request);

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.url).toBe('https://square.com/pay/pl_123');

            // Verify Square call
            expect(mockCreatePaymentLink).toHaveBeenCalledWith(expect.objectContaining({
                order: expect.objectContaining({
                    lineItems: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'DERMATOLOGY Consultation'
                        })
                    ])
                })
            }));

            // Verify DB creation
            expect(prismaMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    consultationId: consultation.id,
                    providerCheckoutId: 'pl_123'
                })
            }));
        });

        it('should fail gracefully if location ID is missing', async () => {
            delete process.env.SQUARE_LOCATION_ID;
            const patient = createMockUser();
            mockGetSession.mockResolvedValue(createMockSession(patient));

            const consultation = createMockConsultation({ patientId: patient.id });
            prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

            const request = createRequest({ consultationId: consultation.id });
            const response = await POST(request);

            expect(response.status).toBe(500);
        });
    });
});
