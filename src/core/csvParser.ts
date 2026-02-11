import { readFile } from "fs";
import { parse } from "csv-parse/sync";
import type { SpotifyTrack } from "../types";

/**
 * CSV文件中的一行数据，表示为一个键值对对象，键是列名，值是对应的单元格内容
 */
export type CsvRow = Record<string, string>;

/**
 * 读取CSV文件并返回其内容作为字符串，使用Node.js的fs模块中的readFile函数来读取指定路径的CSV文件，并将读取到的内容以UTF-8编码的字符串形式返回。如果在读取过程中发生错误，会抛出相应的错误信息。
 * @param {string} filePath 需要读取的CSV文件的路径
 * @returns {Promise<string>} 读取到的CSV文件内容，作为一个字符串返回
 * @throws {Error} 如果在读取过程中发生错误，会抛出相应的错误信息
 */
const readCsvFile = async (filePath: string): Promise<string> => {
  return new Promise((res, rej) => {
    readFile(filePath, "utf-8", (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });
};

/**
 * 解析CSV字符串，使用csv-parse库将CSV文本转换成对象数组，每个对象的键是CSV文件的列名，值是对应的单元格内容。解析过程中会跳过空行，如果没有解析到任何数据，会抛出错误提示用户检查CSV文件格式是否正确。
 * @param {string} text 读取CSV文件获得的字符串
 * @returns {Promise<CsvRow[]>} 解析后的CSV对象数组，每个对象的键是CSV文件的列名，值是对应的单元格内容
 * @throws {Error} 如果没有解析到任何数据，抛出错误提示用户检查CSV文件格式是否正确
 */
const parseCsv = (text: string): Promise<CsvRow[]> => {
  const record = parse(text, {
    columns: true,
    skip_empty_lines: true,
  });

  if (!record || record.length === 0) {
    return Promise.reject(
      new Error("没有解析到任何数据，请检查CSV文件格式是否正确"),
    );
  }

  return Promise.resolve(record as CsvRow[]);
};

/**
 * 将初步处理过后的csv对象数组转换成SpotifyTrack数组，并且在转换过程中验证每个对象是否包含必要的字段，如果缺少字段则跳过该行数据，并在控制台输出警告信息
 * @param {CsvRow[]} rows 初步处理过后的csv对象数组
 * @returns {SpotifyTrack[]} 转换后的SpotifyTrack数组
 */
const mapToTracks = (rows: CsvRow[]): SpotifyTrack[] => {
  const tracks: SpotifyTrack[] = [];
  for (const row of rows) {
    const uri = row["Track URI"]?.trim();
    const name = row["Track Name"]?.trim();
    const album = row["Album Name"]?.trim();
    const artists = row["Artist Name(s)"]?.trim(); //暂时不拆分artists，直接当成一个字符串处理
    const duration = row["Duration (ms)"]?.trim();

    if (!uri || !name || !album || !artists || !duration) {
      console.warn(`跳过缺少字段的行: ${JSON.stringify(row)}`);
      continue;
    }
    tracks.push({
      uri,
      name,
      album,
      artist: artists,
      duration: Number(duration),
    });
  }

  return tracks;
};

export { readCsvFile, parseCsv, mapToTracks };
