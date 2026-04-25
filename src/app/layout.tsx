import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import Script from 'next/script'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'GrayQuest IAM Dashboard',
  description: 'Identity & Access Management Analytics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head />
      <body className="min-h-full bg-bg-primary text-txt-primary antialiased">
        {/* Load theme blocking script from public folder to avoid React hydration errors */}
        <Script src="/theme.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  )
}
