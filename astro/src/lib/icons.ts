// The site's one icon set, inlined at build time so only the icons used here ship.
// Interface icons are Material Symbols (Rounded, weight 400); technology and social
// logos are Simple Icons. Both are filled with currentColor.
import arrowUpward from "@material-symbols/svg-400/rounded/arrow_upward.svg?raw";
import article from "@material-symbols/svg-400/rounded/article.svg?raw";
import barChart from "@material-symbols/svg-400/rounded/bar_chart.svg?raw";
import darkMode from "@material-symbols/svg-400/rounded/dark_mode.svg?raw";
import edit from "@material-symbols/svg-400/rounded/edit.svg?raw";
import folder from "@material-symbols/svg-400/rounded/folder.svg?raw";
import home from "@material-symbols/svg-400/rounded/home.svg?raw";
import language from "@material-symbols/svg-400/rounded/language.svg?raw";
import lightMode from "@material-symbols/svg-400/rounded/light_mode.svg?raw";
import mail from "@material-symbols/svg-400/rounded/mail.svg?raw";
import menuBook from "@material-symbols/svg-400/rounded/menu_book.svg?raw";
import work from "@material-symbols/svg-400/rounded/work.svg?raw";
import android from "simple-icons/icons/android.svg?raw";
import apple from "simple-icons/icons/apple.svg?raw";
import claude from "simple-icons/icons/claude.svg?raw";
import dart from "simple-icons/icons/dart.svg?raw";
import firebase from "simple-icons/icons/firebase.svg?raw";
import flutter from "simple-icons/icons/flutter.svg?raw";
import git from "simple-icons/icons/git.svg?raw";
import github from "simple-icons/icons/github.svg?raw";
import go from "simple-icons/icons/go.svg?raw";
import googlegemini from "simple-icons/icons/googlegemini.svg?raw";
import jetpackcompose from "simple-icons/icons/jetpackcompose.svg?raw";
import kotlin from "simple-icons/icons/kotlin.svg?raw";
import ktor from "simple-icons/icons/ktor.svg?raw";
import laravel from "simple-icons/icons/laravel.svg?raw";
import leetcode from "simple-icons/icons/leetcode.svg?raw";
import linux from "simple-icons/icons/linux.svg?raw";
import opencode from "simple-icons/icons/opencode.svg?raw";
import php from "simple-icons/icons/php.svg?raw";
import python from "simple-icons/icons/python.svg?raw";
import swift from "simple-icons/icons/swift.svg?raw";
import tensorflow from "simple-icons/icons/tensorflow.svg?raw";
import typescript from "simple-icons/icons/typescript.svg?raw";
import wordpress from "simple-icons/icons/wordpress.svg?raw";
import type { IconName } from "./icon-names";

// Medium's dots mark, kept by hand: the current Simple Icons one is a square with cropped
// lettering that looks cut off at icon size.
const medium =
  '<svg><path d="M13 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0M23 12c0 2.761-.448 5-1 5s-1-2.239-1-5 .448-5 1-5 1 2.239 1 5M17 18c1.657 0 3-2.686 3-6s-1.343-6-3-6-3 2.686-3 6 1.343 6 3 6"/></svg>';

const MATERIAL_VIEW_BOX = "0 -960 960 960";
// Simple Icons fill their 24px box edge to edge; this margin matches the optical size of a
// Material Symbol, so both sit on the same size scale.
const BRAND_VIEW_BOX = "-2 -2 28 28";

export interface IconShape {
  readonly viewBox: string;
  /** Inner SVG markup: paths only. */
  readonly body: string;
}

function shape(source: string, viewBox: string): IconShape {
  const body = source
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "");
  return { viewBox, body };
}

const symbol = (source: string): IconShape => shape(source, MATERIAL_VIEW_BOX);
const brand = (source: string): IconShape => shape(source, BRAND_VIEW_BOX);

export const ICONS = {
  arrow_upward: symbol(arrowUpward),
  article: symbol(article),
  bar_chart: symbol(barChart),
  dark_mode: symbol(darkMode),
  edit: symbol(edit),
  folder: symbol(folder),
  home: symbol(home),
  language: symbol(language),
  light_mode: symbol(lightMode),
  mail: symbol(mail),
  menu_book: symbol(menuBook),
  work: symbol(work),
  android: brand(android),
  apple: brand(apple),
  claude: brand(claude),
  dart: brand(dart),
  firebase: brand(firebase),
  flutter: brand(flutter),
  git: brand(git),
  github: brand(github),
  go: brand(go),
  googlegemini: brand(googlegemini),
  jetpackcompose: brand(jetpackcompose),
  kotlin: brand(kotlin),
  ktor: brand(ktor),
  laravel: brand(laravel),
  leetcode: brand(leetcode),
  linux: brand(linux),
  medium: brand(medium),
  opencode: brand(opencode),
  php: brand(php),
  python: brand(python),
  swift: brand(swift),
  tensorflow: brand(tensorflow),
  typescript: brand(typescript),
  wordpress: brand(wordpress),
} as const satisfies Readonly<Record<IconName, IconShape>>;

export type { IconName } from "./icon-names";

function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICONS, value);
}

/** Reads an icon name from content data, failing the build on one the site does not ship. */
export function toIconName(value: string, path: string): IconName {
  if (!isIconName(value)) {
    throw new Error(`Unknown icon "${value}" at ${path}`);
  }
  return value;
}
