import * as dotenv from "dotenv";

dotenv.config();

import {
  UserRole,
  ConsultationStatus,
  PaymentStatus,
} from "../app/generated/prisma/client";
import { prisma } from "../prisma";

if (!prisma) {
  console.error("ERROR: Prisma client instance is not available.");
  process.exit(1);
}

// ============================================
// Test Data Configuration
// ============================================

const SPECIALTIES = [
  "General Practice",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
  "Neurology",
  "Psychiatry",
  "Oncology",
];

// ============================================
// Utility Functions
// ============================================

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateCUID(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function generateCompletedConsultationDates(
  oneWeekAgo: Date,
  now: Date
): { scheduledStartAt: Date; startedAt: Date; endedAt: Date } {
  // Pick scheduledStartAt between oneWeekAgo and now
  const scheduledStartAt = randomDate(oneWeekAgo, now);

  // startedAt is scheduledStartAt plus a small random offset (up to 1 hour)
  const startOffsetMs = Math.random() * 60 * 60 * 1000; // 0 to 1 hour in milliseconds
  const startedAt = new Date(scheduledStartAt.getTime() + startOffsetMs);

  // endedAt is startedAt plus a small random offset (up to 1 hour)
  const endOffsetMs = Math.random() * 60 * 60 * 1000; // 0 to 1 hour in milliseconds
  const endedAt = new Date(startedAt.getTime() + endOffsetMs);

  // Ensure endedAt doesn't exceed now
  if (endedAt > now) {
    endedAt.setTime(now.getTime());
  }

  return { scheduledStartAt, startedAt, endedAt };
}

// ============================================
// Seed Data
// ============================================

async function createUsers() {
  console.log("🌱 Creating users...");

  const users = [
    // Admin users
    {
      id: generateCUID(),
      name: "System Admin",
      email: "admin@healthonthego.com",
      emailVerified: true,
      role: UserRole.ADMIN,
      image: "https://i.pravatar.cc/150?u=admin",
    },
    // Doctor users
    {
      id: generateCUID(),
      name: "Dr. Sarah Johnson",
      email: "sarah.johnson@healthonthego.com",
      emailVerified: true,
      role: UserRole.DOCTOR,
      image: "https://i.pravatar.cc/150?u=sarah",
    },
    {
      id: generateCUID(),
      name: "Dr. Michael Chen",
      email: "michael.chen@healthonthego.com",
      emailVerified: true,
      role: UserRole.DOCTOR,
      image: "https://i.pravatar.cc/150?u=michael",
    },
    {
      id: generateCUID(),
      name: "Dr. Emily Davis",
      email: "emily.davis@healthonthego.com",
      emailVerified: true,
      role: UserRole.DOCTOR,
      image: "https://i.pravatar.cc/150?u=emily",
    },
    {
      id: generateCUID(),
      name: "Dr. Robert Williams",
      email: "robert.williams@healthonthego.com",
      emailVerified: true,
      role: UserRole.DOCTOR,
      image: "https://i.pravatar.cc/150?u=robert",
    },
    // Patient users
    {
      id: generateCUID(),
      name: "Alice Thompson",
      email: "alice.thompson@example.com",
      emailVerified: true,
      role: UserRole.PATIENT,
      image: "https://i.pravatar.cc/150?u=alice",
    },
    {
      id: generateCUID(),
      name: "Bob Martinez",
      email: "bob.martinez@example.com",
      emailVerified: true,
      role: UserRole.PATIENT,
      image: "https://i.pravatar.cc/150?u=bob",
    },
    {
      id: generateCUID(),
      name: "Carol White",
      email: "carol.white@example.com",
      emailVerified: true,
      role: UserRole.PATIENT,
      image: "https://i.pravatar.cc/150?u=carol",
    },
    {
      id: generateCUID(),
      name: "David Brown",
      email: "david.brown@example.com",
      emailVerified: false,
      role: UserRole.PATIENT,
      image: "https://i.pravatar.cc/150?u=david",
    },
    {
      id: generateCUID(),
      name: "Eva Garcia",
      email: "eva.garcia@example.com",
      emailVerified: true,
      role: UserRole.PATIENT,
      image: "https://i.pravatar.cc/150?u=eva",
    },
  ];

  const createdUsers = await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: user,
      })
    )
  );

  console.log(`   ✅ Created ${createdUsers.length} users`);
  return createdUsers;
}

