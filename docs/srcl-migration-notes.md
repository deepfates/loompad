# SRCL Migration Notes

## Overview

This document maps the existing `terminal.css` styles to srcl components for migrating the loompad UI while preserving the same visual appearance.

---

## CSS Variable Mapping

### terminal.css Variables → srcl Variables

| terminal.css | srcl global.css | Notes |
|-------------|-----------------|-------|
| `--background-color` | `--theme-background` | Main background |
| `--font-color` | `--theme-text` | Primary text color |
| `--primary-color` | `--theme-focused-foreground` | Accent/highlight color |
| `--secondary-color` | `--theme-text-muted` | Muted text |
| `--invert-font-color` | `--theme-button-text` | Inverted text (on buttons) |
| `--border-color` | `--theme-border` | Border color |
| `--surface-color` | `--theme-background-modal` | Elevated surfaces |
| `--error-color` | (custom) | Error states - keep custom |
| `--warning-color` | (custom) | Warning states - keep custom |

### Theme System

terminal.css uses:

- `.theme-light` class
- `.theme-system` class with `prefers-color-scheme` media queries
- Custom Game Boy green palette (`--gb-100` through `--gb-800`)

srcl uses:

- CSS variables on `:root`
- Multiple theme palettes (matrix, nerv, akira, deus, hotline, outrun, aperture, macos9)
- `--font-family-mono` for consistent monospace

**Migration Strategy**: Keep custom Game Boy palette, map to srcl variable names for compatibility.

---

## Component Mapping

### 1. Buttons

**Current (terminal.css)**:

```css
.btn - Base button
.btn-primary - Primary action (filled)
.btn-ghost - Secondary action (outline)
.btn-error - Destructive action
.btn-small - Smaller variant
```

**srcl equivalent**:

- `Button` component with `theme="PRIMARY"` or `theme="SECONDARY"`
- `Button.module.css` provides similar styling

**Migration Notes**:

- srcl Button is full-width by default
- Need custom sizing for gamepad buttons (square, specific dimensions)
- May need to extend srcl Button or create wrapper component

### 2. GamepadButton / MenuButton

**Current**:

```tsx
// GamepadButton.tsx
<button className={`btn ${active ? "btn-primary" : "btn-ghost"}`}>
```

**srcl equivalent**:

- Could use `ActionButton` for hotkey support
- Or customize `Button` with additional props

**Migration Notes**:

- GamepadButton needs `active` state visual (pressed)
- Specific sizing: `--button-size: 3rem`
- D-pad buttons are arranged in a grid
- Menu buttons are oval-shaped with border-radius

### 3. D-Pad Grid

**Current (terminal.css)**:

```css
.terminal-grid {
    display: grid;
    grid-template-areas:
        ". up ."
        "left center right"
        ". down .";
    grid-template-columns: repeat(3, var(--button-size));
    grid-template-rows: repeat(3, var(--button-size));
}
```

**srcl equivalent**:

- `Grid` component is a simple flex grid
- Need custom CSS for this specific layout

**Migration Notes**:

- This is a very specific layout - likely keep custom CSS
- Can wrap in srcl's layout primitives but keep grid styling

### 4. Main Layout

**Current**:

```css
.terminal - Full-height flex container
.container - Portrait/landscape responsive layout
.terminal-screen - Main content area with border
.terminal-controls - Bottom controls area
```

**srcl equivalent**:

- `ContentFluid` for fluid containers
- `Row` for horizontal layouts
- `Card` for bordered containers (has header support)

**Migration Notes**:

- srcl doesn't have a direct equivalent for the gamepad layout
- Keep custom layout CSS, use srcl for inner components
- `.container.landscape` uses CSS Grid for GBA-style layout

### 5. Menu System

**Current**:

```css
.menu-screen - Full menu container with fade animation
.menu-content - Scrollable content area
.menu-item - Individual menu row
.menu-item.selected - Highlighted state
.menu-item-label - Item title
.menu-item-value - Item value/control
.menu-item-preview - Secondary text
```

**srcl equivalent**:

- `ListItem` - Basic list item with keyboard nav
- `ActionListItem` - List item with icon support
- `Card` - Container with header

**Migration Notes**:

- srcl ListItem has built-in arrow key navigation
- `.selected` state needs custom styling or use srcl focus styles
- Menu animations can use srcl's transition patterns

### 6. Form Controls

#### MenuKnob (Slider)

**Current**: Custom slider with track/handle
**srcl equivalent**: `NumberRangeSlider`

**Migration Notes**:

- srcl version shows padded numeric display
- May need to adjust for temperature (0.1-2.0) vs token counts

#### MenuSelect (Dropdown)

**Current**: Click to cycle through options
**srcl equivalent**: `Select` component

**Migration Notes**:

- srcl Select opens a dropdown menu
- Current implementation cycles on click - different UX
- May want to keep current behavior or adopt srcl's dropdown

#### MenuToggle (Checkbox)

**Current**: Custom checkbox with ON/OFF label
**srcl equivalent**: `Checkbox`

**Migration Notes**:

- srcl Checkbox uses ╳ for checked state
- Current uses ✓ and ON/OFF text
- Can customize or keep current style

### 7. Text Input / TextArea

**Current**:

```css
.edit-textarea - Styled textarea for editing
```

**srcl equivalent**:

- `Input` - Single line with blinking caret
- `TextArea` - Multi-line with auto-resize and blinking caret

**Migration Notes**:

- srcl inputs have terminal-style caret animation
- Good fit for the aesthetic

### 8. Modal / Dialog

**Current**:

```css
.install-prompt - Fixed position modal
```

**srcl equivalent**:

