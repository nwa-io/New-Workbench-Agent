import type {
  CompressedSpec,
  LeanSpec,
  VsCodeDesignSpecPayload,
} from "../../../shared/types";
import { state } from "../../state";
import { getActiveMappings } from "../mappings/active";

export function getLastVsCodePayload(): VsCodeDesignSpecPayload | null {
  if (!state.lastNwa || !state.lastSpec || !state.lastLean) {
    return null;
  }
  return {
    ...state.lastSpec,
    nwa: state.lastNwa,
    lean: state.lastLean,
    componentMappings: getActiveMappings(),
  };
}

export function calcShrink(raw: CompressedSpec, lean: LeanSpec): number {
  try {
    const rawSize = JSON.stringify(raw).length;
    const leanSize = JSON.stringify(lean).length;
    if (rawSize <= 0) return 0;
    return Math.max(0, Math.round((1 - leanSize / rawSize) * 100));
  } catch {
    return 0;
  }
}
