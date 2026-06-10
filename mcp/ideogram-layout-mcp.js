#!/usr/bin/env node
"use strict";

const readline = require("node:readline");
const core = require("../agent-layout-core.js");

const PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_APP_URL = "http://127.0.0.1:4173/";

const tools = [
  {
    name: "ideogram_design_layout",
    title: "Design Ideogram Layout",
    description: "Create an Ideogram 4 JSON layout from a natural-language brief and return a control link for the web app.",
    inputSchema: {
      type: "object",
      properties: {
        brief: {
          type: "string",
          description: "Natural-language description of the layout to design."
        },
        width: {
          type: "number",
          description: "Canvas width, preferably a multiple of 16."
        },
        height: {
          type: "number",
          description: "Canvas height, preferably a multiple of 16."
        },
        preset: {
          type: "string",
          enum: ["auto", "poster", "thumbnail", "logo", "product", "infographic", "scene"],
          description: "Layout preset. Use auto unless the user asks for a specific format."
        },
        styleMode: {
          type: "string",
          enum: ["none", "photo", "art_style"],
          description: "Ideogram style mode."
        },
        background: {
          type: "string",
          description: "Optional explicit background description."
        },
        headline: {
          type: "string",
          description: "Optional literal headline for text elements."
        },
        subhead: {
          type: "string",
          description: "Optional literal supporting copy for text elements."
        },
        palette: {
          type: "array",
          items: {
            type: "string",
            pattern: "^#[0-9A-Fa-f]{6}$"
          },
          description: "Optional color palette as #RRGGBB values."
        },
        appUrl: {
          type: "string",
          description: "Base app URL. Defaults to http://127.0.0.1:4173/."
        }
      },
      required: ["brief"]
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  {
    name: "ideogram_make_control_link",
    title: "Make Ideogram Control Link",
    description: "Encode an Ideogram caption or agent layout as a URL that opens the web app with that layout applied.",
    inputSchema: {
      type: "object",
      properties: {
        layout: {
          type: "object",
          description: "Agent layout object. May include width, height, style_description, and compositional_deconstruction."
        },
        caption: {
          type: "object",
          description: "ComfyUI-ready Ideogram 4 caption JSON."
        },
        command: {
          type: "object",
          description: "Full agent command object. If provided, it is encoded directly."
        },
        appUrl: {
          type: "string",
          description: "Base app URL. Defaults to http://127.0.0.1:4173/."
        }
      }
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  {
    name: "ideogram_validate_layout",
    title: "Validate Ideogram Layout",
    description: "Normalize an agent layout or caption into the Ideogram 4 JSON schema used by the app and report warnings.",
    inputSchema: {
      type: "object",
      properties: {
        layout: {
          type: "object"
        },
        caption: {
          type: "object"
        }
      }
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  {
    name: "ideogram_agent_schema",
    title: "Ideogram Agent Schema",
    description: "Return the supported agent command and layout schema for controlling Ideogram JSON Studio.",
    inputSchema: {
      type: "object",
      properties: {}
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  }
];

function handleRequest(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: message.params && message.params.protocolVersion || PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: {
        name: "ideogram-json-studio",
        version: "1.0.0"
      }
    };
  }

  if (message.method === "ping") {
    return {};
  }

  if (message.method === "tools/list") {
    return { tools };
  }

  if (message.method === "tools/call") {
    const params = message.params || {};
    return callTool(params.name, params.arguments || {});
  }

  throw jsonRpcError(-32601, `Unknown method: ${message.method}`);
}

function callTool(name, args) {
  if (name === "ideogram_design_layout") {
    if (!args.brief || typeof args.brief !== "string") {
      return toolError("brief is required.");
    }
    const layout = core.createHeuristicLayout(args.brief, args);
    return toolResult(resultForLayout(layout, args.appUrl));
  }

  if (name === "ideogram_make_control_link") {
    const command = args.command || core.commandFromLayout(args.layout || { caption: args.caption || {} });
    const normalizedCommand = command.action ? command : core.commandFromLayout(command);
    const appUrl = core.buildAgentUrl(args.appUrl || DEFAULT_APP_URL, normalizedCommand);
    return toolResult({
      appUrl,
      command: normalizedCommand,
      agentParam: core.encodeCommand(normalizedCommand)
    });
  }

  if (name === "ideogram_validate_layout") {
    const layout = core.normalizeLayout(args.layout || { caption: args.caption || {} });
    const caption = core.captionFromLayout(layout);
    return toolResult({
      valid: true,
      warnings: validateCaption(caption),
      layout,
      caption
    });
  }

  if (name === "ideogram_agent_schema") {
    return toolResult(agentSchema());
  }

  throw jsonRpcError(-32602, `Unknown tool: ${name}`);
}

function resultForLayout(layout, appUrl) {
  const command = core.commandFromLayout(layout);
  return {
    layout,
    caption: core.captionFromLayout(layout),
    command,
    appUrl: core.buildAgentUrl(appUrl || DEFAULT_APP_URL, command),
    agentParam: core.encodeCommand(command)
  };
}

function validateCaption(caption) {
  const warnings = [];
  const comp = caption.compositional_deconstruction || {};
  if (!String(comp.background || "").trim()) {
    warnings.push("background is empty");
  }
  if (!Array.isArray(comp.elements) || comp.elements.length === 0) {
    warnings.push("no elements are defined");
  }
  (comp.elements || []).forEach((element, index) => {
    if (!Array.isArray(element.bbox) || element.bbox.length !== 4) {
      warnings.push(`element ${index + 1} has no bbox`);
    }
    if (element.type === "text" && !String(element.text || "").trim()) {
      warnings.push(`text element ${index + 1} has empty text`);
    }
  });
  return warnings;
}

function agentSchema() {
  return {
    command: {
      version: 1,
      action: "apply_layout | design_layout | set_scene | add_element | replace_elements | clear",
      layout: "Agent layout object for apply_layout",
      caption: "ComfyUI Ideogram 4 caption JSON for import_caption/apply_layout"
    },
    layout: {
      version: 1,
      width: 1024,
      height: 1024,
      high_level_description: "optional overview",
      style_description: {
        aesthetics: "string",
        lighting: "string",
        medium: "string",
        art_style: "string",
        photo: "string, mutually exclusive with art_style",
        color_palette: ["#147D75"]
      },
      compositional_deconstruction: {
        background: "required background description",
        elements: [
          {
            type: "obj | text",
            bbox: [100, 100, 500, 500],
            text: "required only for text elements",
            desc: "visual description",
            color_palette: ["#RRGGBB"]
          }
        ]
      }
    },
    browserApi: {
      global: "window.IdeogramStudioAgent",
      methods: ["applyCommand", "applyLayout", "designLayout", "addElement", "clearElements", "getCaption", "getState"],
      event: "ideogram-studio:changed",
      postMessageSource: "ideogram-agent"
    }
  };
}

function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data,
    isError: false
  };
}

function toolError(message) {
  return {
    content: [
      {
        type: "text",
        text: message
      }
    ],
    isError: true
  };
}

function jsonRpcError(code, message, data) {
  const error = new Error(message);
  error.rpc = { code, message, data };
  return error;
}

function writeResponse(id, result) {
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    id,
    result
  }) + "\n");
}

function writeError(id, error) {
  const rpc = error && error.rpc || {
    code: -32603,
    message: error && error.message || "Internal error"
  };
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    id: id == null ? null : id,
    error: rpc
  }) + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    writeError(null, jsonRpcError(-32700, "Parse error"));
    return;
  }

  if (!message.method) {
    return;
  }

  if (message.id === undefined || message.id === null) {
    try {
      handleRequest(message);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
    }
    return;
  }

  try {
    writeResponse(message.id, handleRequest(message));
  } catch (error) {
    writeError(message.id, error);
  }
});
