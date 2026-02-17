# YouTube Music Importer

Import Spotify playlists to YouTube Music.

## Features

- Read Spotify CSV export files (Exportify format)
- Automatically match songs to YouTube Music
- Incremental import to existing playlists
- Confidence levels (high/medium/low) with configurable matching strictness
- Low confidence tracks collected for manual selection
- Create YouTube Music playlists
- Resume from interruption (SQLite persistence)
- Search result caching (with TTL expiration)
- Smart retry mechanism (exponential backoff + 429 rate limit detection)
- Cookie expiration detection
- Real-time progress bar with ETA estimation
- Multi-language support (English / 简体中文 / 日本語)
- Pure Ink TUI implementation for smooth interaction

## Requirements

- [Bun](https://bun.sh) (JavaScript runtime)

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure cookies (optional, for logged-in features):
   - Create `config/cookies.json`
   - Fill in your YouTube Music browser cookies

## Usage

1. Prepare your CSV file (exported from Exportify or similar tools)
2. Run the program:
   ```bash
   bun run start
   ```
3. Follow the prompts: select options, enter CSV path, playlist name, etc.

### Main Menu

- **New Import**: Create new playlist and import songs
- **Incremental Import**: Add songs to existing playlist (auto-skip duplicates)
- **Resume**: Continue interrupted import
- **View Progress**: View historical import records
- **View Failed**: View failed track list
- **Settings**: Adjust match confidence, request delay, etc.
- **Language**: Switch UI language

## Configuration

- **Match confidence**: high/medium/low - controls auto-matching strictness
- **Request delay**: prevents rate limiting
- Progress auto-saved to SQLite database, can resume after interruption

## Project Structure

```
yt-importer/
├── src/
│   ├── core/           # Core logic (CSV parsing, search, matching, import)
│   ├── cli/            # Interactive prompts
│   ├── tui/            # Ink TUI components
│   ├── types/          # Type definitions (Zod schemas)
│   ├── utils/          # Utilities (database, cache, i18n)
│   └── index.ts        # Main entry point
├── config/             # Configuration files
│   ├── cookies.json    # YouTube Cookie (sensitive)
│   └── translations/   # Multi-language translations
├── example_csv/       # Sample files
└── import-progress.sqlite  # Progress storage
```

## Related Links

- [youtubei.js](https://www.npmjs.com/package/youtubei.js) - YouTube API client
- [Exportify](https://exportify.net/) - Spotify playlist export tool
