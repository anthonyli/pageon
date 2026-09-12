import { OPEN_SOURCE_TRANSFORM_URL } from "@pageon/protocol/public";
import { createTransformClient } from "./client.js";
export { PageOnApiError, readTransformResponse } from "./client.js";
export function createOpenSourceClient(options = {}) {
  return createTransformClient({ endpoint: OPEN_SOURCE_TRANSFORM_URL, ...options });
}
