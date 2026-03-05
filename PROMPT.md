# KOKO SNS Dashboard — Implementation Prompt v3

## Project Info

| Key | Value |
|-----|-------|
| Name | sns-dashboard |
| Status | create-next-app initial state (1 commit, no custom code) |
| Next.js | 16.1.5 (App Router) |
| React | 19.2.3 |
| TypeScript | 5+ |
| Tailwind CSS | 4 (@tailwindcss/postcss, `@import "tailwindcss"`) |
| ESLint | 9 (Flat Config) |

---

## Overview

Multiple SNS platform accounts (TikTok, Instagram, YouTube, X, etc.) in one dashboard.
Track each account's latest post views, likes, saves manually (inline editing).
Filter by region (country) and language tabs.
Manage accounts, languages, platforms, and tags through a slide-out panel.

---

## Packages to Install

```bash
# State management
npm install zustand

# Validation
npm install zod

# Icons
npm install lucide-react

# shadcn/ui (after init, add these components)
npx shadcn@latest init
npx shadcn@latest add button dialog sheet table tabs select popover input badge dropdown-menu toast
```

---

## Reference UI

```
+--------------------------------------------------------------+
|  KOKO SNS DASHBOARD                                          |
|                                                              |
|  [flag] KR v                                                 |
|                                                              |
|  [# EN] [ JP ] [ SP ] [ CN ]                    [ Manage ]  |
|  -----------------------------------------------------------+|
|  Platform v | id | Followers | Last Post | Last Post | ...   |
|             |    |           |   Date    |   View    |       |
|  -----------------------------------------------------------+|
|  d tiktok   |    |           |           |           | #Tag  |
|  -----------------------------------------------------------+|
|  cam insta  |    |           |           |           |       |
|  -----------------------------------------------------------+|
+--------------------------------------------------------------+
```

