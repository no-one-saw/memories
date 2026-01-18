import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: "Nen's Memories",
  description: 'Your private notes — available only in the mobile client.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
