import { useState, useCallback, useRef } from 'react'
import { marked } from 'marked'
import OpenAI from 'openai'
import './MarkdownStreaming.css'

// Initialize OpenAI client (only if API key is available)
const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) return null
  
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Required for browser usage
  })
}

// Test markdown content to simulate streaming
const TEST_MARKDOWN = `# Welcome to Markdown Streaming

This is a demonstration of **streaming markdown** content without breaking the layout.

## How it works

The key is to **postpone rendering** of incomplete markdown tags until they are complete. This prevents:

- Broken HTML structure
- Layout shifts
- Visual glitches

### Features

1. **Bold text** and *italic text*
2. Lists (both ordered and unordered)
3. Code blocks with syntax highlighting
4. Links and images
5. Tables

#### Example Code Block

\`\`\`typescript
function streamMarkdown(text: string) {
  return text
    .split('')
    .reduce((acc, char) => acc + char, '')
}
\`\`\`

##### Example List

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

###### Example Table

| Feature | Status | Priority |
|---------|--------|----------|
| Streaming | ✅ Done | High |
| Layout Stability | ✅ Done | High |
| Performance | ✅ Done | Medium |

> This is a blockquote demonstrating how quoted text looks in markdown.

Here's some \`inline code\` for you to see.

And here's a [link to example.com](https://example.com).

---

**End of streaming demo!** 🎉`

