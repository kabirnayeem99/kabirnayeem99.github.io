import { PAGE_IDS } from "./locale-config";

export type { Lang } from "./locale-config";
export type PageId = (typeof PAGE_IDS)[number];
export type Direction = "ltr" | "rtl";
