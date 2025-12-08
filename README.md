# Portfoli-YOU

<div align="center">

**A Portfolio for you, by you.**

A local-first desktop application that empowers anyone—regardless of coding experience—to design and deploy their own professional portfolio website using a drag-and-drop editor.

[Download](https://portfoliyou.snxethan.dev) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Features

### **Drag-and-Drop Visual Editor**
- Intuitive grid-based canvas with 12-column responsive layout
- Live preview of your portfolio as you build
- Undo/redo support with comprehensive history management
- Real-time visual feedback and instant updates

### **Rich Widget Library**
Build stunning portfolios with pre-built, customizable widgets:
- **Text** - Rich text content with markdown support
- **Image** - Image display with automatic asset management
- **Video** - Embedded video support
- **Project** - Showcase your projects with descriptions and links
- **Contact** - Contact forms and social links
- **Link & NavLink** - Interactive navigation elements
- **Carousel** - Image galleries and slideshows
- **GitHub Repos** - Display your GitHub repositories dynamically
- And more coming soon!

### **Smart Asset Management**
- Automatic image deduplication using SHA-256 hashing
- Local IndexedDB storage for fast access
- Optional cloud sync with Firebase Storage
- Optimized asset delivery and caching

### **Optional Cloud Sync**
- Sign in with Firebase Authentication
- Sync portfolios across multiple devices
- Cloud storage with quota management
- Work offline, sync when ready

### **One-Click Deployment**
- Export static HTML/CSS/JavaScript bundle
- Built-in preview server for testing
- Ready to deploy to any static hosting service
- Self-contained with all assets embedded

### **Local-First Architecture**
- Full functionality without internet connection
- Your data stays on your machine by default
- Privacy-focused design
- Fast performance with local storage

---

## Screenshots

> **Note**: Screenshots coming soon! The app features a modern, clean interface with:
> - A projects dashboard for managing multiple portfolios
> - A powerful visual editor with widget palette
> - Live preview mode
> - Comprehensive settings panels

---

## Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **TailwindCSS** - Utility-first styling
- **Lucide React** - Beautiful icon library
- **DnD Kit** - Drag-and-drop interactions
- **React Router** - Client-side routing
- **Zod** - Runtime type validation

### Desktop
- **Electron 38** - Cross-platform desktop app framework
- **Electron Builder** - Application packaging and distribution

### Backend & Cloud (Optional)
- **Firebase** - Authentication and cloud storage
- **Firestore** - Document database for portfolio metadata
- **Firebase Storage** - Asset hosting with CORS support

### Development & Testing
- **Vitest** - Unit testing framework
- **Playwright** - End-to-end testing
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## Getting Started

### Prerequisites

- **Node.js**: >= 20.19.0 or >= 22.12.0
- **npm**: Latest version recommended

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/snxethan/PortfoliYOU-APP.git
   cd PortfoliYOU-APP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright (for testing)**
   ```bash
   npx playwright install --with-deps
   ```

### Running the Application

#### Development Mode
Start the application in development mode with hot-reload:

```bash
npm run dev
```

This starts:
- TypeScript compiler in watch mode
- Vite dev server on `http://localhost:5173`
- Electron application window

#### Renderer Only (for faster iteration)
Run just the React frontend without Electron:

```bash
npm run dev:renderer
```

---

## Building & Distribution

### Build for Testing
Build the application without creating installers:

```bash
npm run build
```

This compiles TypeScript, builds the React app, and creates an unpacked Electron app in `dist/`.

### Create Distributable Installers

#### Windows & macOS
```bash
npm run dist
```

This creates:
- **Windows**: `Portfoli-YOU-{version}.exe` installer
- **macOS**: `Portfoli-YOU-{version}.dmg` disk image

Installers are output to the `dist/` directory.

---

## Testing

### Unit Tests
Run Vitest unit tests:

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

Unit tests are located in `tests/unit/` and cover:
- Project management utilities
- Rename and normalization logic
- Provider state management

### End-to-End Tests
Run Playwright E2E tests:

```bash
npm run test:e2e
```

E2E tests cover:
- Editor workflow (add, move, rename, undo, redo)
- Page navigation consistency
- Widget history management
- Preview snapshot generation

Test files are in `tests/` directory.

---

## Project Structure

```
PortfoliYOU-APP/
├── app/
│   ├── main/                    # Electron main process
│   │   ├── main.ts             # Main entry point
│   │   ├── staticCompiler.ts   # Portfolio compilation logic
│   │   └── staticServer.ts     # Preview server
│   ├── preload/                # Electron preload scripts
│   ├── renderer/               # React frontend application
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── pages/          # Page components (Home, Editor, Deploy)
│   │   │   ├── providers/      # React Context providers
│   │   │   ├── widgets/        # Widget system
│   │   │   │   ├── defs/       # Widget definitions
│   │   │   │   ├── settings/   # Widget settings UI
│   │   │   │   └── templates/  # Widget templates
│   │   │   ├── lib/            # Utility functions
│   │   │   └── hooks/          # Custom React hooks
│   │   └── public/             # Static assets
│   └── shared/                 # Shared code between processes
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   └── *.spec.ts              # E2E test specs
├── docs/                       # Documentation
│   ├── widgets-dev.md          # Widget development guide
│   ├── assets-manager.md       # Asset management documentation
│   ├── cloud-project-setup.md  # Firebase setup guide
│   └── SMOKE_TEST.md          # Smoke test documentation
├── functions/                  # Firebase Cloud Functions (if used)
├── package.json               # Project dependencies and scripts
├── vite.config.mjs           # Vite configuration
├── tsconfig.electron.json    # TypeScript config for Electron
├── playwright.config.ts      # Playwright test configuration
└── firebase.json             # Firebase configuration
```

---

## Documentation

Detailed documentation is available in the `docs/` directory:

- **[Widget Development Guide](docs/widgets-dev.md)** - Learn how to create custom widgets
- **[Asset Manager](docs/assets-manager.md)** - Understanding the asset management system
- **[Cloud Project Setup](docs/cloud-project-setup.md)** - Firebase configuration guide
- **[Smoke Tests](docs/SMOKE_TEST.md)** - Testing workflow documentation

---

## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (Electron + Vite) |
| `npm run dev:renderer` | Start renderer only (Vite dev server) |
| `npm run build` | Build application (no installer) |
| `npm run dist` | Create distributable installers |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests |

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** and ensure tests pass
4. **Commit your changes** (`git commit -m 'Add amazing feature'`)
5. **Push to the branch** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (ESLint + Prettier)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described
- Ensure all tests pass before submitting PR

---

## Troubleshooting

### Common Issues

**Build Errors**
- Ensure Node.js version matches requirements (>= 20.19.0 or >= 22.12.0)
- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`

**Firebase/Cloud Sync Issues**
- Check Firebase configuration in the console
- Verify CORS settings are applied (see [Cloud Project Setup](docs/cloud-project-setup.md))
- Ensure Firestore indexes are deployed

**Electron Won't Start**
- Make sure all dependencies are installed
- Try deleting the `out/` directory and rebuilding

---

## License

This project is currently under development. License information will be added soon.

---

## Acknowledgments

- Built with ❤️ using modern web technologies
- Icons by [Lucide](https://lucide.dev/)
- Inspired by the need for accessible portfolio creation tools

---

## Links

- **Website**: [https://portfoliyou.snxethan.dev](https://portfoliyou.snxethan.dev)
- **Website Repository**: [https://github.com/snxethan/PortfoliYOU-WEBSITE](https://github.com/snxethan/PortfoliYOU-WEBSITE)
- **App Repository**: [https://github.com/snxethan/PortfoliYOU-APP](https://github.com/snxethan/PortfoliYOU-APP)

---

## Author(s)

- [**Ethan Townsend (snxethan)**](https://www.ethantownsend.dev)

<div align="center">

**A Portfolio for you, by you.**
Portfoli-YOU

</div>