- `Dialog` - Modal with OK/Cancel buttons
- `ModalStack` - Stacked modal system with blur effect
- `ModalTrigger` - Trigger component

**Migration Notes**:

- srcl has a full modal system with context
- `useModals()` hook for programmatic control
- May be overkill for simple install prompt

### 9. Story Display

**Current**:

```css
.story-text - Scrollable text container
.navigation-dots - Horizontal dot indicators
```

**srcl equivalent**:

- `Text` - Paragraph styling
- No direct equivalent for navigation dots

**Migration Notes**:

- Story text is custom - colored spans for depth
- Navigation dots are custom - keep implementation
- Can use srcl's scrollbar styling

### 10. Minimap

**Current**:

```css
.minimap-container
.minimap-viewport
.minimap-minibuffer
```

**srcl equivalent**: None - this is highly custom

**Migration Notes**:

- Keep all minimap CSS
- Uses D3 for tree visualization
- Complex interactive component

---

## Files to Modify

### Phase 1: Setup & Variables

1. `client/styles/terminal.css` - Update CSS variable mapping
2. `client/main.tsx` - Ensure srcl global.css is imported

### Phase 2: Leaf Components

1. `client/interface/components/GamepadButton.tsx` - Use srcl Button
2. `client/interface/components/MenuButton.tsx` - Use srcl Button
3. `client/interface/components/MenuToggle.tsx` - Use srcl Checkbox
4. `client/interface/components/MenuKnob.tsx` - Use srcl NumberRangeSlider
5. `client/interface/components/MenuSelect.tsx` - Consider srcl Select
6. `client/interface/components/InstallPrompt.tsx` - Use srcl Dialog/Button

### Phase 3: Container Components

1. `client/interface/components/MenuScreen.tsx` - Use srcl Card/layout
2. `client/interface/components/ModeBar.tsx` - Use srcl Row
3. `client/interface/menus/SettingsMenu.tsx` - Update to use new controls
4. `client/interface/menus/TreeListMenu.tsx` - Use srcl ListItem
5. `client/interface/menus/ModelsMenu.tsx` - Use srcl ListItem
6. `client/interface/menus/EditMenu.tsx` - Use srcl TextArea

### Phase 4: Main Layout

1. `client/interface/Interface.tsx` - Update main layout classes

### Phase 5: Cleanup

1. `client/styles/terminal.css` - Remove migrated styles, keep custom ones
2. Update any remaining inline styles

---

## Styles to Keep (Not in srcl)

These are custom to loompad and should remain:

1. **Gamepad Layout**
   - `.terminal` main container
   - `.container` portrait/landscape grid
   - `.terminal-screen` bordered screen area
   - `.terminal-controls` controls positioning
   - `.controls-top` D-pad/buttons row
   - `.terminal-grid` D-pad grid layout
   - `.terminal-buttons` A/B buttons layout
   - `.terminal-menu` START/SELECT row

2. **Story Display**
   - `.story-text` scrollable container
   - `.navigation-dots` and `.navigation-dot`
   - Color-coded depth spans

3. **Minimap**
   - All `.minimap-*` classes
   - SVG/D3 visualization styles

4. **Animations**
   - `@keyframes cursor` - blinking cursor (srcl has this)
   - `@keyframes generatePulse` - loading animation
   - `@keyframes bump` / `@keyframes edgeBump` - edge feedback
   - `@keyframes menuFadeIn` / `@keyframes viewFadeIn` - transitions

5. **Theme Palettes**
   - Game Boy green palette (`--gb-*`)
   - Light theme palette (`--light-*`)
   - Theme switching classes

---

## srcl Components NOT Needed

These srcl components don't map to loompad's UI:

- `Accordion` - No accordion UI
- `ActionBar` - Different from mode bar
- `Avatar` - No user avatars
- `Badge` - No badges
- `BarLoader` / `BarProgress` - Using custom loading dots
- `BreadCrumbs` - No breadcrumbs
- `ButtonGroup` - D-pad is custom grid
- `CardDouble` - Not needed
- `CodeBlock` - No code display
- `ComboBox` - Using simpler select
- `DataTable` - No data tables
- `DatePicker` - No dates
- `DebugGrid` - Dev only
- `Divider` - Using borders
- `Drawer` - No drawer UI
- `DropdownMenu` / `DropdownMenuTrigger` - Simpler menus
- `HoverComponentTrigger` - Not needed
- `Indent` - Not needed
- `Message` / `MessageViewer` - Not a chat UI
- `Navigation` - Custom nav
- `Popover` - Not needed
- `RadioButton` / `RadioButtonGroup` - Using toggles
- `RowEllipsis` / `RowSpaceBetween` - Custom layouts
- `SidebarLayout` - No sidebar
- `Table` / `TableColumn` / `TableRow` - No tables
- `Tooltip` - Not needed
- `TreeView` - Using custom minimap

---

## Risk Assessment

### Low Risk (Safe to migrate)

- Button styling
- Input/TextArea styling
- Basic typography

### Medium Risk (Needs careful testing)

- Menu item selection states
- Form control behavior
- Keyboard navigation

### High Risk (Keep custom implementation)

- Gamepad layout
- Minimap
- Theme system
- Responsive portrait/landscape switching

---

## Recommended Approach

1. **Start with CSS variables** - Map terminal.css vars to srcl vars
2. **Migrate buttons first** - Simplest, most reusable
3. **Test keyboard navigation** - srcl has built-in support
4. **Keep custom layouts** - Don't force srcl where it doesn't fit
5. **Preserve animations** - They're part of the UX
6. **Test on mobile** - Gamepad layout is touch-optimized
