// Mugnut pack: controversies. Appends to OBJECTS (see objects.js for the object format and the drawing helpers).
// Every entry needs pack:"controversies", and hole marks (holes / open) that add up to its answer.
{
const WHITE = "#ffffff", SHADE = "#d9dee6";
const ring = (r, op=.3, c=INK, w=2) => `<circle cx="120" cy="100" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${op}"/>`;
const shine = (cx,cy,rx,ry,rot,op=.4) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const dash = (d, c="#fff", op=.75, w=2, pat="4 4") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${op}" stroke-dasharray="${pat}" stroke-linecap="round"/>`;
const rag = (d, f) => `<path d="${d}" fill="${f}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
const BALLOON = "M120 20 C164 20 186 56 182 90 C178 124 146 146 128 154 H112 C94 146 62 124 58 90 C54 56 76 20 120 20 Z";
const balloonTied = () => P(BALLOON, COL.red) + shine(92,56,10,20,25) +
  P("M114 164 L107 182 Q120 176 133 182 L126 164 Z", COL.red) + E(120,160,9,7,"#a8392f");
const balloonOpen = () => `<g transform="rotate(-38 120 96)">` + P("M111 150 L109 180 H131 L129 150 Z", COL.blue) + P(BALLOON, COL.blue) +
  P("M112 154 H128", COL.blue, 'stroke="none"') + R(112,150,16,8,0,COL.blue,'stroke="none"') + shine(92,56,10,20,25) +
  E(120,181,14,6.5,"#5f86bb") + D(120,181,9,3.5) + `</g>`;
const hollowBall = holes => C(120,100,74,COL.green) + shine(98,50,20,9,-25,.35) +
  holes.map(([x,y,rx,ry,dx]) => E(x,y,rx,ry,"#6f9a88") + `<ellipse cx="${x+dx}" cy="${y+1}" rx="${rx-4-Math.abs(dx)}" ry="${ry-4}" fill="#24453b"/>`).join("");
const straw = () => `<defs><pattern id="ctvStripes" width="22" height="30" patternUnits="userSpaceOnUse"><rect width="11" height="30" fill="#fffdf8"/><rect x="11" width="11" height="30" fill="#7aa2d6"/></pattern></defs>` +
  `<g transform="rotate(-24 120 100)">${P("M24 87 H214 V113 H24 A7 13 0 0 1 24 87 Z","url(#ctvStripes)")}${E(214,100,7,13,COL.paper)}${D(214,100,4,9)}${D(118,96,6,4)}</g>`;
const jeans = () => P("M74 26 H166 L184 182 H134 L120 84 L106 182 H56 Z", "#5a7bb5") + L("M76 40 H164") + L("M120 40 V84",1.5,.5) +
  L("M84 40 Q86 58 104 58 M156 40 Q154 58 136 58",1.5,.5) + C(120,33,2.5,COL.gold) +
  L("M58 172 H105 M135 172 H183",1.5,.4) +
  rag("M134 116 L141 111 L148 114 L156 110 L164 113 L170 119 L168 127 L171 133 L163 138 L154 136 L146 140 L138 136 L135 128 L132 122 Z", "#26334f") +
  L("M136 119 H147 M158 117 H169 M137 131 H146 M160 132 H169",1.6,.95,"#fff");
const PORES = [[66,74,8,6],[98,60,6,5],[130,66,10,7],[166,62,6,5],[188,84,7,6],[52,104,6,7],[84,100,10,8],[118,96,6,5],[150,98,9,7],[182,116,7,6],[66,136,8,6],[100,132,7,6],[132,128,10,7],[164,140,7,5],[112,154,6,4]];
const sponge = () => P("M52 52 Q84 36 118 46 Q150 34 186 50 Q210 66 204 100 Q212 136 188 154 Q152 172 118 162 Q82 174 52 156 Q28 134 36 102 Q28 68 52 52 Z", COL.yellow) +
  PORES.map(([x,y,a,b]) => `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="#6b4a12" stroke="${INK}" stroke-width="1.5"/>`).join("") +
  [[84,82],[146,82],[112,116],[172,100],[82,120],[150,150],[60,90],[140,112]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#b98a1e"/>`).join("");
