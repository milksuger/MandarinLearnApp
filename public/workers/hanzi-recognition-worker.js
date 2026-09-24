let ready = false;

self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message?.type === "initialize") {
      importScripts("/vendor/hanzi-lookup/hanzi_lookup.js");
      await self.wasm_bindgen("/vendor/hanzi-lookup/hanzi_lookup_bg.wasm");
      ready = true;
      self.postMessage({ type: "ready" });
      return;
    }
    if (message?.type === "recognize") {
      if (!ready) throw new Error("recognizer_not_ready");
      const matches = JSON.parse(self.wasm_bindgen.lookup(message.strokes, 8));
      self.postMessage({ type: "matches", requestId: message.requestId, matches });
    }
  } catch (error) {
    self.postMessage({ type: "error", requestId: message?.requestId, message: error instanceof Error ? error.message : "recognition_failed" });
  }
};
