import type { IllustrationId } from "./config";
import curtain from "./assets/illustrated/curtain.jpg";
import stone from "./assets/illustrated/stone.jpg";
import wood from "./assets/illustrated/wood.jpg";
import modern from "./assets/illustrated/modern.jpg";

/** The pictures of the illustrated layout (their frames are in illustrated.ts). */
export const ILLUSTRATION_PICTURES: Record<IllustrationId, string> = { curtain, stone, wood, modern };