const binoculars = () => R(104,82,32,36,0,"#a9835a") + [70,170].map(x => C(x,100,48,COL.kraft) + H(x,100,36) + `<circle cx="${x}" cy="100" r="42" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".3"/>`).join("");
const bowling = () => C(120,100,78,COL.navy) + shine(84,52,20,10,-35,.15) +
  dash("M97 73 L113 91 M105 67 L120 85 M135 67 L120 85 M143 73 L127 91 M114 140 V107 M126 140 V107", "#fff", .7, 1.8, "3.5 3.5") +
  `<circle cx="120" cy="97" r="9" fill="#1b2440" stroke="#fff" stroke-width="1.8" stroke-dasharray="3.5 3.5" opacity=".85"/>` +
  [[94,62],[146,62],[120,150]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#0d1224" stroke="#8fa0c8" stroke-width="2"/>`).join("");
const wornSock = () => P("M95 34 H145 V120 Q145 150 172 155 Q202 160 196 182 H112 Q88 182 95 150 Z", COL.green) +
  P("M95 34 H145 V52 H95 Z", "#6fa190") + L("M105 38 V50 M115 38 V50 M125 38 V50 M135 38 V50",1.5,.4) +
  E(120,34,25,6,"#6fa190") + D(120,34,20,3.5) +
  rag("M100 154 L107 150 L114 154 L119 161 L117 168 L120 174 L112 178 L104 176 L100 169 L98 162 Z", "#24453b") +
  rag("M178 165 L185 160 L192 163 L196 170 L193 177 L186 179 L180 176 L177 170 Z", "#24453b");
const GB = "#c98b4a";
const person = pierced => U(crc(120,50,34) + (pierced ? crc(86,54,10) + crc(154,54,10) : "") + rct(94,78,52,66,18) +
    rct(36,86,70,22,11,'transform="rotate(-12 100 97)"') + rct(134,86,70,22,11,'transform="rotate(12 140 97)"') +
    rct(88,122,24,64,12,'transform="rotate(16 100 126)"') + rct(128,122,24,64,12,'transform="rotate(-16 140 126)"'), GB) +
  L("M46 100 q4 -5 8 0 t8 0 M178 100 q4 5 8 0 t8 0 M74 168 q5 -5 10 0 t10 0 M146 168 q5 -5 10 0 t10 0",2.5,.95,"#fff") +
  dash("M120 76 V143", INK, .55, 2, "4 4") + dash("M115 53 V62 M125 53 V62", INK, .55, 1.6, "2.5 2.5") +
  `<path d="M120 30 Q125 30 128 42 Q134 46 132 52 Q130 56 120 56 Q110 56 108 52 Q106 46 112 42 Q115 30 120 30 Z" fill="#b5773a"/>` +
  `<circle cx="115" cy="50" r="2.4" fill="${INK}"/><circle cx="125" cy="50" r="2.4" fill="${INK}"/>` +
  `<path d="M106 62 H134 Q132 78 120 78 Q108 78 106 62 Z" fill="#3a1f14" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
  (pierced ? L("M150 50 Q156 46 158 53",1.5,.4) + L("M90 50 Q84 46 82 53",1.5,.4) + `<circle cx="155" cy="59" r="2.6" fill="${BG}" stroke="${INK}" stroke-width="1.6"/>` : "");

OBJECTS.push(...[
{pack:"controversies", lv:1, name:"Solid mint", sub:"no hole in the middle", g:0, svg:C(120,100,72,WHITE)+ring(60,.25)+`<ellipse cx="120" cy="100" rx="26" ry="26" fill="${SHADE}"/><path d="M96 92 A26 26 0 0 1 138 81" fill="none" stroke="${INK}" stroke-width="2" opacity=".3" stroke-linecap="round"/><ellipse cx="124" cy="104" rx="18" ry="18" fill="#eef1f5"/>`, ex:"No hole at all: the stamped dimple on each face is only a dent.", holes:[]},
{pack:"controversies", lv:1, name:"Ring mint", sub:"hole through the middle", g:1, svg:C(120,100,72,WHITE)+ring(60,.25)+H(120,100,27)+ring(34,.2), ex:"One hole through the middle: a ring mint is a tiny sugar donut.", holes:[[120,100,31]]},
{pack:"controversies", lv:1, name:"Vinyl record", sub:"one spindle hole", g:1, svg:C(120,100,84,"#262630")+[76,68,60,52,44].map(r=>ring(r,.28,"#fff",1.2)).join("")+shine(120,100,80,10,-40,.07)+C(120,100,30,COL.coral)+ring(22,.3,INK,1.5)+H(120,100,5), ex:"The groove is just a long scratch: only the spindle hole in the middle goes through.", holes:[[120,100,10]]},
{pack:"controversies", lv:1, name:"Sewing needle", sub:"one eye", g:1, svg:`<g transform="rotate(-32 120 100)">${P("M6 100 L60 94 L150 91 L192 87 Q222 87 222 100 Q222 113 192 113 L150 109 L60 106 Z",COL.metal)}${L("M50 98 L150 95",1.5,.7,"#fff")}${R(172,95,36,10,5,BG)}</g>`, ex:"A solid spike with one eye for the thread: one hole.", holes:[[179,63,24]]},
{pack:"controversies", lv:2, name:"Balloon", sub:"inflated and tied shut", g:0, svg:balloonTied(), ex:"Tied shut, nothing goes through it: the knot is a lump, not a loop. No holes.", holes:[]},
{pack:"controversies", lv:2, name:"Balloon", sub:"inflated, neck held open", g:0, svg:balloonOpen(), ex:"One opening leads into a dead end, so the inside is one big dent. No holes.", holes:[], open:[[172,163,16]]},
{pack:"controversies", lv:2, name:"Hollow ball", sub:"with 1 hole", g:0, svg:hollowBall([[136,96,27,25,2]]), ex:"One opening into a hollow is only a deep dent: zero holes, like a bowl.", holes:[], open:[[136,96,31]]},
{pack:"controversies", lv:3, name:"Hollow ball", sub:"with 2 holes", g:1, svg:hollowBall([[76,100,15,27,2],[164,100,15,27,-2]]), ex:"In one hole, out the other: two openings make one tunnel, not two holes.", open:[[76,100,30],[164,100,30]]},
{pack:"controversies", lv:3, name:"Drinking straw", sub:"with one pinhole in its side", g:2, svg:straw(), ex:"Three openings into one tube (two ends and the pinhole) make two holes, not three.", open:[[206,62,16],[30,140,16],[116,96,8]]},
{pack:"controversies", lv:3, name:"Jeans", sub:"one ripped knee", g:3, svg:jeans(), ex:"Waist, two leg ends and the rip: four openings, so three holes.", open:[[120,28,20],[81,178,20],[159,178,20],[152,125,24]]},
{pack:"controversies", lv:3, name:"Bath sponge", sub:"natural, full of pores", g:5, svg:sponge(), ex:"The pores join up inside into a maze of tunnels: far more than five holes.", open:PORES.map(([x,y,a])=>[x,y,a+4])},
{pack:"controversies", lv:2, name:"Toy binoculars", sub:"two empty tubes, no lenses", g:2, svg:binoculars(), ex:"Two see-through tubes joined side by side: one hole each, two in all.", holes:[[70,100,40],[170,100,40]]},
{pack:"controversies", lv:4, name:"Bowling ball", sub:"holes drilled to meet inside", g:2, svg:bowling(), ex:"Now the three finger holes join up inside: three openings, so two holes.", open:[[94,62,15],[146,62,15],[120,150,15]]},
{pack:"controversies", lv:4, name:"Sock", sub:"worn through at heel and toe", g:2, svg:wornSock(), ex:"Cuff, heel and toe: three openings into one sock, so two holes.", open:[[120,34,28],[106,167,14],[188,171,13]]},
{pack:"controversies", lv:4, name:"Person", sub:"mouth, two nostrils, one exit", g:3, svg:person(false), ex:"One food tunnel with four openings (mouth, two nostrils, exit): three holes.", open:[[120,69,17],[115,50,4.5],[125,50,4.5],[120,146,8]]},
{pack:"controversies", lv:4, name:"Person", sub:"mouth, 2 nostrils, exit, 1 ear piercing", g:4, svg:person(true), ex:"Three holes from the food tunnel and nostrils, plus one through the earlobe: four.", open:[[120,69,17],[115,50,4.5],[125,50,4.5],[120,146,8]], holes:[[155,59,6]]},
{pack:"controversies", lv:1, name:"Breeze block", sub:"two hollow cores, open top and bottom", g:2, svg:R(20,38,200,124,6,"#bcc0c6")+R(38,56,74,88,9,"#8b9098")+R(128,56,74,88,9,"#8b9098")+R(38,72,74,72,9,BG)+R(128,72,74,72,9,BG)+[[28,48],[116,52],[212,60],[30,110],[120,96],[210,128],[60,152],[150,153],[120,140],[90,47],[180,48]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.5" fill="${INK}" opacity=".35"/>`).join(""), ex:"Each of the two cores runs right through from top to bottom: two.", holes:[[75,106,40],[165,106,40]]},
{pack:"controversies", lv:4, name:"Jack-o'-lantern", sub:"lid back on, two eyes, nose, mouth", g:3, svg:E(120,112,94,74,"#e8852e")+L("M120 38 V186 M90 42 Q52 112 90 182 M150 42 Q188 112 150 182 M62 54 Q14 112 62 170 M178 54 Q226 112 178 170",2,.3)+P("M108 46 Q110 24 126 14 L138 24 Q130 34 132 46 Q120 52 108 46 Z","#5f8a4e")+["M68 92 L86 64 L104 92 Z","M136 92 L154 64 L172 92 Z","M111 112 L120 97 L129 112 Z","M78 130 L90 138 L99 128 L109 140 L120 130 L131 140 L141 128 L150 138 L162 130 Q158 164 131 170 L129 158 H111 L109 170 Q82 164 78 130 Z"].map(d=>P(d,"#2b1c14")).join(""), ex:"Four cut-outs open into one hollow, so it is 4 − 1 = 3.", open:[[86,82,20],[154,82,20],[120,105,10],[120,150,40]]},
{pack:"controversies", lv:2, name:"Surgical mask", sub:"two ear loops", g:2, svg:["M66 58 C4 44 4 156 66 142","M174 58 C236 44 236 156 174 142"].map(d=>L(d,6.5)+L(d,3,1,"#fff")).join("")+R(60,48,120,104,6,"#a9d0e8")+L("M60 74 H180 M60 100 H180 M60 126 H180",1.8,.4)+L("M92 57 H148",3,.6,"#fff"), ex:"The mask itself is a solid sheet; each ear loop makes one hole: two.", holes:[[40,100,22],[200,100,22]]},
]);
}
