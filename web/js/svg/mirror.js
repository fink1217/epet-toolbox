// 左右鏡像、但字保持可讀：把整組東西翻過來看背面時用。
// 外層用 matrix(-1 0 0 1 W 0) 鏡像；每個 <text> 再對自己的錨點鏡像一次（兩次鏡像＝不鏡像），
// 同時把 text-anchor 的 start／end 對調，字才會往鏡像後的方向延伸，不會跑出外框。

const SWAP = { start: 'end', end: 'start', middle: 'middle' };

export function unmirrorText(svg) {
  return svg.replace(/<text\b([^>]*)>/g, (m, attrs) => {
    const x = Number((attrs.match(/\sx="(-?[\d.]+)"/) || [])[1] || 0);
    const tf = attrs.match(/\stransform="([^"]*)"/);
    const anchor = (attrs.match(/\stext-anchor="(\w+)"/) || [])[1] || 'start';
    const rest = attrs
      .replace(/\stransform="[^"]*"/, '')
      .replace(/\stext-anchor="\w+"/, '');
    // 鏡像放在 transform 清單最後（最先作用在字上），以字自己的 x 為軸
    const t = `${tf ? `${tf[1]} ` : ''}matrix(-1 0 0 1 ${2 * x} 0)`;
    return `<text transform="${t}" text-anchor="${SWAP[anchor] || 'end'}"${rest}>`;
  });
}

// 整段 SVG 以寬度 W 的中線左右鏡像（字保持可讀）
export function mirrorX(svg, W) {
  return `<g transform="matrix(-1 0 0 1 ${W} 0)">${unmirrorText(svg)}</g>`;
}
