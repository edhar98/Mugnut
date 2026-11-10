// Mugnut: drawing helpers and the core objects. A plain script (no modules) so the game also runs from a file.
// Themed packs live in packs/*.js and append to OBJECTS.
//
// THE FIRST 100 ENTRIES ARE THE DAILY ROTATION: never reorder or remove them. New objects go in a pack file.
//
// An object: {lv, name, g, svg, ex, sub?, pack?, holes?, open?}
//   lv    1-4 (Easy, Medium, Hard, Expert)        g   genus 0-5, where 5 means "5 or more"
//   svg   drawing in a 240x200 box                ex  one-sentence explanation      sub  qualifier under the name
//   pack  id of a themed pack (absent for the core objects)
//   holes [[x,y] or [x,y,r], ...]  where each through-hole is on the drawing (r: ring radius, default 11)
//   open  [[x,y] or [x,y,r], ...]  openings into one shared hollow space: n openings count as n - 1 holes
//         When marks are given and g < 5: holes.length + max(0, open.length - 1) must equal g.

// ---------- drawing helpers ----------
const INK = "#1f2a44", BG = "#fbf7ee";
const S = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
const COL = {blue:"#7aa2d6", green:"#8fb9a8", mint:"#a8d5ba", coral:"#e07a5f", yellow:"#f2c14e", gold:"#e9c46a",
  brown:"#b5652a", metal:"#cfd6e0", steel:"#b8c1cc", navy:"#2f3e66", pink:"#f2a6c0", wood:"#c9925a", paper:"#fffdf8",
  red:"#c2453b", terra:"#d0774f", kraft:"#c8a27a", dark:"#3a3a44"};
