'use client'

import Link from 'next/link'
import { Droplets, PaintBucket } from 'lucide-react'

export default function AccessoryTabs({ currentTab }: { currentTab: string }) {
  return (
    <div className="tabs">
      <Link href="/complementos?tab=adhesivo" className={`tab ${currentTab === 'adhesivo' ? 'active' : ''}`}>
        <Droplets size={15} /> Adhesivos
      </Link>
      <Link href="/complementos?tab=boquilla" className={`tab ${currentTab === 'boquilla' ? 'active' : ''}`}>
        <PaintBucket size={15} /> Boquillas
      </Link>
    </div>
  )
}