async function createDoctorProfiles(doctors: { id: string; name: string }[]) {
  console.log("🩺 Creating doctor profiles...");

  const profiles = [
    {
      doctorId: doctors[0].id,
      specialties: ["General Practice", "Pediatrics"],
      licenseId: "MD-2024-001",
      timezone: "America/New_York",
    },
    {
      doctorId: doctors[1].id,
      specialties: ["Cardiology", "General Practice"],
      licenseId: "MD-2024-002",
      timezone: "America/Los_Angeles",
    },
    {
      doctorId: doctors[2].id,
      specialties: ["Dermatology"],
      licenseId: "MD-2024-003",
      timezone: "America/Chicago",
    },
    {
      doctorId: doctors[3].id,
      specialties: ["Neurology", "Psychiatry"],
      licenseId: "MD-2024-004",
      timezone: "America/Denver",
    },
  ];

  const createdProfiles = await Promise.all(
    profiles.map((profile) =>
      prisma.doctorProfile.upsert({
        where: { doctorId: profile.doctorId },
        update: {},
        create: profile,
      })
    )
  );

  console.log(`   ✅ Created ${createdProfiles.length} doctor profiles`);
  return createdProfiles;
}

async function createConsultations(
  patients: { id: string }[],
  doctors: { id: string }[]
) {
  console.log("📅 Creating consultations...");

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const consultations = [
    // Completed consultations
    (() => {
      const dates = generateCompletedConsultationDates(oneWeekAgo, now);
      return {
        id: generateCUID(),
        patientId: patients[0].id,
        doctorId: doctors[0].id,
        specialty: "General Practice",
        status: ConsultationStatus.COMPLETED,
        scheduledStartAt: dates.scheduledStartAt,
        startedAt: dates.startedAt,
        endedAt: dates.endedAt,
      };
    })(),
    (() => {
      const dates = generateCompletedConsultationDates(oneWeekAgo, now);
      return {
        id: generateCUID(),
        patientId: patients[1].id,
        doctorId: doctors[1].id,
        specialty: "Cardiology",
        status: ConsultationStatus.COMPLETED,
        scheduledStartAt: dates.scheduledStartAt,
        startedAt: dates.startedAt,
        endedAt: dates.endedAt,
      };
    })(),
    // Paid - ready for consultation
    {
      id: generateCUID(),
      patientId: patients[2].id,
      doctorId: doctors[2].id,
      specialty: "Dermatology",
      status: ConsultationStatus.PAID,
      scheduledStartAt: randomDate(now, oneWeekLater),
    },
    // Payment pending
    {
      id: generateCUID(),
      patientId: patients[3].id,
      doctorId: null,
      specialty: "General Practice",
      status: ConsultationStatus.PAYMENT_PENDING,
      scheduledStartAt: randomDate(now, oneWeekLater),
    },
    // Created (just started)
    {
      id: generateCUID(),
      patientId: patients[4].id,
      doctorId: null,
      specialty: "Pediatrics",
      status: ConsultationStatus.CREATED,
    },
    // In call
    {
      id: generateCUID(),
      patientId: patients[0].id,
      doctorId: doctors[3].id,
      specialty: "Neurology",
      status: ConsultationStatus.IN_CALL,
      scheduledStartAt: now,
      startedAt: now,
    },
    // Cancelled
    {
      id: generateCUID(),
      patientId: patients[1].id,
      doctorId: doctors[0].id,
      specialty: "General Practice",
      status: ConsultationStatus.CANCELLED,
      scheduledStartAt: randomDate(oneWeekAgo, now),
    },
    // Expired
    {
      id: generateCUID(),
      patientId: patients[2].id,
      doctorId: null,
      specialty: "Cardiology",
      status: ConsultationStatus.EXPIRED,
      scheduledStartAt: randomDate(oneWeekAgo, now),
    },
  ];

  const createdConsultations = await Promise.all(
    consultations.map((consultation) =>
      prisma.consultation.create({
        data: consultation,
      })
    )
  );

  console.log(`   ✅ Created ${createdConsultations.length} consultations`);
  return createdConsultations;
}

