(function initAgentLayoutCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.IdeogramAgentCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createAgentLayoutCore() {
  const DEFAULT_PALETTE = ["#147D75", "#E35C3F", "#F0B84A", "#31403B"];

  function normalizeHex(color) {
    if (!color) return "";
    const value = String(color).trim();
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : "";
  }

  function cleanPalette(palette) {
    if (!Array.isArray(palette)) return [];
    return palette.map(normalizeHex).filter(Boolean);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function bbox(ymin, xmin, ymax, xmax) {
    return [
      clamp(Math.round(ymin), 0, 1000),
      clamp(Math.round(xmin), 0, 1000),
      clamp(Math.round(ymax), 0, 1000),
      clamp(Math.round(xmax), 0, 1000)
    ];
  }

  function inferPreset(brief, requestedPreset) {
    if (requestedPreset && requestedPreset !== "auto") return requestedPreset;
    const text = String(brief || "").toLowerCase();
    if (/(youtube|thumbnail|cover image|hero image)/.test(text)) return "thumbnail";
    if (/(logo|brand identity|wordmark|mark\b)/.test(text)) return "logo";
    if (/(package|packaging|label|bottle|box|product)/.test(text)) return "product";
    if (/(infographic|chart|diagram|data|timeline)/.test(text)) return "infographic";
    if (/(poster|flyer|album|event|ad\b|advertisement)/.test(text)) return "poster";
    return "scene";
  }

  function createStyle(options) {
    const styleMode = options.styleMode || options.style_mode || "art_style";
    if (styleMode === "none") return null;
    const style = {
      aesthetics: options.aesthetics || "clean, intentional, polished",
      lighting: options.lighting || "balanced clear lighting"
    };
    if (styleMode === "photo") {
      style.photo = options.photo || "realistic photograph";
      style.medium = options.medium || "photograph";
    } else {
      style.medium = options.medium || "graphic_design";
      style.art_style = options.artStyle || options.art_style || "modern editorial";
    }
    const palette = cleanPalette(options.palette || DEFAULT_PALETTE);
    if (palette.length) style.color_palette = palette.slice(0, 5);
    return style;
  }

  function createHeuristicLayout(brief, options) {
    const opts = options || {};
    const preset = inferPreset(brief, opts.preset);
    const palette = cleanPalette(opts.palette || DEFAULT_PALETTE);
    const accent = palette[0] || DEFAULT_PALETTE[0];
    const warm = palette[1] || DEFAULT_PALETTE[1];
    const gold = palette[2] || DEFAULT_PALETTE[2];
    const dark = palette[3] || DEFAULT_PALETTE[3];
    const width = Number(opts.width) || 1024;
    const height = Number(opts.height) || 1024;
    const highLevel = String(brief || opts.high_level_description || "structured Ideogram layout").trim();
    const background = opts.background || backgroundForPreset(preset, highLevel);
    const layout = {
      version: 1,
      width,
      height,
      high_level_description: highLevel,
      style_description: createStyle(opts),
      compositional_deconstruction: {
        background,
        elements: []
      }
    };

    if (preset === "thumbnail") {
      layout.compositional_deconstruction.elements = [
        element("obj", bbox(120, 55, 875, 500), "large expressive main subject with strong readable silhouette", "", [accent, dark]),
        element("text", bbox(150, 540, 455, 960), "very large high contrast headline typography", opts.headline || headlineFromBrief(highLevel), [warm, "#FFFFFF"]),
        element("text", bbox(500, 565, 650, 940), "compact supporting subheading in bold sans serif type", opts.subhead || "KEY IDEA", [gold])
      ];
    } else if (preset === "logo") {
      layout.compositional_deconstruction.elements = [
        element("obj", bbox(180, 330, 520, 670), "simple geometric brand mark with balanced negative space", "", [accent, warm]),
        element("text", bbox(590, 180, 740, 820), "clean centered wordmark, precise kerning, premium identity design", opts.headline || headlineFromBrief(highLevel), [dark])
      ];
    } else if (preset === "product") {
      layout.compositional_deconstruction.elements = [
        element("obj", bbox(130, 290, 760, 710), "hero product centered with clear front face and realistic volume", "", [accent, dark]),
        element("text", bbox(70, 95, 170, 905), "small premium brand line at the top", opts.headline || headlineFromBrief(highLevel), [dark]),
        element("text", bbox(790, 160, 900, 840), "short product descriptor below the hero object", opts.subhead || "LIMITED RELEASE", [warm])
      ];
    } else if (preset === "infographic") {
      layout.compositional_deconstruction.elements = [
        element("text", bbox(70, 80, 190, 920), "clear infographic title in modern sans serif", opts.headline || headlineFromBrief(highLevel), [dark]),
        element("obj", bbox(245, 95, 810, 905), "organized central data visualization with simple labeled blocks", "", [accent, gold, warm]),
        element("text", bbox(840, 120, 935, 880), "small source or callout text aligned to the bottom", opts.subhead || "SUMMARY", [dark])
      ];
    } else if (preset === "poster") {
      layout.compositional_deconstruction.elements = [
        element("text", bbox(80, 90, 245, 910), "dominant poster headline, bold editorial typography", opts.headline || headlineFromBrief(highLevel), [warm]),
        element("obj", bbox(285, 170, 770, 830), "central hero visual with strong composition and generous negative space", "", [accent, dark]),
        element("text", bbox(800, 160, 900, 840), "small supporting details, date, location, or tagline", opts.subhead || "DETAILS", [gold])
      ];
    } else {
      layout.compositional_deconstruction.elements = [
        element("obj", bbox(170, 160, 780, 840), "primary subject placed clearly in the frame", "", [accent]),
        element("text", bbox(805, 160, 910, 840), "optional caption or label area with readable typography", opts.headline || headlineFromBrief(highLevel), [warm])
      ];
    }
    return normalizeLayout(layout);
  }

  function backgroundForPreset(preset, brief) {
    const base = {
      thumbnail: "clean high contrast background with depth, uncluttered behind text zones",
      logo: "plain off-white brand presentation background with balanced empty space",
      product: "premium studio backdrop with soft surface shadow and clean negative space",
      infographic: "bright neutral background with subtle grid structure for information design",
      poster: "editorial poster background with subtle texture and clear visual hierarchy",
      scene: "clean scene background that supports the main subject without clutter"
    };
    return `${base[preset] || base.scene}; ${brief}`;
  }

  function headlineFromBrief(brief) {
    const words = String(brief || "TITLE")
      .replace(/[^a-zA-Z0-9 ]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4);
    return (words.join(" ") || "TITLE").toUpperCase();
  }

  function element(type, box, desc, text, palette) {
    const item = {
      type: type === "text" ? "text" : "obj",
      bbox: box,
      desc: desc || ""
    };
    if (item.type === "text") item.text = text || "";
    const colors = cleanPalette(palette);
    if (colors.length) item.color_palette = colors.slice(0, 5);
    return item;
  }

  function normalizeLayout(layout) {
    const caption = captionFromLayout(layout);
    return {
      version: Number(layout && layout.version) || 1,
      width: Number(layout && layout.width) || 1024,
      height: Number(layout && layout.height) || 1024,
      high_level_description: caption.high_level_description || "",
      style_description: caption.style_description || null,
      compositional_deconstruction: caption.compositional_deconstruction
    };
  }

  function captionFromLayout(input) {
    const layout = input || {};
    if (layout.caption) return captionFromLayout(layout.caption);
    const comp = layout.compositional_deconstruction || {};
    const caption = {};
    const highLevel = layout.high_level_description || layout.highLevel || "";
    if (highLevel) caption.high_level_description = String(highLevel);
    const style = layout.style_description || layout.styleDescription;
    if (style && typeof style === "object") {
      const normalizedStyle = {
        aesthetics: style.aesthetics || "",
        lighting: style.lighting || ""
      };
      if (Object.prototype.hasOwnProperty.call(style, "photo")) {
        normalizedStyle.photo = style.photo || "";
        normalizedStyle.medium = style.medium || "";
      } else if (Object.prototype.hasOwnProperty.call(style, "art_style")) {
        normalizedStyle.medium = style.medium || "";
        normalizedStyle.art_style = style.art_style || "";
      } else if (Object.prototype.hasOwnProperty.call(style, "artStyle")) {
        normalizedStyle.medium = style.medium || "";
        normalizedStyle.art_style = style.artStyle || "";
      }
      const palette = cleanPalette(style.color_palette || style.colorPalette || []);
      if (palette.length) normalizedStyle.color_palette = palette;
      caption.style_description = normalizedStyle;
    }
    caption.compositional_deconstruction = {
      background: String(comp.background || layout.background || ""),
      elements: normalizeElements(comp.elements || layout.elements || [])
    };
    return caption;
  }

  function normalizeElements(items) {
    if (!Array.isArray(items)) return [];
    return items.map(normalizeElement).filter(Boolean);
  }

  function normalizeElement(item) {
    if (!item || typeof item !== "object") return null;
    const type = item.type === "text" ? "text" : "obj";
    const out = { type };
    out.bbox = normalizeElementBbox(item);
    if (type === "text") out.text = String(item.text || "");
    out.desc = String(item.desc || item.description || "");
    const palette = cleanPalette(item.color_palette || item.colorPalette || item.palette || []);
    if (palette.length) out.color_palette = palette.slice(0, 5);
    return out;
  }

  function normalizeElementBbox(item) {
    if (Array.isArray(item.bbox) && item.bbox.length === 4) {
      const values = item.bbox.map((value) => clamp(Number(value) || 0, 0, 1000));
      return [
        Math.min(values[0], values[2]),
        Math.min(values[1], values[3]),
        Math.max(values[0], values[2]),
        Math.max(values[1], values[3])
      ].map(Math.round);
    }
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    const w = Number(item.w || item.width) || 0.2;
    const h = Number(item.h || item.height) || 0.2;
    const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? 1000 : 1;
    return bbox(y * scale, x * scale, (y + h) * scale, (x + w) * scale);
  }

  function commandFromLayout(layout) {
    return {
      version: 1,
      action: "apply_layout",
      layout: normalizeLayout(layout)
    };
  }

  function encodeCommand(command) {
    const text = JSON.stringify(command);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(text, "utf8").toString("base64url");
    }
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeCommand(encoded) {
    const value = String(encoded || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = value + "=".repeat((4 - value.length % 4) % 4);
    if (typeof Buffer !== "undefined") {
      return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    }
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function buildAgentUrl(baseUrl, command) {
    const url = new URL(baseUrl || "http://127.0.0.1:4173/");
    url.searchParams.set("agent", encodeCommand(command));
    return url.toString();
  }

  return {
    cleanPalette,
    commandFromLayout,
    createHeuristicLayout,
    decodeCommand,
    encodeCommand,
    buildAgentUrl,
    captionFromLayout,
    normalizeLayout,
    normalizeElement,
    normalizeHex
  };
});
