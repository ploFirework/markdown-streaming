import { useState, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import './MarkdownStreaming.css'

// Test markdown content to simulate streaming
const TEST_MARKDOWN = `# Welcome to Markdown Streaming

This is a demonstration of **streaming markdown** content without breaking the layout.

## How it works

The key is to **postpone rendering** of incomplete markdown tags until they are complete. This prevents:

- Broken HTML structure
- Layout shifts
- Visual glitches

### Features

1. Tables
2. **Bold text** and *italic text*
3. Lists (both ordered and unordered)
4. Code blocks with syntax highlighting
5. Links and images

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
    // Inline code `
    else if (char === '`' && lastLine.substring(i, i + 3) !== '```') {
      unclosedCode = 1 - unclosedCode
    }
    // Code block ```
    else if (lastLine.substring(i, i + 3) === '```') {
      unclosedCodeBlock = !unclosedCodeBlock
      i += 2 // Skip next 2 chars
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
      if (unclosedLink > 0) unclosedLink--
      if (unclosedImage > 0) unclosedImage--
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
  
  // Text is complete if there are no unclosed tags
  return unclosedBold === 0 && 
         unclosedItalic === 0 && 
         unclosedCode === 0 && 
         unclosedLink === 0 && 
         unclosedImage === 0 && 
         !unclosedCodeBlock && 
         !hasIncompleteLine
}

function MarkdownStreaming() {
  const [displayedText, setDisplayedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamSpeed, setStreamSpeed] = useState(50) // milliseconds per character

  // Simulate streaming by adding characters one by one
  const startStreaming = useCallback(() => {
    setIsStreaming(true)
    setDisplayedText('')
    
    let currentIndex = 0
    
    const interval = setInterval(() => {
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
        setIsStreaming(false)
      }
    }, streamSpeed)
    
    return () => clearInterval(interval)
  }, [streamSpeed])

  // Start streaming on mount
  useEffect(() => {
    startStreaming()
  }, [startStreaming])

  const handleReset = () => {
    setDisplayedText('')
    setTimeout(() => startStreaming(), 100)
  }

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStreamSpeed(Number(e.target.value))
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
        <button onClick={handleReset} disabled={isStreaming}>
          {isStreaming ? 'Streaming...' : 'Restart Stream'}
        </button>
      </div>

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
          <li>Characters are added one by one to simulate streaming</li>
          <li>Incomplete markdown tags are detected and postponed</li>
          <li>Only complete markdown is rendered to prevent layout breaks</li>
          <li>Adjust the speed slider to see the effect at different rates</li>
        </ul>
      </div>
    </div>
  )
}

export default MarkdownStreaming