// Function to check if a markdown tag is complete
function isCompleteMarkdown(text: string): boolean {
  // If text is empty, it's complete
  if (!text) return true
  
  const lines = text.split('\n')
  const lastLine = lines[lines.length - 1]
  
  // Count unclosed markdown tags
  let unclosedBold = 0
  let unclosedItalic = 0
  let unclosedCode = 0
  let unclosedLink = 0
  let unclosedImage = 0
  let unclosedCodeBlock = false
  let inLinkUrl = false  // Track if we're inside the URL part of a link
  
  // Track state through the line
  for (let i = 0; i < lastLine.length; i++) {
    const char = lastLine[i]
    const nextChar = lastLine[i + 1]
    const prevChar = lastLine[i - 1]
    
    // Bold **
    if (char === '*' && nextChar === '*' && prevChar !== '*') {
      unclosedBold = 1 - unclosedBold
      i++ // Skip next char
    }
    // Italic * (single asterisk, not part of **)
    else if (char === '*' && prevChar !== '*' && nextChar !== '*') {
      unclosedItalic = 1 - unclosedItalic
    }
    // Code block ``` (check this before inline code)
    else if (lastLine.substring(i, i + 3) === '```') {
      unclosedCodeBlock = !unclosedCodeBlock
      i += 2 // Skip next 2 chars
    }
    // Inline code ` (only if not inside a code block)
    else if (char === '`' && !unclosedCodeBlock) {
      unclosedCode = 1 - unclosedCode
    }
    // Link [
    else if (char === '[' && prevChar !== '!') {
      unclosedLink = 1 - unclosedLink
    }
    // Image ![
    else if (char === '[' && prevChar === '!') {
      unclosedImage = 1 - unclosedImage
    }
    // Closing ]
    else if (char === ']') {
      if (unclosedLink > 0) {
        if (nextChar === '(') {
          inLinkUrl = true
          unclosedLink--
          i++ // Skip the opening (
        }
        // If nextChar is NOT (, the link is incomplete (just [text] without (url))
        // Don't decrement unclosedLink, keep it as 1
      }
      if (unclosedImage > 0) {
        unclosedImage--
      }
    }
    // Closing ) - check if we're inside a link URL
    else if (char === ')' && inLinkUrl) {
      inLinkUrl = false
    }
  }
  
  // Check for incomplete line-level elements
  const incompleteLineEndings = [
    />\s*$/,                // Incomplete blockquote
    /^\s*[-*+]\s*$/,        // Incomplete list item
    /^\s*\d+\.\s*$/,        // Incomplete ordered list (with period)
    /^\s*\d+\s*$/,          // Incomplete ordered list (just number)
    /^#{1,6}\s*$/,          // Header with no text
  ]
  
  const hasIncompleteLine = incompleteLineEndings.some(pattern => pattern.test(lastLine))
  
  // Check if line ends with incomplete backticks (1 or 2 backticks without content)
  const backtickMatch = lastLine.match(/`+$/);
  const endsWithIncompleteBackticks = backtickMatch && 
    backtickMatch[0].length > 0 && 
    backtickMatch[0].length < 3;
  
  const isComplete = unclosedBold === 0 && 
         unclosedItalic === 0 && 
         unclosedCode === 0 && 
         unclosedLink === 0 && 
         unclosedImage === 0 && 
         !unclosedCodeBlock && 
         !hasIncompleteLine &&
         !endsWithIncompleteBackticks &&
         !inLinkUrl
  
  // Text is complete if there are no unclosed tags and no incomplete patterns
  return isComplete
}

type StreamMode = 'mock' | 'api'

function MarkdownStreaming() {
  const [displayedText, setDisplayedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamSpeed, setStreamSpeed] = useState(50) // milliseconds per character
  const [streamMode, setStreamMode] = useState<StreamMode>('mock')
  const [prompt, setPrompt] = useState('Create a detailed product page in markdown format for a sample tech product. Include: 1) A product title and description with multiple headings (H2, H3) and bullet points, 2) A feature comparison table with at least 4 rows and 3 columns, 3) At least 3 markdown image links (use placeholder URLs like https://via.placeholder.com/600x400), 4) At least 2 video embeds or links (use placeholder URLs), 5) A user reviews section with at least 5 reviews, each including a star rating (use emoji stars ⭐), customer name, review text, and date. Make it comprehensive and well-formatted.')
  const [error, setError] = useState<string | null>(null)
  
  // Refs to track streaming state for cancellation
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false) // Flag to check if we should continue streaming

  // Simulate streaming by adding characters one by one (mock mode)
  const startMockStreaming = useCallback(() => {
    // Clear any existing interval
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current)
    }
    
    setIsStreaming(true)
    setDisplayedText('')
    setError(null)
    isStreamingRef.current = true
    
    let currentIndex = 0
    
    const interval = setInterval(() => {
      // Check if streaming was stopped
      if (!isStreamingRef.current) {
        clearInterval(interval)
        mockIntervalRef.current = null
        return
      }
      
      if (currentIndex < TEST_MARKDOWN.length) {
        currentIndex++
        const text = TEST_MARKDOWN.substring(0, currentIndex)
        
        // Update if:
        // 1. The current text is complete (no incomplete tags at the end)
        // 2. We're at the end of the text
        const isComplete = isCompleteMarkdown(text)
        
        if (isComplete || currentIndex === TEST_MARKDOWN.length) {
          setDisplayedText(text)
        }
      } else {
        // Make sure we display the final text
        setDisplayedText(TEST_MARKDOWN)
        clearInterval(interval)
        mockIntervalRef.current = null
        isStreamingRef.current = false
        setIsStreaming(false)
      }
    }, streamSpeed)
    
    mockIntervalRef.current = interval
  }, [streamSpeed])

  // Real streaming from OpenAI API
  const startAPIStreaming = useCallback(async () => {
    const openai = getOpenAIClient()
    if (!openai) {
      setError('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file.')
      return
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsStreaming(true)
    setDisplayedText('')
    setError(null)
    isStreamingRef.current = true
    
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-5-nano', // or 'gpt-3.5-turbo'
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always respond in markdown format with proper formatting.' },
          { role: 'user', content: prompt }
        ],
        stream: true,
      }, {
        signal: abortController.signal
      })

      let accumulatedText = ''
      
      for await (const chunk of stream) {
        // Check if aborted or stopped
        if (abortController.signal.aborted || !isStreamingRef.current) {
          break
        }

        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          accumulatedText += content
          
          // Check if current text is complete before updating
          const isComplete = isCompleteMarkdown(accumulatedText)
          
          if (isComplete) {
            setDisplayedText(accumulatedText)
          }
        }
      }
      
      // Ensure final text is displayed even if incomplete (unless aborted)
      if (!abortController.signal.aborted && isStreamingRef.current) {
        setDisplayedText(accumulatedText)
      }
    } catch (error: unknown) {
      // Don't show error if it was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was stopped by user
        return
      }
      console.error('Error streaming from OpenAI:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error: Could not fetch response from API'
      setError(errorMessage)
    } finally {
      setIsStreaming(false)
      isStreamingRef.current = false
      abortControllerRef.current = null
    }
  }, [prompt])

  // Start streaming based on mode
  const startStreaming = useCallback(() => {
    if (streamMode === 'mock') {
      return startMockStreaming()
    } else {
      startAPIStreaming()
    }
  }, [streamMode, startMockStreaming, startAPIStreaming])

  const handleReset = () => {
    setDisplayedText('')
    setTimeout(() => startStreaming(), 100)
  }

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStreamSpeed(Number(e.target.value))
  }

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStreamMode(e.target.value as StreamMode)
    setDisplayedText('')
    setError(null)
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
  }

  const handleStop = () => {
    if (streamMode === 'mock') {
      // Stop mock streaming
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current)
        mockIntervalRef.current = null
      }
      setIsStreaming(false)
      isStreamingRef.current = false
    } else {
      // Stop API streaming
      isStreamingRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      setIsStreaming(false)
    }
  }

  // Convert markdown to HTML
  const getMarkdownHTML = (text: string) => {
    try {
      return marked(text)
    } catch (error) {
      return marked('Error rendering markdown')
    }
  }

  return (
    <div className="markdown-streaming">
      <div className="controls">
        <div className="control-group">
          <label htmlFor="mode">Stream Mode:</label>
          <select
            id="mode"
            value={streamMode}
            onChange={handleModeChange}
            disabled={isStreaming}
          >
            <option value="mock">Mock Data</option>
            <option value="api">ChatGPT API</option>
          </select>
        </div>

        {streamMode === 'api' && (
          <div className="control-group">
            <label htmlFor="prompt">Prompt:</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={handlePromptChange}
              disabled={isStreaming}
              placeholder="Enter your prompt here..."
              rows={3}
              style={{ width: '100%', minWidth: '300px' }}
            />
          </div>
        )}

        {streamMode === 'mock' && (
          <div className="control-group">
            <label htmlFor="speed">Stream Speed:</label>
            <input
              id="speed"
              type="range"
              min="10"
              max="200"
              value={streamSpeed}
              onChange={handleSpeedChange}
              disabled={isStreaming}
            />
            <span>{streamSpeed}ms/char</span>
          </div>
        )}

        <button onClick={handleReset} disabled={isStreaming}>
          {isStreaming ? 'Streaming...' : streamMode === 'api' ? 'Start Stream' : 'Restart Stream'}
        </button>
        {isStreaming && (
          <button onClick={handleStop} style={{ backgroundColor: '#dc3545', color: 'white' }}>
            Stop Stream
          </button>
        )}
      </div>

      {error && (
        <div className="error-message" style={{ 
          color: 'red', 
          padding: '10px', 
          margin: '10px 0', 
          backgroundColor: '#ffe6e6',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div className="markdown-container">
        <div 
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: getMarkdownHTML(displayedText) }}
        />
        {isStreaming && (
          <span className="cursor">|</span>
        )}
      </div>

      <div className="info-panel">
        <h3>How it works:</h3>
        <ul>
          <li>Choose between <strong>Mock Data</strong> (simulated streaming) or <strong>ChatGPT API</strong> (real streaming)</li>
          <li>Characters are added one by one to simulate streaming</li>
          <li>Incomplete markdown tags are detected and postponed</li>
          <li>Only complete markdown is rendered to prevent layout breaks</li>
          {streamMode === 'mock' && <li>Adjust the speed slider to see the effect at different rates</li>}
          {streamMode === 'api' && <li>Enter a prompt and click "Start Stream" to get a real ChatGPT response</li>}
        </ul>
        {streamMode === 'api' && !import.meta.env.VITE_OPENAI_API_KEY && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            color: '#856404'
          }}>
            <strong>Note:</strong> To use ChatGPT API, set VITE_OPENAI_API_KEY in your .env file
          </div>
        )}
      </div>
    </div>
  )
}

export default MarkdownStreaming
