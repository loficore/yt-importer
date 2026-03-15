import { existsSync } from "fs";
import { stat } from "fs/promises";
import { parse } from "csv-parse/sync";
import { logger } from "@utils/logger.js";

/**
 * CSV 验证结果
 */
export interface ValidationResult {
  /** 验证是否通过 */
  isValid: boolean;
  /** 总行数 */
  totalRows: number;
  /** 有效曲目数 */
  validTracks: number;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationWarning[];
}

/**
 * CSV 验证错误
 */
export interface ValidationError {
  /** 行号 */
  row: number;
  /** 列名 */
  column: string;
  /** 错误信息 */
  message: string;
  /** 错误值 */
  value?: string;
}

/**
 * CSV 验证警告
 */
export interface ValidationWarning {
  /** 行号（可选） */
  row?: number;
  /** 警告信息 */
  message: string;
  /** 数量（可选） */
  count?: number;
}

/** 必需的 CSV 列 */
const REQUIRED_COLUMNS = [
  "Track URI",
  "Track Name",
  "Album Name",
  "Artist Name(s)",
  "Duration (ms)",
];

/**
 * 验证 CSV 文件
 * @param {string} filePath CSV 文件路径
 * @returns {Promise<ValidationResult>} 验证结果
 */
export async function validateCsv(filePath: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let totalRows = 0;
  let validTracks = 0;

  if (!existsSync(filePath)) {
    errors.push({
      row: 0,
      column: "",
      message: "文件不存在",
      value: filePath,
    });
    return { isValid: false, totalRows: 0, validTracks: 0, errors, warnings };
  }

  const fileStats = await stat(filePath);
  if (fileStats.size === 0) {
    errors.push({
      row: 0,
      column: "",
      message: "文件为空",
    });
    return { isValid: false, totalRows: 0, validTracks: 0, errors, warnings };
  }

  let content: string;
  try {
    const { readFile } = await import("fs/promises");
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    errors.push({
      row: 0,
      column: "",
      message: "无法读取文件",
      value: String(err),
    });
    return { isValid: false, totalRows: 0, validTracks: 0, errors, warnings };
  }

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    errors.push({
      row: 0,
      column: "",
      message: "CSV 解析失败",
      value: String(err),
    });
    return { isValid: false, totalRows: 0, validTracks: 0, errors, warnings };
  }

  if (records.length === 0) {
    errors.push({
      row: 0,
      column: "",
      message: "文件中没有数据",
    });
    return { isValid: false, totalRows: 0, validTracks: 0, errors, warnings };
  }

  const columns = Object.keys(records[0] || {});
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !columns.includes(col),
  );
  if (missingColumns.length > 0) {
    errors.push({
      row: 0,
      column: "",
      message: `缺少必需列: ${missingColumns.join(", ")}`,
    });
    return {
      isValid: false,
      totalRows: records.length,
      validTracks: 0,
      errors,
      warnings,
    };
  }

  const uriSet = new Set<string>();
  const duplicateUris: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i] || {};
    const rowNum = i + 2;
    totalRows++;

    const uri = String(row["Track URI"] || "").trim();
    const name = String(row["Track Name"] || "").trim();
    const album = String(row["Album Name"] || "").trim();
    const artists = String(row["Artist Name(s)"] || "").trim();
    const durationStr = String(row["Duration (ms)"] || "").trim();

    let hasError = false;

    if (!uri) {
      errors.push({ row: rowNum, column: "Track URI", message: "缺少值" });
      hasError = true;
    } else {
      if (uriSet.has(uri)) {
        duplicateUris.push(uri);
      } else {
        uriSet.add(uri);
      }
    }

    if (!name) {
      errors.push({ row: rowNum, column: "Track Name", message: "缺少值" });
      hasError = true;
    }

    if (!album) {
      errors.push({ row: rowNum, column: "Album Name", message: "缺少值" });
      hasError = true;
    }

    if (!artists) {
      errors.push({ row: rowNum, column: "Artist Name(s)", message: "缺少值" });
      hasError = true;
    }

    if (!durationStr) {
      errors.push({ row: rowNum, column: "Duration (ms)", message: "缺少值" });
      hasError = true;
    } else {
      const duration = Number(durationStr);
      if (isNaN(duration) || duration <= 0) {
        errors.push({
          row: rowNum,
          column: "Duration (ms)",
          message: "无效的时长值",
          value: durationStr,
        });
        hasError = true;
      }
    }

    if (!hasError) {
      validTracks++;
    }
  }

  if (duplicateUris.length > 0) {
    warnings.push({
      message: `发现 ${duplicateUris.length} 个重复的 Track URI`,
      count: duplicateUris.length,
    });
  }

  const isValid = errors.length === 0;

  logger.info("CSV 验证完成", {
    filePath,
    isValid,
    totalRows,
    validTracks,
    errorCount: errors.length,
    warningCount: warnings.length,
  });

  return { isValid, totalRows, validTracks, errors, warnings };
}
