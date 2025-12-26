import { BookingWizard } from "@/components/booking/BookingWizard";
import { requireAuth } from "@/lib/api-utils";
import { redirect } from "next/navigation";

export default async function BookingPage() {
    const { session } = await requireAuth();

    if (!session) {
        redirect("/");
    }

    return (
        <div className="container mx-auto py-10">
            <BookingWizard />
        </div>
    );
}
