import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import ClientInit from '@/components/client-init';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Gate Controller',
  description: 'A web interface for controlling an automated gate',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
