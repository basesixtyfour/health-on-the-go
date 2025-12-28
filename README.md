# Health on the Go

A modern telehealth platform built with Next.js that enables patients to book and conduct video consultations with doctors.

## Features

- 🔐 **OAuth Authentication** - Secure Google OAuth login via Better Auth
- 👨‍⚕️ **Doctor Management** - Browse doctors by specialty with availability slots
- 📅 **Smart Scheduling** - Timezone-aware appointment booking
- 💳 **Payment Integration** - Square payment processing support
- 📹 **Video Sessions** - Daily.co video consultation integration
- 📋 **Patient Intake** - Digital intake forms with consent management
- 🔒 **Role-Based Access** - Patient, Doctor, and Admin roles

## Documentation

- 📚 [**API Documentation**](./docs/API.md) - Complete REST API reference

## Project Video
- [**Demo**](https://youtu.be/hpjOMS0qcyw)

## Tech Stack

- **Framework:** Next.js 16.1.1 (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Better Auth with Google OAuth
- **Language:** TypeScript
- **Styling:** CSS

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
