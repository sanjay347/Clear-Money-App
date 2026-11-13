/**
 * HiddenPdfExtractor — pdf.js text extraction inside a hidden WebView.
 *
 * Everything is loaded from files in one cache directory, by relative path:
 *
 *   pdf_runner.html       the page below
 *   pdf.min.js            pdf.js
 *   pdf.worker.min.js     pdf.js's worker, loaded on the MAIN thread
 *   pdf_input.js          the statement, as `window.__PDF_BASE64__ = "…"`
 *
 * Two things this avoids, both of which fail on current iOS with the unhelpful
 * message "Load failed":
 *
 *  1. Passing the page as one big `source={{ html }}` string. pdf.js, its worker
 *     and a base64 statement together are several megabytes, past what the
 *     WKWebView bridge accepts.
 *  2. Spawning a Web Worker from a blob URL. A page loaded from a string has no
 *     origin, and WebKit refuses to start workers from it. Loading the worker
 *     script with a normal <script> tag defines `globalThis.pdfjsWorker`, which
 *     pdf.js detects and runs in-page instead of starting a Worker.
 */
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Local pdf.js cache ────────────────────────────────────────────────────────
// On first PDF extraction the two scripts are downloaded from CDN and stored
// permanently in documentDirectory. Every subsequent extraction is fully offline.

const PDFJS_VERSION = '2.16.105';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const CACHE_DIR = `${FileSystem.documentDirectory}pdfjs_cache/`;
const MAIN_PATH = `${CACHE_DIR}pdf.min.js`;
const WORKER_PATH = `${CACHE_DIR}pdf.worker.min.js`;
const INPUT_PATH = `${CACHE_DIR}pdf_input.js`;
const RUNNER_PATH = `${CACHE_DIR}pdf_runner.html`;

let pdfJsReady = false;

export const ensurePdfJsReady = async (): Promise<void> => {
  if (pdfJsReady) return;

  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});

  const [mainInfo, workerInfo] = await Promise.all([
    FileSystem.getInfoAsync(MAIN_PATH),
    FileSystem.getInfoAsync(WORKER_PATH),
  ]);

  // Download if missing or suspiciously small (failed partial download)
  const MIN_SIZE = 250_000;
  const size = (info: FileSystem.FileInfo) => (info.exists ? info.size ?? 0 : 0);
  if (size(mainInfo) < MIN_SIZE) {
    await FileSystem.downloadAsync(`${PDFJS_CDN}/pdf.min.js`, MAIN_PATH);
  }
  if (size(workerInfo) < MIN_SIZE) {
    await FileSystem.downloadAsync(`${PDFJS_CDN}/pdf.worker.min.js`, WORKER_PATH);
  }

  pdfJsReady = true;
};

// The page is static: the statement arrives through pdf_input.js, so nothing
// user-controlled is ever interpolated into this HTML.
const RUNNER_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script src="./pdf.min.js"></script>
<script src="./pdf.worker.min.js"></script>
<script src="./pdf_input.js"></script>
<script>
(async function extractText() {
  var post = function (msg) { window.ReactNativeWebView.postMessage(msg); };
  try {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF engine did not load');
    if (!window.__PDF_BASE64__) throw new Error('Statement file did not load');

    // Only used if pdf.js decides it must start a real worker; with the worker
    // script already on the page it runs in-page instead.
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

    var raw = atob(window.__PDF_BASE64__);
    var data = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);

    var pdf = await pdfjsLib.getDocument({ data: data }).promise;

    var pages = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();

      // Rebuild lines by grouping items that share a Y coordinate. PDF Y runs
      // bottom to top, so sort descending.
      var byY = {};
      for (var k = 0; k < content.items.length; k++) {
        var item = content.items[k];
        if (!item.str || !item.transform) continue;
        var y = Math.round(item.transform[5]);
        (byY[y] = byY[y] || []).push({ x: item.transform[4], w: item.width || 0, em: item.height || 10, str: item.str });
      }
      var ys = Object.keys(byY).map(Number).sort(function (a, b) { return b - a; });
      pages.push(ys.map(function (y) {
        // Join by the real gap between items: words in one description get a
        // single space, separate columns get two. (Joining everything with two
        // spaces made every word look like its own column.)
        var items = byY[y].sort(function (a, b) { return a.x - b.x; });
        var line = '';
        for (var n = 0; n < items.length; n++) {
          if (n > 0) {
            var prev = items[n - 1];
            var gap = items[n].x - (prev.x + prev.w);
            line += gap > prev.em * 1.0 ? '  ' : gap > prev.em * 0.08 ? ' ' : '';
          }
          line += items[n].str;
        }
        return line;
      }).join('\\n'));
    }

    post(JSON.stringify({ type: 'result', text: pages.join('\\n\\n') }));
  } catch (e) {
    post(JSON.stringify({ type: 'error', message: (e && e.message) || String(e) }));
  }
})();
</script>
</body>
</html>`;

// ─── Component ────────────────────────────────────────────────────────────────

interface PdfExtractorProps {
  uri: string;
  onExtracted: (text: string) => void;
  onError: (error: string) => void;
}

export const HiddenPdfExtractor: React.FC<PdfExtractorProps> = ({ uri, onExtracted, onError }) => {
  const [runnerUri, setRunnerUri] = useState<string | null>(null);
  const done = useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    done.current = false;
    setRunnerUri(null);

    const prepare = async () => {
      try {
        const [base64Pdf] = await Promise.all([
          FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
          ensurePdfJsReady(), // no-op after first call
        ]);
        if (cancelled) return;

        // Base64 contains only [A-Za-z0-9+/=], so it is safe inside a JS string literal.
        await Promise.all([
          FileSystem.writeAsStringAsync(INPUT_PATH, `window.__PDF_BASE64__ = "${base64Pdf}";`),
          FileSystem.writeAsStringAsync(RUNNER_PATH, RUNNER_HTML),
        ]);
        if (cancelled) return;

        // The query string makes each extraction a fresh page load.
        setRunnerUri(`${RUNNER_PATH}?t=${Date.now()}`);
      } catch (e: any) {
        onError(e?.message ?? 'Failed to prepare PDF extractor');
      }
    };

    prepare();
    return () => { cancelled = true; };
    // onError is intentionally not a dependency: callers pass a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const finish = (fn: () => void) => {
    if (done.current) return;
    done.current = true;
    // The statement should not sit on disk longer than the extraction takes.
    FileSystem.deleteAsync(INPUT_PATH, { idempotent: true }).catch(() => {});
    fn();
  };

  if (!runnerUri) return null;

  return (
    <View style={{ width: 0, height: 0, opacity: 0 }}>
      <WebView
        style={{ width: 1, height: 1 }}
        originWhitelist={['*']}
        source={{ uri: runnerUri }}
        allowingReadAccessToURL={CACHE_DIR}
        allowFileAccess
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'result') finish(() => onExtracted(msg.text ?? ''));
            else finish(() => onError(msg.message ?? 'PDF extraction failed'));
          } catch {
            finish(() => onError('Invalid response from the PDF engine'));
          }
        }}
        onError={e => finish(() => onError(e.nativeEvent.description || 'The PDF engine failed to load'))}
      />
    </View>
  );
};
