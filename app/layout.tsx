import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Drop',
  description: 'Paste a URL or topic. Get a podcast episode in 60 seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
