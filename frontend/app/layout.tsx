import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CricPulse — Live Cricket Scores',
  description: 'Real-time cricket scores powered by CricAPI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <header className="bg-green-800 py-4 px-6 shadow-md">
          <a href="/" className="text-2xl font-bold tracking-wide text-white">
            🏏 CricPulse
          </a>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
