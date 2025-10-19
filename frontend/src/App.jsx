import React, { useState } from 'react'
import axios from 'axios'
// Ensure cross-site cookies are sent to the API for session auth
axios.defaults.withCredentials = true
import { Link, Routes, Route, useLocation } from 'react-router-dom'

function isAudioFmt(fmt) {
  const f = String(fmt || '').toLowerCase()
  return f === 'mp3' || f === 'm4a' || f === 'opus'
}

function HomePage({ apiBase }) {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp4')
  const [quality, setQuality] = useState('1080p')
  const [progress, setProgress] = useState(null)
  const [downloadId, setDownloadId] = useState(null)
  const [downloads, setDownloads] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // store active EventSource so we can close it when starting a new download
  const eventSourceRef = React.useRef(null)

  function autoDownloadFile(filename) {
    if (!filename) return
    // Prefer forced-download endpoint to ensure browser saves instead of previewing
    const forceUrl = `${apiBase}/files/download/${encodeURIComponent(filename)}`
    const a = document.createElement('a')
    a.href = forceUrl
    a.style.display = 'none'
    // 'download' attribute may be ignored cross-origin; force endpoint handles headers
    a.setAttribute('download', filename)
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch (e) {}
    }, 100)
  }

  async function startDownload() {
    try {
      const res = await axios.post(`${apiBase}/api/download`, { url, format, quality })
      setDownloadId(res.data.id)
      setProgress({ percent: 0, status: 'queued' })
      setStatusText('Queued…')
      setNote('')
      setIsDownloading(true)

      // close any previous EventSource
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close() } catch (e) {}
        eventSourceRef.current = null
      }

      // open SSE connection for real-time updates
      const es = new EventSource(`${apiBase.replace(/^http:/, 'http:')}/api/stream/${res.data.id}`)
      eventSourceRef.current = es

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          setProgress(data)
          if (data.last) setNote(String(data.last).trim())
          if (data.status) {
            if (data.status === 'downloading') setStatusText('Downloading…')
            if (data.status === 'completed') setStatusText('Completed')
            if (data.status === 'error') setStatusText('Error')
          }
          if (data.error) setErrorMessage(String(data.error))
          if (data.status === 'completed' || data.status === 'error') {
            try { es.close() } catch (e) {}
            eventSourceRef.current = null
            setIsDownloading(false)
            // Session-scoped: append/replace this item in current session list only
            if (data.status === 'completed') {
              setDownloads(prev => {
                const copy = prev.filter(d => d.id !== downloadId)
                const entry = { id: downloadId, filename: data.filename, status: 'completed', created_at: new Date().toISOString() }
                return [entry, ...copy]
              })
            }
            // auto-download when completed and filename present
            if (data.status === 'completed' && data.filename) {
              autoDownloadFile(data.filename)
            }
          }
        } catch (err) {
          console.error('Invalid SSE payload', err)
        }
      }

      es.onerror = (err) => {
        console.error('SSE error', err)
        try { es.close() } catch (e) {}
        eventSourceRef.current = null
        setIsDownloading(false)
        setStatusText('Connection lost')
        setErrorMessage('Connection lost while streaming progress')
      }

    } catch (err) {
      console.error(err)
      alert('Failed to start download: ' + (err.response?.data?.error || err.message))
    }
  }

  async function fetchDownloads() {
    try {
      const res = await axios.get(`${apiBase}/api/downloads`)
      setDownloads(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error(err)
    }
  }

  React.useEffect(() => { return () => { try { eventSourceRef.current?.close() } catch (e) {} } }, [])

  async function deleteDownload(id) {
    if (!id) return
    const d = downloads.find(x => x.id === id)
    const name = d?.filename || d?.url || id
    const confirmed = window.confirm(`Delete this download?\n${name}`)
    if (!confirmed) return
    try {
      setDeletingId(id)
      await axios.delete(`${apiBase}/api/downloads/${id}`)
      await fetchDownloads()
    } catch (err) {
      console.error(err)
      alert('Failed to delete download: ' + (err.response?.data?.error || err.message))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
        <div className="">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Download YouTube Videos Effortlessly</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">A simple, fast, and responsive way to get your favorite content.</p>
          </div>

            <div className="space-y-6">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"> link </span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full h-14 pl-12 pr-4 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent transition" placeholder="Paste YouTube Link Here" type="text" />
              </div>

              {/* Presets removed per request */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300" htmlFor="format">Format</label>
                  <select id="format" value={format} onChange={(e) => {
                    const f = e.target.value; setFormat(f);
                    if (isAudioFmt(f)) { if (!['best','medium','low'].includes(quality)) setQuality('best'); }
                    else { if (!['1080p','720p','480p','best'].includes(quality)) setQuality('1080p'); }
                  }} className="w-full h-14 rounded-lg font-display bg-[#1a0f10] text-white border border-[#8b0000]/50 focus:outline-none focus:ring-2 focus:ring-[#8b0000] focus:border-[#8b0000] transition appearance-none pl-4 pr-10 bg-no-repeat bg-right hover:bg-[#2b1517]">
                  <optgroup label="Video">
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                    <option value="mkv">MKV</option>
                  </optgroup>
                  <optgroup label="Audio">
                    <option value="mp3">MP3</option>
                    <option value="m4a">M4A</option>
                    <option value="opus">OPUS</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300" htmlFor="quality">Quality</label>
                {isAudioFmt(format) ? (
                  <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full h-14 rounded-lg font-display bg-[#1a0f10] text-white border border-[#8b0000]/50 focus:outline-none focus:ring-2 focus:ring-[#8b0000] focus:border-[#8b0000] transition appearance-none pl-4 pr-10 bg-no-repeat bg-right hover:bg-[#2b1517]">
                    <option value="best">Best</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                ) : (
                  <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full h-14 rounded-lg font-display bg-[#1a0f10] text-white border border-[#8b0000]/50 focus:outline-none focus:ring-2 focus:ring-[#8b0000] focus:border-[#8b0000] transition appearance-none pl-4 pr-10 bg-no-repeat bg-right hover:bg-[#2b1517]">
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="best">Best</option>
                  </select>
                )}
              </div>
            </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Download Progress</p>
                  <div className="flex items-center gap-2">
                    {isDownloading && (
                      <span className="material-symbols-outlined animate-spin text-slate-500 dark:text-slate-400" style={{fontSize:'16px'}}> progress_activity </span>
                    )}
                    <p className="text-slate-500 dark:text-slate-400">{progress?.percent ? Math.round(progress.percent) + '%' : '0%'}</p>
                  </div>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full transition-all" style={{width: `${progress?.percent ?? 0}%`}}></div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 h-4">{statusText}</div>
                {note && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 break-words">{note}</div>
                )}
                {errorMessage && (
                  <div className="text-xs text-red-500 mt-1 break-words">{errorMessage}</div>
                )}
              </div>

            <div className="pt-4">
              <button type="button" onClick={startDownload} disabled={isDownloading || !url}
                className={`w-full h-12 flex items-center justify-center gap-2 rounded-lg text-white font-bold text-sm tracking-wide transition-opacity ${isDownloading ? 'bg-primary/60 cursor-not-allowed' : 'bg-primary hover:opacity-90'}`}>
                <span className="material-symbols-outlined"> {isDownloading ? 'hourglass_top' : 'download'} </span>
                <span>{isDownloading ? 'Downloading…' : 'Download'}</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Recent Downloads</h3>
                <button type="button" onClick={fetchDownloads} className="text-xs text-primary hover:underline">Load history</button>
              </div>
              <ul className="space-y-2">
                {downloads.map((d) => {
                  const canOpen = d.status === 'completed' && d.filename
                  const href = canOpen ? `${apiBase}/files/download/${encodeURIComponent(d.filename)}` : undefined
                  return (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-slate-800 dark:text-slate-200">{d.filename || d.url}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{d.status}{d.created_at ? ` · ${new Date(d.created_at).toLocaleString()}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canOpen ? (
                          <a className="text-primary hover:underline" href={href}>Download</a>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                        {canOpen && (
                          <button
                            type="button"
                            onClick={() => deleteDownload(d.id)}
                            disabled={deletingId === d.id}
                            title="Delete"
                            className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${deletingId === d.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300" style={{fontSize:'18px'}}>
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
                {downloads.length === 0 && (
                  <li className="text-sm text-slate-500">No downloads yet.</li>
                )}
              </ul>
            </div>

          </div>
        </div>
    </div>
  )
}

function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">About VideoDownloader</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Your go-to solution for easy video downloads.</p>
      </div>
      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Our Mission</h3>
          <p className="text-slate-600 dark:text-slate-400">VideoDownloader was created to provide a simple, fast, and reliable way for users to download videos for offline viewing. We believe accessing content you love should be straightforward and hassle-free.</p>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Frequently Asked Questions (FAQ)</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">Is VideoDownloader free to use?</h4>
              <p className="text-slate-600 dark:text-slate-400">Yes, our basic video downloading service is free. Premium features may come later.</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">What formats and qualities can I download?</h4>
              <p className="text-slate-600 dark:text-slate-400">Video: MP4/WebM/MKV with various qualities. Audio: MP3/M4A/OPUS.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactPage() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Contact Us</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">We're here to help. Send us a message!</p>
      </div>
      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 sm:p-8 space-y-6">
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300" htmlFor="name">Your Name</label>
            <input className="w-full h-12 px-4 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent transition" id="name" placeholder="John Doe" type="text" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300" htmlFor="email">Your Email</label>
            <input className="w-full h-12 px-4 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent transition" id="email" placeholder="you@example.com" type="email" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300" htmlFor="message">Message</label>
            <textarea className="w-full min-h-[120px] p-4 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent transition" id="message" placeholder="Let us know how we can help..."></textarea>
          </div>
          <div className="pt-4">
            <button className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-primary text-white font-bold text-sm tracking-wide hover:opacity-90 transition-opacity" type="submit">
              <span className="material-symbols-outlined"> send </span>
              <span>Send Message</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE || 'https://youtube-downloader-app-vh39.onrender.com'
  const location = useLocation()
  const [user, setUser] = useState(null)

  async function fetchUser() {
    try {
      const res = await axios.get(`${apiBase}/api/auth/user`)
      setUser(res.data.user || null)
    } catch (_) {
      setUser(null)
    }
  }

  async function logout() {
    try { await axios.get(`${apiBase}/api/auth/logout`) } catch (_) {}
    setUser(null)
  }

  React.useEffect(() => { fetchUser() }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-primary/20 dark:border-primary/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary text-3xl"> movie </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">VideoDownloader</h1>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <Link className={`text-sm font-medium hover:text-primary dark:hover:text-primary ${location.pathname==='/'?'text-primary dark:text-primary':''}`} to="/">Home</Link>
              <Link className={`text-sm font-medium hover:text-primary dark:hover:text-primary ${location.pathname==='/about'?'text-primary dark:text-primary':''}`} to="/about">About</Link>
              <Link className={`text-sm font-medium hover:text-primary dark:hover:text-primary ${location.pathname==='/contact'?'text-primary dark:text-primary':''}`} to="/contact">Contact</Link>
            </nav>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  {user.photo && (
                    <img src={user.photo} alt={user.displayName || 'User'} className="h-8 w-8 rounded-full border border-slate-300 dark:border-slate-700" />
                  )}
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={user.displayName || user.email}>
                    {user.displayName || user.email}
                  </span>
                  <button type="button" onClick={logout} className="text-xs px-3 py-1 rounded bg-primary text-white hover:opacity-90">
                    Logout
                  </button>
                </div>
              ) : (
                <a href={`${apiBase}/api/auth/google`} className="text-xs px-3 py-1 rounded bg-primary text-white hover:opacity-90">
                  Login with Google
                </a>
              )}
              <button type="button" aria-label="Help" className="p-2 rounded-full hover:bg-primary/10 dark:hover:bg-primary/20">
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400"> help </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Routes>
          <Route path="/" element={<HomePage apiBase={apiBase} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </main>
    </div>
  )
}
