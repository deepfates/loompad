# LoomPad: Interactive Story Tree Explorer

A gamepad-style interface for exploring branching narratives with AI text generation.

## Features

- 🎮 Gamepad-style interface with keyboard controls
- 🌳 Multiple story trees with branching narratives
- 🤖 AI-powered text generation
- 💾 Automatic local storage
- 🎯 Focus-driven navigation
- 📱 **Progressive Web App (PWA)** - Install to home screen, works offline

## Quick Start

1. Install dependencies:
```bash
bun i
```

2. Set up environment variables:
- Create a `.env` file
- Add your OpenRouter API key: `OPENROUTER_API_KEY=your_key_here`

3. Start development server:
```bash
bun run dev
```

## Usage Guide

### Interface
The interface is designed around a gamepad metaphor:
```
┌───────────────────┐
│    Story Text     │
│                   │
│  [Navigation Dots]│
├───────┬─────┬────┤
│ D-Pad │ A B │ ···│
└───────┴─────┴────┘
```

### Controls
- **Arrow Keys/D-Pad**: Navigate through story tree
  - Up/Down: Move through story progression
  - Left/Right: Switch between branches
- **Enter/A Button**: Generate new continuation
- **Backspace/B Button**: Edit current text
- **~/Select**: Open settings menu
- **Escape/Start**: Switch between stories

### Story Management
Press Enter/Start to:
- Create new stories
- Switch between stories
- Delete stories
- All changes auto-save

### Generation Settings
Press Tab/Select to adjust:
- Model selection
- Temperature (randomness)
- Max tokens (length)
- Top P (variety)

### Tips
- Use Up/Down to follow main thread
- Use Left/Right to explore alternatives
- Watch navigation dots for branch locations


## Development

### Project Structure
- `client/` - Frontend React code
  - `interface/` - UI components and hooks
  - `assets/` - Static resources
- `server/` - Backend API and services
  - `apis/` - HTTP and WebSocket endpoints
- `shared/` - Common types and utilities

### Available Scripts
- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production
- `bun run prod` - Run production server
- `bun run lint` - Run ESLint

### Technical Details
- Built with Bun + React + Vite
- TypeScript throughout
- OpenRouter API for text generation
- Local storage for persistence
- Server-side rendering enabled

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Progressive Web App (PWA)

LoomPad is now a full PWA with:

### 📱 Installation
- Install to home screen on mobile/desktop
- Runs in standalone mode (no browser UI)
- Custom app icons and splash screen

### ⚡ Offline Support
- Works offline for reading saved stories
- Automatic service worker caching
- Network detection with graceful degradation

### 🔄 Auto-Updates
- Background updates download automatically
- Seamless version management

### Testing PWA Features
```bash
# Build and run production server
bun run build
bun run prod

# Open http://localhost:4000
# Look for install prompt in browser
# Test offline mode in DevTools
```

See `docs/PWA.md` for detailed implementation guide.

## License

MIT License - see LICENSE file for details