async function createPatientIntakes(
  consultations: { id: string; status: ConsultationStatus }[]
) {
  console.log("📋 Creating patient intakes...");

  const ageRanges = ["18-39", "40-64", "65+"];
  const chiefComplaints = [
    "Persistent headaches for the past week",
    "Skin rash on arms and legs",
    "Difficulty breathing during exercise",
    "General checkup and wellness consultation",
    "Follow-up on previous treatment",
    "Chest pain and discomfort",
    "Anxiety and stress management",
  ];

  // Create intakes for consultations that are beyond CREATED status
  const eligibleConsultations = consultations.filter(
    (c) => c.status !== ConsultationStatus.CREATED
  );

  const intakes = eligibleConsultations.map((consultation) => ({
    consultationId: consultation.id,
    nameOrAlias: `Patient_${Math.random().toString(36).slice(2, 8)}`,
    ageRange: randomItem(ageRanges),
    chiefComplaint: randomItem(chiefComplaints),
    consentAcceptedAt: new Date(),
  }));

  const createdIntakes = await Promise.all(
    intakes.map((intake) =>
      prisma.patientIntake.create({
        data: intake,
      })
    )
  );

  console.log(`   ✅ Created ${createdIntakes.length} patient intakes`);
  return createdIntakes;
}

async function createPayments(
  consultations: { id: string; status: ConsultationStatus }[]
) {
  console.log("💳 Creating payments...");

  const payments: {
    consultationId: string;
    provider: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    providerCheckoutId?: string;
    providerPaymentId?: string;
    providerOrderId?: string;
    paidAt?: Date;
  }[] = [];

  consultations.forEach((consultation) => {
    if (
      consultation.status === ConsultationStatus.COMPLETED ||
      consultation.status === ConsultationStatus.PAID ||
      consultation.status === ConsultationStatus.IN_CALL
    ) {
      payments.push({
        consultationId: consultation.id,
        provider: "SQUARE",
        status: PaymentStatus.PAID,
        amount: 9900, // $99.00
        currency: "USD",
        providerCheckoutId: `chkout_${generateCUID()}`,
        providerPaymentId: `pay_${generateCUID()}`,
        providerOrderId: `order_${generateCUID()}`,
        paidAt: new Date(),
      });
    } else if (consultation.status === ConsultationStatus.PAYMENT_PENDING) {
      payments.push({
        consultationId: consultation.id,
        provider: "SQUARE",
        status: PaymentStatus.PENDING,
        amount: 9900,
        currency: "USD",
        providerCheckoutId: `chkout_${generateCUID()}`,
      });
    } else if (consultation.status === ConsultationStatus.PAYMENT_FAILED) {
      payments.push({
        consultationId: consultation.id,
        provider: "SQUARE",
        status: PaymentStatus.FAILED,
        amount: 9900,
        currency: "USD",
        providerCheckoutId: `chkout_${generateCUID()}`,
      });
    } else if (consultation.status === ConsultationStatus.CANCELLED) {
      payments.push({
        consultationId: consultation.id,
        provider: "SQUARE",
        status: PaymentStatus.REFUNDED,
        amount: 9900,
        currency: "USD",
        providerCheckoutId: `chkout_${generateCUID()}`,
        providerPaymentId: `pay_${generateCUID()}`,
        providerOrderId: `order_${generateCUID()}`,
      });
    }
  });

  const createdPayments = await Promise.all(
    payments.map((payment) =>
      prisma.payment.create({
        data: payment,
      })
    )
  );

  console.log(`   ✅ Created ${createdPayments.length} payments`);
  return createdPayments;
}

