import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: 'Lumière Index — News that matters.',
    template: '%s · Lumière Index',
  },
  description: 'Entertainment and culture reporting from Lumière Index.',
  // The publication is not live. Nothing here may be indexed until the
  // editorial site is finished and launch is approved.
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
