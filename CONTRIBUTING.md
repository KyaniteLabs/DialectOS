# Contributing to DialectOS

Thank you for your interest in contributing! DialectOS is a community-driven project and we welcome contributions of all kinds — code, documentation, bug reports, feature requests, and translations.

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** 9.15.0 (managed via corepack)

### Setup

```bash
git clone https://github.com/Pastorsimon1798/DialectOS.git
cd DialectOS
pnpm install
pnpm build
pnpm test
```

All 590 tests should pass before you submit a PR.

## 📁 Repository Structure

```
packages/
├── mcp/              MCP server (stdio, 16 tools)
├── cli/              CLI commands and translation pipelines
├── providers/        Translation providers with circuit breaker
├── security/         Rate limiting, validation, sanitization
├── types/            Shared TypeScript types
├── locale-utils/     Locale file diff/merge
└── markdown-parser/  Structure-preserving markdown parser
```

Each package is independently versioned and tested.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test -- --filter=@espanol/cli

# Run tests in watch mode
pnpm --filter=@espanol/cli test:watch

# Run with coverage
pnpm test:coverage
```

### Writing Tests

- We use **Vitest** for testing
- Tests live next to source code in `src/__tests__/`
- Follow the existing patterns: mock providers, use temporary directories, clean up after tests
- New features must include tests

## 📝 Code Style

- **TypeScript** with strict mode enabled
- Use `type` imports where possible
- Prefer explicit return types on exported functions
- Follow existing naming conventions (`kebab-case` for files, `camelCase` for functions)

## 🔄 Commit Convention

We use atomic commits with descriptive messages:

```
feat(cli): add new translate-batch command
fix(providers): handle LibreTranslate timeout edge case
docs(readme): update MCP configuration examples
test(security): add SSRF validation tests
```

## 🐛 Reporting Bugs

Please open an issue with:
1. A clear description of the bug
2. Steps to reproduce
3. Expected vs actual behavior
4. Your environment (Node version, OS, DialectOS version)

## 💡 Requesting Features

Open an issue with the `enhancement` label. Describe:
1. The problem you're trying to solve
2. Your proposed solution
3. Any alternatives you've considered

## 🔒 Security

If you discover a security vulnerability, please see [`SECURITY.md`](SECURITY.md) for responsible disclosure.

## 🏷️ Good First Issues

Look for issues tagged with `good first issue` — these are designed for newcomers and have clear acceptance criteria.

## 📜 Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/Pastorsimon1798/DialectOS/discussions)
- Or reach out via the issue tracker

Thank you for making DialectOS better! 🌎
