// "Build the spec, then run X with the result." We can't await SPEC_READY from
// the main runtime, so we stash the next action here and the SPEC_READY
// handler in dispatcher.ts picks it up.

export type ExportAction = "send" | "download" | "download-json" | null;

export const exportActionState: { value: ExportAction } = { value: null };

export const pendingState = { openReview: false };