// extra attributes may override the stroke colour; the default is dropped then so no attribute is repeated
const SX = x => /(^|\s)stroke=/.test(x) ? S.replace(/stroke="[^"]*" /, "") : S;
const P = (d, f, x="") => `<path d="${d}" fill="${f}" ${SX(x)} ${x}/>`;
const E = (cx,cy,rx,ry,f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${S}/>`;
const C = (cx,cy,r,f) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${S}/>`;
const R = (x,y,w,h,rx,f,extra="") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${SX(extra)} ${extra}/>`;
const L = (d, w=2.5, op=1, c=INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`;
const H = (cx,cy,rx,ry=rx) => E(cx,cy,rx,ry,BG);
const D = (cx,cy,rx,ry=rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" opacity=".85"/>`;
const T = (d, c, w=10) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w+6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const TE = (cx,cy,rx,ry,c,w=10) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${INK}" stroke-width="${w+6}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
// union of shapes with a single outline: draw shapes as strings using {f} placeholder
const U = (shapes, c) => `<g fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round">${shapes}</g><g fill="${c}" stroke="none">${shapes}</g>`;
const crc = (cx,cy,r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const rct = (x,y,w,h,rx=0,tr="") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${tr}/>`;
const pth = d => `<path d="${d}"/>`;

// ---------- reusable drawings ----------
function mug({handle="full", drilled=false, c=COL.blue}={}){
  let h = "";
  if(handle==="full") h = T("M153 78 C200 78 200 140 153 140", c, 14);
  if(handle==="broken") h = T("M153 78 C172 78 180 86 184 96", c, 14) + T("M153 140 C170 140 180 132 184 124", c, 14);
  return h + P("M57 55 V150 Q57 170 105 170 Q153 170 153 150 V55", c) + E(105,55,48,12,"#dfe8f5") +
    `<ellipse cx="105" cy="57" rx="40" ry="8" fill="#6b4226"/>` +
    (drilled ? L("M95 172 L95 186 M115 172 L115 186", 2, .6) + D(105,188,10,3) : "");
}
function bottle(cap=true){
  return P("M85 88 Q85 72 102 64 V44 H138 V64 Q155 72 155 88 V168 Q155 178 145 178 H95 Q85 178 85 168 Z", COL.mint) +
    (cap ? R(98,26,44,20,4,COL.coral) : E(120,44,18,5,INK)) + R(85,108,70,36,0,COL.paper) + L("M98 126 H142",2,.35);
}
function donut(){
  return E(120,108,82,56,"#d9a066") +
   P("M48 100 Q50 58 120 54 Q190 58 192 100 Q188 128 165 124 Q150 140 120 136 Q90 140 75 124 Q52 128 48 100 Z", COL.pink) +
   H(120,100,26,14) +
   `<g stroke-width="4" stroke-linecap="round"><path d="M80 80 l8 3" stroke="#3d5a98"/><path d="M150 72 l7 -4" stroke="#f2c14e"/><path d="M70 105 l4 -6" stroke="#f2c14e"/><path d="M118 70 l8 1" stroke="#2f8f5b"/><path d="M95 122 l-6 3" stroke="#c2453b"/></g>`;
}
const PRETZEL_OUT = "M120 72 C95 32 32 44 38 106 C44 162 102 172 120 150 C138 172 196 162 202 106 C208 44 145 32 120 72 Z";
function pretzel(broken=false){
  const arms = broken ? " M120 72 Q104 112 78 152 M120 72 Q130 95 138 108" : " M120 72 Q104 112 78 152 M120 72 Q136 112 162 152";
  return T(PRETZEL_OUT + arms, "#b5652a", 18) +
   `<g fill="#fff"><rect x="60" y="64" width="4" height="4"/><rect x="170" y="70" width="4" height="4"/><rect x="45" y="118" width="4" height="4"/><rect x="190" y="124" width="4" height="4"/></g>`;
}
function tshirt(hole=false){
  return P("M92 34 Q120 56 148 34 L196 60 L178 98 L160 88 V178 H80 V88 L62 98 L44 60 Z", COL.coral) +
    L("M92 34 Q120 48 148 34",2,.5) + (hole ? H(135,125,8,6) : "");
}
function trousers(sewn=false){
  return P("M78 32 H162 L178 180 H132 L120 88 L108 180 H62 Z", "#5a7bb5") + L("M78 46 H162") + L("M120 46 V88",1.5,.5) +
    (sewn ? `<path d="M66 172 H106" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/>` : "");
}
function teapot(lid=true){
  return T("M64 96 C24 96 26 152 68 146", COL.green, 12) +
    P("M162 118 Q186 108 196 72 L208 76 Q198 126 160 142 Z", COL.green) +
    E(116,124,56,46,COL.green) +
    (lid ? E(116,82,30,8,"#b9d6ca") + C(116,70,6,"#b9d6ca") : E(116,82,30,8,"#24453b")) +
    L("M76 130 Q116 146 156 130",2,.35);
}
function glove(hole=false){
  const sh = rct(80,46,17,70,8)+rct(99,32,17,80,8)+rct(118,36,17,78,8)+rct(137,50,16,66,8)+
    rct(46,96,17,52,8,'transform="rotate(-40 54 122)"')+rct(80,92,73,72,14)+rct(88,150,58,34,4);
  return U(sh, COL.yellow) + L("M88 160 H146",2,.4) + (hole ? D(107,38,5,4) : "");
}
function sock(hole=false){
  return P("M95 30 H145 V120 Q145 150 172 155 Q202 160 196 182 H112 Q88 182 95 150 Z", COL.green) +
    R(95,30,50,18,2,"#6fa190") + (hole ? D(190,170,5,6) : "");
}
function ladder(n){
  const top=30, bot=180, gap=(bot-top)/(n+1);
  let r=""; for(let i=1;i<=n;i++){ const y=top+gap*i; r+=R(88,y-5,64,10,2,COL.wood); }
  return r + R(76,22,14,166,4,COL.wood) + R(150,22,14,166,4,COL.wood);
}
function button(n){
  const pos = n===2 ? [[104,104],[136,104]] : [[100,84],[140,84],[100,124],[140,124]];
  return C(120,104,72,COL.yellow) + `<circle cx="120" cy="104" r="58" fill="none" stroke="${INK}" stroke-width="2" opacity=".35"/>` +
    pos.map(([x,y])=>H(x,y,9)).join("");
}
function trefoil(){
  let d=""; for(let i=0;i<=120;i++){ const t=i/120*2*Math.PI; const x=120+26*(Math.sin(t)+2*Math.sin(2*t)); const y=100+26*(Math.cos(t)-2*Math.cos(2*t))*0.85+8; d+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1); }
  return T(d+"Z", COL.coral, 12);
}
function bagel(cut=false){
  return E(120,104,82,58, cut ? "#f3dfb8" : "#c98b4a") + (cut ? E(120,104,70,48,"#f7e8c9") : "") + H(120,100,30,17) +
    (cut ? L("M70 90 l6 2 M160 120 l6 -2 M150 80 l5 3 M85 125 l5 -2",2,.35) :
     `<g fill="#f7e8c9"><ellipse cx="80" cy="85" rx="3" ry="1.6"/><ellipse cx="150" cy="70" rx="3" ry="1.6"/><ellipse cx="170" cy="110" rx="3" ry="1.6"/><ellipse cx="95" cy="135" rx="3" ry="1.6"/><ellipse cx="128" cy="140" rx="3" ry="1.6"/><ellipse cx="68" cy="112" rx="3" ry="1.6"/></g>`);
}

// ---------- the 100 objects ----------
// lv: 1 easy, 2 medium, 3 hard, 4 expert. g: genus (5 means 5 or more)
const OBJECTS = [
// ===== EASY =====
{lv:1,name:"Ball",g:0,svg:C(120,100,72,COL.coral)+L("M50 82 Q120 125 190 82",3,.8,"#fff")+L("M56 128 Q120 92 184 128",3,.8,"#fff")+`<ellipse cx="95" cy="62" rx="16" ry="9" fill="#fff" opacity=".35"/>`,
 ex:"No holes at all — the sphere itself."},
{lv:1,name:"Donut",g:1,svg:donut(),ex:"The definition of a torus: one hole straight through."},
{lv:1,name:"Ring",g:1,svg:TE(120,120,62,52,"#d4a017",12)+P("M102 72 H138 L130 54 H110 Z","#9ad1f0"),ex:"One hole for the finger — a torus wearing jewellery."},
{lv:1,name:"Coffee mug",g:1,svg:mug(),ex:"Only the handle goes through. Squash the cup into the handle and you get a donut."},
{lv:1,name:"Dinner plate",g:0,svg:E(120,108,94,52,COL.paper)+`<ellipse cx="120" cy="106" rx="58" ry="30" fill="none" stroke="${INK}" stroke-width="2" opacity=".35"/>`,ex:"A flattened ball. No holes."},
{lv:1,name:"Bottle with the cap on",g:0,svg:bottle(true),ex:"With the cap on, nothing passes through. Inflate it and it becomes a ball."},
{lv:1,name:"Key",g:1,svg:P("M98 94 H208 V110 H196 V128 H184 V110 H172 V124 H160 V110 H98 Z",COL.gold)+C(66,102,36,COL.gold)+H(58,102,13),ex:"Only the ring in the head goes through. The teeth are bumps."},
{lv:1,name:"Hammer",g:0,svg:R(110,72,20,112,6,COL.wood)+P("M58 40 H170 Q182 40 182 52 V62 Q182 74 170 74 H58 Q48 66 48 57 Q48 48 58 40 Z",COL.steel),ex:"A head on a stick — no tunnels anywhere."},
{lv:1,name:"Spoon",g:0,svg:P("M114 92 L111 182 Q120 190 129 182 L126 92 Z",COL.metal)+E(120,60,30,42,COL.metal)+`<ellipse cx="120" cy="58" rx="20" ry="30" fill="#fff" opacity=".4"/>`,ex:"The bowl of the spoon is a dent, not a hole."},
{lv:1,name:"Pencil",g:0,svg:`<g transform="rotate(-25 120 100)">${R(56,88,120,24,0,COL.yellow)}${P("M176 88 L210 100 L176 112 Z",COL.wood)}${P("M200 96.5 L210 100 L200 103.5 Z",INK)}${R(40,88,16,24,0,COL.steel)}${R(24,88,18,24,6,COL.pink)}</g>`,ex:"A long thin solid. Sphere."},
{lv:1,name:"Bagel",g:1,svg:bagel(),ex:"Just a chewier torus."},
{lv:1,name:"Rubber band",g:1,svg:TE(120,100,82,46,COL.red,6),ex:"A thin loop — one hole."},
{lv:1,name:"Lifebuoy",g:1,svg:`<circle cx="120" cy="100" r="56" fill="none" stroke="${INK}" stroke-width="40"/><circle cx="120" cy="100" r="56" fill="none" stroke="#fff" stroke-width="34"/><circle cx="120" cy="100" r="56" fill="none" stroke="${COL.red}" stroke-width="34" stroke-dasharray="44 44"/>`,ex:"A fat torus you can float in."},
{lv:1,name:"Button with 2 holes",g:2,svg:button(2),ex:"Two thread holes, each going through: genus 2."},
{lv:1,name:"Button with 4 holes",g:4,svg:button(4),ex:"Four thread holes: genus 4."},
{lv:1,name:"Scissors",g:2,svg:P("M95 132 L152 28 L160 34 L130 108 Z",COL.metal)+P("M145 132 L88 28 L80 34 L110 108 Z",COL.metal)+TE(84,152,22,22,COL.coral,9)+TE(156,152,22,22,COL.coral,9)+`<circle cx="120" cy="96" r="5" fill="${INK}"/>`,ex:"Two finger loops. The pivot joins both halves into one object."},
{lv:1,name:"Brick",g:0,svg:P("M50 90 H170 V160 H50 Z",COL.red)+P("M50 90 L80 62 H200 L170 90 Z","#d9675b")+P("M170 90 L200 62 V132 L170 160 Z","#a8392f"),ex:"A solid block — a squared-off ball."},
{lv:1,name:"Coin",g:0,svg:C(120,100,70,COL.gold)+`<circle cx="120" cy="100" r="56" fill="none" stroke="${INK}" stroke-width="2" opacity=".4"/><text x="120" y="122" text-anchor="middle" font-family="Georgia,serif" font-size="64" font-weight="700" fill="${INK}" opacity=".6">1</text>`,ex:"A flat disc — a squashed sphere."},
{lv:1,name:"Washer",g:1,svg:C(120,100,64,COL.steel)+H(120,100,26)+`<circle cx="120" cy="100" r="45" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>`,ex:"A flat ring: one hole."},
{lv:1,name:"Banana",g:0,svg:P("M40 70 Q60 170 190 140 Q205 136 200 128 Q100 140 70 66 Q66 56 56 58 Z",COL.yellow)+P("M40 70 L34 62 L46 56 L56 58",COL.brown),ex:"Bent, but no holes."},
{lv:1,name:"Hex nut",g:1,svg:P("M120 32 L180 66 V134 L120 168 L60 134 V66 Z",COL.steel)+H(120,100,28)+`<circle cx="120" cy="100" r="22" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3"/>`,ex:"The threaded hole goes right through: torus."},
{lv:1,name:"Apple",g:0,svg:P("M120 62 C80 40 40 70 50 120 C58 160 95 182 120 166 C145 182 182 160 190 120 C200 70 160 40 120 62 Z",COL.red)+L("M120 62 Q118 40 126 26",5)+P("M126 40 Q150 22 166 36 Q146 50 126 40 Z","#5b9a5b"),ex:"The dimples at top and bottom are dents."},
{lv:1,name:"Closed book",g:0,svg:R(56,40,128,130,6,"#3d5a98")+R(66,164,114,12,2,COL.paper)+L("M74 40 V170",3,.4,"#fff")+R(92,70,70,24,3,COL.paper),ex:"A rectangular block — a sphere."},
{lv:1,name:"Glasses frame",sub:"lenses popped out",g:2,svg:TE(76,108,34,34,"#3d5a98",6)+TE(164,108,34,34,"#3d5a98",6)+L("M108 100 Q120 86 132 100",7)+L("M42 100 L18 90 M198 100 L222 90",7),ex:"Two empty lens openings = two holes."},
{lv:1,name:"Picture frame",sub:"empty — no glass",g:1,svg:R(48,30,144,144,4,COL.wood)+R(72,54,96,96,2,BG)+L("M48 30 L72 54 M192 30 L168 54 M48 174 L72 150 M192 174 L168 150",2,.5),ex:"One big window in the middle: a (square) torus."},

// ===== MEDIUM =====
{lv:2,name:"Bowling ball",g:0,svg:C(120,104,74,COL.navy)+`<ellipse cx="96" cy="70" rx="22" ry="12" fill="#fff" opacity=".15" transform="rotate(-30 96 70)"/>`+D(110,76,9)+D(136,74,9)+D(124,110,10),ex:"Trick! The finger holes are dents — they don't come out the other side."},
{lv:2,name:"Drinking straw",g:1,svg:`<defs><pattern id="stripes" width="22" height="30" patternUnits="userSpaceOnUse"><rect width="11" height="30" fill="#fffdf8"/><rect x="11" width="11" height="30" fill="#e07a5f"/></pattern></defs><g transform="rotate(-22 120 104)">${R(26,92,188,24,0,"url(#stripes)")}${E(214,104,6,12,COL.paper)}${D(214,104,3,8)}</g>`,ex:"One tunnel end to end. A straw has exactly one hole, not two."},
{lv:2,name:"Padlock",sub:"locked",g:1,svg:T("M90 98 V66 A30 30 0 0 1 150 66 V98",COL.steel,12)+R(68,92,104,84,12,COL.gold)+`<circle cx="120" cy="126" r="8" fill="${INK}"/><rect x="116" y="126" width="8" height="22" rx="2" fill="${INK}"/>`,ex:"The closed shackle is a loop. The keyhole is only a dent."},
{lv:2,name:"Bowl",g:0,svg:P("M44 92 Q48 172 120 172 Q192 172 196 92 Z",COL.blue)+E(120,92,76,18,"#dfe8f5")+`<ellipse cx="120" cy="94" rx="64" ry="12" fill="#5d82b8" opacity=".5"/>`,ex:"A bowl is one big dent. Push it flat: a disc, a sphere."},
{lv:2,name:"Drinking glass",g:0,svg:P("M74 40 L86 172 H154 L166 40 Z","#dbeaf5")+P("M80 100 L86 172 H154 L160 100 Z","#9cc3e6")+E(120,40,46,10,"#eef5fb"),ex:"Open at the top only, so the inside is a dent. Sphere."},
{lv:2,name:"Bucket with handle",g:1,svg:T("M70 74 Q120 -6 170 74",COL.steel,5)+P("M68 74 L82 172 H158 L172 74 Z",COL.coral)+E(120,74,52,12,"#a94f3a"),ex:"The bucket itself is a dent; the handle makes one loop."},
{lv:2,name:"Pretzel",g:3,svg:pretzel(),ex:"Count the windows: left, right and the little one at the bottom. Three."},
{lv:2,name:"Trophy with two handles",g:2,svg:T("M82 52 C44 52 46 104 88 102",COL.gold,8)+T("M158 52 C196 52 194 104 152 102",COL.gold,8)+P("M80 36 H160 V78 Q160 126 120 130 Q80 126 80 78 Z",COL.gold)+R(112,130,16,24,0,COL.gold)+R(88,154,64,18,3,"#b07d2b"),ex:"The cup is a dent. Each handle adds a hole: two."},
{lv:2,name:"Fork",g:0,svg:P("M114 96 L110 182 Q120 190 130 182 L126 96 Z",COL.metal)+P("M92 26 V76 Q92 100 120 102 Q148 100 148 76 V26 H138 V70 H130 V26 H124 V70 H116 V26 H110 V70 H102 V26 Z",COL.metal),ex:"The gaps between tines are open at the end — no loops."},
{lv:2,name:"Comb",g:0,svg:R(40,60,160,26,6,COL.navy)+Array.from({length:14},(_,i)=>R(46+i*11,84,6,62,2,COL.navy)).join(""),ex:"Every gap is open at the bottom. Sphere."},
{lv:2,name:"Paper clip",g:0,svg:T("M100 160 V60 Q100 36 122 36 Q144 36 144 60 V150 Q144 170 128 170 Q112 170 112 150 V72",COL.steel,5),ex:"It looks loopy, but the wire has two free ends. Unbend it into a straight line."},
{lv:2,name:"Chain link",g:1,svg:`<g transform="rotate(-20 120 100)">${TE(120,100,66,34,COL.steel,12)}</g>`,ex:"A stretched ring: one hole."},
{lv:2,name:"Coat hanger",g:1,svg:T("M120 62 Q120 34 138 34 Q154 36 150 52",COL.steel,5)+T("M120 62 L40 140 Q34 152 50 152 H190 Q206 152 200 140 Z",COL.steel,5),ex:"The hook is open, but the triangle is closed: one hole."},
{lv:2,name:"Paper bag with two handles",g:2,svg:T("M96 86 C96 40 144 40 144 86",COL.kraft,6)+R(62,84,116,96,2,COL.kraft)+T("M86 84 C86 30 154 30 154 84","#a8835a",6)+L("M62 100 H178",2,.3),ex:"The bag is a dent; each handle adds a hole."},
{lv:2,name:"Frying pan",sub:"with a hanging hole",g:1,svg:R(150,94,78,20,8,COL.dark)+H(212,104,6)+C(92,104,62,COL.dark)+`<circle cx="92" cy="104" r="50" fill="#555561"/>`,ex:"The pan is a dent; the hole in the handle goes through."},
{lv:2,name:"Hole-punched sheet",g:3,svg:R(70,24,104,152,2,COL.paper)+H(86,56,6)+H(86,100,6)+H(86,144,6)+L("M104 50 H160 M104 66 H160 M104 82 H150 M104 98 H160 M104 114 H156 M104 130 H160",1.5,.25),ex:"Paper is a very thin solid. Three punched holes: genus 3."},
{lv:2,name:"Combination wrench",g:1,svg:`<g transform="rotate(-20 120 100)">${R(66,92,110,16,6,COL.steel)}${C(52,100,26,COL.steel)}${P("M44 100 L48 92 H56 L60 100 L56 108 H48 Z",BG)}${P("M196 84 A26 26 0 1 0 196 116 L182 108 V92 Z",COL.steel)}</g>`,ex:"The ring end is closed (one hole); the open end is just a notch."},
{lv:2,name:"Headphones",g:0,svg:T("M60 120 Q60 30 120 30 Q180 30 180 120",COL.navy,10)+R(42,108,34,58,14,COL.navy)+R(164,108,34,58,14,COL.navy),ex:"The headband is an arch, not a loop — the bottom is open."},
{lv:2,name:"Funnel",g:1,svg:P("M48 50 L192 50 L132 128 V182 H108 V128 Z",COL.coral)+E(120,50,72,14,"#a94f3a")+D(120,182,12,3),ex:"Open at both ends, so it's a tube: one hole."},
{lv:2,name:"Pot with two side handles",g:2,svg:T("M66 92 Q38 92 38 104 Q38 116 66 116",COL.steel,7)+T("M174 92 Q202 92 202 104 Q202 116 174 116",COL.steel,7)+R(66,70,108,96,8,COL.steel)+E(120,70,54,10,"#7d8794"),ex:"The pot is a dent. Two loop handles = two holes."},
{lv:2,name:"Toy building brick",g:0,svg:P("M50 92 H170 V152 H50 Z",COL.red)+P("M50 92 L80 64 H200 L170 92 Z","#d9675b")+P("M170 92 L200 64 V124 L170 152 Z","#a8392f")+[[90,74],[120,74],[150,74],[105,86],[135,86],[165,80]].slice(0,4).map(([x,y])=>E(x,y,10,4,"#e88276")).join(""),ex:"The studs are bumps and the hollow underside is a dent."},
{lv:2,name:"Bead",sub:"drilled through",g:1,svg:C(120,100,62,"#7a5cc4")+`<ellipse cx="98" cy="74" rx="16" ry="10" fill="#fff" opacity=".3"/>`+D(120,100,10)+L("M30 100 H58 M182 100 H210",2,.5),ex:"The drilled channel is one hole straight through."},
{lv:2,name:"Letter B",sub:"cut out of card",g:2,svg:`<path d="M70 30 H140 Q180 30 180 65 Q180 88 162 98 Q190 108 190 135 Q190 170 145 170 H70 Z M100 55 H135 Q150 55 150 72 Q150 88 135 88 H100 Z M100 112 H140 Q158 112 158 130 Q158 146 140 146 H100 Z" fill="${COL.blue}" fill-rule="evenodd" ${S}/>`,ex:"Two enclosed counters: two holes."},
{lv:2,name:"Letter A",sub:"cut out of card",g:1,svg:`<path d="M60 170 L105 30 H135 L180 170 H148 L138 135 H102 L92 170 Z M110 110 H130 L120 74 Z" fill="${COL.coral}" fill-rule="evenodd" ${S}/>`,ex:"Only the little triangle is enclosed. The space between the legs is open."},
{lv:2,name:"Sunglasses",sub:"lenses in",g:0,svg:C(76,108,34,COL.dark)+C(164,108,34,COL.dark)+`<ellipse cx="66" cy="96" rx="10" ry="6" fill="#fff" opacity=".25"/><ellipse cx="154" cy="96" rx="10" ry="6" fill="#fff" opacity=".25"/>`+L("M108 100 Q120 86 132 100",7)+L("M42 100 L18 90 M198 100 L222 90",7),ex:"The lenses fill the openings, so no holes: sphere!"},

// ===== HARD =====
{lv:3,name:"Trousers",g:2,svg:trousers(),ex:"Three openings (waist, two legs). A sheet with n openings, thickened, has genus n − 1 → 2."},
{lv:3,name:"T-shirt",g:3,svg:tshirt(),ex:"Four openings: neck, waist, two sleeves → genus 3."},
{lv:3,name:"Sock",g:0,svg:sock(),ex:"Only one opening. A bag with one opening flattens into a disc: sphere."},
{lv:3,name:"Glove",g:0,svg:glove(),ex:"Five fingers, but only one opening — at the wrist. The fingers are long dents."},
{lv:3,name:"Teapot",sub:"lid sealed on",g:1,svg:teapot(true),ex:"The handle is one hole. The spout leads inside, but the inside goes nowhere else — a deep dent."},
{lv:3,name:"Teapot",sub:"lid off",g:2,svg:teapot(false),ex:"Now the inside has two openings (top and spout) — a tunnel. Plus the handle: genus 2."},
{lv:3,name:"Watering can",sub:"open top",g:2,svg:T("M70 96 Q34 96 34 124 Q34 152 70 152",COL.green,10)+P("M158 140 L212 72 L222 80 L166 156 Z",COL.green)+R(70,80,92,90,10,COL.green)+E(114,80,40,9,"#3f6b5d")+E(216,74,9,6,"#3f6b5d"),ex:"Top and spout make a tunnel through the inside (1), plus the handle (1) = 2."},
{lv:3,name:"Belt",g:5,svg:`<g transform="rotate(-8 120 100)">${R(70,90,160,22,4,COL.brown)}${[150,166,182,198,214].map(x=>H(x,101,3.5)).join("")}${TE(52,101,20,24,COL.gold,6)}${L("M38 101 H72",4)}</g>`,ex:"Five punched holes plus the buckle frame — genus 6, so “5 or more”."},
{lv:3,name:"Jug",g:1,svg:T("M150 70 C196 70 196 140 150 140",COL.blue,12)+P("M70 52 L64 48 Q60 44 70 42 H152 V150 Q152 172 120 172 Q84 172 82 150 Z",COL.blue)+E(111,46,40,7,"#4f73a8"),ex:"The open jug is a dent; the handle gives one hole."},
{lv:3,name:"Vase",g:0,svg:P("M96 34 H144 Q136 60 160 92 Q182 130 150 170 H90 Q58 130 80 92 Q104 60 96 34 Z",COL.terra)+E(120,34,24,6,"#7a3d24"),ex:"One opening, so the inside is just a deep dent."},
{lv:3,name:"T-shaped pipe",g:2,svg:R(36,62,168,40,4,COL.steel)+R(100,100,40,82,0,COL.steel)+E(36,82,8,20,COL.steel)+D(36,82,5,14)+E(204,82,8,20,COL.steel)+D(204,82,5,14)+E(120,182,20,6,COL.steel)+D(120,182,14,4),ex:"A tube with three open ends: n − 1 = 2."},
{lv:3,name:"Ladder",sub:"3 rungs",g:2,svg:ladder(3),ex:"Count enclosed windows: between rungs 1–2 and 2–3. The ends are open."},
{lv:3,name:"Bicycle frame",sub:"no wheels",g:2,svg:T("M100 60 L180 66 L116 150 Z",COL.red,8)+T("M100 60 L44 150 L116 150",COL.red,6)+T("M180 66 L204 150",COL.red,6)+T("M100 60 L96 40 M84 38 H110 M180 66 L176 44 L194 40",INK,4),ex:"Two closed triangles — main and rear. The fork is open: genus 2."},
{lv:3,name:"Strapless dress",g:1,svg:P("M88 30 H152 L158 80 L196 180 H44 L82 80 Z",COL.pink)+L("M84 80 H156",2,.4),ex:"Two openings, top and bottom: it's a tube, a torus."},
{lv:3,name:"Coffee cup sleeve",g:1,svg:P("M70 70 L84 150 Q120 164 156 150 L170 70 Q120 84 70 70 Z",COL.kraft)+E(120,72,50,11,BG)+L("M78 110 Q120 122 162 110",2,.3),ex:"A band open at both ends: one hole."},
{lv:3,name:"Bottle without its cap",g:0,svg:bottle(false),ex:"One opening only — the inside is a dent. Still a sphere."},
{lv:3,name:"Flowerpot",sub:"with a drainage hole",g:1,svg:P("M62 66 L82 176 H158 L178 66 Z",COL.terra)+R(54,48,132,22,3,COL.terra)+E(120,48,66,8,"#7a3d24")+`<ellipse cx="120" cy="176" rx="10" ry="3" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2"/>`,ex:"Top opening plus drainage hole: the inside becomes a tunnel. One hole."},
{lv:3,name:"Window frame",sub:"4 panes, no glass",g:4,svg:R(46,26,148,148,3,COL.paper)+R(60,40,56,56,0,BG)+R(124,40,56,56,0,BG)+R(60,104,56,56,0,BG)+R(124,104,56,56,0,BG),ex:"Four separate windows → genus 4."},
{lv:3,name:"Hollow ball",sub:"with 3 holes",g:2,svg:C(120,100,72,COL.yellow)+D(96,74,12)+D(150,90,11)+D(110,138,12),ex:"A hollow shell with n openings has genus n − 1 → 2."},
{lv:3,name:"Coiled garden hose",g:1,svg:T("M120 100 m-14 0 a14 14 0 1 1 28 0 a30 30 0 1 1 -60 0 a46 46 0 1 1 92 0 a62 62 0 1 1 -124 0",COL.green,10)+E(58,100,8,5,INK),ex:"However you coil it, it's one tube: torus."},
{lv:3,name:"Jigsaw piece",g:0,svg:P("M60 60 H100 Q92 36 120 36 Q148 36 140 60 H180 V96 Q204 88 204 116 Q204 144 180 136 V170 H140 Q148 148 120 148 Q92 148 100 170 H60 V136 Q84 144 84 116 Q84 88 60 96 Z",COL.blue),ex:"Knobs and sockets are bumps and dents. Sphere."},
{lv:3,name:"Pliers",g:0,svg:T("M118 96 L80 186 M122 96 L160 186",COL.red,12)+P("M112 104 L104 26 L122 30 L126 94 Z",COL.steel)+P("M128 104 L136 26 L118 30 L114 94 Z",COL.steel)+`<circle cx="120" cy="98" r="6" fill="${INK}"/>`,ex:"Unlike scissors, the handles have no finger loops. Sphere."},
{lv:3,name:"Swing",g:1,svg:R(30,26,180,14,4,COL.wood)+L("M86 40 V150 M154 40 V150",3)+R(72,148,96,14,3,COL.wood),ex:"Bar, two ropes and seat close a single loop: one hole."},
{lv:3,name:"Plus-shaped pipe",g:3,svg:R(30,80,180,40,0,COL.steel)+R(100,26,40,148,0,COL.steel)+R(98.75,81.25,42.5,37.5,0,COL.steel,'stroke="none"')+R(101.25,78.75,37.5,42.5,0,COL.steel,'stroke="none"')+[[30,100,8,20],[210,100,8,20]].map(([x,y,a,b])=>E(x,y,a,b,COL.steel)+D(x,y,a-3,b-6)).join("")+E(120,26,20,6,COL.steel)+D(120,26,14,4)+E(120,174,20,6,COL.steel)+D(120,174,14,4),ex:"Four open ends: n − 1 = 3."},
{lv:3,name:"Kettlebell",g:1,svg:T("M86 84 Q86 34 120 34 Q154 34 154 84",COL.dark,14)+C(120,124,56,COL.dark)+R(100,170,40,10,3,COL.dark),ex:"The ball is solid; the handle is one loop."},

// ===== EXPERT =====
{lv:4,name:"Ocarina",sub:"4 finger holes + mouthpiece",g:4,svg:P("M196 100 Q196 150 120 150 Q50 150 48 104 Q46 58 120 56 Q196 56 196 100 Z",COL.terra)+R(26,90,30,22,4,COL.terra)+D(28,101,3,7)+D(100,86,7)+D(134,84,7)+D(116,118,7)+D(158,104,7),ex:"A hollow body with 5 openings (4 holes + mouthpiece): n − 1 = 4."},
{lv:4,name:"Bar stool with foot ring",g:4,svg:L("M80 60 L64 186 M160 60 L176 186 M104 66 L100 176 M136 66 L140 176",7)+TE(120,140,52,12,COL.steel,5)+E(120,58,52,14,COL.red),ex:"Seat, 4 legs and the ring form a network. Loops = edges − vertices + 1 = 8 − 5 + 1 = 4."},
{lv:4,name:"Bubble tea",sub:"sealed lid, straw through it",g:0,svg:R(126,10,14,78,2,COL.pink)+P("M70 50 L84 182 H156 L170 50 Z","#e9d8c2")+E(120,50,50,9,"#ffffff")+[[96,166],[112,170],[128,168],[144,164],[104,154],[136,154]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="7" fill="${INK}" opacity=".8"/>`).join("")+R(126,50,14,120,0,COL.pink,'opacity=".7"'),ex:"The straw leads into the cup, but the cup is sealed — it's all one deep dent. Sphere!"},
{lv:4,name:"Unzipped jacket",g:2,svg:P("M92 34 Q120 50 148 34 L196 62 L182 176 H162 L164 96 L160 176 H124 L120 60 L116 176 H80 L76 96 L78 176 H58 L44 62 Z",COL.navy)+L("M120 60 V176",3,.6,BG),ex:"Neck, front and hem form ONE continuous opening, plus two cuffs = 3 openings → genus 2."},
{lv:4,name:"Colander",g:5,svg:T("M48 96 Q30 96 30 104 Q30 112 50 112",COL.steel,6)+T("M192 96 Q210 96 210 104 Q210 112 190 112",COL.steel,6)+P("M48 92 Q52 170 120 170 Q188 170 192 92 Z",COL.steel)+E(120,92,72,14,"#8f99a6")+[[80,116],[100,120],[120,122],[140,120],[160,116],[90,138],[110,142],[130,142],[150,138],[105,158],[135,158]].map(([x,y])=>D(x,y,3.5)).join(""),ex:"Dozens of holes plus two handle loops — way past 5."},
{lv:4,name:"Tennis racket",sub:"strung",g:5,svg:`<defs><clipPath id="rk"><ellipse cx="120" cy="72" rx="48" ry="58"/></clipPath></defs>`+`<g clip-path="url(#rk)">${Array.from({length:9},(_,i)=>L(`M${80+i*10} 10 V140`,1.2,.6)).join("")}${Array.from({length:11},(_,i)=>L(`M60 ${22+i*10} H180`,1.2,.6)).join("")}</g>`+TE(120,72,52,62,COL.coral,8)+T("M100 128 L114 150 M140 128 L126 150",COL.coral,6)+R(112,148,16,46,5,COL.dark),ex:"Every gap between strings is a hole — about a hundred."},
{lv:4,name:"Hollow practice ball",sub:"7 slots",g:5,svg:C(120,100,72,COL.paper)+[[100,58],[140,58],[78,96],[120,96],[162,96],[100,136],[140,136],[120,170]].slice(0,7).map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="13" ry="7" fill="${INK}" opacity=".8"/>`).join(""),ex:"A hollow shell with 7 openings: genus 6."},
{lv:4,name:"Recorder",g:5,svg:`<g transform="rotate(-12 120 100)">${R(108,20,26,170,8,"#f4ead7")}${R(106,20,30,26,6,"#f4ead7")}${D(121,32,7,3)}${[66,82,98,114,130,146,162].map(y=>D(121,y,4)).join("")}${E(121,190,13,4,"#f4ead7")}</g>`,ex:"A tube (1) plus 7 front holes and a thumb hole, each opening into it — genus well over 5."},
{lv:4,name:"Glove",sub:"with a hole in one fingertip",g:1,svg:glove(true),ex:"Now there are two openings — wrist and fingertip — so it's a tube. Torus!"},
{lv:4,name:"Sock",sub:"with a hole in the toe",g:1,svg:sock(true),ex:"Two openings make it a tube: genus 1."},
{lv:4,name:"T-shirt",sub:"with a hole in it",g:4,svg:tshirt(true),ex:"Four openings plus the hole = 5 openings → genus 4."},
{lv:4,name:"Mug",sub:"hole drilled in the bottom",g:2,svg:mug({drilled:true}),ex:"The cup becomes a tunnel (1), plus the handle (1) = 2."},
{lv:4,name:"Knotted ring",sub:"a closed loop tied in a knot",g:1,svg:trefoil(),ex:"Knotting changes how it sits in space, not the surface itself: still a torus."},
{lv:4,name:"Ladder",sub:"5 rungs",g:4,svg:ladder(5),ex:"Four enclosed windows between five rungs."},
{lv:4,name:"Bicycle wheel",sub:"8 spokes",g:5,svg:TE(120,100,72,72,COL.dark,8)+Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return L(`M120 100 L${(120+70*Math.cos(a)).toFixed(1)} ${(100+70*Math.sin(a)).toFixed(1)}`,2.5)}).join("")+C(120,100,10,COL.steel),ex:"Each spoke closes a new loop with the rim: genus 8."},
{lv:4,name:"Sneaker",sub:"6 eyelets, no laces",g:5,svg:P("M30 150 Q28 110 52 100 L100 70 Q120 60 136 74 Q158 96 196 108 Q216 114 214 140 V160 H30 Z",COL.paper)+R(30,148,186,18,6,COL.coral)+[[104,80],[114,88],[124,96],[134,104],[144,110],[154,116]].map(([x,y])=>H(x,y,3.5)).join(""),ex:"The ankle opening plus 6 eyelets = 7 openings into the shoe → genus 6."},
{lv:4,name:"Donut with a bite out",g:0,svg:donut()+`<g fill="${BG}" ${S}><circle cx="160" cy="98" r="24"/><circle cx="178" cy="122" r="22"/><circle cx="180" cy="76" r="20"/><circle cx="194" cy="100" r="18"/></g><g fill="${BG}"><circle cx="160" cy="98" r="22.5"/><circle cx="178" cy="122" r="20.5"/><circle cx="180" cy="76" r="18.5"/><circle cx="194" cy="100" r="16.5"/></g>`,ex:"The bite cuts the ring open — now it's a bent sausage. Sphere."},
{lv:4,name:"Half a bagel",sub:"sliced horizontally",g:1,svg:bagel(true),ex:"Slicing a bagel flat leaves the hole in each half. Still a torus."},
{lv:4,name:"Open cuff bracelet",g:0,svg:T("M151 155 A62 52 0 1 0 89 155",COL.gold,12),ex:"The gap breaks the loop. Sphere."},
{lv:4,name:"Pretzel",sub:"one arm broken",g:2,svg:pretzel(true),ex:"The broken arm no longer separates two windows: genus 2."},
{lv:4,name:"Mug",sub:"handle snapped",g:0,svg:mug({handle:"broken"}),ex:"No loop left — just two stubs. Sphere."},
{lv:4,name:"Möbius strip",sub:"thick paper, one half-twist",g:1,svg:T("M50 100 C50 40 110 40 120 100 C130 160 190 160 190 100 C190 40 130 40 120 100 C110 160 50 160 50 100",COL.paper,16),ex:"Thickened, a Möbius band is a solid ring — its outer surface is a torus."},
{lv:4,name:"Fidget spinner",g:4,svg:U(crc(120,100,26)+crc(120,46,28)+crc(73,127,28)+crc(167,127,28)+pth("M120 46 L73 127 L167 127 Z"),COL.blue)+H(120,46,15)+H(73,127,15)+H(167,127,15)+H(120,100,11),ex:"Three outer holes plus the bearing hole: genus 4."},
{lv:4,name:"Wire cube",sub:"just the 12 edges",g:5,svg:T("M90 40 H180 V130 M90 40 V130 H180",COL.steel,4)+T("M60 70 L90 40 M150 70 L180 40 M150 160 L180 130 M60 160 L90 130",COL.steel,4)+T("M60 70 H150 V160 H60 Z",COL.steel,4),ex:"Edges − corners + 1 = 12 − 8 + 1 = 5 loops."},
{lv:4,name:"Trousers",sub:"one leg sewn shut",g:1,svg:trousers(true),ex:"Only two openings left (waist and one leg): a tube → torus."},
];

// ---------- themed packs (objects are added by packs/*.js) ----------
const PACKS = {
  kitchen:       {n:"Kitchen",          d:"Pots, pasta and things in the drawer."},
  clothing:      {n:"Clothing",         d:"What you wear, counted properly."},
  tools:         {n:"Tools",            d:"Workshop, hardware and the garden shed."},
  letters:       {n:"Letters & digits", d:"Latin and Armenian, cut out of card."},
  controversies: {n:"Controversies",    d:"The ones people argue about."},
};
