import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'GrayQuest IAM Dashboard',
  description: 'Identity & Access Management Analytics',
}

// Injected before hydration to avoid flash of wrong theme
const themeScript = `
  try {
    var s = localStorage.getItem('gq-theme');
    if (s === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-bg-primary text-txt-primary antialiased">
        {children}
      </body>
    </html>
  )
}
