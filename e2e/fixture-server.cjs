// Serves a page whose content changes when /flip is requested.
const http = require("http");
let v = 0;
const body = () => `<html><body><header>Site header</header><main><h1>Test program page</h1>
<p>This is a test page for the PRPath Canada source monitor. It describes a program with several requirements in enough words to pass the minimum length check that filters out bot challenge pages and empty error pages.</p>
<p>Applicants need at least one year of skilled work experience and language results at CLB 7.</p>
<p>${v === 0 ? "Intake is currently paused until further notice." : "Intake reopened on November 18, 2026 for all applicants."}</p>
<dl><dt>Date modified:</dt><dd>2026-11-${10 + v}</dd></dl></main><footer>Footer</footer></body></html>`;
http.createServer((req, res) => {
  if (req.url === "/flip") { v = 1 - v; res.end("ok"); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(body());
}).listen(4555, () => console.log("fixture on 4555"));
