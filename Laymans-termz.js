// package.json
{
  "name": "laymans-terms",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "3.23.8",
    "pdf-parse": "1.1.1",
    "remark": "15.0.1",
    "remark-html": "16.0.1"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.12.12",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "eslint": "9.7.0",
    "eslint-config-next": "14.2.5",
    "tailwindcss": "3.4.7",
    "postcss": "8.4.41",
    "autoprefixer": "10.4.19",
    "vitest": "2.0.5",
    "@vitest/coverage-v8": "2.0.5"
  },
  "engines": {
    "node": ">=18.17.0"
  }
}

// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "allowJs": false,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"]
  },
  "exclude": ["node_modules"]
}

// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  output: "standalone",
  reactStrictMode: true,
};
module.exports = nextConfig;

// vercel.json (if needed)
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "pnpm i || npm i || yarn",
  "env": {
    "OPENAI_API_KEY": ""
  }
}

// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// tailwind.config.ts
import type { Config } from 'tailwindcss'
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
export default config

// globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

// app/layout.tsx
import "./globals.css";
import React from "react";

export const metadata = { title: "Laymans Terms", description: "Summarize T&C into plain English" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-3xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}'use client'
import React, { useState } from 'react'
import { summarizeClient } from '../lib/summarize-client'

export default function Page() {
  const [mode, setMode] = useState<'paste'|'url'|'file'>('paste')
  const [input, setInput] = useState('')
  const [file, setFile] = useState<File|null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  async function run() {
    setLoading(true); setResult('')
    try {
      let text = ''
      if (mode === 'paste') text = input
      if (mode === 'url') {
        const r = await fetch('/api/fetch?url=' + encodeURIComponent(input))
        const j = await r.json(); text = j.text
      }
      if (mode === 'file' && file) {
        const fd = new FormData(); fd.append('file', file)
        const r = await fetch('/api/upload', { method: 'POST', body: fd })
        const j = await r.json(); text = j.text
      }
      const out = await summarizeClient(text)
      setResult(out)
    } catch (e:any) {
      setResult('Error: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold">Laymans Terms</h1>
        <p className="text-sm text-gray-600">Short, plain-English summaries of Terms & Conditions for anybody.</p>
      </header>

      <div className="flex gap-2 text-sm">
        {['paste','url','file'].map((m)=> (
          <button key={m} onClick={()=>setMode(m as any)} className={`px-3 py-1.5 rounded-full border ${mode===m?'bg-black text-white border-black':'bg-white'}`}>{m}</button>
        ))}
      </div>

      {mode==='paste' && (
        <textarea className="w-full h-48 p-3 border rounded-xl" placeholder="Paste T&C text here" value={input} onChange={e=>setInput(e.target.value)} />
      )}
      {mode==='url' && (
        <input className="w-full p-3 border rounded-xl" placeholder="https://example.com/terms" value={input} onChange={e=>setInput(e.target.value)} />
      )}
      {mode==='file' && (
        <input type="file" accept=".txt,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} />
      )}

      <button onClick={run} disabled={loading} className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50">
        {loading? 'Summarizing…':'Summarize'}
      </button>

      {result && (
        <div className="bg-white border rounded-2xl p-4">
          <h2 className="font-semibold mb-2">Summary</h2>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: result}} />
          <p className="text-xs text-gray-500 mt-3">Not legal advice. Verify with the original document.</p>
        </div>
      )}
    </div>
  )import { NextRequest, NextResponse } from 'next/server'
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  const r = await fetch(url)
  const html = await r.text()
  // crude text extraction
  const text = html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0, 150000)
  return NextResponse.json({ text })
  import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as unknown as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  if (file.type === 'application/pdf') {
    const data = await pdfParse(buf)
    return NextResponse.json({ text: (data.text||'').slice(0, 150000) })
  }
  return NextResponse.json({ text: buf.toString('utf8').slice(0, 150000) 
    import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { summarizeServer } from '../../../lib/summarize-server'

const Body = z.object({ text: z.string().min(20) })
export async function POST(req: NextRequest) {
  const json = await req.json().catch(()=>null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const html = await summarizeServer(parsed.data.text)
  return NextResponse.json({ html })
  export async function summarizeClient(text: string): Promise<string> {
  const r = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ text }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j.html as string
import { remark } from 'remark'
import html from 'remark-html'

export async function summarizeServer(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }const fallback = `# TL;DR\n- This document describes rules for using a service.\n- Key obligations and risks are listed below.\n\n## Potential Risks\n- Data collection and sharing possible.\n- Service may change or end anytime.\n- Arbitration/limited liability may apply.\n\n## What You Agree To\n- Follow usage rules.\n- Provide accurate info.\n- Accept updates by continuing to use the service.\n\n## Data & Privacy\n- Your information may be collected and stored.\n- Data can be shared with partners or required by law.\n\n## Cancellations\n- You may stop using the service at any time.\n- Provider may suspend or cancel accounts if rules are broken.\n\n## Liability\n- Service provided \\\"as is\\\" with limited liability.`
    const processed = await remark().use(html).process(fallback)
    return String(processed)
  }

  const prompt = `You are a legal explainer. Rewrite the provided Terms & Conditions in clear, neutral, non-legal English for the general public. Keep it under 1000 words. Provide clear sections with these headings if relevant: TL;DR, What You Agree To, Data & Privacy, Fees/Payments, Cancellations, Disputes/Arbitration, Liability, Intellectual Property, Governing Law, Contact/Support. Avoid legalese. Only include sections that apply. Output in GitHub-flavored Markdown.`

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text.slice(0, 12000) }
    ]
  }

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const fallback = `# TL;DR\n- Unable to summarize right now. Try again later.`
    const processed = await remark().use(html).process(fallback)
    return String(processed)
  }
  const j = await r.json()
  const md: string = j.choices?.[0]?.message?.content || '# TL;DR\n- No result.'
  const processed = await remark().use(html).process(md)
  return String(processed)
  import { describe, it, expect, beforeEach } from 'vitest'
