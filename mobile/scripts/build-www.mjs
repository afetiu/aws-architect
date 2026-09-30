// Assemble the AWS course into ./www for the Android app.
// Same files as the website, minus Firebase (progress lives in on-device SQLite)
// plus the Capacitor runtime so app.js can reach the native ProgressStore plugin.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const www = path.resolve(here, "..", "www");

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "aws"), { recursive: true });

for (const f of ["app.js", "styles.css"]) fs.copyFileSync(path.join(repo, f), path.join(www, f));
fs.cpSync(path.join(repo, "content"), path.join(www, "content"), {
  recursive: true,
  filter: (src) => !/\.md$/.test(src) && !/[\/]_example\.js$/.test(src),
});
fs.copyFileSync(
  path.join(here, "..", "node_modules", "@capacitor", "core", "dist", "capacitor.js"),
  path.join(www, "capacitor.js")
);

let html = fs.readFileSync(path.join(repo, "aws", "index.html"), "utf8");
html = html.replace(/<script src="\.\.\/firebase-config\.js"><\/script>\s*/, "");
html = html.replace('<script src="../app.js"></script>', '<script src="../capacitor.js"></script>\n<script src="../app.js"></script>');
if (!html.includes("../capacitor.js")) throw new Error("could not inject capacitor.js");
fs.writeFileSync(path.join(www, "aws", "index.html"), html);
fs.writeFileSync(
  path.join(www, "index.html"),
  '<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=aws/index.html"><script>location.replace("aws/index.html")</script>'
);
console.log("www ready:", www);
