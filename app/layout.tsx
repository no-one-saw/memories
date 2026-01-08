import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: "Nen's Memories",
  description: 'Password-protected notes'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
