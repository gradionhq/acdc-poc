import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement window.matchMedia. Provide a default stub that
// returns no match (light preference) so every test that renders <App /> works
// without needing to set it up individually. Tests that care about the OS
// colour-scheme preference override this in their own beforeEach.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Replace every lucide-react icon with a trivial null-rendering stub so that
// jsdom does not parse heavy inline SVGs. This dramatically speeds up unit
// tests that render large note lists (NoteCard renders ~9 icons each).
// We enumerate every icon imported across the codebase; the stub returns null
// which is a valid React render result.
vi.mock('lucide-react', () => {
  function IconStub() {
    return null;
  }
  return {
    AlertTriangle: IconStub,
    Archive: IconStub,
    ArchiveRestore: IconStub,
    ArrowUpDown: IconStub,
    Bold: IconStub,
    CheckCircle2: IconStub,
    ChevronLeft: IconStub,
    ChevronRight: IconStub,
    Copy: IconStub,
    FileText: IconStub,
    Heading2: IconStub,
    HelpCircle: IconStub,
    Italic: IconStub,
    Link: IconStub,
    List: IconStub,
    Menu: IconStub,
    Moon: IconStub,
    MoreHorizontal: IconStub,
    Paperclip: IconStub,
    PenLine: IconStub,
    Pencil: IconStub,
    Pin: IconStub,
    PinOff: IconStub,
    Plus: IconStub,
    Search: IconStub,
    SearchX: IconStub,
    Sun: IconStub,
    Tag: IconStub,
    Trash2: IconStub,
    RotateCcw: IconStub,
    X: IconStub,
    XCircle: IconStub,
  };
});
