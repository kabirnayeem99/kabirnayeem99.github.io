// Messages from the page to the paper-flutter worker. The worker replies with a
// Float32Array of [sway, lift, curl] per paper.

export type FlutterCommand =
  | { readonly type: "init"; readonly count: number }
  | { readonly type: "visibility"; readonly visible: readonly boolean[] }
  | { readonly type: "run"; readonly running: boolean };
