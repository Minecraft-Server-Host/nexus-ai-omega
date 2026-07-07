import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nexus AI Omega — Command Center v2.2',
  description: 'Next-gen Discord platform • Zero-Trust • 18 AI modules',
  manifest: '/manifest.json',
  themeColor: '#7c3aed'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#05060f] text-[#e8ecff] antialiased">{children}</body>
    </html>
  );
}
