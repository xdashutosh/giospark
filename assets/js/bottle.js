/*!
 * GIO Spark — 3D bottle stage
 * Builds PET bottles (200 ml / 500 ml / 1 L) with Three.js and exposes plain
 * state objects (shared / intro / per-bottle offsets) that GSAP timelines drive.
 */
(function (global) {
  'use strict';

  var THREE = global.THREE;
  var TAU = Math.PI * 2;

  var NECK_R = 0.245;
  var CAP_R = 0.3;
  var CAP_H = 0.36;
  var LABEL_GAP = 0.006;
  var WALL = 0.022;

  // Square PET bottles (as on the GIO Spark posters): rounded-square body with an
  // embossed tile grid, chamfered shoulder, royal-blue cap and a portrait front label.
  // 1 unit ≈ 5 cm. A = half-width of the body; label = [bottom, top] in units.
  var SPECS = {
    '200': {
      id: '200', size: '200', unit: 'ml', name: '200 ml', qty: '200 ml.',
      H: 2.8, A: 0.46, shoulder: 0.42, label: [0.22, 1.86], labelW: 0.6, cellH: 0.165, cols: 20,
      heroScale: 0.8
    },
    '500': {
      id: '500', size: '500', unit: 'ml', name: '500 ml', qty: '500 ml.',
      H: 4.2, A: 0.6, shoulder: 0.7, label: [0.3, 2.95], labelW: 0.8, cellH: 0.19, cols: 24,
      heroScale: 0.9
    },
    '1000': {
      id: '1000', size: '1', unit: 'litre', name: '1 litre', qty: '1 Ltr.',
      H: 5.3, A: 0.78, shoulder: 0.95, label: [0.4, 3.78], labelW: 1.02, cellH: 0.22, cols: 28,
      heroScale: 0.95
    }
  };

  /* ------------------------------------------------------------------ */
  /* Geometry                                                             */
  /* ------------------------------------------------------------------ */

  function smooth01(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  // distance from the axis to a rounded square ("squircle") of half-width a, exponent n
  function squircleR(th, a, n) {
    var c = Math.abs(Math.cos(th));
    var s = Math.abs(Math.sin(th));
    return a / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
  }

  function makeShape(s) {
    var capBase = s.H - CAP_H;
    var yRing = capBase - 0.035;
    var yNeck = yRing - 0.075;
    var ySB = yNeck - s.shoulder;
    var shape = { capBase: capBase, yRing: yRing, yNeck: yNeck, ySB: ySB, top: s.H };

    // half-width of the cross-section at height y (before the grid relief)
    shape.size = function (y) {
      if (y < 0.12) return s.A * (0.9 + 0.1 * Math.sin((Math.max(0, y) / 0.12) * Math.PI / 2));
      if (y <= ySB) return s.A;
      if (y >= yNeck) return NECK_R;
      var t = (y - ySB) / s.shoulder;
      return s.A + (NECK_R - s.A) * (0.6 * t + 0.4 * smooth01(t));
    };
    // squareness: 5 = rounded-square body, 2 = round neck
    shape.expo = function (y) {
      if (y <= ySB) return 5;
      if (y >= yNeck) return 2;
      return 5 - 3 * Math.pow((y - ySB) / s.shoulder, 0.85);
    };
    shape.radiusAt = shape.size;
    shape.fillMin = 0.1;
    shape.fillMax = yNeck + 0.04;
    return shape;
  }

  function gridGroove(d, w) {
    return d >= w ? 0 : 1 - smooth01(d / w);
  }

  // indexed ring mesh; rings = [[y, halfWidth, exponent, relief], ...]
  function ringMesh(rings, segs, spec, relief, bottomY, topCap) {
    var nr = rings.length;
    var extra = (bottomY !== null ? 1 : 0) + (topCap ? 1 : 0);
    var pos = new Float32Array((nr * segs + extra) * 3);
    var p = 0;
    var gw = 0.024;
    var depth = 0.016;
    for (var i = 0; i < nr; i++) {
      var ry = rings[i][0], a = rings[i][1], n = rings[i][2];
      var useRelief = relief && rings[i][3];
      var dy = 0;
      if (useRelief) {
        var fy = ry / spec.cellH;
        dy = Math.abs(fy - Math.round(fy)) * spec.cellH;
      }
      for (var j = 0; j < segs; j++) {
        var th = (j / segs) * TAU;
        var r = squircleR(th, a, n);
        if (useRelief) {
          var fx = (j / segs) * spec.cols;
          var dx = Math.abs(fx - Math.round(fx)) * (TAU * a / spec.cols);
          r -= depth * Math.max(gridGroove(dy, gw), gridGroove(dx, gw));
        }
        pos[p++] = r * Math.sin(th); pos[p++] = ry; pos[p++] = r * Math.cos(th);
      }
    }
    var idx = [];
    for (var i2 = 0; i2 < nr - 1; i2++) {
      for (var j2 = 0; j2 < segs; j2++) {
        var a0 = i2 * segs + j2, b0 = i2 * segs + (j2 + 1) % segs;
        idx.push(a0, b0, b0 + segs, a0, b0 + segs, a0 + segs);
      }
    }
    var next = nr * segs;
    if (bottomY !== null) {
      pos[p++] = 0; pos[p++] = bottomY; pos[p++] = 0;
      for (var j3 = 0; j3 < segs; j3++) idx.push(next, (j3 + 1) % segs, j3);
      next++;
    }
    if (topCap) {
      var last = (nr - 1) * segs;
      pos[p++] = 0; pos[p++] = rings[nr - 1][0]; pos[p++] = 0;
      for (var j4 = 0; j4 < segs; j4++) idx.push(next, last + j4, last + (j4 + 1) % segs);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function makeShell(shape, spec, mobile) {
    var rings = [];
    var R = function (y, a, n, relief) { rings.push([y, a, n, relief]); };
    [0, 0.012, 0.03, 0.055, 0.085, 0.12].forEach(function (y) { R(y, shape.size(y), 5, 0); });
    var step = mobile ? 0.022 : 0.015;
    for (var y = 0.14; y < shape.yNeck - 0.02; y += step) {
      R(y, shape.size(y), shape.expo(y), y < shape.yNeck - 0.12 ? 1 : 0);
    }
    // neck, support ring, thread finish and inner lip
    R(shape.yNeck, NECK_R, 2, 0);
    R(shape.yRing - 0.012, NECK_R, 2, 0);
    R(shape.yRing - 0.004, NECK_R + 0.05, 2, 0);
    R(shape.yRing + 0.01, NECK_R + 0.06, 2, 0);
    R(shape.yRing + 0.024, NECK_R + 0.052, 2, 0);
    R(shape.yRing + 0.03, NECK_R + 0.004, 2, 0);
    R(spec.H - 0.03, NECK_R, 2, 0);
    R(spec.H - 0.012, NECK_R - 0.012, 2, 0);
    R(spec.H - 0.012, NECK_R - 0.032, 2, 0);
    R(spec.H - 0.22, NECK_R - 0.034, 2, 0);
    return ringMesh(rings, mobile ? 176 : 232, spec, true, 0.07, false);
  }

  function makeWater(shape, spec, mobile) {
    var rings = [];
    var top = shape.yNeck + 0.08;
    for (var y = 0.1; y < top; y += (y > shape.ySB - 0.05 ? 0.03 : 0.08)) {
      rings.push([y, Math.max(0.03, shape.size(y) - WALL), shape.expo(y), 0]);
    }
    rings.push([top, NECK_R - WALL, 2, 0]);
    return ringMesh(rings, mobile ? 72 : 112, spec, false, 0.1, true);
  }

  // water surface: a disc whose rim follows the bottle's cross-section at the fill height
  function makeDisc(segs) {
    var pos = new Float32Array((segs + 1) * 3);
    var nrm = new Float32Array((segs + 1) * 3);
    var uv = new Float32Array((segs + 1) * 2);
    var idx = [];
    uv[0] = 0.5; uv[1] = 0.5;
    for (var j = 0; j <= segs; j++) nrm[j * 3 + 1] = 1;
    for (var k = 0; k < segs; k++) {
      var th = (k / segs) * TAU;
      uv[(k + 1) * 2] = 0.5 + 0.5 * Math.sin(th);
      uv[(k + 1) * 2 + 1] = 0.5 + 0.5 * Math.cos(th);
      idx.push(0, 1 + k, 1 + (k + 1) % segs);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }

  function updateDisc(geo, a, n) {
    var pos = geo.attributes.position;
    var segs = pos.count - 1;
    for (var k = 0; k < segs; k++) {
      var th = (k / segs) * TAU;
      var r = squircleR(th, a, n);
      pos.setXYZ(k + 1, r * Math.sin(th), 0, r * Math.cos(th));
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  // front label panel that hugs the flat front face of the body
  function makeLabelGeometry(shape, spec) {
    var cols = 40, rows = 8;
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= rows; i++) {
      var v = i / rows;
      var y = spec.label[0] + (spec.label[1] - spec.label[0]) * v;
      var a = shape.size(y), n = shape.expo(y);
      for (var j = 0; j <= cols; j++) {
        var u = j / cols;
        var th = Math.atan2((u - 0.5) * spec.labelW, a);
        var r = squircleR(th, a, n) + LABEL_GAP;
        pos.push(r * Math.sin(th), y, r * Math.cos(th));
        uv.push(u, v);
      }
    }
    for (var i2 = 0; i2 < rows; i2++) {
      for (var j2 = 0; j2 < cols; j2++) {
        var a0 = i2 * (cols + 1) + j2, b0 = a0 + 1, c0 = a0 + cols + 1, d0 = c0 + 1;
        idx.push(a0, b0, d0, a0, d0, c0);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function makeCapGeometry() {
    var pts = [];
    function P(r, y) { pts.push(new THREE.Vector2(r, y)); }
    P(0.001, CAP_H); P(CAP_R - 0.045, CAP_H); P(CAP_R - 0.014, CAP_H - 0.007); P(CAP_R, CAP_H - 0.032);
    var knurlTop = CAP_H - 0.045, knurlBottom = 0.112;
    for (var i = 0; i <= 6; i++) P(CAP_R, knurlTop - (knurlTop - knurlBottom) * (i / 6));
    P(CAP_R, 0.1); P(CAP_R - 0.014, 0.088); P(CAP_R - 0.014, 0.072); P(CAP_R + 0.002, 0.062);
    P(CAP_R + 0.002, 0.006); P(CAP_R - 0.01, 0); P(NECK_R + 0.02, 0); P(NECK_R + 0.02, 0.06);

    var geo = new THREE.LatheGeometry(pts, 200);
    var pos = geo.attributes.position;
    for (var v = 0; v < pos.count; v++) {
      var x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      var r = Math.sqrt(x * x + z * z);
      if (y > knurlBottom + 0.004 && y < knurlTop - 0.004 && r > CAP_R - 0.002) {
        var phi = Math.atan2(x, z);
        var bump = 0.012 * Math.pow(Math.abs(Math.cos(phi * 30)), 0.8);
        var k = (CAP_R + bump) / r;
        pos.setX(v, x * k); pos.setZ(v, z * k);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  /* ------------------------------------------------------------------ */
  /* Shaders                                                              */
  /* ------------------------------------------------------------------ */

  var SURFACE_VERT = [
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP; varying vec2 vUv;',
    'void main() {',
    '  vLP = position; vUv = uv;',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWP = wp.xyz;',
    '  vWN = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  // Clear PET: tinted see-through shell, fresnel edges, procedural studio softboxes.
  var GLASS_FRAG = [
    'uniform vec3 uTint; uniform float uAlpha; uniform float uEdge; uniform float uSpec;',
    'uniform float uUvY; uniform float uUvAmt; uniform vec3 uUvColor;',
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP;',
    'float band(float x, float c, float w, float s) { return 1.0 - smoothstep(w, w + s, abs(x - c)); }',
    'float studio(vec3 R) {',
    '  float az = atan(R.x, R.z);',
    '  float el = R.y;',
    '  float v = smoothstep(0.98, 0.5, abs(el));',
    '  float k = 0.0;',
    '  k += 3.4 * band(az, -1.02, 0.06, 0.12) * v;',
    '  k += 2.4 * band(az, 1.22, 0.035, 0.07) * v;',
    '  k += 1.2 * band(az, 0.4, 0.012, 0.04) * v;',
    '  k += 1.6 * smoothstep(0.5, 0.95, el);',
    '  k += 0.5 * smoothstep(-0.25, -0.95, el);',
    '  return k;',
    '}',
    'void main() {',
    '  vec3 N = normalize(vWN);',
    '  if (!gl_FrontFacing) N = -N;',
    '  vec3 V = normalize(cameraPosition - vWP);',
    '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
    '  float F = 0.1 + 0.9 * pow(1.0 - ndv, 4.0);',
    '  vec3 R = reflect(-V, N);',
    '  float hl = clamp(studio(R) * F * uSpec, 0.0, 1.0);',
    '  float edge = pow(1.0 - ndv, 2.4) * uEdge;',
    '  float uvb = exp(-pow((vLP.y - uUvY) / 0.18, 2.0)) * uUvAmt;',
    '  vec3 col = mix(uTint, uUvColor, clamp(uvb * 1.6, 0.0, 1.0));',
    '  float a = uAlpha + edge + uvb * 0.75;',
    '  col = mix(col, vec3(1.0), hl);',
    '  a = clamp(a + hl, 0.0, 1.0);',
    '  gl_FragColor = linearToOutputTexel(vec4(col, a));',
    '}'
  ].join('\n');

  var WATER_FRAG = [
    'uniform vec3 uWater; uniform vec3 uDeep; uniform float uAlpha; uniform float uFillY; uniform float uTop; uniform float uTime;',
    'uniform float uUvY; uniform float uUvAmt; uniform vec3 uUvColor;',
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP;',
    'void main() {',
    '  float ang = atan(vLP.x, vLP.z);',
    '  float wob = sin(ang * 2.0 + uTime * 2.2) * 0.012;',
    '  if (vLP.y > uFillY + wob) discard;',
    '  vec3 N = normalize(vWN);',
    '  if (!gl_FrontFacing) N = -N;',
    '  vec3 V = normalize(cameraPosition - vWP);',
    '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
    '  float edge = pow(1.0 - ndv, 1.7);',
    '  float depth = clamp(vLP.y / uTop, 0.0, 1.0);',
    '  vec3 col = mix(uDeep, uWater, depth);',
    '  float c1 = sin(vLP.y * 16.0 + uTime * 1.4 + sin(ang * 5.0 + uTime * 0.9) * 1.6);',
    '  float c2 = sin(vLP.y * 23.0 - uTime * 1.1 + sin(ang * 3.0 - uTime * 0.7) * 2.0);',
    '  float caust = smoothstep(0.55, 1.0, c1 * 0.5 + c2 * 0.5);',
    '  col = mix(col, vec3(1.0), caust * 0.35 * (1.0 - edge));',
    '  float surf = smoothstep(uFillY - 0.08, uFillY, vLP.y);',
    '  float uvb = exp(-pow((vLP.y - uUvY) / 0.2, 2.0)) * uUvAmt;',
    '  col = mix(col, vec3(1.0), surf * 0.55);',
    '  col = mix(col, uUvColor, clamp(uvb, 0.0, 1.0));',
    '  float a = uAlpha * (1.25 - depth * 0.5) + edge * 0.42 + surf * 0.3 + caust * 0.08 + uvb * 0.45;',
    '  gl_FragColor = linearToOutputTexel(vec4(col, clamp(a, 0.0, 1.0)));',
    '}'
  ].join('\n');

  var MENISCUS_FRAG = [
    'uniform vec3 uWater; uniform float uAmt; uniform float uTime;',
    'varying vec2 vUv;',
    'void main() {',
    '  float d = length(vUv - 0.5) * 2.0;',
    '  float rim = smoothstep(0.7, 1.0, d);',
    '  float rip = 0.5 + 0.5 * sin(d * 22.0 - uTime * 3.0);',
    '  vec3 col = mix(uWater, vec3(1.0), 0.45 + rim * 0.45 + rip * 0.08);',
    '  float a = (0.34 + rim * 0.55 + rip * 0.06) * uAmt;',
    '  gl_FragColor = linearToOutputTexel(vec4(col, a));',
    '}'
  ].join('\n');

  var STREAM_VERT = [
    'uniform float uTime;',
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP;',
    'void main() {',
    '  vLP = position;',
    '  vec3 p = position;',
    '  vec4 w0 = modelMatrix * vec4(p, 1.0);',
    '  p.xz *= 1.0 + 0.18 * sin(w0.y * 7.0 + uTime * 30.0);',
    '  vec4 wp = modelMatrix * vec4(p, 1.0);',
    '  wp.x += sin(w0.y * 3.0 + uTime * 12.0) * 0.006;',
    '  vWP = wp.xyz;',
    '  vWN = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var STREAM_FRAG = [
    'uniform vec3 uWater; uniform float uAmt; uniform float uTime;',
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP;',
    'void main() {',
    '  vec3 N = normalize(vWN);',
    '  vec3 V = normalize(cameraPosition - vWP);',
    '  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);',
    '  float edge = pow(1.0 - ndv, 1.5);',
    '  float streak = 0.5 + 0.5 * sin(vWP.y * 9.0 + uTime * 26.0);',
    '  vec3 col = mix(uWater, vec3(1.0), 0.35 + edge * 0.55 + streak * 0.1);',
    '  float a = (0.28 + edge * 0.6 + streak * 0.06) * uAmt;',
    '  gl_FragColor = linearToOutputTexel(vec4(col, clamp(a, 0.0, 1.0)));',
    '}'
  ].join('\n');

  var PROFILE_GLSL = [
    'uniform float uR; uniform float uSB; uniform float uST; uniform float uNeckR;',
    'float radiusAt(float y) {',
    '  if (y < uSB) return uR;',
    '  float t = clamp((y - uSB) / (uST - uSB), 0.0, 1.0);',
    '  return uNeckR + (uR - uNeckR) * pow(0.5 + 0.5 * cos(t * 3.14159), 0.72);',
    '}'
  ].join('\n');

  var BUBBLE_VERT = [
    'attribute vec4 aSeed;',
    'uniform float uTime; uniform float uAmt; uniform float uTop; uniform float uScale;',
    PROFILE_GLSL,
    'varying float vA;',
    'void main() {',
    '  float h = max(uTop - 0.18, 0.01);',
    '  float y = 0.16 + mod(aSeed.z * h + uTime * (0.25 + aSeed.w * 0.45), h);',
    '  float r = max(radiusAt(y) - 0.07, 0.0) * aSeed.y;',
    '  float a = aSeed.x + sin(uTime * 1.7 + aSeed.z * 30.0) * 0.18;',
    '  vec3 p = vec3(sin(a) * r, y, cos(a) * r);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = (0.025 + aSeed.w * 0.05) * uScale / -mv.z;',
    '  vA = uAmt * smoothstep(uTop, uTop - 0.2, y) * smoothstep(0.16, 0.4, y);',
    '}'
  ].join('\n');

  var BUBBLE_FRAG = [
    'varying float vA;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float d = length(c) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float ring = smoothstep(0.55, 0.88, d) * (1.0 - smoothstep(0.88, 1.0, d));',
    '  float spec = 1.0 - smoothstep(0.0, 0.3, length(c - vec2(-0.17, -0.17)));',
    '  float a = (ring * 0.85 + spec * 0.9 + 0.1) * vA;',
    '  gl_FragColor = linearToOutputTexel(vec4(vec3(1.0), a));',
    '}'
  ].join('\n');

  var SPARK_VERT = [
    'attribute vec4 aSeed; attribute vec3 aColor;',
    'uniform float uTime; uniform float uP; uniform float uTop; uniform float uScale; uniform float uR;',
    'varying float vA; varying vec3 vColor;',
    'void main() {',
    '  float p = clamp(uP * 1.35 - aSeed.y * 0.35, 0.0, 1.0);',
    '  float e = p * p * (3.0 - 2.0 * p);',
    '  float rad = mix(uR * (2.6 + aSeed.w * 1.4), uR * 0.35, e);',
    '  float ang = aSeed.x + uTime * (0.35 + aSeed.z * 0.5) + e * 7.0;',
    '  float y = mix(aSeed.y * uTop * 1.15 - 0.2, 0.35 + aSeed.y * uTop * 0.55, e);',
    '  vec3 pos = vec3(sin(ang) * rad, y, cos(ang) * rad);',
    '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float tw = 0.55 + 0.45 * sin(uTime * (3.0 + aSeed.z * 5.0) + aSeed.x * 10.0);',
    '  gl_PointSize = (0.09 + aSeed.w * 0.14) * uScale / -mv.z * (0.7 + tw * 0.5);',
    '  vA = smoothstep(0.0, 0.12, uP) * (1.0 - smoothstep(0.82, 1.0, p)) * tw;',
    '  vColor = aColor;',
    '}'
  ].join('\n');

  var SPARK_FRAG = [
    'varying float vA; varying vec3 vColor;',
    'void main() {',
    '  vec2 c = (gl_PointCoord - 0.5) * 2.0;',
    '  float d = length(c);',
    '  if (d > 1.0) discard;',
    '  float crs = max(0.0, 1.0 - abs(c.x) * 9.0) * (1.0 - abs(c.y)) + max(0.0, 1.0 - abs(c.y) * 9.0) * (1.0 - abs(c.x));',
    '  float core = exp(-d * d * 9.0);',
    '  float a = clamp(core + crs * 0.85, 0.0, 1.0) * vA;',
    '  gl_FragColor = linearToOutputTexel(vec4(mix(vColor, vec3(1.0), core * 0.6), a));',
    '}'
  ].join('\n');

  var DIRT_VERT = [
    'attribute vec4 aSeed;',
    'uniform float uTime; uniform float uAmt; uniform float uTop; uniform float uScale; uniform float uR;',
    'varying float vA;',
    'void main() {',
    '  float t = fract(aSeed.z + uTime * (0.12 + aSeed.w * 0.1));',
    '  float rad = mix(uR * 3.4, uR * 1.64, t);',
    '  float ang = aSeed.x + t * 0.4;',
    '  vec3 pos = vec3(sin(ang) * rad, aSeed.y * uTop, cos(ang) * rad);',
    '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = (0.035 + aSeed.w * 0.05) * uScale / -mv.z;',
    '  vA = uAmt * smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.86, 1.0, t));',
    '}'
  ].join('\n');

  var DIRT_FRAG = [
    'varying float vA;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float a = (1.0 - smoothstep(0.5, 1.0, d)) * vA * 0.85;',
    '  gl_FragColor = linearToOutputTexel(vec4(0.78, 0.66, 0.5, a));',
    '}'
  ].join('\n');

  var MEMBRANE_FRAG = [
    'uniform float uAmt; uniform float uTime; uniform vec3 uColor;',
    'varying vec3 vWN; varying vec3 vWP; varying vec3 vLP; varying vec2 vUv;',
    'void main() {',
    '  vec2 g = vec2(vUv.x * 64.0, vUv.y * 22.0);',
    '  g.x += step(1.0, mod(g.y, 2.0)) * 0.5;',
    '  vec2 f = abs(fract(g) - 0.5);',
    '  float line = smoothstep(0.38, 0.5, max(f.x, f.y));',
    '  vec3 N = normalize(vWN);',
    '  vec3 V = normalize(cameraPosition - vWP);',
    '  float edge = pow(1.0 - abs(dot(N, V)), 2.0);',
    '  float scan = smoothstep(0.12, 0.0, abs(fract(vUv.y * 1.0 - uTime * 0.35) - 0.5) - 0.38);',
    '  float a = uAmt * (line * (0.22 + edge * 0.5) + edge * 0.18 + scan * 0.12 * line);',
    '  gl_FragColor = linearToOutputTexel(vec4(uColor, a));',
    '}'
  ].join('\n');

  var GLOW_FRAG = [
    'uniform float uAmt; uniform vec3 uColor;',
    'varying vec2 vUv;',
    'void main() {',
    '  float d = length(vUv - 0.5) * 2.0;',
    '  float ring = exp(-pow((d - 0.82) / 0.12, 2.0));',
    '  float fill = (1.0 - smoothstep(0.0, 0.9, d)) * 0.25;',
    '  float a = (ring + fill) * uAmt;',
    '  gl_FragColor = linearToOutputTexel(vec4(mix(uColor, vec3(1.0), ring * 0.4), a));',
    '}'
  ].join('\n');

  function shaderMat(frag, uniforms, opts) {
    var m = new THREE.ShaderMaterial({
      vertexShader: (opts && opts.vert) || SURFACE_VERT,
      fragmentShader: frag,
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      side: (opts && opts.side) || THREE.FrontSide
    });
    return m;
  }

  function seeds(n, fn) {
    var arr = new Float32Array(n * 4);
    for (var i = 0; i < n; i++) {
      var s = fn(i);
      arr[i * 4] = s[0]; arr[i * 4 + 1] = s[1]; arr[i * 4 + 2] = s[2]; arr[i * 4 + 3] = s[3];
    }
    return arr;
  }

  function pointsGeo(n, seedArr, colors) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 4));
    if (colors) g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* Label artwork                                                        */
  /* ------------------------------------------------------------------ */

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // mountain range: pts = [x0, y0, x1, y1, ...] as fractions of the band
  function mountainRange(g, W, top, h, pts, base, snow) {
    g.beginPath();
    g.moveTo(0, top + h);
    for (var i = 0; i < pts.length; i += 2) g.lineTo(pts[i] * W, top + pts[i + 1] * h);
    g.lineTo(W, top + h);
    g.closePath();
    var grad = g.createLinearGradient(0, top + h * 0.12, 0, top + h * 0.85);
    grad.addColorStop(0, snow);
    grad.addColorStop(0.32, snow);
    grad.addColorStop(0.55, base);
    grad.addColorStop(1, base);
    g.fillStyle = grad;
    g.fill();
  }

  function dropPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y - s);
    g.bezierCurveTo(x + s * 0.2, y - s * 0.55, x + s * 0.62, y - s * 0.1, x + s * 0.62, y + s * 0.3);
    g.arc(x, y + s * 0.3, s * 0.62, 0, Math.PI, false);
    g.bezierCurveTo(x - s * 0.62, y - s * 0.1, x - s * 0.2, y - s * 0.55, x, y - s);
    g.closePath();
  }

  function drawScene(g, W, top, bottom) {
    var h = bottom - top;
    var sky = g.createLinearGradient(0, top, 0, bottom);
    sky.addColorStop(0, 'rgba(120, 190, 255, 0)');
    sky.addColorStop(0.42, 'rgba(160, 210, 255, 0.5)');
    sky.addColorStop(0.75, 'rgba(70, 140, 235, 0.25)');
    sky.addColorStop(1, 'rgba(10, 30, 80, 0)');
    g.fillStyle = sky;
    g.fillRect(0, top, W, h);
    mountainRange(g, W, top, h * 0.84, [0, 0.62, 0.1, 0.4, 0.18, 0.52, 0.3, 0.22, 0.4, 0.46, 0.5, 0.14, 0.6, 0.42, 0.7, 0.26, 0.82, 0.5, 0.92, 0.3, 1, 0.55], '#3e74c4', '#f2f8ff');
    mountainRange(g, W, top, h * 0.84, [0, 0.78, 0.12, 0.5, 0.24, 0.7, 0.36, 0.46, 0.46, 0.64, 0.56, 0.5, 0.68, 0.72, 0.8, 0.52, 0.9, 0.7, 1, 0.6], '#173f86', '#d9e9ff');

    var lakeY = top + h * 0.8;
    var lake = g.createLinearGradient(0, lakeY, 0, bottom);
    lake.addColorStop(0, '#2a74db');
    lake.addColorStop(1, '#08214f');
    g.fillStyle = lake;
    g.fillRect(0, lakeY, W, bottom - lakeY);
    g.strokeStyle = 'rgba(210, 235, 255, 0.4)';
    g.lineWidth = 2;
    for (var k = 0; k < 5; k++) {
      var yy = lakeY + 10 + k * (bottom - lakeY - 14) / 5;
      g.beginPath(); g.moveTo(W * 0.5 - 150 + k * 18, yy); g.lineTo(W * 0.5 + 150 - k * 18, yy); g.stroke();
    }

    // a drop falls into the lake
    var cx = W * 0.5;
    var dg = g.createLinearGradient(cx, lakeY - 110, cx, lakeY - 40);
    dg.addColorStop(0, '#ffffff');
    dg.addColorStop(1, '#7fc2ff');
    g.fillStyle = dg;
    dropPath(g, cx, lakeY - 74, 34);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, lakeY + 6, 54, 10, 0, 0, TAU); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, lakeY + 8, 92, 16, 0, 0, TAU); g.stroke();
    g.fillStyle = '#ffffff';
    [[-46, -18, 5], [-26, -30, 4], [0, -36, 5], [26, -30, 4], [46, -18, 5], [-60, -6, 3], [60, -6, 3]].forEach(function (d) {
      g.beginPath(); g.arc(cx + d[0], lakeY + d[1], d[2], 0, TAU); g.fill();
    });
  }

  function leaf(g, x, y, s, rot) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    var lg = g.createLinearGradient(-s, 0, s, 0);
    lg.addColorStop(0, '#2f8f1f');
    lg.addColorStop(1, '#a6e04a');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(-s, 0);
    g.quadraticCurveTo(0, -s * 0.7, s, 0);
    g.quadraticCurveTo(0, s * 0.7, -s, 0);
    g.fill();
    g.restore();
  }

  // Front label, recreated from the GIO Spark packaging: dark navy panel with a gold
  // frame, the logo standing on its side, a snowy mountain lake and the net quantity.
  function drawLabel(spec, logo) {
    var W = 640;
    var H = Math.round(W * (spec.label[1] - spec.label[0]) / spec.labelW);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var DISPLAY = '"Bricolage Grotesque", "Arial Narrow", sans-serif';
    var BODY = 'Manrope, "Helvetica Neue", Arial, sans-serif';
    var GOLD = '#e3a623';
    var rad = 40;

    g.save();
    roundRect(g, 2, 2, W - 4, H - 4, rad);
    g.clip();

    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1736');
    bg.addColorStop(0.36, '#0c2963');
    bg.addColorStop(0.62, '#0a1f4e');
    bg.addColorStop(1, '#060e27');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W * 0.45, H * 0.36, 20, W * 0.45, H * 0.36, W * 0.95);
    glow.addColorStop(0, 'rgba(46, 132, 255, 0.5)');
    glow.addColorStop(1, 'rgba(46, 132, 255, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    var sceneTop = H * 0.5;
    var sceneBottom = H - 400;
    drawScene(g, W, sceneTop, sceneBottom);

    // gold arc emblem with a snowy peak and leaves (top left)
    var ex = W * 0.3, ey = 330, er = 104;
    g.strokeStyle = GOLD;
    g.lineWidth = 6;
    g.beginPath(); g.arc(ex, ey, er, Math.PI * 0.45, Math.PI * 1.72); g.stroke();
    g.fillStyle = '#e8f3ff';
    g.beginPath(); g.moveTo(ex - 70, ey + 40); g.lineTo(ex - 22, ey - 52); g.lineTo(ex + 6, ey - 8); g.lineTo(ex + 22, ey - 30); g.lineTo(ex + 56, ey + 40); g.closePath(); g.fill();
    g.fillStyle = '#5b8fd8';
    g.beginPath(); g.moveTo(ex - 22, ey - 52); g.lineTo(ex - 6, ey + 40); g.lineTo(ex - 70, ey + 40); g.closePath(); g.fill();
    leaf(g, ex - 52, ey + 58, 26, -0.6);
    leaf(g, ex - 20, ey + 74, 22, 0.3);

    // logo on its side, reading bottom to top
    if (logo) {
      var lw = Math.min(H * 0.43, sceneBottom - 300);
      var lh = lw * logo.height / logo.width;
      g.save();
      g.translate(W * 0.5, H * 0.37);
      g.rotate(-Math.PI / 2);
      g.shadowColor = 'rgba(0, 12, 45, 0.55)';
      g.shadowBlur = 18;
      g.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      g.restore();
    } else {
      g.save();
      g.translate(W * 0.5, H * 0.37);
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'italic 800 150px ' + DISPLAY;
      g.fillText('GioSpark', 0, 0);
      g.restore();
    }
    g.restore();

    // gold frame
    var frame = g.createLinearGradient(0, 0, W, H);
    frame.addColorStop(0, '#f6c84f');
    frame.addColorStop(0.5, '#d18e12');
    frame.addColorStop(1, '#f2bb3a');
    g.strokeStyle = frame;
    g.lineWidth = 7;
    roundRect(g, 14, 14, W - 28, H - 28, rad - 10);
    g.stroke();

    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = '800 46px ' + DISPLAY;
    g.fillText('PURE WATER,', W / 2, 104);
    g.fillText('BRIGHTER TOMORROW!', W / 2, 156);

    // RO + UV ozonated seal (top right)
    var sx = W * 0.8, sy = 252, sr = 50;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.stroke();
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(sx, sy, sr - 8, 0, TAU); g.stroke();
    g.font = '800 21px ' + DISPLAY;
    g.fillText('RO + UV', sx, sy - 2);
    g.font = '800 12px ' + BODY;
    g.fillText('OZONATED', sx, sy + 18);

    // separator, claims and net quantity
    var sepY = H - 372;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(44, sepY); g.lineTo(W - 44, sepY); g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, 0.8)';
    g.font = '700 16px ' + BODY;
    g.fillText('RO  •  UV  •  OZONATED  •  ADDED MINERALS', W / 2, sepY - 14);
    g.fillStyle = '#ffffff';
    g.font = '800 46px ' + DISPLAY;
    g.fillText('PURE  ·  SAFE  ·  TRUSTED', W / 2, H - 296);
    g.font = '800 30px ' + BODY;
    g.fillText('PACKAGED DRINKING WATER', W / 2, H - 226);
    g.fillText('WITH ADDED MINERALS', W / 2, H - 186);
    g.font = '700 32px ' + BODY;
    g.fillText('Net Quantity: ' + spec.qty, W / 2, H - 92);

    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Bottle                                                               */
  /* ------------------------------------------------------------------ */

  function Bottle(stage, spec, logo) {
    var self = this;
    this.stage = stage;
    this.spec = spec;
    this.id = spec.id;
    var shape = this.shape = makeShape(spec);
    this.totalH = shape.top;

    // per-bottle offsets (used for switching between sizes)
    this.off = { x: 0, y: 0, spin: 0, scale: 1, visible: false };

    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.spin = new THREE.Group();
    this.body = new THREE.Group();
    this.fx = new THREE.Group();
    this.root.add(this.tilt);
    this.tilt.add(this.spin);
    this.tilt.add(this.fx);
    this.spin.add(this.body);
    this.body.position.y = -this.totalH / 2;
    this.fx.position.y = -this.totalH / 2;

    var C = function (hex) { return new THREE.Color(hex); };
    var top = shape.fillMax;

    // ---- uniforms shared across the bottle's materials
    this.u = {
      time: { value: 0 },
      fillY: { value: shape.fillMax },
      uvY: { value: -10 },
      uvAmt: { value: 0 },
      uvColor: { value: C('#9b6bff') },
      wrap: { value: 1 }
    };

    var glassU = function (alpha, edge) {
      return {
        uTint: { value: C('#d9f3ff') },
        uAlpha: { value: alpha },
        uEdge: { value: edge },
        uSpec: { value: 1.6 },
        uUvY: self.u.uvY, uUvAmt: self.u.uvAmt, uUvColor: self.u.uvColor
      };
    };

    var outerGeo = makeShell(shape, spec, stage.mobile);
    this.glassBack = new THREE.Mesh(outerGeo, shaderMat(GLASS_FRAG, glassU(0.03, 0.22), { side: THREE.BackSide }));
    this.glassFront = new THREE.Mesh(outerGeo, shaderMat(GLASS_FRAG, glassU(0.04, 0.5)));
    this.glassBack.renderOrder = 2;
    this.glassFront.renderOrder = 6;

    var waterU = {
      uWater: { value: C('#8fdcff') },
      uDeep: { value: C('#139fe8') },
      uAlpha: { value: 0.13 },
      uFillY: this.u.fillY,
      uTop: { value: top },
      uTime: this.u.time,
      uUvY: this.u.uvY, uUvAmt: this.u.uvAmt, uUvColor: this.u.uvColor
    };
    var waterGeo = makeWater(shape, spec, stage.mobile);
    this.waterBack = new THREE.Mesh(waterGeo, shaderMat(WATER_FRAG, waterU, { side: THREE.BackSide }));
    this.waterFront = new THREE.Mesh(waterGeo, shaderMat(WATER_FRAG, waterU));
    this.waterBack.renderOrder = 3;
    this.waterFront.renderOrder = 5;

    this.meniscusU = { uWater: waterU.uWater, uAmt: { value: 1 }, uTime: this.u.time };
    this.meniscus = new THREE.Mesh(makeDisc(96), shaderMat(MENISCUS_FRAG, this.meniscusU, { side: THREE.DoubleSide }));
    this.meniscus.renderOrder = 4;
    this.meniscus.frustumCulled = false;
    this._disc = { a: -1, n: -1 };

    // front label
    var tex = new THREE.CanvasTexture(drawLabel(spec, logo));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
    this.labelTex = tex;
    var labelMat = new THREE.MeshPhysicalMaterial({
      map: tex, roughness: 0.48, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.6, side: THREE.DoubleSide, alphaTest: 0.5
    });
    labelMat.onBeforeCompile = function (sh) {
      sh.uniforms.uWrap = self.u.wrap;
      sh.fragmentShader = 'uniform float uWrap;\n' + sh.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n' +
        'if (abs(vMapUv.x - 0.5) > uWrap * 0.5 + 0.0005) discard;\n' +
        'if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.86, 0.9, 0.95);'
      );
    };
    this.label = new THREE.Mesh(makeLabelGeometry(shape, spec), labelMat);

    // cap
    this.cap = new THREE.Mesh(makeCapGeometry(), new THREE.MeshPhysicalMaterial({
      color: '#0e24b0', roughness: 0.52, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.35, envMapIntensity: 0.3
    }));
    this.cap.position.y = shape.capBase;

    this.body.add(this.label, this.cap, this.glassBack, this.waterBack, this.meniscus, this.waterFront, this.glassFront);

    // ---- effects (do not spin with the bottle)
    var mobile = stage.mobile;
    var profileU = {
      uR: { value: spec.A }, uSB: { value: shape.ySB }, uST: { value: shape.yNeck }, uNeckR: { value: NECK_R }
    };
    var scaleU = this.pointScaleU = { value: 400 };

    var nB = mobile ? 90 : 170;
    this.bubbleU = Object.assign({
      uTime: this.u.time, uAmt: { value: 0 }, uTop: { value: top }, uScale: scaleU
    }, profileU);
    this.bubbles = new THREE.Points(
      pointsGeo(nB, seeds(nB, function () { return [Math.random() * TAU, Math.sqrt(Math.random()), Math.random(), Math.random()]; })),
      shaderMat(BUBBLE_FRAG, this.bubbleU, { vert: BUBBLE_VERT })
    );
    this.bubbles.frustumCulled = false;
    this.bubbles.renderOrder = 4;

    var nS = mobile ? 120 : 220;
    var palette = [C('#ffd34d'), C('#7fe8ff'), C('#ffffff'), C('#9be15d')];
    var cols = new Float32Array(nS * 3);
    for (var i = 0; i < nS; i++) {
      var pc = palette[i % palette.length];
      cols[i * 3] = pc.r; cols[i * 3 + 1] = pc.g; cols[i * 3 + 2] = pc.b;
    }
    this.sparkU = { uTime: this.u.time, uP: { value: 0 }, uTop: { value: top }, uScale: scaleU, uR: { value: spec.A } };
    this.sparks = new THREE.Points(
      pointsGeo(nS, seeds(nS, function () { return [Math.random() * TAU, Math.random(), Math.random(), Math.random()]; }), cols),
      shaderMat(SPARK_FRAG, this.sparkU, { vert: SPARK_VERT })
    );
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 8;

    var nD = mobile ? 90 : 160;
    this.dirtU = { uTime: this.u.time, uAmt: { value: 0 }, uTop: { value: top }, uScale: scaleU, uR: { value: spec.A } };
    this.dirt = new THREE.Points(
      pointsGeo(nD, seeds(nD, function () { return [Math.random() * TAU, 0.05 + Math.random() * 0.95, Math.random(), Math.random()]; })),
      shaderMat(DIRT_FRAG, this.dirtU, { vert: DIRT_VERT })
    );
    this.dirt.frustumCulled = false;
    this.dirt.renderOrder = 7;

    this.membraneU = { uAmt: { value: 0 }, uTime: this.u.time, uColor: { value: C('#7fe8ff') } };
    this.membrane = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.A * 1.75, spec.A * 1.75, top * 1.04, 96, 1, true),
      shaderMat(MEMBRANE_FRAG, this.membraneU, { side: THREE.DoubleSide })
    );
    this.membrane.position.y = top * 0.52;
    this.membrane.renderOrder = 7;

    this.glowU = { uAmt: { value: 0 }, uColor: { value: C('#a77bff') } };
    this.uvSheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaderMat(GLOW_FRAG, this.glowU, { side: THREE.DoubleSide }));
    this.uvSheet.rotation.x = -Math.PI / 2;
    this.uvSheet.scale.setScalar(spec.A * 3.9);
    this.uvSheet.renderOrder = 7;
    this.uvRing = new THREE.Mesh(
      new THREE.TorusGeometry(spec.A * 1.55, 0.022, 10, 140),
      new THREE.MeshBasicMaterial({ color: '#d9c7ff', transparent: true, opacity: 0, depthWrite: false })
    );
    this.uvRing.rotation.x = Math.PI / 2;
    this.uvRing.renderOrder = 8;

    this.streamU = { uWater: waterU.uWater, uAmt: { value: 0 }, uTime: this.u.time };
    var sg = new THREE.CylinderGeometry(0.038, 0.056, 1, 20, 1, true);
    sg.translate(0, 0.5, 0);
    this.stream = new THREE.Mesh(sg, shaderMat(STREAM_FRAG, this.streamU, { side: THREE.DoubleSide, vert: STREAM_VERT }));
    this.stream.renderOrder = 4;
    this.stream.frustumCulled = false;

    this.fx.add(this.bubbles, this.sparks, this.dirt, this.membrane, this.uvSheet, this.uvRing, this.stream);

    this.root.visible = false;
    stage.scene.add(this.root);
  }

  Bottle.prototype.update = function (t, st) {
    var o = this.off;
    var S = st.shared, I = st.intro;
    var show = o.visible && o.scale > 0.002;
    this.root.visible = show;
    if (!show) return;

    var shape = this.shape;
    var h = S.h * this.spec.heroScale * o.scale;
    var sc = (h * st.vh) / this.totalH;
    this.root.scale.setScalar(sc);
    this.pointScaleU.value = st.pointScale.value * sc;
    var bob = Math.sin(t * 1.15 + this.spec.A * 3) * 0.012 * S.float;
    this.root.position.set((S.x + o.x) * st.vw, (S.y + o.y + I.y + bob) * st.vh, 0);

    this.tilt.rotation.z = S.tiltZ + I.tilt - st.pointer.sx * 0.08 * S.follow;
    this.tilt.rotation.x = S.tiltX + st.pointer.sy * 0.1 * S.follow;
    var sway = Math.sin(t * 0.55) * 0.42 * S.sway;
    this.spin.rotation.y = S.spin + o.spin + I.spin + sway + st.dragAngle;

    // uniforms
    this.u.time.value = t;
    var fill = Math.max(0, Math.min(1, I.fill));
    var fillY = shape.fillMin + (shape.fillMax - shape.fillMin) * fill;
    this.u.fillY.value = fill <= 0.001 ? -1 : fillY;
    this.meniscus.visible = fill > 0.001;
    if (this.meniscus.visible) {
      var da = Math.max(0.02, shape.size(fillY) - WALL);
      var dn = shape.expo(fillY);
      if (Math.abs(da - this._disc.a) > 0.0005 || Math.abs(dn - this._disc.n) > 0.005) {
        updateDisc(this.meniscus.geometry, da, dn);
        this._disc.a = da; this._disc.n = dn;
      }
      this.meniscus.position.y = fillY;
    }

    this.cap.position.y = shape.capBase + (I.capLift + S.capLift);
    this.cap.rotation.y = I.capSpin + S.capSpin;
    this.u.wrap.value = S.wrap;

    var uvY = shape.top * (1 - S.uvY);
    this.u.uvY.value = uvY;
    this.u.uvAmt.value = S.uv;
    this.uvSheet.position.y = uvY;
    this.uvRing.position.y = uvY;
    this.uvSheet.visible = this.uvRing.visible = S.uv > 0.002;
    this.glowU.uAmt.value = S.uv * 1.3;
    this.uvRing.material.opacity = S.uv;

    this.bubbleU.uAmt.value = Math.max(S.bubbles, I.bubbles) * (fill > 0.05 ? 1 : 0);
    this.bubbleU.uTop.value = fillY;
    this.bubbles.visible = this.bubbleU.uAmt.value > 0.002;

    this.sparkU.uP.value = S.minerals;
    this.sparks.visible = S.minerals > 0.002 && S.minerals < 0.999;

    this.dirtU.uAmt.value = S.ro;
    this.membraneU.uAmt.value = S.ro;
    this.dirt.visible = this.membrane.visible = S.ro > 0.002;

    var pour = I.pour;
    this.stream.visible = pour > 0.002;
    if (this.stream.visible) {
      var topWorld = st.vh * 0.5 + 1;
      var localTop = (topWorld - this.root.position.y) / sc + this.totalH / 2;
      var bottom = Math.max(fillY, shape.fillMin) + I.streamCut * (localTop - fillY);
      this.stream.position.y = bottom;
      this.stream.scale.set(pour, Math.max(0.001, localTop - bottom), pour);
      this.streamU.uAmt.value = Math.min(1, pour * 1.4);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Stage                                                                */
  /* ------------------------------------------------------------------ */

  function Stage(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
    var r = this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer
    });
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.maxDpr = opts.maxDpr || (this.mobile ? 1.6 : 2);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 15);

    var pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-5, 6, 7);
    var rim = new THREE.DirectionalLight(0xdff4ff, 1.2);
    rim.position.set(6, 2, -5);
    var fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(4, -2, 6);
    this.scene.add(key, rim, fill);

    this.pointScale = { value: 400 };
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.dragAngle = 0;
    this.dragVel = 0;
    this.dragging = false;
    this.running = true;
    this.vw = 1; this.vh = 1;

    // Shared, GSAP-animatable state. x/y/h are fractions of the viewport.
    this.shared = {
      x: 0, y: 0, h: 0.72, spin: 0, tiltZ: -0.1, tiltX: 0.06, sway: 1, float: 1, follow: 1,
      wrap: 1, capLift: 0, capSpin: 0, uv: 0, uvY: 0, ro: 0, bubbles: 0, minerals: 0
    };
    this.intro = { y: 0, spin: 0, fill: 1, pour: 0, streamCut: 0, capLift: 0, capSpin: 0, bubbles: 0, tilt: 0 };
    this.bottles = {};
    this.list = [];

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  Stage.prototype.addBottle = function (spec, logo) {
    var b = new Bottle(this, spec, logo);
    this.bottles[spec.id] = b;
    this.list.push(b);
    return b;
  };

  Stage.prototype.resize = function () {
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    var tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.vh = 2 * tanHalf * this.camera.position.z;
    this.vw = this.vh * this.camera.aspect;
    this.pointScale.value = (h * this.renderer.getPixelRatio()) / (2 * tanHalf);
    this.width = w; this.height = h;
  };

  Stage.prototype.setPointer = function (nx, ny) {
    this.pointer.x = nx; this.pointer.y = ny;
  };

  Stage.prototype.tick = function () {
    if (!this.running) return;
    var t = performance.now() / 1000;
    var p = this.pointer;
    p.sx += (p.x - p.sx) * 0.06;
    p.sy += (p.y - p.sy) * 0.06;
    if (!this.dragging) {
      this.dragAngle += this.dragVel;
      this.dragVel *= 0.94;
      // ease the user's spin back towards a front-facing label
      if (Math.abs(this.dragVel) < 0.002) {
        var target = Math.round(this.dragAngle / TAU) * TAU;
        this.dragAngle += (target - this.dragAngle) * 0.03;
      }
    }
    for (var i = 0; i < this.list.length; i++) this.list[i].update(t, this);
    this.renderer.render(this.scene, this.camera);
  };

  Stage.prototype.start = function () { this.running = true; };
  Stage.prototype.stop = function () { this.running = false; };

  /* ------------------------------------------------------------------ */
  /* Loading helpers                                                      */
  /* ------------------------------------------------------------------ */

  function loadLogo(base) {
    return new Promise(function (resolve) {
      function fromSrc(src) {
        if (!src) return resolve(null);
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = src;
      }
      // file:// pages cannot upload same-folder images to WebGL, so use an inlined copy.
      if (location.protocol === 'file:') {
        if (global.GIOSPARK_LOGO_DATA) return fromSrc(global.GIOSPARK_LOGO_DATA);
        var s = document.createElement('script');
        s.src = base + 'js/logo-data.js';
        s.onload = function () { fromSrc(global.GIOSPARK_LOGO_DATA); };
        s.onerror = function () { resolve(null); };
        document.head.appendChild(s);
      } else {
        fromSrc(base + 'img/logo-640.png');
      }
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var wait = Promise.all([
      document.fonts.load('800 40px "Bricolage Grotesque"'),
      document.fonts.load('italic 800 40px "Bricolage Grotesque"'),
      document.fonts.load('700 20px Manrope'),
      document.fonts.load('600 20px Manrope')
    ]).catch(function () {});
    var timeout = new Promise(function (r) { setTimeout(r, 2500); });
    return Promise.race([wait, timeout]);
  }

  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function create(canvas, opts) {
    opts = opts || {};
    var base = opts.base || 'assets/';
    var ids = opts.sizes || ['200', '500', '1000'];
    return Promise.all([loadLogo(base), loadFonts()]).then(function (res) {
      var stage = new Stage(canvas, opts);
      ids.forEach(function (id) { stage.addBottle(SPECS[id], res[0]); });
      return stage;
    });
  }

  global.GioBottle = { SPECS: SPECS, supported: supported, create: create, TAU: TAU };
})(window);