import { summarizeServer } from '../lib/summarize-server'

describe('summarizeServer', () => {
  let prevKey: string | undefined
  beforeEach(() => { prevKey = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY })

  it('returns HTML including TL;DR when no API key (fallback)', async () => {
    const html = await summarizeServer('Terms and conditions apply. You agree to use the service responsibly. Data may be collected.')
    expect(html).toContain('TL;DR')
    expect(html).toContain('Data & Privacy')
    expect(html).toContain('Cancellations')
    process.env.OPENAI_API_KEY = prevKey
  })

  it('handles very long input safely', async () => {
    const long = 'a'.repeat(200000)
    const html = await summarizeServer(long)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('keeps fallback under 1000 words', async () => {
    const html = await summarizeServer('Some example terms and conditions for testing purposes, including data and cancellation wording to trigger sections.')
    const textOnly = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const words = textOnly ? textOnly.split(' ').length : 0
    expect(words).toBeLessThanOrEqual(1000)
  })

  it('does not invent irrelevant sections in fallback (no Fees/Payments)', async () => {
    const html = await summarizeServer('Short terms mentioning data and cancellation but nothing about fees.')
    expect(html.includes('Fees/Payments')).toBe(false)
  })

  it('renders Markdown headings to HTML (h1/h2 present)', async () => {
    const html = await summarizeServer('This is a simple terms text that will trigger TL;DR and sections.')
    expect(html).toMatch(/<h1[^>]*>\s*TL;DR\s*<\/h1>/)
    expect(html).toMatch(/<h2[^>]*>\s*Data & Privacy\s*<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>\s*Cancellations\s*<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>\s*What You Agree To\s*<\/h2>/)


    expect(html).toMatch(/<h2[^>]*>\s*Liability\s*<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>\s*Intellectual Property\s*<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>\s*Governing Law\s*<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>\s*Contact\/Support\s*<\/h2>/)
  })npm i
npm run dev
  expect(html).toMatch(/<h2[^>]*>\s*Disputes\/Arbitration\s*<\/h2>/)
  }npm i
npm run dev
  expect(html).toMatch(/<h2[^>]*>\s*Fees\/Payments\s*<\/h2>/)
  }git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/laymans-terms.git
git push -u origin main