### Design Rules
- Minimal black & white (color only on tag badges)
- Light mode only (no dark mode)
- Font: Geist Sans (already configured)
- Row separator: light gray line (#e5e5e5)
- Background: pure white (#ffffff)
- Active tab: black bg + white text, rounded-full
- Inactive tab: gray bg (#e5e5e5) + gray text, rounded-full
- Numbers: right-aligned, comma-formatted (1,234)

---

## Data Types

```typescript
// types/index.ts

export interface Region {
  code: string;        // "KR", "US", "JP"
  name: string;        // "Korea"
  flagEmoji: string;   // flag emoji character
}

export interface Language {
  id: string;
  code: string;        // "EN", "JP", "SP", "CN"
  label: string;       // "English"
  sortOrder: number;
}

export interface Platform {
  id: string;
  name: string;        // "tiktok" (lowercase, unique key)
  displayName: string; // "TikTok"
  iconName: string;    // lucide-react icon name or custom identifier
}

export interface Tag {
  id: string;
  label: string;       // "#Shadowban"
  color: string;       // hex "#ef4444"
}

export interface Account {
  id: string;
  platformId: string;
  username: string;
  regionCode: string;
  languageCode: string;

  followers: number | null;
  lastPostDate: string | null;   // "YYYY-MM-DD"
  lastPostView: number | null;
  lastPostLike: number | null;
  lastPostSave: number | null;

  tagIds: string[];

  createdAt: string;   // ISO datetime
  updatedAt: string;
}
```

---

## Zustand Store Shape

```typescript
// stores/dashboard-store.ts

interface DashboardStore {
  // Data
  regions: Region[];
  languages: Language[];
  platforms: Platform[];
  tags: Tag[];
  accounts: Account[];

  // Filters
  selectedRegion: string;        // Region.code
  selectedLanguage: string;      // Language.code
  platformFilter: string | null; // Platform.id or null (all)
  tagFilter: string | null;      // Tag.id or null (all)

  // Region CRUD
  addRegion: (region: Region) => void;
  removeRegion: (code: string) => void;

  // Language CRUD
  addLanguage: (lang: Omit<Language, 'id'>) => void;
  removeLanguage: (id: string) => void;
  reorderLanguages: (ids: string[]) => void;

  // Platform CRUD
  addPlatform: (platform: Omit<Platform, 'id'>) => void;
  removePlatform: (id: string) => void;

  // Tag CRUD
  addTag: (tag: Omit<Tag, 'id'>) => void;
  updateTag: (id: string, data: Partial<Tag>) => void;
  removeTag: (id: string) => void;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAccount: (id: string, data: Partial<Account>) => void;
  removeAccount: (id: string) => void;

  // Account Tags
  assignTag: (accountId: string, tagId: string) => void;
  unassignTag: (accountId: string, tagId: string) => void;

  // Filter setters
  setRegion: (code: string) => void;
  setLanguage: (code: string) => void;
  setPlatformFilter: (id: string | null) => void;
  setTagFilter: (id: string | null) => void;

  // Derived
  getFilteredAccounts: () => Account[];
}
```

Use `zustand/middleware` persist with `localStorage`, key: `"koko-sns-dashboard"`.

---

## Seed Data

On first load (localStorage empty), initialize with:

```typescript
// lib/constants.ts

export const SEED_REGIONS: Region[] = [
  { code: "KR", name: "Korea", flagEmoji: "🇰🇷" },
  { code: "US", name: "United States", flagEmoji: "🇺🇸" },
  { code: "JP", name: "Japan", flagEmoji: "🇯🇵" },
];

export const SEED_LANGUAGES: Language[] = [
  { id: "lang-en", code: "EN", label: "English", sortOrder: 0 },
  { id: "lang-jp", code: "JP", label: "Japanese", sortOrder: 1 },
  { id: "lang-sp", code: "SP", label: "Spanish", sortOrder: 2 },
  { id: "lang-cn", code: "CN", label: "Chinese", sortOrder: 3 },
];

export const SEED_PLATFORMS: Platform[] = [
  { id: "plt-tiktok", name: "tiktok", displayName: "TikTok", iconName: "music" },
  { id: "plt-instagram", name: "instagram", displayName: "Instagram", iconName: "instagram" },
  { id: "plt-youtube", name: "youtube", displayName: "YouTube", iconName: "youtube" },
];

export const SEED_TAGS: Tag[] = [
  { id: "tag-shadowban", label: "#Shadowban", color: "#ef4444" },
  { id: "tag-viral", label: "#Viral", color: "#22c55e" },
  { id: "tag-inactive", label: "#Inactive", color: "#6b7280" },
];
```

---

## Project Structure

```
app/
  layout.tsx
  page.tsx
  globals.css

components/
  dashboard/
    DashboardHeader.tsx
    RegionSelector.tsx
    LanguageTabs.tsx
    AccountTable.tsx
    AccountTableRow.tsx
    InlineEditCell.tsx
    PlatformFilterDropdown.tsx
    TagFilterDropdown.tsx
  manage/
    ManageSheet.tsx
    AccountManager.tsx
    LanguageManager.tsx
    PlatformManager.tsx
    TagManager.tsx
  common/
    TagBadge.tsx
    TagSelector.tsx
    PlatformIcon.tsx
    ConfirmDialog.tsx
    EmptyState.tsx
  ui/
    (shadcn/ui generated components)

stores/
  dashboard-store.ts

types/
  index.ts

lib/
  utils.ts
  validators.ts
  constants.ts
```

---

## Validation (Zod)

```typescript
// lib/validators.ts
import { z } from 'zod';

export const accountSchema = z.object({
  platformId: z.string().min(1, "Select a platform"),
  username: z.string().min(1, "Enter username").max(100),
  regionCode: z.string().min(1, "Select a region"),
  languageCode: z.string().min(1, "Select a language"),
});

export const languageSchema = z.object({
  code: z.string().min(1).max(5),
  label: z.string().min(1).max(50),
});

export const platformSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(50),
  iconName: z.string().min(1),
});

export const tagSchema = z.object({
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
```

---

## Table Columns

| # | Column | Type | Editable | Align | Notes |
|---|--------|------|----------|-------|-------|
| 1 | Platform | icon + text | No | left | Filter dropdown on header icon |
| 2 | id | text | No | left | @username |
| 3 | Followers | number | Yes (inline) | right | Format: 1,234 |
| 4 | Last Post Date | date | Yes (inline) | left | Format: YYYY-MM-DD |
| 5 | Last Post View | number | Yes (inline) | right | Format: 1,234 |
| 6 | Last Post Like | number | Yes (inline) | right | Format: 1,234 |
| 7 | Last Post Save | number | Yes (inline) | right | Format: 1,234 |
| 8 | ETC | tag badges | Yes (popover) | left | Filter dropdown on header icon. Click to add/remove tags |

### Inline Edit Behavior
- Click cell -> transforms to input (shows raw number, no commas)
- Number cells: type="number"
- Date cell: type="date"
- Enter or blur -> save + return to display mode
- Escape -> cancel changes

### ETC Cell Behavior
- Click -> Popover opens with checkbox list of all tags
- Check/uncheck -> immediately saves
- Cell displays assigned tags as colored badges

---

## Manage Sheet Tabs

### [Accounts]
- List of registered accounts (platform icon + username)
- "Add Account" button -> Dialog with: platform select, username input, region select, language select
- Delete button per row -> ConfirmDialog

### [Languages]
- List of language codes + labels
- "Add Language" button -> code + label input
- Delete button per row -> warn if accounts exist with this language

### [Platforms]
- List of platforms (icon + display name)
- "Add Platform" button -> name, displayName, icon select
- Delete button per row -> warn if accounts exist on this platform

### [Tags]
- List of tags (colored badge + label)
- "Add Tag" button -> label (with #), color picker
- Edit color inline
- Delete button per row -> removes from all accounts too

---

## Constraints

- NO `as any`, `@ts-ignore`, `@ts-expect-error`
- NO empty catch blocks
- NO console.log in production code
- NO dark mode (light mode only)
- NO API routes (no app/api/ directory)
- NO external API calls (manual input only)
- NO pages/ directory (App Router only)
- Client components: use 'use client' directive only where needed
- Import order: react -> next -> external libs -> internal (@/)
- Number formatting: toLocaleString('en-US')

---

# IMPLEMENTATION PHASES

---

## Phase 1: Project Setup

### Goal
Install dependencies, initialize shadcn/ui, define types and constants.

### Tasks
1. Install packages:
   ```bash
   npm install zustand zod lucide-react
   npx shadcn@latest init
   npx shadcn@latest add button dialog sheet table tabs select popover input badge dropdown-menu toast
   ```

2. Create `types/index.ts` — all interfaces (Region, Language, Platform, Tag, Account)

3. Create `lib/constants.ts` — seed data arrays

4. Create `lib/utils.ts`:
   - `cn()` — classname merge (shadcn provides this)
   - `generateId()` — `crypto.randomUUID()` wrapper
   - `formatNumber(n: number | null)` — returns formatted string or "-"
   - `formatDate(d: string | null)` — returns formatted date or "-"

5. Create `lib/validators.ts` — all Zod schemas

6. Modify `app/globals.css`:
   - Remove dark mode CSS
   - Keep light mode variables only

7. Modify `app/layout.tsx`:
   - Remove dark mode class logic
   - Set `<html lang="ko">` (or "en")
   - Keep Geist font setup

### Deliverables
- All packages installed and working
- Type system complete
- Utility functions ready
- Validation schemas defined
- Clean light-mode-only CSS

---

## Phase 2: Store + Layout Scaffold

### Goal
Zustand store with persist, basic page layout rendering.

### Tasks
1. Create `stores/dashboard-store.ts`:
   - Full DashboardStore interface implementation
   - `persist` middleware with localStorage
   - Key: `"koko-sns-dashboard"`
   - Initialize with seed data when store is empty
   - `getFilteredAccounts()`: filter by selectedRegion + selectedLanguage + platformFilter + tagFilter

2. Modify `app/page.tsx`:
   - 'use client' (needs zustand)
   - Import store
   - Render layout skeleton:
     ```
     DashboardHeader
     RegionSelector
     LanguageTabs + ManageButton
     AccountTable
     ```

3. Create `components/dashboard/DashboardHeader.tsx`:
   - "KOKO SNS DASHBOARD" title
   - Bold, uppercase, text-3xl, font-bold

### Deliverables
- Store loads from localStorage (or initializes with seed)
- Page renders title
- Store actions work (verifiable via console in dev tools)

---

## Phase 3: Dashboard UI Components

### Goal
Region selector, language tabs, and the main data table (read-only first).

### Tasks
1. Create `components/dashboard/RegionSelector.tsx`:
   - shadcn Select component
   - Shows flag emoji + region code
   - Options from store.regions
   - onChange -> store.setRegion()

2. Create `components/dashboard/LanguageTabs.tsx`:
   - Horizontal pill buttons (not shadcn Tabs — custom styled)
   - Active: bg-black text-white rounded-full px-4 py-1.5
   - Inactive: bg-neutral-200 text-neutral-500 rounded-full px-4 py-1.5
   - Gap between pills: gap-2
   - onClick -> store.setLanguage()

3. Create `components/common/PlatformIcon.tsx`:
   - Maps platform.iconName to lucide-react icon
   - Fallback: generic Globe icon
   - Size: 20x20

4. Create `components/common/TagBadge.tsx`:
   - Small badge with tag.color as background (10% opacity) + text color
   - Rounded, text-xs, px-2 py-0.5

5. Create `components/common/EmptyState.tsx`:
   - Centered message: "No accounts found. Add one from Manage."

6. Create `components/dashboard/AccountTable.tsx`:
   - shadcn Table component
   - Header row with all 8 columns
   - Maps store.getFilteredAccounts() to AccountTableRow
   - Shows EmptyState when no accounts

7. Create `components/dashboard/AccountTableRow.tsx`:
   - Renders one account row
   - Platform cell: PlatformIcon + platform displayName
   - id cell: username text
   - Number cells: formatted with commas (read-only for now)
   - Date cell: formatted date (read-only for now)
   - ETC cell: TagBadge for each assigned tag
   - Last cell: more menu (vertical dots) with "Delete" option

8. Wire everything in `app/page.tsx`:
   - Full layout with all components
   - Proper spacing matching the reference UI

### Deliverables
- Complete read-only dashboard rendering
- Region dropdown filters accounts
- Language tabs filter accounts
- Table displays all filtered accounts
- Platform icons and tag badges render correctly

---

## Phase 4: Inline Editing

### Goal
Click any editable cell to modify its value directly in the table.

### Tasks
1. Create `components/dashboard/InlineEditCell.tsx`:
   - Props: `value`, `onChange`, `type` ("number" | "date"), `align` ("left" | "right")
   - Display mode: shows formatted value, cursor-pointer
   - Edit mode: renders `<input>`, auto-focused, pre-filled with raw value
   - Enter/blur -> call onChange with new value, return to display mode
   - Escape -> cancel, return to display mode
   - Number type: strip commas on edit, parse as number on save
   - Date type: native date picker

2. Integrate InlineEditCell into AccountTableRow:
   - Followers, Last Post View, Last Post Like, Last Post Save -> type="number"
   - Last Post Date -> type="date"
   - onChange -> store.updateAccount(id, { [field]: newValue })

### Deliverables
- All numeric and date cells are click-to-edit
- Values persist to localStorage via zustand
- Escape cancels edits
- Number formatting preserved in display mode

---

## Phase 5: Manage Sheet

### Goal
Slide-out panel for managing accounts, languages, platforms, and tags.

### Tasks
1. Create `components/manage/ManageSheet.tsx`:
   - shadcn Sheet (side="right", width ~480px)
   - Header: "Settings"
   - 4 tabs: Accounts, Languages, Platforms, Tags
   - Uses shadcn Tabs component inside Sheet

2. Create `components/manage/AccountManager.tsx`:
   - Top: "Add Account" button
   - Click -> shadcn Dialog with form:
     - Platform select (from store.platforms)
     - Username input (text)
     - Region select (from store.regions)
     - Language select (from store.languages)
   - Zod validation on submit
   - Duplicate check: same platformId + username -> show error
   - Below button: list of existing accounts
     - Each row: platform icon + username + region + language + delete button
   - Delete -> ConfirmDialog -> store.removeAccount()

3. Create `components/manage/LanguageManager.tsx`:
   - Top: "Add Language" button -> Dialog
     - Code input (text, uppercase)
     - Label input (text)
   - Zod validation
   - Duplicate check on code
   - Below: list of languages with delete button
   - Delete warning: "N accounts use this language. They will lose their language assignment."

4. Create `components/manage/PlatformManager.tsx`:
   - Top: "Add Platform" button -> Dialog
     - Name input (lowercase)
     - Display name input
     - Icon select (dropdown of available lucide icons or text input)
   - Below: list of platforms with delete button
   - Delete warning: "N accounts on this platform will be deleted."

5. Create `components/manage/TagManager.tsx`:
   - Top: "Add Tag" button -> Dialog
     - Label input (must start with #)
     - Color picker (simple hex input or preset colors)
   - Below: list of tags (colored badge + delete button)
   - Delete: removes tag from all accounts + deletes tag

6. Create `components/common/ConfirmDialog.tsx`:
   - shadcn Dialog
   - Props: title, description, onConfirm, onCancel
   - "Cancel" and "Delete" (red) buttons

7. Add Manage button to `app/page.tsx`:
   - Right side of language tabs row
   - Opens ManageSheet

### Deliverables
- Manage sheet opens/closes properly
- All 4 CRUD sections work
- Validation prevents invalid input
- Cascade warnings show before dangerous deletes
- Data persists after add/delete operations

---

## Phase 6: Filtering + Tag Assignment

### Goal
Column filters for Platform and ETC, plus tag assignment popover.

### Tasks
1. Create `components/dashboard/PlatformFilterDropdown.tsx`:
   - Triggered by filter icon (funnel) in Platform column header
   - shadcn DropdownMenu
   - Options: "All Platforms" + each platform from store
   - Checkmark on currently selected
   - Selection -> store.setPlatformFilter()

2. Create `components/dashboard/TagFilterDropdown.tsx`:
   - Triggered by filter icon in ETC column header
   - Same pattern as PlatformFilterDropdown
   - Options: "All Tags" + each tag from store
   - Selection -> store.setTagFilter()

3. Create `components/common/TagSelector.tsx`:
   - shadcn Popover
   - Triggered by clicking ETC cell in a row
   - Shows all tags as checkboxes
   - Checked = tag assigned to this account
   - Toggle -> store.assignTag() / store.unassignTag()
   - Changes reflect immediately in the table cell

4. Update AccountTable header to include filter icons:
   - Platform header: text + PlatformFilterDropdown
   - ETC header: text + TagFilterDropdown

5. Update AccountTableRow ETC cell:
   - Click -> TagSelector popover
   - Display -> TagBadge for each assigned tag

### Deliverables
- Platform column filterable via dropdown
- ETC column filterable via dropdown
- Tag assignment via popover in each row
- All filters stack: region + language + platform + tag
- Filter state persists (zustand)

---

## Phase Summary

| Phase | What | Key Files | Est. Components |
|-------|------|-----------|-----------------|
| 1 | Setup | types, lib, globals.css | 0 (config only) |
| 2 | Store + Layout | store, page.tsx, Header | 2 |
| 3 | Dashboard UI | Table, Row, Icons, Badges | 7 |
| 4 | Inline Editing | InlineEditCell | 1 |
| 5 | Manage Sheet | Sheet, 4 Managers, Dialog | 7 |
| 6 | Filtering + Tags | 2 Filters, TagSelector | 3 |
| **Total** | | | **~20 components** |

---

## Future Phases (Not in this prompt)

### Phase 7: API Integration (requires DB + external API keys)
- Prisma + PostgreSQL setup
- SNS API client factory (TikTok, Instagram, YouTube)
- OAuth flow per platform
- Auto-sync via Vercel Cron
- Token encryption

### Phase 8: Analytics
- MetricHistory time-series tracking
- Charts (views over time)
- Growth rate calculations
- Export to CSV

### Phase 9: Multi-user
- NextAuth.js authentication
- Per-user data isolation
- Role-based access
