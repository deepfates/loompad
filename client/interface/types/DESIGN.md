# Text Tree Explorer: Design Document

## The Problem
Writers and creators need a way to explore different narrative possibilities using AI text generation, but current interfaces are either too chat-focused or too complex. We need an interface that makes it natural to:
- Explore multiple story branches
- Navigate through different possibilities
- Maintain focus on the narrative
- Control the generation process

## Core Mental Model
Think of it like exploring a game world, but for text:

1. **The Story Tree**
   - You're always at a specific point in a branching narrative
   - From any point, you can:
     - Move up to earlier parts
     - Move down into continuations
     - Move sideways to alternate versions
   - Like turning pages in a "Choose Your Own Adventure" book

2. **The Gameboy Interface**
   - Simple, familiar controls that map to natural actions:
     - D-pad: Navigate the story tree
     - A button: Generate new continuation
     - B button: Edit current text
     - Select: Adjust how text is generated
     - Start: Switch between different stories

3. **The Reading Experience**
   - Text flows naturally as one continuous story
   - Small dots show where branches exist
   - The "screen" shows your current view into the story
   - Everything happens within this frame

## User Flow
1. Start with initial text (could be blank)
2. Navigate to where you want to continue
3. Press A to generate a continuation
4. Use D-pad to explore different versions
5. Press B to edit any section
6. Use Select to adjust generation settings
7. Use Start to switch between different stories

## Technical Architecture
- Frontend handles navigation and UI
- Backend connects to language models
- LocalStorage keeps everything saved automatically
- Simple data structure: nodes with parent/child relationships

## Why This Works
- Familiar gaming metaphor makes complex navigation intuitive
- Limited, consistent controls reduce cognitive load
- Focus stays on the text itself
- Works equally well with keyboard, mouse, or touch
- Everything saves automatically

This is essentially a "game console for text" - it makes exploring narrative possibilities as natural as playing a game.
