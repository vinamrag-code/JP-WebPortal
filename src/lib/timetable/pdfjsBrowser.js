/**
 * Browser-configured pdf.js, kept separate from `pdfTimetableParser.js` so that file stays platform-agnostic
 * (Node tests import the pdf.js module directly and never touch this file).
 *
 * pdf.js runs its heavy work in a worker script; without pointing it at one it defaults to a relative
 * `./pdf.worker.mjs`, which 404s under Vite. The `?url` import gets Vite to emit the worker file and hand us
 * its built URL, which works both in `vite dev` and in the production build, and inside a Capacitor WebView.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default pdfjs;
