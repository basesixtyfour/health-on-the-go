import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConsultationStatus } from "@/app/generated/prisma/client";

interface DoctorVideoSessionCardProps {
  userId: string;
}

/**
 * Server component that fetches and displays active video sessions for the doctor.
 * Shows consultations assigned to this doctor with PAID or IN_CALL status.
 */
export async function DoctorVideoSessionCard({
  userId,
}: DoctorVideoSessionCardProps) {
  // Fetch consultations assigned to this doctor with PAID or IN_CALL status
  const activeConsultations = await prisma.consultation.findMany({
    where: {
      doctorId: userId,
      status: {
        in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
      },
    },
    include: {
      patient: {
        select: {
          name: true,
        },
      },
      patientIntake: {
        select: {
          nameOrAlias: true,
          chiefComplaint: true,
        },
      },
    },
    orderBy: {
      scheduledStartAt: "asc",
    },
    take: 5,
  });

  // Check if any consultation is within the join window
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const EARLY_JOIN_WINDOW = 5 * 60 * 1000;
  const LATE_JOIN_WINDOW = 30 * 60 * 1000;

  const joinableConsultations = activeConsultations.filter((consult) => {
    if (!consult.scheduledStartAt) return true;
    const scheduledTime = consult.scheduledStartAt.getTime();
    const earlyBoundary = scheduledTime - EARLY_JOIN_WINDOW;
    const lateBoundary = scheduledTime + LATE_JOIN_WINDOW;
    return now >= earlyBoundary && now <= lateBoundary;
  });

  if (joinableConsultations.length === 0) {
    return (
      <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Active Consultations
          </CardTitle>
          <Video className="h-4 w-4 text-slate-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">No Active Calls</div>
          <p className="text-xs text-slate-500 mt-1">
            You have no consultations ready to join.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-emerald-50 dark:bg-emerald-900/20 shadow-sm border-emerald-200 dark:border-emerald-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Active Consultations ({joinableConsultations.length})
        </CardTitle>
        <Video className="h-4 w-4 text-emerald-600" />
      </CardHeader>
      <CardContent className="space-y-3">
        {joinableConsultations.map((consult) => {
          const patientName =
            consult.patientIntake?.nameOrAlias ||
            consult.patient?.name ||
            "Patient";
          const isInProgress = consult.status === ConsultationStatus.IN_CALL;

          return (
            <div
              key={consult.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {patientName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {consult.specialty}
                  {consult.patientIntake?.chiefComplaint &&
                    ` • ${consult.patientIntake.chiefComplaint.slice(
                      0,
                      30
                    )}...`}
                </p>
              </div>
              <Link href={`/video/${consult.id}`}>
                <Button
                  size="sm"
                  className={
                    isInProgress
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }
                >
                  {isInProgress ? "Rejoin" : "Join"}
                </Button>
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
