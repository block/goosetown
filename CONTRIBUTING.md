# Contributing to Goosetown

Goosetown is open source under the Apache 2.0 license. We welcome contributions!

If you have a larger feature in mind or questions about how to approach a fix, please [open an issue][issues] before starting.

## Prerequisites

- [Python 3.11+](https://www.python.org/)
- [uv](https://docs.astral.sh/uv/) — Python package manager
- [Node.js](https://nodejs.org/) (for UI / JavaScript linting)
- [Biome](https://biomejs.dev/) — JavaScript/TypeScript linter

## Getting Started

```bash
# Clone the repository
git clone https://github.com/block/goosetown.git
cd goosetown

# Install Python dependencies
uv sync

# Verify everything works
bash tests/run_all.sh
```

## Development Workflow

### Running Tests

```bash
bash tests/run_all.sh
```

### Linting

```bash
# Python — format and check
uv run black .

# JavaScript/TypeScript — check
npx @biomejs/biome check .
```

### Making Changes

1. Create a branch for your work:
   ```bash
   git checkout -b my-feature
   ```

2. Make your changes and ensure tests pass.

3. Commit with a sign-off (required — see [DCO](#developer-certificate-of-origin)):
   ```bash
   git commit -s -m "feat: add new skill loader"
   ```

4. Push and open a pull request against `main`.

## Pull Request Process

- Keep PRs focused — one concern per PR.
- Ensure all tests pass and linters are clean.
- Provide a clear description of what changed and why.
- PRs require review before merging.

## Conventional Commits

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for PR titles (e.g. `feat:`, `fix:`, `docs:`, `chore:`).

## Developer Certificate of Origin

This project requires a [Developer Certificate of Origin](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) sign-off on all commits. This certifies that you have the right to submit the work under the project's license.

```bash
git commit --signoff -m "your message"
# or
git commit -s -m "your message"
```

## Getting Help

If you run into issues or have questions, [open an issue][issues] and we'll be happy to help.

[issues]: https://github.com/block/goosetown/issues
