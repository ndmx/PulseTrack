import React from "react"

type NoticeProps = { type?: 'error' | 'info'; children: React.ReactNode }

export default function Notice({ type = 'info', children }: NoticeProps) {
  const bg = type === 'error' ? '#FFF5F5' : '#F8F9FA'
  const border = type === 'error' ? '#F1AEB5' : '#E9ECEF'
  const color = type === 'error' ? '#842029' : '#495057'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, color, padding: '10px 12px', borderRadius: 8 }}>
      {children}
    </div>
  )
}


