// 상자 사이 화살표: drawWires([[from, to, mode, color, label, dashed, offset], ...])
// mode: h(오른쪽→왼쪽) · hl(왼쪽→오른쪽) · v(아래→위) · vu(위→아래) · hv · vh — 꺾인 선은 중간에서 꺾는다
window.drawWires = function (wires) {
  const cv = document.querySelector('.canvas'), base = cv.getBoundingClientRect();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'wires');
  svg.setAttribute('width', base.width); svg.setAttribute('height', base.height);
  const defs = new Set(); let html = '', marks = '';
  const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cx: (r.left + r.right) / 2 - base.left, cy: (r.top + r.bottom) / 2 - base.top } };
  for (const w of wires) {
    const [from, to, mode = 'h', color = '#8b95a1', label = '', dash = false, off = 0] = w; const a = box(from), b = box(to);
    const id = 'm' + color.replace('#', ''); if (!defs.has(id)) { defs.add(id); marks += `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>` }
    let d, lx, ly;
    if (mode === 'h') { const y1 = a.cy + off, y2 = b.cy + off, x1 = a.r, x2 = b.l - 2, mx = (x1 + x2) / 2; d = Math.abs(y1 - y2) < 2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`; lx = mx; ly = Math.min(y1, y2) - 10 }
    else if (mode === 'hl') { const y1 = a.cy + off, y2 = b.cy + off, x1 = a.l, x2 = b.r + 2, mx = (x1 + x2) / 2; d = `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`; lx = mx; ly = Math.min(y1, y2) - 10 }
    else if (mode === 'v') { const x1 = a.cx + off, x2 = b.cx + off, y1 = a.b, y2 = b.t - 2, my = (y1 + y2) / 2; d = Math.abs(x1 - x2) < 2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`; lx = x2 + 12; ly = my + 5 }
    else if (mode === 'vu') { const x1 = a.cx + off, x2 = b.cx + off, y1 = a.t, y2 = b.b + 2, my = (y1 + y2) / 2; d = `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`; lx = x2 + 8; ly = my - 6 }
    else if (mode === 'hv') { const x1 = a.r, y1 = a.cy + off, x2 = b.cx, y2 = b.t - 2; d = `M${x1},${y1} L${x2},${y1} L${x2},${y2}`; lx = (x1 + x2) / 2; ly = y1 - 10 }
    else if (mode === 'vh') { const x1 = a.cx + off, y1 = a.b, x2 = b.l - 2, y2 = b.cy; d = `M${x1},${y1} L${x1},${y2} L${x2},${y2}`; lx = x1 + 10; ly = y2 - 10 }
    html += `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" ${dash ? 'stroke-dasharray="6 6"' : ''} stroke-linejoin="round" marker-end="url(#${id})"/>`;
    if (label) html += `<text x="${lx}" y="${ly}" text-anchor="${mode === 'v' || mode === 'vu' ? 'start' : 'middle'}" font-size="16" font-weight="800" fill="${color}" font-family="Pretendard">${label}</text>`;
  }
  svg.innerHTML = `<defs>${marks}</defs>${html}`;
  cv.appendChild(svg);
};
