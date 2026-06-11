# Ideogram JSON Studio

A static browser app for building Ideogram 4 JSON captions for ComfyUI workflows, matching the JSON shape used by Kijai's `Ideogram4PromptBuilderKJ` node.

Open `index.html` in a browser. The app does not need a build step.

## Features

- Draw, move, resize, duplicate, and delete object/text bounding boxes.
- Edit normalized Ideogram boxes visually while exporting `[ymin, xmin, ymax, xmax]` on the 0-1000 grid.
- Add optional per-box and style color palettes with uppercase `#RRGGBB` output.
- Drag images onto the canvas to create image-backed boxes.
- Split a selected image-backed box into separate detected object boxes with the configured vision model.
- Load a background reference image and crop selected boxes for vision description.
- Generate, import, copy, and download the full ComfyUI-ready JSON.
- Enhance prompts through local Ollama or Hugging Face's OpenAI-compatible Inference Providers endpoint.

## LLM setup

For Ollama, set the provider to `Local Ollama` in the Prompt Assistant panel. The default local setup is:

```text
Ollama URL: http://127.0.0.1:11434
Text model: qwen3-vl:8b
Vision model: qwen3-vl:8b
```

Click `Test Ollama` to run a small local `/api/generate` health check. Use `127.0.0.1` rather than `localhost` if Windows resolves those to different Ollama instances.

Browser requests to Ollama may require `OLLAMA_ORIGINS` to allow the app origin. For this app's launcher, allow both common local origins and restart Ollama:

```powershell
setx OLLAMA_ORIGINS "http://127.0.0.1:4173,http://localhost:4173"
```

For Hugging Face, enter an API token and a chat or vision model available through Inference Providers. The default endpoint is:

```text
https://router.huggingface.co/v1/chat/completions
```

Click `Test HF` in the Prompt Assistant panel to run a small chat completion health check. It reports the normalized endpoint, model, HTTP status, parsed error body, elapsed time, and likely cause.

If the app reports a browser/network/CORS failure, test the same token and model outside the browser:

```powershell
$env:HF_TOKEN="hf_..."
curl https://router.huggingface.co/v1/chat/completions `
  -H "Authorization: Bearer $env:HF_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"Qwen/Qwen3-VL-8B-Instruct\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly OK.\"}],\"stream\":false,\"max_tokens\":8}"
```

The token is kept in browser local storage for this local app. Do not use the Hugging Face option from an untrusted hosted copy.

## Agent control

The app exposes a browser API for automation:

```js
window.IdeogramStudioAgent.designLayout("poster for a midnight synthwave show");
window.IdeogramStudioAgent.applyCommand({
  action: "add_element",
  element: {
    type: "text",
    bbox: [740, 120, 860, 880],
    text: "SATURDAY",
    desc: "bold condensed footer text",
    color_palette: ["#E35C3F"]
  }
});
window.IdeogramStudioAgent.getCaption();
```

It also accepts `postMessage` commands with `source: "ideogram-agent"` and emits an `ideogram-studio:changed` event after layout changes.

Agent links can open the app with a layout already applied:

```text
http://127.0.0.1:4173/?agent=<base64url-command>
```

Use the Agent Control panel to design a heuristic layout from a brief, paste command JSON, or copy a control link for the current layout.

## MCP server

The repo includes a dependency-free stdio MCP server:

```text
P:\_code\IdeogramApp\mcp\ideogram-layout-mcp.js
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "ideogram-json-studio": {
      "command": "node",
      "args": ["P:\\_code\\IdeogramApp\\mcp\\ideogram-layout-mcp.js"]
    }
  }
}
```

Tools exposed:

- `ideogram_design_layout`: creates a layout from a natural-language brief and returns ComfyUI JSON plus an app control link.
- `ideogram_make_control_link`: encodes an existing caption/layout as an app link.
- `ideogram_validate_layout`: normalizes and checks a layout/caption.
- `ideogram_agent_schema`: returns the supported command schema.
