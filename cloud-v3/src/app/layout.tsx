import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Gate Controller",
  description: "A web interface for controlling an automated gate",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/apple-touch-startup-image.png",
      },
      {
        url: "/apple-touch-startup-image-dark.png",
        media: "screen and (prefers-color-scheme: dark)",
      },
    ],
  },
  other: {
    // Needed for splash screen on iOS because of this bug:
    // https://github.com/vercel/next.js/issues/74524#issuecomment-2765443131
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
