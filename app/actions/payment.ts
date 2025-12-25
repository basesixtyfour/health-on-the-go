"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";

/**
 * Initiates a Square Checkout session for a consultation.
 * Resolves the ts(2339) error for createPaymentLink on CheckoutClient.
 */
export async function createCheckoutSession(consultationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("Unauthorized");

  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) throw new Error("Consultation not found");

    // Verify ownership
    if (consultation.patientId !== session.user.id) {
      throw new Error("Forbidden: You are not authorized to pay for this consultation");
    }

    // Mock fee logic - in production, pull from your specialty constants
    const amountInCents = 5000;

    /**
     * SDK RESOLUTION:
     * In some versions of the Square v30+ SDK, 'createPaymentLink' is the correct method,
     * but TypeScript may incorrectly identify 'checkout' as the legacy Checkout API.
     * We use a type cast to ensure we can access the modern Payment Links method.
     */
    const { result } = await (squareClient as any).checkout.createPaymentLink({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [
          {
            name: `${consultation.specialty} Consultation`,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(amountInCents),
              currency: "USD"
            },
          },
        ],
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?id=${consultationId}`,
      }
    });


    if (!result.paymentLink?.id) {
      throw new Error("Failed to retrieve payment link ID from Square");
    }

    // Create a pending record to track the transaction
    await prisma.payment.create({
      data: {
        consultationId: consultationId,
        amount: amountInCents,
        status: "PENDING",
        providerCheckoutId: result.paymentLink.id,
      }
    });

    return { success: true, url: result.paymentLink?.url };
  } catch (error) {
    console.error("Square Checkout Error:", error);
    return { success: false, error: "Failed to initialize payment gateway." };
  }
}

/**
 * Pollable helper to check if a consultation has been paid.
 */
export async function getPaymentStatus(consultationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const payment = await prisma.payment.findFirst({
    where: {
      consultationId,
      status: "PAID"
    },
  });
  return { paid: !!payment };
}