import { Button } from "@/components/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-gray-100 px-6">
      <section className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold mb-6">
          Build Habits. Track Streaks. Stay Motivated.
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          With StreakFlow, you get reminders where you want them, and we celebrate your wins with you!
        </p>
        <div className="flex gap-4 justify-center">
          <Button href="/onboarding "size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
            Get Started
          </Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </section>

      <footer className="mt-20 text-sm text-gray-500">
        © {new Date().getFullYear()} StreakFlow. All rights reserved.
      </footer>
    </main>
  );
}