async function createVideoSessions(
  consultations: { id: string; status: ConsultationStatus }[]
) {
  console.log("📹 Creating video sessions...");

  const sessionsToCreate = consultations.filter(
    (c) =>
      c.status === ConsultationStatus.COMPLETED ||
      c.status === ConsultationStatus.IN_CALL
  );

  const sessions = sessionsToCreate.map((consultation) => ({
    consultationId: consultation.id,
    provider: "DAILY",
    roomName: `room_${generateCUID()}`,
    roomUrl: `https://health-on-the-go.daily.co/room_${generateCUID()}`,
    endedAt:
      consultation.status === ConsultationStatus.COMPLETED ? new Date() : null,
  }));

  const createdSessions = await Promise.all(
    sessions.map((session) =>
      prisma.videoSession.create({
        data: session,
      })
    )
  );

  console.log(`   ✅ Created ${createdSessions.length} video sessions`);
  return createdSessions;
}

async function createAuditEvents(
  users: { id: string }[],
  consultations: { id: string }[]
) {
  console.log("📝 Creating audit events...");

  const eventTypes = [
    "CONSULT_CREATED",
    "PAYMENT_INITIATED",
    "PAYMENT_CONFIRMED",
    "CALL_STARTED",
    "CALL_ENDED",
    "JOIN_TOKEN_MINTED",
    "USER_LOGIN",
    "USER_LOGOUT",
  ];

  const events = [];

  // Create events for each consultation
  for (const consultation of consultations) {
    const user = randomItem(users);
    events.push({
      actorUserId: user.id,
      consultationId: consultation.id,
      eventType: "CONSULT_CREATED",
      eventMetadata: { source: "web", version: "1.0.0" },
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
  }

  // Create some additional random audit events
  for (let i = 0; i < 15; i++) {
    events.push({
      actorUserId: randomItem(users).id,
      consultationId: randomItem(consultations).id,
      eventType: randomItem(eventTypes),
      eventMetadata: { action: "test_seed", iteration: i },
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(
        Math.random() * 255
      )}`,
      userAgent: "Mozilla/5.0 (Test Seed Script)",
    });
  }

  const createdEvents = await Promise.all(
    events.map((event) =>
      prisma.auditEvent.create({
        data: event,
      })
    )
  );

  console.log(`   ✅ Created ${createdEvents.length} audit events`);
  return createdEvents;
}

// ============================================
// Main Seed Function
// ============================================

async function main() {
  console.log("\n🚀 Starting database seed...\n");
  console.log("━".repeat(50));

  try {
    // Create users first
    const users = await createUsers();

    // Filter users by role
    const doctors = users.filter((u) => u.role === UserRole.DOCTOR);
    const patients = users.filter((u) => u.role === UserRole.PATIENT);

    // Create doctor profiles
    await createDoctorProfiles(doctors);

    // Create consultations
    const consultations = await createConsultations(patients, doctors);

    // Create patient intakes
    await createPatientIntakes(consultations);

    // Create payments
    await createPayments(consultations);

    // Create video sessions
    await createVideoSessions(consultations);

    // Create audit events
    await createAuditEvents(users, consultations);

    console.log("\n" + "━".repeat(50));
    console.log("✨ Database seeded successfully!\n");

    // Print summary
    console.log("📊 Summary:");
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Doctors: ${doctors.length}`);
    console.log(`   • Patients: ${patients.length}`);
    console.log(`   • Consultations: ${consultations.length}`);
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });