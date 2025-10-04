# LoomPad: Interactive Story Tree Explorer

## Overview
LoomPad is an interactive Progressive Web App (PWA) for exploring branching narratives with AI-powered text generation. It features a gamepad-style interface with keyboard controls for navigating story trees and generating AI continuations.

**Tech Stack:**
- Runtime: Bun 1.2.16
- Frontend: React + Vite + TypeScript
- Backend: Express.js (custom SSR mode, disabled by default)
- AI: OpenRouter API for text generation
- Styling: Styled Components
- Storage: Local Storage for persistence

## Recent Changes (Replit Setup - October 4, 2025)
- Imported from GitHub and fully configured for Replit environment
  - Installed Bun runtime and all dependencies
  - Fixed Vite configuration:
    - Changed base path from `/client/` to `/` for proper routing
    - Configured inline Vite setup with React plugin
    - Added security middleware to prevent unauthorized file access
  - Disabled SSR by default (changed from true to false in server/args.ts)
  - Fixed offline detection for iframe environment (always returns online in Replit)
  - Configured proper middleware order (Vite → Security → Catch-all routes)
  - Server binds to 0.0.0.0:5000 with HMR over WSS protocol
  - Set up deployment configuration for Replit Autoscale

## Project Structure
```
├── client/           # Frontend React application
│   ├── interface/    # UI components, hooks, menus
│   ├── assets/       # PWA icons and screenshots
│   └── styles/       # CSS styles
├── server/           # Backend Express server with SSR
│   └── apis/         # HTTP endpoints and generation API
├── shared/           # Common types and utilities
├── config/           # TypeScript and Vite configuration
└── run.ts            # Entry point
```

## Environment Variables
- `OPENROUTER_API_KEY` (optional): API key for OpenRouter text generation
  - If not set, uses a placeholder key for development
  - Required for production deployment

## Development
- **Start dev server**: `bun run dev` (uses nodemon with hot reload)
- **Port**: 5000 (configured for Replit proxy)
- **Dev mode**: SSR disabled by default (use --ssr flag to enable), HMR configured for WSS
- **Note**: HMR WebSocket may show connection errors in Replit's iframe but app functions normally

## Building & Deployment
- **Build**: `bun run build` - Creates production bundles in `dist/`
- **Production**: `bun run prod` - Runs optimized production server
- **Deployment**: Configured for Replit Autoscale deployment

## Key Features
- Gamepad-style interface with keyboard controls
- Multiple story trees with branching narratives
- AI-powered text generation via OpenRouter
- Automatic local storage persistence
- Progressive Web App (installable, works offline)
- Server-side rendering for better performance

## Controls
- Arrow Keys/D-Pad: Navigate story tree
- Enter/A: Generate new continuation
- Backspace/B: Edit current text
- ~/Select: Open settings
- Escape/Start: Switch between stories

## User Preferences
None configured yet.

## Project Architecture
- **Frontend-Backend Split**: Express serves both API routes and SSR'd React
- **Vite Integration**: Custom Vite server middleware for development HMR
- **API Routes**: `/api/generate`, `/api/models`, `/api/props`
- **SSR**: Renders React on server for initial page load
- **PWA**: Service worker caching with VitePWA plugin
