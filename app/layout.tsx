import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: "Nen's Memories",
  description: '“I’ve tried so many times to think of a new way to say it, and it’s still I love you.” —Zelda Fitzgerald'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
