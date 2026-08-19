import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");
const includes = (source, text, label) => assert.ok(source.includes(text), `${label} should include ${JSON.stringify(text)}`);

test("the shared visual reference picker connects Shot List and Boards to upload, Imagine, and Vault", async () => {
  const [editor, workspace, client, server] = await Promise.all([
    read("Editor v5.dc.html"),
    read("canvas-workspace.js"),
    read("preproduction-client.js"),
    read("server.js"),
  ]);

  // Shot List owns a target (scene or shot), while the picker stays a single
  // reusable surface instead of three unrelated upload paths.
  includes(editor, "visualReferencePicker", "Shot List");
  includes(editor, "visual-reference-picker", "Shot List");
  includes(editor, 'data-action="reference-upload"', "Shot List");
  includes(editor, 'data-action="recent-imagine"', "Shot List");
  includes(editor, 'data-action="open-imagine"', "Shot List");
  includes(editor, "useCanvasShotReference", "Shot List");
  includes(editor, "referenceAssetIds", "Shot List");

  // Boards surface the same visual picker before generating or adding an
  // image, and pass any selected visuals through to storyboard generation.
  includes(workspace, "visualReferencePicker", "Board");
  includes(workspace, "visual-reference-picker", "Board");
  includes(workspace, 'data-action="reference-upload"', "Board");
  includes(workspace, 'data-action="recent-imagine"', "Board");
  includes(workspace, 'data-action="open-imagine"', "Board");
  includes(workspace, "storyboardReferenceIds", "Board");
  includes(workspace, "referenceAssetIds", "Board");
  assert.ok(/action === 'board-generate-image'[\s\S]{0,360}visualReferencePicker/.test(workspace), "Board Generate should open the shared visual reference picker");
  assert.ok(/action === 'board-add-image'[\s\S]{0,360}visualReferencePicker/.test(workspace), "Board Add Image should open the shared visual reference picker");

  // A picked Canvas image is persisted through the existing trusted API,
  // rather than exposing storage URLs in the UI. Vault images are Canvas
  // assets too, so the endpoint must not accept Imagine-only sources.
  includes(client, "useCanvasShotReference", "Preproduction client");
  includes(server, "handleShotReferenceFromCanvas", "Server");
  assert.ok(!server.includes("asset.id === assetId && asset.source === 'imagine'"), "Canvas references must accept Vault assets as well as Imagine assets");

  // Generating a shot reference creates one shared visual, not an isolated
  // Shot List file. Imagine must receive the same generated frame.
  includes(server, "origin: 'shotlist'", "Shot List generation");
  includes(server, "source: 'imagine'", "Shot List generation");
  includes(server, "removeUncommittedGeneratedCanvasAsset", "Shot List generation");
});
