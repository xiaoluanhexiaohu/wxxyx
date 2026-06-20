"use strict";

class CanvasUI {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.hits = [];
  }

  begin() {
    this.hits = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  hit(x, y) {
    for (let index = this.hits.length - 1; index >= 0; index -= 1) {
      const item = this.hits[index];
      if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) return item.action;
    }
    return null;
  }

  addHit(x, y, w, h, action) {
    if (typeof action === "function") this.hits.push({ x, y, w, h, action });
  }

  roundRect(x, y, w, h, radius, fill, stroke, lineWidth = 1) {
    const ctx = this.ctx;
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  shadowCard(x, y, w, h, radius, fill, shadow = "rgba(20, 48, 70, 0.28)") {
    this.roundRect(x, y + 4, w, h, radius, shadow);
    this.roundRect(x, y, w, h, radius, fill);
  }

  text(value, x, y, size = 16, color = "#333333", align = "left", weight = "normal") {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x, y);
  }

  wrappedText(value, x, y, maxWidth, lineHeight = 18, options = {}) {
    const ctx = this.ctx;
    const size = options.size || 13;
    const color = options.color || "#333333";
    const weight = options.weight || "normal";
    const maxLines = options.maxLines || 3;
    ctx.font = `${weight} ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = "top";
    const chars = String(value).split("");
    const lines = [];
    let line = "";
    for (const char of chars) {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) break;
      } else {
        line = next;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(`${last}…`).width > maxWidth && last) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return lines.length * lineHeight;
  }

  button(label, x, y, w, h, color, action, options = {}) {
    const radius = options.radius === undefined ? 12 : options.radius;
    const shadow = options.shadow === false ? null : (options.shadowColor || "rgba(15, 56, 48, 0.3)");
    if (shadow) this.roundRect(x, y + 4, w, h, radius, shadow);
    this.roundRect(x, y, w, h, radius, options.disabled ? "#A8B2B8" : color, options.stroke || null, options.lineWidth || 1);
    this.text(label, x + w / 2, y + h / 2 + 1, options.fontSize || 16, options.textColor || "#FFFFFF", "center", options.weight || "bold");
    if (!options.disabled) this.addHit(x, y, w, h + 4, action);
  }

  pill(label, x, y, w, h, fill, color = "#FFFFFF", size = 12) {
    this.roundRect(x, y, w, h, h / 2, fill);
    this.text(label, x + w / 2, y + h / 2, size, color, "center", "bold");
  }

  divider(x, y, w, color = "rgba(44, 62, 80, 0.12)") {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, 1);
  }
}

module.exports = CanvasUI;
