import { LEVELS, AMBIENT, SPOT_INNER, TINT_K } from "./model";

/** Max lights per pass; uniform arrays are sized by this and the active count is passed in. */
export const MAX_LIGHTS = 48;
/** Max shadow-ray steps per fragment per light (a compile-time loop bound). */
export const MAX_STEPS = 24;
/** Reach of the tint a coloured light adds on top of the brightness, as in the old baked look. */
export const TINT = TINT_K;

export const VERTEX = `#version 300 es
in vec2 aPosition; out vec2 vTextureCoord;
uniform vec4 uInputSize; uniform vec4 uOutputFrame; uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;

const lv = LEVELS.map((v) => v.toFixed(2)).join(", ");

/** Mirrors model.ts (falloff, castLight for point and spot, quantize) so the CPU reference stays the oracle. */
export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vTextureCoord; out vec4 finalColor;
uniform sampler2D uTexture; uniform sampler2D uMask; uniform sampler2D uEmis;
uniform vec4 uInputSize; uniform vec4 uOutputFrame;
uniform vec4 uView;        // screen x, y of tile (0,0) in filter pixels; px per tile; softness 0..1
uniform vec4 uMap;         // map width, height in tiles; light count; shadow steps
uniform vec4 uLights[${MAX_LIGHTS}];   // x, y, r, intensity
uniform vec4 uColors[${MAX_LIGHTS}];   // r, g, b (0..1), kind (0 point, 1 spot)
uniform vec4 uAim[${MAX_LIGHTS}];      // dir, cone, fade (0..1), unused
const float LEVELS[6] = float[6](${lv});
const float AMBIENT = ${AMBIENT.toFixed(2)};
const float SPOT_INNER = ${SPOT_INNER.toFixed(2)};
const float TINT = ${TINT.toFixed(2)};

// how much of the light a tile stops: 1 for walls, 0 for floor, in between for a door that is part open
float opacityAt(vec2 c) {
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uMap.x || c.y >= uMap.y) return 0.0;
  return texture(uMask, (c + 0.5) / uMap.xy).r;
}
// share of light that gets from lp to p (the end cells are skipped, as in the CPU model)
float lit(vec2 p, vec2 lp) {
  float through = 1.0;
  vec2 d = lp - p; float len = length(d);
  vec2 cs = floor(p), ce = floor(lp);
  int n = int(min(max(len * 2.0, 1.0), uMap.w));
  for (int s = 1; s < ${MAX_STEPS}; s++) {
    if (s >= n) break;
    vec2 c = floor(p + d * (float(s) / float(n)));
    if (c == cs || c == ce) continue;
    through *= 1.0 - opacityAt(c);
    if (through < 0.02) return 0.0;
  }
  return through;
}
float quant(float v, float soft) {
  if (v <= LEVELS[0]) return LEVELS[0];
  if (v >= LEVELS[5]) return LEVELS[5];
  int k = 0;
  for (int i = 1; i < 5; i++) if (v >= LEVELS[i]) k = i;
  float lo = LEVELS[k], hi = LEVELS[k + 1];
  float edge = (lo + hi) * 0.5, width = soft * (hi - lo) * 0.5;
  if (width <= 0.0) return v < edge ? lo : hi;
  float t = clamp((v - edge) / (2.0 * width) + 0.5, 0.0, 1.0);
  return lo + (hi - lo) * t;
}
void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  if (base.a <= 0.0) { finalColor = base; return; }
  vec2 px = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 p = (px - uView.xy) / uView.z;
  float L = AMBIENT; vec3 tint = vec3(0.0);
  int count = int(uMap.z);
  for (int j = 0; j < ${MAX_LIGHTS}; j++) {
    if (j >= count) break;
    vec4 l = uLights[j]; vec2 d = p - l.xy; float dist = length(d);
    if (dist >= l.z) continue;
    float t = 1.0 - dist / l.z, f = t * t * l.w * uAim[j].z;
    if (uColors[j].w > 0.5 && dist > 0.0) {
      float half_ = uAim[j].y * 0.5;
      float da = abs(atan(d.y, d.x) - uAim[j].x); da = mod(da, 6.2831853); if (da > 3.1415927) da = 6.2831853 - da;
      if (da >= half_) continue;
      float u = clamp((da - half_ * SPOT_INNER) / (half_ * (1.0 - SPOT_INNER)), 0.0, 1.0);
      f *= 1.0 - u * u * (3.0 - 2.0 * u);
    }
    f *= lit(p, l.xy);
    L += f; tint += uColors[j].rgb * f;
  }
  float emissive = texture(uEmis, p / uMap.xy).r;
  vec3 col = emissive > 0.5 ? base.rgb : min(base.rgb * quant(L, uView.w) + tint * TINT * base.a, 1.0);
  finalColor = vec4(col, base.a);
}`;
