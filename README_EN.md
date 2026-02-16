# YouTube Music Importer

Import Spotify playlists to YouTube Music.

## Features

- Read Spotify CSV export files (Exportify format)
- Automatically match songs to YouTube Music
- Create YouTube Music playlists
- Resume from interruption
- Configurable match confidence

## Requirements

- [Bun](https://bun.sh) (JavaScript runtime)

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure cookies (optional, for logged-in features):
   - Copy `config/cookies.example.json` to `config/cookies.json`
   - Fill in your YouTube Music browser cookies

## Usage

1. Prepare your CSV file (exported from Exportify or similar tools)
2. Run the program:
   ```bash
   bun run start
   ```
3. Follow the prompts: enter CSV path, playlist name, etc.

## Configuration

- **Match confidence**: high/medium/low/none - controls how strict the auto-matching is
- **Request delay**: prevents rate limiting
- Progress is auto-saved to `import-progress.json`, can resume after interruption

## Project Structure

```
yt-importer/
├── src/
│   ├── core/         # Core logic
│   ├── cli/          # Interactive prompts
│   └── types/        # Type definitions
├── config/           # Configuration files
└── example_csv/      # Sample files
```
