import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Searcher from "../../src/core/searcher.js";

const mockInnertubeInstance = {
  music: {
    search: vi.fn(),
  },
  playlist: {
    create: vi.fn(),
    addVideos: vi.fn(),
  },
  getPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
};

vi.mock("youtubei.js", () => ({
  Innertube: {
    create: vi.fn().mockResolvedValue(mockInnertubeInstance),
  },
}));

vi.mock("../../src/utils/cookies.js", () => ({
  loadCookieHeader: vi.fn().mockResolvedValue(""),
}));

describe("searcher.ts - Integration Tests", () => {
  let tempDir: string;
  let searcher: Searcher;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "yt-importer-searcher-"));
    searcher = new Searcher();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("init", () => {
    it("should initialize searcher without cookies", async () => {
      await searcher.init({ lang: "en", location: "US" }, "");
      expect(mockInnertubeInstance.music.search).not.toHaveBeenCalled();
    });

    it("should initialize searcher with cookies", async () => {
      const cookiePath = join(tempDir, "cookies.json");
      writeFileSync(cookiePath, "{}");

      await searcher.init(
        { lang: "en", location: "US", cookies: "cookie-string" },
        cookiePath,
      );
      expect(mockInnertubeInstance.music.search).not.toHaveBeenCalled();
    });

    it("should use custom user agent", async () => {
      const customUA = "Mozilla/5.0 Custom Browser";
      await searcher.init({ userAgent: customUA }, "");
      expect(mockInnertubeInstance.music.search).not.toHaveBeenCalled();
    });

    it("should use proxy when provided", async () => {
      await searcher.init({ proxy: "http://proxy:8080" }, "");
      expect(mockInnertubeInstance.music.search).not.toHaveBeenCalled();
    });
  });

  describe("searchSongs", () => {
    it("should throw error when not initialized", async () => {
      const searcher2 = new Searcher();
      await expect(searcher2.searchSongs(["test"])).rejects.toThrow(
        "Innertube没有初始化",
      );
    });

    it("should perform search and return results", async () => {
      await searcher.init({ lang: "en" }, "");

      const mockResults = [{ type: "song", title: "Test Song" }];
      mockInnertubeInstance.music.search.mockResolvedValueOnce(mockResults);

      const results = await searcher.searchSongs(["test query"]);

      expect(mockInnertubeInstance.music.search).toHaveBeenCalledWith(
        "test query",
        { type: "song" },
      );
      expect(results).toEqual([mockResults]);
    });

    it("should perform multiple searches", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.music.search
        .mockResolvedValueOnce([{ type: "song" }])
        .mockResolvedValueOnce([{ type: "song" }]);

      const results = await searcher.searchSongs(["query1", "query2"]);

      expect(results).toHaveLength(2);
      expect(mockInnertubeInstance.music.search).toHaveBeenCalledTimes(2);
    });

    it("should throw error when search fails", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.music.search.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(searcher.searchSongs(["test"])).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("createPlaylist", () => {
    it("should throw error when not initialized", async () => {
      const searcher2 = new Searcher();
      await expect(searcher2.createPlaylist("Test")).rejects.toThrow(
        "Innertube没有初始化",
      );
    });

    it("should create playlist and return id", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.playlist.create.mockResolvedValueOnce({
        playlist_id: "PLtest123",
      });

      const playlistId = await searcher.createPlaylist("My Playlist");

      expect(playlistId).toBe("PLtest123");
      expect(mockInnertubeInstance.playlist.create).toHaveBeenCalledWith(
        "My Playlist",
        [],
      );
    });

    it("should handle create playlist error", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.playlist.create.mockRejectedValueOnce(
        new Error("API Error"),
      );

      await expect(searcher.createPlaylist("Test")).rejects.toThrow();
    });
  });

  describe("addToPlaylist", () => {
    it("should throw error when not initialized", async () => {
      const searcher2 = new Searcher();
      await expect(
        searcher2.addToPlaylist("playlistId", ["vid1"]),
      ).rejects.toThrow("Innertube没有初始化");
    });

    it("should add videos to playlist", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.playlist.addVideos.mockResolvedValueOnce(undefined);

      await searcher.addToPlaylist("PLtest123", ["vid1", "vid2", "vid3"]);

      expect(mockInnertubeInstance.playlist.addVideos).toHaveBeenCalledWith(
        "PLtest123",
        ["vid1", "vid2", "vid3"],
      );
    });

    it("should handle add videos error", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.playlist.addVideos.mockRejectedValueOnce(
        new Error("API Error"),
      );

      await expect(
        searcher.addToPlaylist("PLtest", ["vid1"]),
      ).rejects.toThrow();
    });
  });

  describe("getPlaylists", () => {
    it("should throw error when not initialized", async () => {
      const searcher2 = new Searcher();
      await expect(searcher2.getPlaylists()).rejects.toThrow(
        "Innertube没有初始化",
      );
    });

    it("should return empty array when no playlists", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylists.mockResolvedValueOnce(null);

      const playlists = await searcher.getPlaylists();
      expect(playlists).toEqual([]);
    });

    it("should return playlists", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylists.mockResolvedValueOnce({
        playlists: [
          { id: "PL1", title: { text: "Playlist 1" }, total_items: 10 },
          { id: "PL2", title: { text: "Playlist 2" }, total_items: 5 },
        ],
      });

      const playlists = await searcher.getPlaylists();

      expect(playlists).toHaveLength(2);
      expect(playlists[0]?.name).toBe("Playlist 1");
      expect(playlists[0]?.trackCount).toBe(10);
    });

    it("should handle LockupView playlist type", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylists.mockResolvedValueOnce({
        playlists: [
          {
            type: "LockupView",
            content_id: "lockup1",
            metadata: { title: { toString: () => "Lockup Playlist" } },
            content_image: {
              primary_thumbnail: {
                overlays: [{ badges: [{ text: "20 songs" }] }],
              },
            },
          },
        ],
      });

      const playlists = await searcher.getPlaylists();

      expect(playlists).toHaveLength(1);
      expect(playlists[0]?.name).toBe("Lockup Playlist");
      expect(playlists[0]?.trackCount).toBe(20);
    });

    it("should handle getPlaylists error", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylists.mockRejectedValueOnce(
        new Error("API Error"),
      );

      const playlists = await searcher.getPlaylists();
      expect(playlists).toEqual([]);
    });
  });

  describe("getPlaylistTracks", () => {
    it("should throw error when not initialized", async () => {
      const searcher2 = new Searcher();
      await expect(searcher2.getPlaylistTracks("PL123")).rejects.toThrow(
        "Innertube没有初始化",
      );
    });

    it("should return empty array when no items", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylist.mockResolvedValueOnce({ items: [] });

      const tracks = await searcher.getPlaylistTracks("PL123");
      expect(tracks).toEqual([]);
    });

    it("should return playlist tracks", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylist.mockResolvedValueOnce({
        items: [
          {
            id: "vid1",
            title: { toString: () => "Song 1" },
            artists: [{ name: "Artist 1" }],
          },
          {
            id: "vid2",
            title: { toString: () => "Song 2" },
            artists: [{ name: "Artist 2" }],
          },
        ],
      });

      const tracks = await searcher.getPlaylistTracks("PL123");

      expect(tracks).toHaveLength(2);
      expect(tracks[0]?.videoId).toBe("vid1");
      expect(tracks[0]?.name).toBe("Song 1");
      expect(tracks[0]?.artist).toBe("Artist 1");
    });

    it("should skip invalid items", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylist.mockResolvedValueOnce({
        items: [
          null,
          {
            id: "vid1",
            title: { toString: () => "Valid Song" },
            artists: [{ name: "Artist" }],
          },
          "invalid",
          {},
        ],
      });

      const tracks = await searcher.getPlaylistTracks("PL123");
      expect(tracks).toHaveLength(1);
    });

    it("should handle getPlaylist error", async () => {
      await searcher.init({ lang: "en" }, "");

      mockInnertubeInstance.getPlaylist.mockRejectedValueOnce(
        new Error("API Error"),
      );

      const tracks = await searcher.getPlaylistTracks("PL123");
      expect(tracks).toEqual([]);
    });
  });
});
