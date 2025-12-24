import IntakeForm from "@/components/intake/IntakeForm";

/**
 * The Server Component route that renders the Patient Intake Form.
 */
export default function IntakePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto py-12">
        <IntakeForm />
      </div>
    </div>
  );
}