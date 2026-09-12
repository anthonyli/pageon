export const OPEN_SOURCE_TRANSFORM_URL = "https://pageon.cc/api/open-source/transform";
export const OPEN_SOURCE_HTML_LIMIT = 1024 * 1024;
export const OPEN_SOURCE_BODY_LIMIT = OPEN_SOURCE_HTML_LIMIT + 64 * 1024;

export function isTransformResult(value) {
  return Boolean(
    value &&
    typeof value.previewHtml === "string" &&
    typeof value.exportTemplate === "string" &&
    Number.isInteger(value.transformVersion) && value.transformVersion > 0 &&
    value.stats && Number.isInteger(value.stats.editableCount) && value.stats.editableCount >= 0
  );
}
