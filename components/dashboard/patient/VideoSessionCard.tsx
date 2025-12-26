import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConsultationStatus } from "@/app/generated/prisma/client";

interface VideoSessionCardProps {
  userId: string;
}

/**
 * Server component that fetches and displays active video sessions for the user.
 * Shows consultations with PAID or IN_CALL status that are within the join window.
 */
export async function VideoSessionCard({ userId }: VideoSessionCardProps) {
  // Fetch consultations with PAID or IN_CALL status
  const activeConsultations = await prisma.consultation.findMany({
    where: {
      patientId: userId,
      status: {
        in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
      },
    },
    include: {
      doctor: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      scheduledStartAt: "asc",
    },
    take: 3,
  });

  // Check if any consultation is within the join window (5 min early to 30 min late)
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const EARLY_JOIN_WINDOW = 5 * 60 * 1000; // 5 minutes
  const LATE_JOIN_WINDOW = 30 * 60 * 1000; // 30 minutes

  const joinableConsultations = activeConsultations.filter((consult) => {
    if (!consult.scheduledStartAt) return true; // No scheduled time = always joinable
    const scheduledTime = consult.scheduledStartAt.getTime();
    const earlyBoundary = scheduledTime - EARLY_JOIN_WINDOW;
    const lateBoundary = scheduledTime + LATE_JOIN_WINDOW;
    return now >= earlyBoundary && now <= lateBoundary;
  });

  const upcomingConsultations = activeConsultations.filter((consult) => {
    if (!consult.scheduledStartAt) return false;
    const scheduledTime = consult.scheduledStartAt.getTime();
    const earlyBoundary = scheduledTime - EARLY_JOIN_WINDOW;
    return now < earlyBoundary;
  });

  // Has active session that can be joined now
  const activeSession = joinableConsultations[0];
  const upcomingSession = upcomingConsultations[0];

  if (activeSession) {
    const minutesUntil = activeSession.scheduledStartAt
      ? Math.round((activeSession.scheduledStartAt.getTime() - now) / 60000)
      : 0;
    const isInProgress = activeSession.status === ConsultationStatus.IN_CALL;

    return (
      <Card className="bg-emerald-50 dark:bg-emerald-900/20 shadow-sm border-emerald-200 dark:border-emerald-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {isInProgress ? "Call In Progress" : "Ready to Join"}
          </CardTitle>
          <Video className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {activeSession.specialty} Consultation
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {activeSession.doctor?.name
              ? `With ${activeSession.doctor.name}`
              : "Doctor will join shortly"}
            {minutesUntil > 0 && ` • Starts in ${minutesUntil} min`}
          </p>
          <Link href={`/video/${activeSession.id}`}>
            <Button
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
              variant="default"
            >
              Join Video Call
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (upcomingSession) {
    const minutesUntil = upcomingSession.scheduledStartAt
      ? Math.round((upcomingSession.scheduledStartAt.getTime() - now) / 60000)
      : 0;
    const hoursUntil = Math.floor(minutesUntil / 60);
    const displayTime =
      hoursUntil >= 1
        ? `${hoursUntil}h ${minutesUntil % 60}m`
        : `${minutesUntil} min`;

    return (
      <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Video Sessions</CardTitle>
          <Video className="h-4 w-4 text-slate-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{upcomingSession.specialty}</div>
          <p className="text-xs text-slate-500 mt-1">
            Starts in {displayTime}
            {upcomingSession.doctor?.name &&
              ` • ${upcomingSession.doctor.name}`}
          </p>
          <Button className="w-full mt-4" variant="outline" disabled>
            Opens in {displayTime}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No active sessions
  return (
    <Card className="bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Video Sessions</CardTitle>
        <Video className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">Join Room</div>
        <p className="text-xs text-slate-500 mt-1">
          Enter your waiting room 5 mins early.
        </p>
        <Button className="w-full mt-4" variant="default" disabled>
          No Active Session
        </Button>
      </CardContent>
    </Card>
  );
}
