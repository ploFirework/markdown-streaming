import { useState } from 'react'
import MarkdownStreaming from './components/MarkdownStreaming'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Markdown Streaming Demo</h1>
        <p>Watch markdown stream in real-time without breaking the layout</p>
      </header>
      <main className="app-main">
        <MarkdownStreaming />
      </main>
    </div>
  )
}

export default App
