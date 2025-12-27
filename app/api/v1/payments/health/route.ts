import { NextRequest } from "next/server";
import { squareClient } from "@/lib/square";
import { successResponse, errorResponse, ErrorCodes } from "@/lib/api-utils";

/**
 * GET /api/v1/payments/health
 * 
 * Health check endpoint to verify Square API connection.
 * Returns environment info and validates credentials.
 */
export async function GET(_request: NextRequest) {
    try {
        // Check if env vars are set
        const hasToken = !!process.env.SQUARE_ACCESS_TOKEN;
        const hasLocationId = !!process.env.SQUARE_LOCATION_ID;
        const environment = process.env.NODE_ENV;
        const squareEnv = process.env.SQUARE_ENVIRONMENT || "auto";

        if (!hasToken || !hasLocationId) {
            return successResponse({
                status: "error",
                message: "Missing Square configuration",
                config: {
                    hasToken,
                    hasLocationId,
                    environment,
                    squareEnv,
                }
            });
        }

        // Try to fetch locations to verify credentials
        const result = await squareClient.locations.list();

        return successResponse({
            status: "ok",
            message: "Square connection successful",
            config: {
                hasToken,
                hasLocationId,
                environment,
                squareEnv,
                locationsFound: result.locations?.length ?? 0,
            }
        });

    } catch (error) {
        return errorResponse(
            ErrorCodes.INTERNAL_ERROR,
            `Square connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            500,
            {
                hasToken: !!process.env.SQUARE_ACCESS_TOKEN,
                hasLocationId: !!process.env.SQUARE_LOCATION_ID,
                environment: process.env.NODE_ENV,
            }
        );
    }
}
