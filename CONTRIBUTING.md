# Contributing to AudiobookShelf Mobile App

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/audiobookshelf-app.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Before You Start

1. Read the [Architecture Documentation](docs/architecture.md)
2. Check [Current Work](docs/current-work.md) to see what's in progress
3. Review [Claude Instructions](docs/claude-instructions.md) for code guidelines

### While Developing

1. **Keep files small**: Maximum 400 lines per file
2. **Use TypeScript**: All new files must be TypeScript
3. **Follow the structure**: Place code in appropriate feature folders
4. **Write comments**: Explain "why" not "what"
5. **Handle errors**: Always use try/catch for async operations
6. **Update docs**: Keep documentation current

### Code Style

We use Prettier and ESLint to maintain code quality:
```bash
npm run format  # Format code
npm run lint    # Check for issues
```

### Commit Messages

Use conventional commit format:
```
feat(feature-name): Add new feature
fix(feature-name): Fix bug
docs: Update documentation
refactor: Improve code structure
test: Add tests
```

## Pull Request Process

1. **Update documentation** if you've made significant changes
2. **Update current-work.md** with your changes
3. **Test on both iOS and Android** if possible
4. **Create a PR** with a clear description of changes
5. **Link any related issues**

## Code Review

All submissions require review. We'll look for:

- Code quality and maintainability
- Adherence to project structure
- Proper error handling
- TypeScript usage
- Documentation updates

## Feature Development

### Starting a New Feature

1. Create feature folder: `src/features/feature-name/`
2. Create feature doc: `docs/features/feature-name.md`
3. Update `docs/current-work.md`

### Feature Structure
```
feature-name/
├── components/     # UI components
├── hooks/          # Custom hooks
├── screens/        # Screen components
├── services/       # Business logic
└── index.ts        # Public API
```

## Testing

Currently focused on manual testing. If you add tests:

- Place unit tests next to the file: `file.test.ts`
- Use Jest and React Native Testing Library
- Test business logic, not UI (for now)

## Questions?

- Check the [documentation](docs/)
- Open an issue for discussion
- Join our community channels

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Help others learn and grow
- Keep discussions professional

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing! 🎉
