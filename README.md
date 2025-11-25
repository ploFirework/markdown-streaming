# Markdown Streaming Demo

A React TypeScript application that demonstrates streaming markdown content without breaking the layout.

## Features

- **Streaming Simulation**: Characters are added one by one to simulate real-time streaming
- **Incomplete Tag Handling**: Postpones rendering of incomplete markdown tags to prevent layout breaks
- **Adjustable Speed**: Control the streaming speed with a slider
- **Beautiful UI**: Modern, responsive design with dark/light mode support

## How It Works

The key innovation is detecting and postponing incomplete markdown tags. When streaming, the app checks if the current text contains incomplete markdown patterns (like `**bold` without closing `**`, or `[link` without closing `]`). Only complete markdown is rendered to the DOM, preventing:

- Broken HTML structure
- Layout shifts
- Visual glitches

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### .env
Add the following key:
```
VITE_OPENAI_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

### Build

```bash
npm run build
# or
yarn build
# or
pnpm build
```

## Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Marked** - Markdown parser
- **CSS3** - Styling with modern features

## Project Structure

```
markdown-streaming/
├── src/
│   ├── components/
│   │   ├── MarkdownStreaming.tsx    # Main streaming component
│   │   └── MarkdownStreaming.css    # Component styles
│   ├── App.tsx                       # Root component
│   ├── App.css                       # App styles
│   ├── main.tsx                      # Entry point
│   └── index.css                     # Global styles
├── index.html                        # HTML template
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── vite.config.ts                    # Vite config
└── README.md                         # This file
```

## Customization

### Change Streaming Speed

Edit the `streamSpeed` state in `MarkdownStreaming.tsx`:

```typescript
const [streamSpeed, setStreamSpeed] = useState(50) // milliseconds per character
```

### Add Your Own Markdown Content

Replace the `TEST_MARKDOWN` constant in `MarkdownStreaming.tsx` with your own content.

### Modify Incomplete Tag Detection

Edit the `isCompleteMarkdown` function to add or modify patterns for detecting incomplete markdown tags.

## License

MIT
