/**
 * Tests for the Square webhook conflict handling:
 * If Square confirms payment but confirming the consultation as PAID hits the slot-uniqueness constraint,
 * the system should mark the consultation as PAYMENT_FAILED and create an audit event.
 */

import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { prismaMock, resetPrismaMock, setupPrismaMock } from "../../helpers/prisma-mock";

// Mock Redis helper (webhook releases locks best-effort)
const mockRedisDel = jest.fn();
jest.mock("@/lib/redis", () => ({
  getRedis: async () => ({
    del: (...args: unknown[]) => mockRedisDel(...args),
  }),
  slotLockKey: (doctorId: string, scheduledStartAtMs: number) =>
    `slotlock:${doctorId}:${scheduledStartAtMs}`,
}));

describe("POST /api/v1/payments/webhook (conflict handling)", () => {
  beforeEach(() => {
    resetPrismaMock();
    setupPrismaMock();
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = "test-webhook-secret";
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
    mockRedisDel.mockReset();
  });

  it("should mark consultation PAYMENT_FAILED when payment is COMPLETED but consultation update to PAID fails with P2002", async () => {
    const { POST } = await import("@/app/api/v1/payments/webhook/route");

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay_1",
      consultationId: "consult_1",
      providerOrderId: "order_1",
    } as any);

    // Force the first $transaction (payment.update + consultation.update) to fail with a unique-violation.
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2002" });

    prismaMock.consultation.findUnique.mockResolvedValue({
      id: "consult_1",
      doctorId: "doc_1",
      scheduledStartAt: new Date("2030-01-01T10:00:00.000Z"),
    } as any);

    prismaMock.payment.update.mockResolvedValue({} as any);
    prismaMock.consultation.update.mockResolvedValue({} as any);
    prismaMock.auditEvent.create.mockResolvedValue({} as any);

    const body = JSON.stringify({
      type: "payment.updated",
      data: {
        object: {
          payment: {
            order_id: "order_1",
            status: "COMPLETED",
            id: "square_payment_1",
          },
        },
      },
    });

    const notificationUrl = process.env.NEXT_PUBLIC_BASE_URL + "/api/v1/payments/webhook";
    const signature = createHmac(
      "sha256",
      Buffer.from(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!, "base64")
    )
      .update(notificationUrl + body)
      .digest("base64");

    const request = new NextRequest(notificationUrl, {
      method: "POST",
      headers: {
        "x-square-hmacsha256-signature": signature,
        "content-type": "application/json",
      },
      body,
    } as any);

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Expect fallback transaction to run:
    // - payment updated to PAID
    // - consultation marked PAYMENT_FAILED
    // - audit event created
    expect(prismaMock.payment.update).toHaveBeenCalled();
    expect(prismaMock.consultation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "consult_1" },
        data: { status: "PAYMENT_FAILED" },
      })
    );
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultationId: "consult_1",
          eventType: "PAYMENT_CONFLICT_SLOT_TAKEN",
        }),
      })
    );

    // Best-effort lock release should be attempted
    expect(mockRedisDel).toHaveBeenCalled();
  });
});


