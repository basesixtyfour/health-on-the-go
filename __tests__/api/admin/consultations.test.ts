/**
 * Tests for GET /api/v1/admin/consultations
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockAdmin, createMockConsultation, resetFactories, UserRole } from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../../helpers/prisma-mock';

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
    auth: {
        api: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
    },
}));

import { GET } from '@/app/api/v1/admin/consultations/route';

describe('GET /api/v1/admin/consultations', () => {
    beforeEach(() => {
        resetFactories();
        resetPrismaMock();
        setupPrismaMock();
        mockGetSession.mockReset();
    });

    function createRequest(query?: string): NextRequest {
        return new NextRequest(`http://localhost:3000/api/v1/admin/consultations${query ? '?' + query : ''}`, {
            method: 'GET',
        });
    }

    it('should return 401 when not authenticated', async () => {
        mockGetSession.mockResolvedValue(null);
        const request = createRequest();
        const response = await GET(request);
        expect(response.status).toBe(401);
    });

    it('should return 403 when user is not an ADMIN', async () => {
        const patient = createMockUser({ role: UserRole.PATIENT });
        mockGetSession.mockResolvedValue(createMockSession(patient));

        const request = createRequest();
        const response = await GET(request);

        expect(response.status).toBe(403);
    });

    it('should return list of consultations for ADMIN', async () => {
        const admin = createMockAdmin();
        mockGetSession.mockResolvedValue(createMockSession(admin));

        const consultations = [
            createMockConsultation(),
            createMockConsultation(),
        ];

        prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
        prismaMock.consultation.count.mockResolvedValue(2);

        const request = createRequest();
        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toHaveLength(2);
        expect(body.meta.total).toBe(2);
    });

    it('should apply filters correctly', async () => {
        const admin = createMockAdmin();
        mockGetSession.mockResolvedValue(createMockSession(admin));

        prismaMock.consultation.findMany.mockResolvedValue([]);
        prismaMock.consultation.count.mockResolvedValue(0);

        const request = createRequest('status=CREATED&limit=10');
        await GET(request);

        expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: 'CREATED'
            }),
            take: 10
        }));
    });
});
