import { existsSync } from "node:fs";
import { Importer } from "./core/importer.js";
import { ImporterConfigSchema } from "./types/index.js";
import type { ImporterOptions } from "./core/importer.js";
import {
  promptForImport,
  confirmImport,
  printSummary,
} from "./cli/prompts.js";

async function main(): Promise<void> {
  console.log("YouTube Music Importer");
  console.log("======================\n");

  const answers = await promptForImport();

  if (!existsSync(answers.csvPath)) {
    console.error("Error: CSV file not found:", answers.csvPath);
    process.exit(1);
  }

  const config = ImporterConfigSchema.parse({
    minConfidence: answers.minConfidence,
    requestDelay: answers.requestDelay,
    skipConfirmation: answers.skipConfirmation,
    saveProgress: true,
    progressFile: "./import-progress.json",
  });

  const importerOptions: ImporterOptions = {
    csvPath: answers.csvPath,
    config,
  };

  try {
    const importer = new Importer(importerOptions);

    console.log("Initializing...");
    await importer.init();

    console.log("Loading CSV...");
    importer.loadCsv();

    const hasProgress = importer.loadProgress();
    if (hasProgress) {
      console.log("\nResuming previous import session...\n");
    }

    const results = await importer.processTracks();

    importer.printSummary();

    const stats = importer.getStats();

    if (stats.matched > 0) {
      const proceed = await confirmImport(stats);
      if (proceed) {
        console.log("\nCreating playlist:", answers.playlistName);
        await importer.createPlaylist(answers.playlistName);

        const playlistId = importer.getPlaylistId?.();
        if (playlistId) {
          console.log("Importing songs to playlist...");
          const importResult = await importer.importToPlaylist(playlistId, results);
          console.log("\nImport complete!");
          console.log("  Success:", importResult.success);
          console.log("  Failed:", importResult.failed);
        }
      }
    }

    console.log("\nDone!");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
}

main();
