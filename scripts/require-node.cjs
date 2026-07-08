// require-node.cjs — friendly Node-version gate.
//
// This runs BEFORE anything else (on `npm install` via "preinstall", and before
// every `npm run` script). It must therefore run on ancient Node too, so it uses
// only the oldest, plainest JavaScript — no imports, no modern syntax.
//
// Why it exists: the app uses features (e.g. node:readline/promises) that only
// exist in Node 20+. Without this gate, an old-Node user just sees a cryptic
// "ERR_UNKNOWN_BUILTIN_MODULE" and has no idea the real problem is their Node.

var MIN_MAJOR = 20;
var major = parseInt(process.versions.node.split(".")[0], 10);

if (major < MIN_MAJOR) {
  var red = "\x1b[31m";
  var bold = "\x1b[1m";
  var reset = "\x1b[0m";

  console.error("");
  console.error(red + bold + "  ✖  This app needs Node " + MIN_MAJOR + " or newer." + reset);
  console.error("     You're on " + process.version + " — that's too old.");
  console.error("");
  console.error("  Upgrade Node, then run the same command again. Pick one:");
  console.error("");
  console.error("    • Download the LTS installer (easiest):  https://nodejs.org");
  console.error("    • Homebrew:  brew install node@22 && brew link --overwrite --force node@22");
  console.error("    • nvm:       nvm install 22 && nvm use 22");
  console.error("");
  console.error("  Then check it worked:  node -v   (should say v20 or higher)");
  console.error("");
  process.exit(1);
}
