/* eslint-disable */
var N = Object.defineProperty;
var F = (E, A, g) => A in E ? N(E, A, { enumerable: !0, configurable: !0, writable: !0, value: g }) : E[A] = g;
var C = (E, A, g) => F(E, typeof A != "symbol" ? A + "" : A, g);
import l from "maplibre-gl";
import * as n from "three";
class c {
  constructor(A = {}) {
    C(this, "cache", /* @__PURE__ */ new Map());
    C(this, "memoryUsage", 0);
    C(this, "options");
    this.options = {
      maxNodes: A.maxNodes != null ? A.maxNodes : 100,
      maxMemoryBytes: A.maxMemoryBytes != null ? A.maxMemoryBytes : 100 * 1024 * 1024,
      debug: A.debug != null ? A.debug : !1
    };
  }
  get(A) {
    const g = this.cache.get(A);
    return g ? (this.cache.delete(A), this.cache.set(A, g), g.lastAccessed = Date.now(), g) : null;
  }
  set(A, g) {
    const { nodeId: I } = A, B = this.cache.get(I);
    B && (this.disposeNodeResources(B), this.memoryUsage -= B.sizeBytes, this.cache.delete(I)), this.ensureCacheLimits(A.sizeBytes, g), A.lastAccessed = Date.now(), this.cache.set(I, A), this.memoryUsage += A.sizeBytes, this.log(`Cached node ${I} (${this.formatBytes(A.sizeBytes)})`);
  }
  has(A) {
    return this.cache.has(A);
  }
  delete(A) {
    const g = this.cache.get(A);
    return g ? (this.disposeNodeResources(g), this.cache.delete(A), this.memoryUsage -= g.sizeBytes, this.log(`Removed node ${A} from cache`), !0) : !1;
  }
  clear() {
    for (const A of this.cache.values())
      this.disposeNodeResources(A);
    this.cache.clear(), this.memoryUsage = 0;
  }
  updateOptions(A, g) {
    Object.assign(this.options, A), this.ensureCacheLimits(0, g);
  }
  getCachedNodeIds() {
    return Array.from(this.cache.keys());
  }
  size() {
    return this.cache.size;
  }
  static estimateNodeSize(A, g) {
    const I = A.length * (A instanceof Float64Array ? 8 : 4), B = g.length * 4;
    return I + B + 1024;
  }
  static createNodeData(A, g, I, B) {
    return {
      nodeId: A,
      positions: new Float64Array(g),
      colors: new Float32Array(I),
      pointCount: g.length / 3,
      materialConfig: { ...B },
      lastAccessed: Date.now(),
      sizeBytes: c.estimateNodeSize(g, I)
    };
  }
  ensureCacheLimits(A, g) {
    for (; (this.cache.size >= this.options.maxNodes || this.memoryUsage + A > this.options.maxMemoryBytes) && this.cache.size !== 0; ) {
      let I = null;
      for (const B of this.cache.keys())
        if (!(g != null && g.has(B))) {
          I = B;
          break;
        }
      if (!I) {
        this.log(
          "Warning: Cannot evict any nodes - all are protected. Cache limit exceeded."
        );
        break;
      }
      this.delete(I);
    }
  }
  disposeNodeResources(A) {
    var g, I;
    (g = A.geometry) == null || g.dispose(), ((I = A.points) == null ? void 0 : I.material) instanceof n.Material && A.points.material.dispose();
  }
  formatBytes(A) {
    const g = ["B", "KB", "MB", "GB"];
    if (A === 0) return "0 B";
    const I = Math.floor(Math.log(A) / Math.log(1024));
    return `${Math.round(A / 1024 ** I * 100) / 100} ${g[I]}`;
  }
  log(A) {
    this.options.debug && console.log("[CacheManager]", A);
  }
}
const S = `uniform float size;
uniform float scale;

#ifdef USE_COLOR
    varying vec3 vColor;
#endif

void main() {
    #ifdef USE_COLOR
        vColor = color;
    #endif

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = size;

    #ifdef USE_SIZEATTENUATION
        gl_PointSize *= (scale / -mvPosition.z);
    #endif
}
`, L = `uniform vec3 pointColor;

#ifdef USE_COLOR
    varying vec3 vColor;
#endif

void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) {
        discard;
    }

    #ifdef USE_COLOR
        gl_FragColor = vec4(vColor, 1.0);
    #else
        gl_FragColor = vec4(pointColor, 1.0);
    #endif
}
`, p = `varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`, U = `uniform sampler2D tDepth;
uniform sampler2D tColor;
uniform vec2 screenSize;
uniform float edlStrength;
uniform float radius;
varying vec2 vUv;

float readDepth(sampler2D depthSampler, vec2 coord) {
    return texture2D(depthSampler, coord).x;
}

void main() {
    vec4 color = texture2D(tColor, vUv);

    if (color.a == 0.0) {
        discard;
    }

    float depth = readDepth(tDepth, vUv);

    float response = 0.0;
    vec2 texelSize = 1.0 / screenSize;

    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            if (i == 0 && j == 0) continue;

            vec2 offset = vec2(float(i), float(j)) * texelSize * radius;
            vec2 sampleCoord = vUv + offset;

            if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                continue;
            }

            float sampleDepth = readDepth(tDepth, sampleCoord);
            float depthDiff = depth - sampleDepth;

            if (depthDiff > 0.0) {
                response += min(1.0, depthDiff * 100.0);
            }
        }
    }

    response /= 24.0;
    float edl = exp(-response * edlStrength);

    gl_FragColor = vec4(color.rgb * edl, color.a);
}
`, u = `var Sr = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function No(t) {
  if (Object.prototype.hasOwnProperty.call(t, "__esModule")) return t;
  var e = t.default;
  if (typeof e == "function") {
    var r = function n() {
      return this instanceof n ? Reflect.construct(e, arguments, this.constructor) : e.apply(this, arguments);
    };
    r.prototype = e.prototype;
  } else r = {};
  return Object.defineProperty(r, "__esModule", { value: !0 }), Object.keys(t).forEach(function(n) {
    var a = Object.getOwnPropertyDescriptor(t, n);
    Object.defineProperty(r, n, a.get ? a : {
      enumerable: !0,
      get: function() {
        return t[n];
      }
    });
  }), r;
}
var It = {}, se = {}, ui = {}, sa;
function Lo() {
  return sa || (sa = 1, Object.defineProperty(ui, "__esModule", { value: !0 })), ui;
}
var Ue = {}, oa;
function Fo() {
  if (oa) return Ue;
  oa = 1, Object.defineProperty(Ue, "__esModule", { value: !0 }), Ue.Hierarchy = void 0, Ue.Hierarchy = { parse: t };
  function t(e) {
    return Object.entries(e).reduce((r, [n, a]) => (a === -1 ? r.pages[n] = {} : a && (r.nodes[n] = { pointCount: a }), r), { nodes: {}, pages: {} });
  }
  return Ue;
}
var ha;
function Do() {
  return ha || (ha = 1, (function(t) {
    var e = se && se.__createBinding || (Object.create ? (function(n, a, i, o) {
      o === void 0 && (o = i);
      var s = Object.getOwnPropertyDescriptor(a, i);
      (!s || ("get" in s ? !a.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: function() {
        return a[i];
      } }), Object.defineProperty(n, o, s);
    }) : (function(n, a, i, o) {
      o === void 0 && (o = i), n[o] = a[i];
    })), r = se && se.__exportStar || function(n, a) {
      for (var i in n) i !== "default" && !Object.prototype.hasOwnProperty.call(a, i) && e(a, n, i);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), r(Lo(), t), r(Fo(), t);
  })(se)), se;
}
var qt = {}, oe = {}, la;
function Pi() {
  return la || (la = 1, Object.defineProperty(oe, "__esModule", { value: !0 }), oe.hierarchyItemLength = oe.infoLength = void 0, oe.infoLength = 160, oe.hierarchyItemLength = 32), oe;
}
var Ot = {}, $t = {}, zt = {}, ua;
function Si() {
  return ua || (ua = 1, Object.defineProperty(zt, "__esModule", { value: !0 }), zt.evlrHeaderLength = zt.vlrHeaderLength = zt.minHeaderLength = void 0, zt.minHeaderLength = 375, zt.vlrHeaderLength = 54, zt.evlrHeaderLength = 60), zt;
}
var Be = {}, he = {}, le = {}, ca;
function Uo() {
  if (ca) return le;
  ca = 1, Object.defineProperty(le, "__esModule", { value: !0 }), le.getBigUint64 = le.parseBigInt = void 0;
  function t(r) {
    if (r > BigInt(Number.MAX_SAFE_INTEGER) || r < BigInt(-Number.MAX_SAFE_INTEGER))
      throw new Error(\`Cannot convert bigint to number: \${r}\`);
    return Number(r);
  }
  le.parseBigInt = t;
  function e(r, n, a) {
    if (r.getBigUint64)
      return r.getBigUint64(n, a);
    const [i, o] = a ? [4, 0] : [0, 4], s = BigInt(r.getUint32(n + i, a)), h = BigInt(r.getUint32(n + o, a));
    return (s << BigInt(32)) + h;
  }
  return le.getBigUint64 = e, le;
}
var Ht = {}, fa;
function Bo() {
  if (fa) return Ht;
  fa = 1, Object.defineProperty(Ht, "__esModule", { value: !0 }), Ht.toCString = Ht.toDataView = Ht.Binary = void 0, Ht.Binary = { toDataView: t, toCString: e };
  function t(r) {
    return new DataView(r.buffer, r.byteOffset, r.length);
  }
  Ht.toDataView = t;
  function e(r) {
    const n = t(r);
    let a = "";
    for (let i = 0; i < n.byteLength; ++i) {
      const o = n.getInt8(i);
      if (o === 0)
        return a;
      a += String.fromCharCode(o);
    }
    return a;
  }
  return Ht.toCString = e, Ht;
}
var je = {}, da;
function jo() {
  if (da) return je;
  da = 1, Object.defineProperty(je, "__esModule", { value: !0 }), je.Bounds = void 0, je.Bounds = {
    min: t,
    max: e,
    mid: r,
    width: n,
    depth: a,
    height: i,
    cube: o,
    step: s,
    stepTo: h,
    intersection: f
  };
  function t(g) {
    return [g[0], g[1], g[2]];
  }
  function e(g) {
    return [g[3], g[4], g[5]];
  }
  function r([g, d, c, _, y, M]) {
    return [
      g + (_ - g) / 2,
      d + (y - d) / 2,
      c + (M - c) / 2
    ];
  }
  function n(g) {
    return g[3] - g[0];
  }
  function a(g) {
    return g[4] - g[1];
  }
  function i(g) {
    return g[5] - g[2];
  }
  function o(g) {
    const d = r(g), c = Math.max(n(g), a(g), i(g)) / 2;
    return [
      d[0] - c,
      d[1] - c,
      d[2] - c,
      d[0] + c,
      d[1] + c,
      d[2] + c
    ];
  }
  function s(g, [d, c, _]) {
    const [y, M, m, S, w, P] = g, [R, I, k] = r(g);
    return [
      d ? R : y,
      c ? I : M,
      _ ? k : m,
      d ? S : R,
      c ? w : I,
      _ ? P : k
    ];
  }
  function h(g, [d, c, _, y]) {
    for (let M = d - 1; M >= 0; --M)
      g = s(g, [c >> M & 1, _ >> M & 1, y >> M & 1]);
    return g;
  }
  function f(g, d) {
    return [
      Math.max(g[0], d[0]),
      Math.max(g[1], d[1]),
      Math.max(g[2], d[2]),
      Math.min(g[3], d[3]),
      Math.min(g[4], d[4]),
      Math.min(g[5], d[5])
    ];
  }
  return je;
}
var ke = {}, ga;
function ko() {
  if (ga) return ke;
  ga = 1, Object.defineProperty(ke, "__esModule", { value: !0 }), ke.Dimension = void 0;
  const t = {
    int8: { type: "signed", size: 1 },
    int16: { type: "signed", size: 2 },
    int32: { type: "signed", size: 4 },
    int64: { type: "signed", size: 8 },
    uint8: { type: "unsigned", size: 1 },
    uint16: { type: "unsigned", size: 2 },
    uint32: { type: "unsigned", size: 4 },
    uint64: { type: "unsigned", size: 8 },
    float32: { type: "float", size: 4 },
    float64: { type: "float", size: 8 },
    // Aliases.
    float: { type: "float", size: 4 },
    double: { type: "float", size: 8 },
    // Minimum size of one byte, so this is a convenience for a byte.
    bool: { type: "unsigned", size: 1 },
    boolean: { type: "unsigned", size: 1 }
  };
  ke.Dimension = { Type: t, ctype: e };
  function e({ type: r, size: n }) {
    switch (r) {
      case "signed":
        switch (n) {
          case 1:
            return "int8";
          case 2:
            return "int16";
          case 4:
            return "int32";
          case 8:
            return "int64";
        }
      case "unsigned":
        switch (n) {
          case 1:
            return "uint8";
          case 2:
            return "uint16";
          case 4:
            return "uint32";
          case 8:
            return "uint64";
        }
      case "float":
        switch (n) {
          case 4:
            return "float";
          case 8:
            return "double";
        }
    }
    throw new Error(\`Invalid dimension type/size: \${r}/\${n}\`);
  }
  return ke;
}
var Pt = {}, xr = { exports: {} }, _a;
function qo() {
  return _a || (_a = 1, (function(t, e) {
    var r = typeof globalThis < "u" && globalThis || typeof self < "u" && self || typeof Sr < "u" && Sr, n = (function() {
      function i() {
        this.fetch = !1, this.DOMException = r.DOMException;
      }
      return i.prototype = r, new i();
    })();
    (function(i) {
      (function(o) {
        var s = typeof i < "u" && i || typeof self < "u" && self || // eslint-disable-next-line no-undef
        typeof Sr < "u" && Sr || {}, h = {
          searchParams: "URLSearchParams" in s,
          iterable: "Symbol" in s && "iterator" in Symbol,
          blob: "FileReader" in s && "Blob" in s && (function() {
            try {
              return new Blob(), !0;
            } catch {
              return !1;
            }
          })(),
          formData: "FormData" in s,
          arrayBuffer: "ArrayBuffer" in s
        };
        function f(b) {
          return b && DataView.prototype.isPrototypeOf(b);
        }
        if (h.arrayBuffer)
          var g = [
            "[object Int8Array]",
            "[object Uint8Array]",
            "[object Uint8ClampedArray]",
            "[object Int16Array]",
            "[object Uint16Array]",
            "[object Int32Array]",
            "[object Uint32Array]",
            "[object Float32Array]",
            "[object Float64Array]"
          ], d = ArrayBuffer.isView || function(b) {
            return b && g.indexOf(Object.prototype.toString.call(b)) > -1;
          };
        function c(b) {
          if (typeof b != "string" && (b = String(b)), /[^a-z0-9\\-#$%&'*+.^_\`|~!]/i.test(b) || b === "")
            throw new TypeError('Invalid character in header field name: "' + b + '"');
          return b.toLowerCase();
        }
        function _(b) {
          return typeof b != "string" && (b = String(b)), b;
        }
        function y(b) {
          var T = {
            next: function() {
              var q = b.shift();
              return { done: q === void 0, value: q };
            }
          };
          return h.iterable && (T[Symbol.iterator] = function() {
            return T;
          }), T;
        }
        function M(b) {
          this.map = {}, b instanceof M ? b.forEach(function(T, q) {
            this.append(q, T);
          }, this) : Array.isArray(b) ? b.forEach(function(T) {
            if (T.length != 2)
              throw new TypeError("Headers constructor: expected name/value pair to be length 2, found" + T.length);
            this.append(T[0], T[1]);
          }, this) : b && Object.getOwnPropertyNames(b).forEach(function(T) {
            this.append(T, b[T]);
          }, this);
        }
        M.prototype.append = function(b, T) {
          b = c(b), T = _(T);
          var q = this.map[b];
          this.map[b] = q ? q + ", " + T : T;
        }, M.prototype.delete = function(b) {
          delete this.map[c(b)];
        }, M.prototype.get = function(b) {
          return b = c(b), this.has(b) ? this.map[b] : null;
        }, M.prototype.has = function(b) {
          return this.map.hasOwnProperty(c(b));
        }, M.prototype.set = function(b, T) {
          this.map[c(b)] = _(T);
        }, M.prototype.forEach = function(b, T) {
          for (var q in this.map)
            this.map.hasOwnProperty(q) && b.call(T, this.map[q], q, this);
        }, M.prototype.keys = function() {
          var b = [];
          return this.forEach(function(T, q) {
            b.push(q);
          }), y(b);
        }, M.prototype.values = function() {
          var b = [];
          return this.forEach(function(T) {
            b.push(T);
          }), y(b);
        }, M.prototype.entries = function() {
          var b = [];
          return this.forEach(function(T, q) {
            b.push([q, T]);
          }), y(b);
        }, h.iterable && (M.prototype[Symbol.iterator] = M.prototype.entries);
        function m(b) {
          if (!b._noBody) {
            if (b.bodyUsed)
              return Promise.reject(new TypeError("Already read"));
            b.bodyUsed = !0;
          }
        }
        function S(b) {
          return new Promise(function(T, q) {
            b.onload = function() {
              T(b.result);
            }, b.onerror = function() {
              q(b.error);
            };
          });
        }
        function w(b) {
          var T = new FileReader(), q = S(T);
          return T.readAsArrayBuffer(b), q;
        }
        function P(b) {
          var T = new FileReader(), q = S(T), Y = /charset=([A-Za-z0-9_-]+)/.exec(b.type), Z = Y ? Y[1] : "utf-8";
          return T.readAsText(b, Z), q;
        }
        function R(b) {
          for (var T = new Uint8Array(b), q = new Array(T.length), Y = 0; Y < T.length; Y++)
            q[Y] = String.fromCharCode(T[Y]);
          return q.join("");
        }
        function I(b) {
          if (b.slice)
            return b.slice(0);
          var T = new Uint8Array(b.byteLength);
          return T.set(new Uint8Array(b)), T.buffer;
        }
        function k() {
          return this.bodyUsed = !1, this._initBody = function(b) {
            this.bodyUsed = this.bodyUsed, this._bodyInit = b, b ? typeof b == "string" ? this._bodyText = b : h.blob && Blob.prototype.isPrototypeOf(b) ? this._bodyBlob = b : h.formData && FormData.prototype.isPrototypeOf(b) ? this._bodyFormData = b : h.searchParams && URLSearchParams.prototype.isPrototypeOf(b) ? this._bodyText = b.toString() : h.arrayBuffer && h.blob && f(b) ? (this._bodyArrayBuffer = I(b.buffer), this._bodyInit = new Blob([this._bodyArrayBuffer])) : h.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(b) || d(b)) ? this._bodyArrayBuffer = I(b) : this._bodyText = b = Object.prototype.toString.call(b) : (this._noBody = !0, this._bodyText = ""), this.headers.get("content-type") || (typeof b == "string" ? this.headers.set("content-type", "text/plain;charset=UTF-8") : this._bodyBlob && this._bodyBlob.type ? this.headers.set("content-type", this._bodyBlob.type) : h.searchParams && URLSearchParams.prototype.isPrototypeOf(b) && this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8"));
          }, h.blob && (this.blob = function() {
            var b = m(this);
            if (b)
              return b;
            if (this._bodyBlob)
              return Promise.resolve(this._bodyBlob);
            if (this._bodyArrayBuffer)
              return Promise.resolve(new Blob([this._bodyArrayBuffer]));
            if (this._bodyFormData)
              throw new Error("could not read FormData body as blob");
            return Promise.resolve(new Blob([this._bodyText]));
          }), this.arrayBuffer = function() {
            if (this._bodyArrayBuffer) {
              var b = m(this);
              return b || (ArrayBuffer.isView(this._bodyArrayBuffer) ? Promise.resolve(
                this._bodyArrayBuffer.buffer.slice(
                  this._bodyArrayBuffer.byteOffset,
                  this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                )
              ) : Promise.resolve(this._bodyArrayBuffer));
            } else {
              if (h.blob)
                return this.blob().then(w);
              throw new Error("could not read as ArrayBuffer");
            }
          }, this.text = function() {
            var b = m(this);
            if (b)
              return b;
            if (this._bodyBlob)
              return P(this._bodyBlob);
            if (this._bodyArrayBuffer)
              return Promise.resolve(R(this._bodyArrayBuffer));
            if (this._bodyFormData)
              throw new Error("could not read FormData body as text");
            return Promise.resolve(this._bodyText);
          }, h.formData && (this.formData = function() {
            return this.text().then(ot);
          }), this.json = function() {
            return this.text().then(JSON.parse);
          }, this;
        }
        var W = ["CONNECT", "DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"];
        function D(b) {
          var T = b.toUpperCase();
          return W.indexOf(T) > -1 ? T : b;
        }
        function V(b, T) {
          if (!(this instanceof V))
            throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
          T = T || {};
          var q = T.body;
          if (b instanceof V) {
            if (b.bodyUsed)
              throw new TypeError("Already read");
            this.url = b.url, this.credentials = b.credentials, T.headers || (this.headers = new M(b.headers)), this.method = b.method, this.mode = b.mode, this.signal = b.signal, !q && b._bodyInit != null && (q = b._bodyInit, b.bodyUsed = !0);
          } else
            this.url = String(b);
          if (this.credentials = T.credentials || this.credentials || "same-origin", (T.headers || !this.headers) && (this.headers = new M(T.headers)), this.method = D(T.method || this.method || "GET"), this.mode = T.mode || this.mode || null, this.signal = T.signal || this.signal || (function() {
            if ("AbortController" in s) {
              var B = new AbortController();
              return B.signal;
            }
          })(), this.referrer = null, (this.method === "GET" || this.method === "HEAD") && q)
            throw new TypeError("Body not allowed for GET or HEAD requests");
          if (this._initBody(q), (this.method === "GET" || this.method === "HEAD") && (T.cache === "no-store" || T.cache === "no-cache")) {
            var Y = /([?&])_=[^&]*/;
            if (Y.test(this.url))
              this.url = this.url.replace(Y, "$1_=" + (/* @__PURE__ */ new Date()).getTime());
            else {
              var Z = /\\?/;
              this.url += (Z.test(this.url) ? "&" : "?") + "_=" + (/* @__PURE__ */ new Date()).getTime();
            }
          }
        }
        V.prototype.clone = function() {
          return new V(this, { body: this._bodyInit });
        };
        function ot(b) {
          var T = new FormData();
          return b.trim().split("&").forEach(function(q) {
            if (q) {
              var Y = q.split("="), Z = Y.shift().replace(/\\+/g, " "), B = Y.join("=").replace(/\\+/g, " ");
              T.append(decodeURIComponent(Z), decodeURIComponent(B));
            }
          }), T;
        }
        function it(b) {
          var T = new M(), q = b.replace(/\\r?\\n[\\t ]+/g, " ");
          return q.split("\\r").map(function(Y) {
            return Y.indexOf(\`
\`) === 0 ? Y.substr(1, Y.length) : Y;
          }).forEach(function(Y) {
            var Z = Y.split(":"), B = Z.shift().trim();
            if (B) {
              var K = Z.join(":").trim();
              try {
                T.append(B, K);
              } catch (ge) {
                console.warn("Response " + ge.message);
              }
            }
          }), T;
        }
        k.call(V.prototype);
        function tt(b, T) {
          if (!(this instanceof tt))
            throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
          if (T || (T = {}), this.type = "default", this.status = T.status === void 0 ? 200 : T.status, this.status < 200 || this.status > 599)
            throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].");
          this.ok = this.status >= 200 && this.status < 300, this.statusText = T.statusText === void 0 ? "" : "" + T.statusText, this.headers = new M(T.headers), this.url = T.url || "", this._initBody(b);
        }
        k.call(tt.prototype), tt.prototype.clone = function() {
          return new tt(this._bodyInit, {
            status: this.status,
            statusText: this.statusText,
            headers: new M(this.headers),
            url: this.url
          });
        }, tt.error = function() {
          var b = new tt(null, { status: 200, statusText: "" });
          return b.ok = !1, b.status = 0, b.type = "error", b;
        };
        var lt = [301, 302, 303, 307, 308];
        tt.redirect = function(b, T) {
          if (lt.indexOf(T) === -1)
            throw new RangeError("Invalid status code");
          return new tt(null, { status: T, headers: { location: b } });
        }, o.DOMException = s.DOMException;
        try {
          new o.DOMException();
        } catch {
          o.DOMException = function(T, q) {
            this.message = T, this.name = q;
            var Y = Error(T);
            this.stack = Y.stack;
          }, o.DOMException.prototype = Object.create(Error.prototype), o.DOMException.prototype.constructor = o.DOMException;
        }
        function ee(b, T) {
          return new Promise(function(q, Y) {
            var Z = new V(b, T);
            if (Z.signal && Z.signal.aborted)
              return Y(new o.DOMException("Aborted", "AbortError"));
            var B = new XMLHttpRequest();
            function K() {
              B.abort();
            }
            B.onload = function() {
              var st = {
                statusText: B.statusText,
                headers: it(B.getAllResponseHeaders() || "")
              };
              Z.url.indexOf("file://") === 0 && (B.status < 200 || B.status > 599) ? st.status = 200 : st.status = B.status, st.url = "responseURL" in B ? B.responseURL : st.headers.get("X-Request-URL");
              var Ct = "response" in B ? B.response : B.responseText;
              setTimeout(function() {
                q(new tt(Ct, st));
              }, 0);
            }, B.onerror = function() {
              setTimeout(function() {
                Y(new TypeError("Network request failed"));
              }, 0);
            }, B.ontimeout = function() {
              setTimeout(function() {
                Y(new TypeError("Network request timed out"));
              }, 0);
            }, B.onabort = function() {
              setTimeout(function() {
                Y(new o.DOMException("Aborted", "AbortError"));
              }, 0);
            };
            function ge(st) {
              try {
                return st === "" && s.location.href ? s.location.href : st;
              } catch {
                return st;
              }
            }
            if (B.open(Z.method, ge(Z.url), !0), Z.credentials === "include" ? B.withCredentials = !0 : Z.credentials === "omit" && (B.withCredentials = !1), "responseType" in B && (h.blob ? B.responseType = "blob" : h.arrayBuffer && (B.responseType = "arraybuffer")), T && typeof T.headers == "object" && !(T.headers instanceof M || s.Headers && T.headers instanceof s.Headers)) {
              var Ce = [];
              Object.getOwnPropertyNames(T.headers).forEach(function(st) {
                Ce.push(c(st)), B.setRequestHeader(st, _(T.headers[st]));
              }), Z.headers.forEach(function(st, Ct) {
                Ce.indexOf(Ct) === -1 && B.setRequestHeader(Ct, st);
              });
            } else
              Z.headers.forEach(function(st, Ct) {
                B.setRequestHeader(Ct, st);
              });
            Z.signal && (Z.signal.addEventListener("abort", K), B.onreadystatechange = function() {
              B.readyState === 4 && Z.signal.removeEventListener("abort", K);
            }), B.send(typeof Z._bodyInit > "u" ? null : Z._bodyInit);
          });
        }
        return ee.polyfill = !0, s.fetch || (s.fetch = ee, s.Headers = M, s.Request = V, s.Response = tt), o.Headers = M, o.Request = V, o.Response = tt, o.fetch = ee, Object.defineProperty(o, "__esModule", { value: !0 }), o;
      })({});
    })(n), n.fetch.ponyfill = !0, delete n.fetch.polyfill;
    var a = r.fetch ? r : n;
    e = a.fetch, e.default = a.fetch, e.fetch = a.fetch, e.Headers = a.Headers, e.Request = a.Request, e.Response = a.Response, t.exports = e;
  })(xr, xr.exports)), xr.exports;
}
var $o = {}, zo = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  default: $o
}), Ho = /* @__PURE__ */ No(zo), va;
function Wo() {
  if (va) return Pt;
  va = 1;
  var t = Pt && Pt.__createBinding || (Object.create ? (function(f, g, d, c) {
    c === void 0 && (c = d);
    var _ = Object.getOwnPropertyDescriptor(g, d);
    (!_ || ("get" in _ ? !g.__esModule : _.writable || _.configurable)) && (_ = { enumerable: !0, get: function() {
      return g[d];
    } }), Object.defineProperty(f, c, _);
  }) : (function(f, g, d, c) {
    c === void 0 && (c = d), f[c] = g[d];
  })), e = Pt && Pt.__setModuleDefault || (Object.create ? (function(f, g) {
    Object.defineProperty(f, "default", { enumerable: !0, value: g });
  }) : function(f, g) {
    f.default = g;
  }), r = Pt && Pt.__importStar || function(f) {
    if (f && f.__esModule) return f;
    var g = {};
    if (f != null) for (var d in f) d !== "default" && Object.prototype.hasOwnProperty.call(f, d) && t(g, f, d);
    return e(g, f), g;
  }, n = Pt && Pt.__importDefault || function(f) {
    return f && f.__esModule ? f : { default: f };
  };
  Object.defineProperty(Pt, "__esModule", { value: !0 }), Pt.Getter = void 0;
  const a = n(qo());
  Pt.Getter = { create: i, http: o, file: s };
  function i(f) {
    return typeof f == "function" ? f : f.startsWith("http://") || f.startsWith("https://") ? o(f) : s(f);
  }
  function o(f) {
    return async function(d, c) {
      if (d < 0 || c < 0 || d > c)
        throw new Error("Invalid range");
      const y = await (await (0, a.default)(f, {
        headers: { Range: \`bytes=\${d}-\${c - 1}\` }
      })).arrayBuffer();
      return new Uint8Array(y);
    };
  }
  function s(f) {
    return async function(d, c) {
      const _ = await Promise.resolve().then(() => r(Ho));
      async function y(M = 0, m = 1 / 0) {
        if (M < 0 || m < 0 || M > m)
          throw new Error("Invalid range");
        await _.promises.access(f);
        const S = _.createReadStream(f, {
          start: M,
          end: m - 1,
          autoClose: !0
        });
        return h(S);
      }
      return y(d, c);
    };
  }
  async function h(f) {
    return await new Promise((g, d) => {
      const c = [];
      f.on("data", (_) => c.push(_)), f.on("error", d), f.on("end", () => g(Buffer.concat(c)));
    });
  }
  return Pt;
}
var ci = {}, ya;
function Vo() {
  return ya || (ya = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Key = void 0, t.Key = { create: e, parse: r, toString: n, step: a, up: i, compare: o, depth: s };
    function e(h, f = 0, g = 0, d = 0) {
      return typeof h != "number" ? r(h) : [h, f, g, d];
    }
    function r(h) {
      if (typeof h != "string")
        return h;
      const [f, g, d, c, ..._] = h.split("-").map((M) => parseInt(M, 10)), y = [f, g, d, c];
      if (_.length !== 0 || y.some((M) => typeof M != "number" || Number.isNaN(M)))
        throw new Error(\`Invalid key: \${h}\`);
      return y;
    }
    function n(h) {
      return typeof h == "string" ? h : h.join("-");
    }
    function a(h, [f, g, d]) {
      const [c, _, y, M] = t.Key.create(h);
      return [c + 1, _ * 2 + f, y * 2 + g, M * 2 + d];
    }
    function i(h, f = 1) {
      const [g, d, c, _] = t.Key.create(h);
      return [g - f, d >> f, c >> f, _ >> f];
    }
    function o(h, f) {
      for (let g = 0; g < h.length; ++g) {
        if (h[g] < f[g])
          return -1;
        if (h[g] > f[g])
          return 1;
      }
      return 0;
    }
    function s(h) {
      return h[0];
    }
  })(ci)), ci;
}
var qe = {}, ma;
function Yo() {
  return ma || (ma = 1, Object.defineProperty(qe, "__esModule", { value: !0 }), qe.Scale = void 0, qe.Scale = {
    apply: (t, e = 1, r = 0) => (t - r) / e,
    unapply: (t, e = 1, r = 0) => t * e + r
  }), qe;
}
var $e = {}, Ma;
function Ko() {
  if (Ma) return $e;
  Ma = 1, Object.defineProperty($e, "__esModule", { value: !0 }), $e.Step = void 0, $e.Step = { fromIndex: t, list: e };
  function t(r) {
    if (r < 0 || r >= 8)
      throw new Error(\`Invalid step index: \${r}\`);
    const n = r >> 0 & 1 ? 1 : 0, a = r >> 1 & 1 ? 1 : 0, i = r >> 2 & 1 ? 1 : 0;
    return [n, a, i];
  }
  function e() {
    return [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 1, 1]
    ];
  }
  return $e;
}
var pa;
function Ft() {
  return pa || (pa = 1, (function(t) {
    var e = he && he.__createBinding || (Object.create ? (function(g, d, c, _) {
      _ === void 0 && (_ = c);
      var y = Object.getOwnPropertyDescriptor(d, c);
      (!y || ("get" in y ? !d.__esModule : y.writable || y.configurable)) && (y = { enumerable: !0, get: function() {
        return d[c];
      } }), Object.defineProperty(g, _, y);
    }) : (function(g, d, c, _) {
      _ === void 0 && (_ = c), g[_] = d[c];
    })), r = he && he.__exportStar || function(g, d) {
      for (var c in g) c !== "default" && !Object.prototype.hasOwnProperty.call(d, c) && e(d, g, c);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Step = t.Scale = t.Key = t.Getter = t.Dimension = t.Bounds = t.Binary = void 0, r(Uo(), t);
    var n = Bo();
    Object.defineProperty(t, "Binary", { enumerable: !0, get: function() {
      return n.Binary;
    } });
    var a = jo();
    Object.defineProperty(t, "Bounds", { enumerable: !0, get: function() {
      return a.Bounds;
    } });
    var i = ko();
    Object.defineProperty(t, "Dimension", { enumerable: !0, get: function() {
      return i.Dimension;
    } });
    var o = Wo();
    Object.defineProperty(t, "Getter", { enumerable: !0, get: function() {
      return o.Getter;
    } });
    var s = Vo();
    Object.defineProperty(t, "Key", { enumerable: !0, get: function() {
      return s.Key;
    } });
    var h = Yo();
    Object.defineProperty(t, "Scale", { enumerable: !0, get: function() {
      return h.Scale;
    } });
    var f = Ko();
    Object.defineProperty(t, "Step", { enumerable: !0, get: function() {
      return f.Step;
    } });
  })(he)), he;
}
var ze = {}, wa;
function on() {
  if (wa) return ze;
  wa = 1, Object.defineProperty(ze, "__esModule", { value: !0 }), ze.ExtraBytes = void 0;
  const t = Ft();
  ze.ExtraBytes = { getDimension: r, parse: n, parseOne: a };
  const e = 192;
  function r({ type: s, length: h }) {
    switch (s) {
      case "signed":
      case "unsigned":
        switch (h) {
          case 1:
          case 2:
          case 4:
          case 8:
            return { type: s, size: h };
        }
      case "float":
        switch (h) {
          case 4:
          case 8:
            return { type: s, size: h };
        }
    }
  }
  function n(s) {
    if (s.byteLength % e !== 0)
      throw new Error(\`Invalid extra bytes VLR length: \${s.byteLength}\`);
    const h = [];
    for (let f = 0; f < s.byteLength; f += e)
      h.push(a(s.slice(f, f + e)));
    return h;
  }
  function a(s) {
    if (s.byteLength !== e)
      throw new Error(\`Invalid extra bytes entry length: \${s.byteLength}\`);
    const h = t.Binary.toDataView(s), f = t.Binary.toCString(s.slice(4, 36)), g = t.Binary.toCString(s.slice(60, 192)), d = h.getUint8(2), c = h.getUint8(3);
    if (d >= 11)
      throw new Error(\`Invalid extra bytes "type" value: \${d}\`);
    if (d === 0)
      return { name: f, description: g, length: c };
    const _ = o(c), y = i(d);
    if (!y)
      throw new Error(\`Failed to extract dimension type: \${d}\`);
    const { type: M, size: m } = y;
    function S(P) {
      switch (M) {
        case "signed":
          return (0, t.parseBigInt)(h.getBigInt64(P, !0));
        case "unsigned":
          return (0, t.parseBigInt)((0, t.getBigUint64)(h, P, !0));
        case "float":
          return h.getFloat64(P, !0);
      }
    }
    const w = { name: f, description: g, type: M, length: m };
    return _.hasNodata && (w.nodata = S(40)), _.hasMin && (w.min = S(64)), _.hasMax && (w.max = S(88)), _.hasScale && (w.scale = h.getFloat64(112)), _.hasOffset && (w.offset = h.getFloat64(136)), w;
  }
  function i(s) {
    switch (s) {
      case 1:
        return t.Dimension.Type.uint8;
      case 2:
        return t.Dimension.Type.int8;
      case 3:
        return t.Dimension.Type.uint16;
      case 4:
        return t.Dimension.Type.int16;
      case 5:
        return t.Dimension.Type.uint32;
      case 6:
        return t.Dimension.Type.int32;
      case 7:
        return t.Dimension.Type.uint64;
      case 8:
        return t.Dimension.Type.int64;
      case 9:
        return t.Dimension.Type.float32;
      case 10:
        return t.Dimension.Type.float64;
    }
  }
  function o(s) {
    return {
      hasNodata: !!(s & 1),
      hasMin: !!(s >> 1 & 1),
      hasMax: !!(s >> 2 & 1),
      hasScale: !!(s >> 3 & 1),
      hasOffset: !!(s >> 4 & 1)
    };
  }
  return ze;
}
var ba;
function hn() {
  if (ba) return Be;
  ba = 1, Object.defineProperty(Be, "__esModule", { value: !0 }), Be.Dimensions = void 0;
  const t = Ft(), e = on();
  Be.Dimensions = { create: a };
  const { Type: r } = t.Dimension, n = {
    X: r.float64,
    Y: r.float64,
    Z: r.float64,
    Intensity: r.uint16,
    ReturnNumber: r.uint8,
    NumberOfReturns: r.uint8,
    ScanDirectionFlag: r.boolean,
    EdgeOfFlightLine: r.boolean,
    Classification: r.uint8,
    Synthetic: r.boolean,
    KeyPoint: r.boolean,
    Withheld: r.boolean,
    Overlap: r.boolean,
    ScanAngle: r.float32,
    UserData: r.uint8,
    PointSourceId: r.uint16,
    GpsTime: r.float64,
    Red: r.uint16,
    Green: r.uint16,
    Blue: r.uint16,
    ScannerChannel: r.uint8,
    Infrared: r.uint16
  };
  function a(i, o = []) {
    return Object.keys(i).reduce((s, h) => {
      const f = n[h];
      if (f)
        return { ...s, [h]: f };
      const g = o.find((c) => c.name === h), d = g && e.ExtraBytes.getDimension(g);
      if (d)
        return { ...s, [h]: d };
      throw new Error(\`Failed to look up LAS type: \${h}\`);
    }, {});
  }
  return Be;
}
var He = {}, Ea;
function ln() {
  if (Ea) return He;
  Ea = 1, Object.defineProperty(He, "__esModule", { value: !0 }), He.Extractor = void 0;
  const t = Ft();
  He.Extractor = { create: a };
  function e(_) {
    switch (_) {
      case 0:
        return 20;
      case 1:
        return 28;
      case 2:
        return 26;
      case 3:
        return 34;
      case 6:
        return 30;
      case 7:
        return 36;
      case 8:
        return 38;
      default:
        throw new Error(\`Unsupported point data record format: \${_}\`);
    }
  }
  function r(_, y, { type: M, length: m }) {
    const S = c(_);
    switch (M) {
      case "signed":
        switch (m) {
          case 1:
            return (w, P) => w.getInt8(S(P) + y);
          case 2:
            return (w, P) => w.getInt16(S(P) + y, !0);
          case 4:
            return (w, P) => w.getInt32(S(P) + y, !0);
          case 8:
            return (w, P) => (0, t.parseBigInt)(w.getBigInt64(S(P) + y, !0));
        }
      case "unsigned":
        switch (m) {
          case 1:
            return (w, P) => w.getUint8(S(P) + y);
          case 2:
            return (w, P) => w.getUint16(S(P) + y, !0);
          case 4:
            return (w, P) => w.getUint32(S(P) + y, !0);
          case 8:
            return (w, P) => (0, t.parseBigInt)((0, t.getBigUint64)(w, S(P) + y, !0));
        }
      case "float":
        switch (m) {
          case 4:
            return (w, P) => w.getFloat32(S(P) + y, !0);
          case 8:
            return (w, P) => w.getFloat64(S(P) + y, !0);
        }
    }
  }
  function n(_, y) {
    let m = e(_.pointDataRecordFormat);
    return y.reduce((S, w) => {
      const P = m;
      m += w.length;
      const R = r(_, P, w);
      if (!R)
        return S;
      const I = (k, W) => t.Scale.unapply(R(k, W), w.scale, w.offset);
      return { ...S, [w.name]: I };
    }, {});
  }
  function a(_, y = []) {
    const M = n(_, y);
    return { ...(() => {
      const { pointDataRecordFormat: S } = _;
      switch (S) {
        case 0:
          return i(_);
        case 1:
          return o(_);
        case 2:
          return s(_);
        case 3:
          return h(_);
        case 6:
          return f(_);
        case 7:
          return g(_);
        case 8:
          return d(_);
        default:
          throw new Error(\`Unsupported point data record format: \${S}\`);
      }
    })(), ...M };
  }
  function i(_) {
    const { scale: y, offset: M } = _, m = c(_);
    function S(R, I) {
      return R.getUint8(m(I) + 14);
    }
    function w(R, I) {
      return R.getUint8(m(I) + 15);
    }
    function P(R, I) {
      return w(R, I) & 31;
    }
    return {
      X: (R, I) => t.Scale.unapply(R.getInt32(m(I), !0), y[0], M[0]),
      Y: (R, I) => t.Scale.unapply(R.getInt32(m(I) + 4, !0), y[1], M[1]),
      Z: (R, I) => t.Scale.unapply(R.getInt32(m(I) + 8, !0), y[2], M[2]),
      Intensity: (R, I) => R.getUint16(m(I) + 12, !0),
      ReturnNumber: (R, I) => S(R, I) & 7,
      NumberOfReturns: (R, I) => (S(R, I) & 56) >> 3,
      ScanDirectionFlag: (R, I) => (S(R, I) & 64) >> 6,
      EdgeOfFlightLine: (R, I) => (S(R, I) & 128) >> 7,
      Classification: (R, I) => {
        const k = P(R, I);
        return k === 12 ? 0 : k;
      },
      Synthetic: (R, I) => (w(R, I) & 32) >> 5,
      KeyPoint: (R, I) => (w(R, I) & 64) >> 6,
      Withheld: (R, I) => (w(R, I) & 128) >> 7,
      Overlap: (R, I) => P(R, I) === 12 ? 1 : 0,
      ScanAngle: (R, I) => R.getInt8(m(I) + 16),
      UserData: (R, I) => R.getUint8(m(I) + 17),
      PointSourceId: (R, I) => R.getUint16(m(I) + 18, !0)
    };
  }
  function o(_) {
    const y = c(_);
    return {
      ...i(_),
      GpsTime: (M, m) => M.getFloat64(y(m) + 20, !0)
    };
  }
  function s(_) {
    const y = c(_);
    return {
      ...i(_),
      Red: (M, m) => M.getUint16(y(m) + 20, !0),
      Green: (M, m) => M.getUint16(y(m) + 22, !0),
      Blue: (M, m) => M.getUint16(y(m) + 24, !0)
    };
  }
  function h(_) {
    const y = c(_);
    return {
      ...i(_),
      GpsTime: (M, m) => M.getFloat64(y(m) + 20, !0),
      Red: (M, m) => M.getUint16(y(m) + 28, !0),
      Green: (M, m) => M.getUint16(y(m) + 30, !0),
      Blue: (M, m) => M.getUint16(y(m) + 32, !0)
    };
  }
  function f(_) {
    const { scale: y, offset: M } = _, m = c(_);
    function S(w, P) {
      return w.getUint8(m(P) + 15);
    }
    return {
      X: (w, P) => t.Scale.unapply(w.getInt32(m(P), !0), y[0], M[0]),
      Y: (w, P) => t.Scale.unapply(w.getInt32(m(P) + 4, !0), y[1], M[1]),
      Z: (w, P) => t.Scale.unapply(w.getInt32(m(P) + 8, !0), y[2], M[2]),
      Intensity: (w, P) => w.getUint16(m(P) + 12, !0),
      ReturnNumber: (w, P) => w.getUint16(m(P) + 14, !0) & 15,
      NumberOfReturns: (w, P) => (w.getUint16(m(P) + 14, !0) & 240) >> 4,
      Synthetic: (w, P) => S(w, P) & 1,
      KeyPoint: (w, P) => (S(w, P) & 2) >> 1,
      Withheld: (w, P) => (S(w, P) & 4) >> 2,
      Overlap: (w, P) => (S(w, P) & 8) >> 3,
      ScannerChannel: (w, P) => (S(w, P) & 48) >> 4,
      ScanDirectionFlag: (w, P) => (S(w, P) & 64) >> 6,
      EdgeOfFlightLine: (w, P) => (S(w, P) & 128) >> 7,
      Classification: (w, P) => w.getUint8(m(P) + 16),
      UserData: (w, P) => w.getUint8(m(P) + 17),
      ScanAngle: (w, P) => w.getInt16(m(P) + 18, !0) * 6e-3,
      PointSourceId: (w, P) => w.getUint16(m(P) + 20, !0),
      GpsTime: (w, P) => w.getFloat64(m(P) + 22, !0)
    };
  }
  function g(_) {
    const y = c(_);
    return {
      ...f(_),
      Red: (M, m) => M.getUint16(y(m) + 30, !0),
      Green: (M, m) => M.getUint16(y(m) + 32, !0),
      Blue: (M, m) => M.getUint16(y(m) + 34, !0)
    };
  }
  function d(_) {
    const y = c(_);
    return {
      ...g(_),
      Infrared: (M, m) => M.getUint16(y(m) + 36, !0)
    };
  }
  function c(_) {
    const { pointDataRecordLength: y } = _;
    return function(m) {
      return m * y;
    };
  }
  return He;
}
var We = {}, ue = {}, Pa;
function Jo() {
  if (Pa) return ue;
  Pa = 1, Object.defineProperty(ue, "__esModule", { value: !0 }), ue.formatGuid = ue.parsePoint = void 0;
  const t = Ft();
  function e(n) {
    const a = t.Binary.toDataView(n);
    if (a.byteLength !== 24)
      throw new Error(\`Invalid tuple buffer length: \${a.byteLength}\`);
    return [
      a.getFloat64(0, !0),
      a.getFloat64(8, !0),
      a.getFloat64(16, !0)
    ];
  }
  ue.parsePoint = e;
  function r(n) {
    const a = t.Binary.toDataView(n);
    if (a.byteLength !== 16)
      throw new Error(\`Invalid GUID buffer length: \${a.byteLength}\`);
    let i = "";
    for (let o = 0; o < a.byteLength; o += 4) {
      const s = a.getUint32(o, !0);
      i += s.toString(16).padStart(8, "0");
    }
    return [i.slice(0, 8), i.slice(8, 12), i.slice(12, 16), i.slice(16, 32)].join("-");
  }
  return ue.formatGuid = r, ue;
}
var Sa;
function un() {
  if (Sa) return We;
  Sa = 1, Object.defineProperty(We, "__esModule", { value: !0 }), We.Header = void 0;
  const t = Ft(), e = Si(), r = Jo();
  We.Header = { parse: n };
  function n(o) {
    if (o.byteLength < e.minHeaderLength)
      throw new Error(\`Invalid header: must be at least \${e.minHeaderLength} bytes\`);
    const s = t.Binary.toDataView(o), h = t.Binary.toCString(o.slice(0, 4));
    if (h !== "LASF")
      throw new Error(\`Invalid file signature: \${h}\`);
    const f = s.getUint8(24), g = s.getUint8(25);
    if (f !== 1 || g !== 2 && g !== 4)
      throw new Error(\`Invalid version (only 1.2 and 1.4 supported): \${f}.\${g}\`);
    const d = {
      fileSignature: h,
      fileSourceId: s.getUint16(4, !0),
      globalEncoding: s.getUint16(6, !0),
      projectId: (0, r.formatGuid)(o.slice(8, 24)),
      majorVersion: f,
      minorVersion: g,
      systemIdentifier: t.Binary.toCString(o.slice(26, 58)),
      generatingSoftware: t.Binary.toCString(o.slice(58, 90)),
      fileCreationDayOfYear: s.getUint16(90, !0),
      fileCreationYear: s.getUint16(92, !0),
      headerLength: s.getUint16(94, !0),
      pointDataOffset: s.getUint32(96, !0),
      vlrCount: s.getUint32(100, !0),
      pointDataRecordFormat: s.getUint8(104) & 15,
      pointDataRecordLength: s.getUint16(105, !0),
      pointCount: s.getUint32(107, !0),
      pointCountByReturn: i(o.slice(111, 131)),
      scale: (0, r.parsePoint)(o.slice(131, 155)),
      offset: (0, r.parsePoint)(o.slice(155, 179)),
      min: [
        s.getFloat64(187, !0),
        s.getFloat64(203, !0),
        s.getFloat64(219, !0)
      ],
      max: [
        s.getFloat64(179, !0),
        s.getFloat64(195, !0),
        s.getFloat64(211, !0)
      ],
      waveformDataOffset: 0,
      evlrOffset: 0,
      evlrCount: 0
    };
    return g == 2 ? d : {
      ...d,
      pointCount: (0, t.parseBigInt)((0, t.getBigUint64)(s, 247, !0)),
      pointCountByReturn: a(o.slice(255, 375)),
      waveformDataOffset: (0, t.parseBigInt)((0, t.getBigUint64)(s, 227, !0)),
      evlrOffset: (0, t.parseBigInt)((0, t.getBigUint64)(s, 235, !0)),
      evlrCount: s.getUint32(243, !0)
    };
  }
  function a(o) {
    const s = t.Binary.toDataView(o), h = [];
    for (let f = 0; f < 120; f += 8)
      h.push((0, t.getBigUint64)(s, f, !0));
    return h.map((f) => (0, t.parseBigInt)(f));
  }
  function i(o) {
    const s = t.Binary.toDataView(o), h = [];
    for (let f = 0; f < 20; f += 4)
      h.push(s.getUint32(f, !0));
    return h;
  }
  return We;
}
var Wt = {}, Rt = {}, fi = { exports: {} }, xa;
function Xo() {
  return xa || (xa = 1, (function(t, e) {
    var r = (() => {
      var n = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
      return (function(a) {
        a = a || {};
        var i = typeof a < "u" ? a : {}, o, s;
        i.ready = new Promise(function(l, u) {
          o = l, s = u;
        }), ["_main", "___getTypeName", "__embind_initialize_bindings", "_fflush", "onRuntimeInitialized"].forEach((l) => {
          Object.getOwnPropertyDescriptor(i.ready, l) || Object.defineProperty(i.ready, l, { get: () => yt("You are getting " + l + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js"), set: () => yt("You are setting " + l + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js") });
        });
        var h = Object.assign({}, i), f = "./this.program", g = !0;
        if (i.ENVIRONMENT)
          throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
        var d = "";
        function c(l) {
          return i.locateFile ? i.locateFile(l, d) : d + l;
        }
        var _;
        if (typeof document < "u" && document.currentScript && (d = document.currentScript.src), n && (d = n), d.indexOf("blob:") !== 0 ? d = d.substr(0, d.replace(/[?#].*/, "").lastIndexOf("/") + 1) : d = "", !(typeof window == "object" || typeof importScripts == "function")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
        var y = i.print || console.log.bind(console), M = i.printErr || console.warn.bind(console);
        Object.assign(i, h), h = null, Ao(), i.arguments && i.arguments, m("arguments", "arguments_"), i.thisProgram && (f = i.thisProgram), m("thisProgram", "thisProgram"), i.quit && i.quit, m("quit", "quit_"), D(typeof i.memoryInitializerPrefixURL > "u", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead"), D(typeof i.pthreadMainPrefixURL > "u", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead"), D(typeof i.cdInitializerPrefixURL > "u", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead"), D(typeof i.filePackagePrefixURL > "u", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead"), D(typeof i.read > "u", "Module.read option was removed (modify read_ in JS)"), D(typeof i.readAsync > "u", "Module.readAsync option was removed (modify readAsync in JS)"), D(typeof i.readBinary > "u", "Module.readBinary option was removed (modify readBinary in JS)"), D(typeof i.setWindowTitle > "u", "Module.setWindowTitle option was removed (modify setWindowTitle in JS)"), D(typeof i.TOTAL_MEMORY > "u", "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY"), m("read", "read_"), m("readAsync", "readAsync"), m("readBinary", "readBinary"), m("setWindowTitle", "setWindowTitle"), D(!0, "worker environment detected but not enabled at build time.  Add 'worker' to \`-sENVIRONMENT\` to enable."), D(!0, "node environment detected but not enabled at build time.  Add 'node' to \`-sENVIRONMENT\` to enable."), D(!0, "shell environment detected but not enabled at build time.  Add 'shell' to \`-sENVIRONMENT\` to enable.");
        function m(l, u) {
          Object.getOwnPropertyDescriptor(i, l) || Object.defineProperty(i, l, { configurable: !0, get: function() {
            yt("Module." + l + " has been replaced with plain " + u + " (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)");
          } });
        }
        function S(l) {
          Object.getOwnPropertyDescriptor(i, l) && yt("\`Module." + l + "\` was supplied but \`" + l + "\` not included in INCOMING_MODULE_JS_API");
        }
        function w(l) {
          return l === "FS_createPath" || l === "FS_createDataFile" || l === "FS_createPreloadedFile" || l === "FS_unlink" || l === "addRunDependency" || l === "FS_createLazyFile" || l === "FS_createDevice" || l === "removeRunDependency";
        }
        function P(l) {
          typeof globalThis < "u" && !Object.getOwnPropertyDescriptor(globalThis, l) && Object.defineProperty(globalThis, l, { configurable: !0, get: function() {
            var u = "\`" + l + "\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line";
            w(l) && (u += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you"), ae(u);
          } });
        }
        function R(l) {
          Object.getOwnPropertyDescriptor(i, l) || Object.defineProperty(i, l, { configurable: !0, get: function() {
            var u = "'" + l + "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)";
            w(l) && (u += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you"), yt(u);
          } });
        }
        var I;
        i.wasmBinary && (I = i.wasmBinary), m("wasmBinary", "wasmBinary"), i.noExitRuntime, m("noExitRuntime", "noExitRuntime"), typeof WebAssembly != "object" && yt("no native wasm support detected");
        var k, W = !1;
        function D(l, u) {
          l || yt("Assertion failed" + (u ? ": " + u : ""));
        }
        var V = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
        function ot(l, u, v) {
          for (var p = u + v, E = u; l[E] && !(E >= p); ) ++E;
          if (E - u > 16 && l.buffer && V)
            return V.decode(l.subarray(u, E));
          for (var G = ""; u < E; ) {
            var C = l[u++];
            if (!(C & 128)) {
              G += String.fromCharCode(C);
              continue;
            }
            var x = l[u++] & 63;
            if ((C & 224) == 192) {
              G += String.fromCharCode((C & 31) << 6 | x);
              continue;
            }
            var L = l[u++] & 63;
            if ((C & 240) == 224 ? C = (C & 15) << 12 | x << 6 | L : ((C & 248) != 240 && ae("Invalid UTF-8 leading byte 0x" + C.toString(16) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!"), C = (C & 7) << 18 | x << 12 | L << 6 | l[u++] & 63), C < 65536)
              G += String.fromCharCode(C);
            else {
              var U = C - 65536;
              G += String.fromCharCode(55296 | U >> 10, 56320 | U & 1023);
            }
          }
          return G;
        }
        function it(l, u) {
          return l ? ot(q, l, u) : "";
        }
        function tt(l, u, v, p) {
          if (!(p > 0)) return 0;
          for (var E = v, G = v + p - 1, C = 0; C < l.length; ++C) {
            var x = l.charCodeAt(C);
            if (x >= 55296 && x <= 57343) {
              var L = l.charCodeAt(++C);
              x = 65536 + ((x & 1023) << 10) | L & 1023;
            }
            if (x <= 127) {
              if (v >= G) break;
              u[v++] = x;
            } else if (x <= 2047) {
              if (v + 1 >= G) break;
              u[v++] = 192 | x >> 6, u[v++] = 128 | x & 63;
            } else if (x <= 65535) {
              if (v + 2 >= G) break;
              u[v++] = 224 | x >> 12, u[v++] = 128 | x >> 6 & 63, u[v++] = 128 | x & 63;
            } else {
              if (v + 3 >= G) break;
              x > 1114111 && ae("Invalid Unicode code point 0x" + x.toString(16) + " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF)."), u[v++] = 240 | x >> 18, u[v++] = 128 | x >> 12 & 63, u[v++] = 128 | x >> 6 & 63, u[v++] = 128 | x & 63;
            }
          }
          return u[v] = 0, v - E;
        }
        function lt(l, u, v) {
          return D(typeof v == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), tt(l, q, u, v);
        }
        function ee(l) {
          for (var u = 0, v = 0; v < l.length; ++v) {
            var p = l.charCodeAt(v);
            p <= 127 ? u++ : p <= 2047 ? u += 2 : p >= 55296 && p <= 57343 ? (u += 4, ++v) : u += 3;
          }
          return u;
        }
        var b, T, q, Y, Z, B, K, ge, Ce;
        function st(l) {
          b = l, i.HEAP8 = T = new Int8Array(l), i.HEAP16 = Y = new Int16Array(l), i.HEAP32 = B = new Int32Array(l), i.HEAPU8 = q = new Uint8Array(l), i.HEAPU16 = Z = new Uint16Array(l), i.HEAPU32 = K = new Uint32Array(l), i.HEAPF32 = ge = new Float32Array(l), i.HEAPF64 = Ce = new Float64Array(l);
        }
        var Ct = 65536;
        i.TOTAL_STACK && D(Ct === i.TOTAL_STACK, "the stack size can no longer be determined at runtime");
        var Vr = i.INITIAL_MEMORY || 262144;
        m("INITIAL_MEMORY", "INITIAL_MEMORY"), D(Vr >= Ct, "INITIAL_MEMORY should be larger than TOTAL_STACK, was " + Vr + "! (TOTAL_STACK=" + Ct + ")"), D(typeof Int32Array < "u" && typeof Float64Array < "u" && Int32Array.prototype.subarray != null && Int32Array.prototype.set != null, "JS engine does not provide full typed array support"), D(!i.wasmMemory, "Use of \`wasmMemory\` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally"), D(Vr == 262144, "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically");
        var vr;
        function $n() {
          var l = li();
          D((l & 3) == 0), K[l >> 2] = 34821223, K[l + 4 >> 2] = 2310721022, K[0] = 1668509029;
        }
        function Yr() {
          if (!W) {
            var l = li(), u = K[l >> 2], v = K[l + 4 >> 2];
            (u != 34821223 || v != 2310721022) && yt("Stack overflow! Stack cookie has been overwritten at 0x" + l.toString(16) + ", expected hex dwords 0x89BACDFE and 0x2135467, but received 0x" + v.toString(16) + " 0x" + u.toString(16)), K[0] !== 1668509029 && yt("Runtime error: The application has corrupted its heap memory area (address zero)!");
          }
        }
        (function() {
          var l = new Int16Array(1), u = new Int8Array(l.buffer);
          if (l[0] = 25459, u[0] !== 115 || u[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
        })();
        var Fi = [], Di = [], Ui = [], Kr = !1;
        function zn() {
          if (i.preRun)
            for (typeof i.preRun == "function" && (i.preRun = [i.preRun]); i.preRun.length; )
              Vn(i.preRun.shift());
          Jr(Fi);
        }
        function Hn() {
          D(!Kr), Kr = !0, Yr(), Jr(Di);
        }
        function Wn() {
          if (Yr(), i.postRun)
            for (typeof i.postRun == "function" && (i.postRun = [i.postRun]); i.postRun.length; )
              Kn(i.postRun.shift());
          Jr(Ui);
        }
        function Vn(l) {
          Fi.unshift(l);
        }
        function Yn(l) {
          Di.unshift(l);
        }
        function Kn(l) {
          Ui.unshift(l);
        }
        D(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), D(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), D(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), D(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
        var re = 0, ie = null, Te = null, Ie = {};
        function Jn(l) {
          re++, i.monitorRunDependencies && i.monitorRunDependencies(re), D(!Ie[l]), Ie[l] = 1, ie === null && typeof setInterval < "u" && (ie = setInterval(function() {
            if (W) {
              clearInterval(ie), ie = null;
              return;
            }
            var u = !1;
            for (var v in Ie)
              u || (u = !0, M("still waiting on run dependencies:")), M("dependency: " + v);
            u && M("(end of list)");
          }, 1e4));
        }
        function Xn(l) {
          if (re--, i.monitorRunDependencies && i.monitorRunDependencies(re), D(Ie[l]), delete Ie[l], re == 0 && (ie !== null && (clearInterval(ie), ie = null), Te)) {
            var u = Te;
            Te = null, u();
          }
        }
        function yt(l) {
          i.onAbort && i.onAbort(l), l = "Aborted(" + l + ")", M(l), W = !0;
          var u = new WebAssembly.RuntimeError(l);
          throw s(u), u;
        }
        var St = { error: function() {
          yt("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM");
        }, init: function() {
          St.error();
        }, createDataFile: function() {
          St.error();
        }, createPreloadedFile: function() {
          St.error();
        }, createLazyFile: function() {
          St.error();
        }, open: function() {
          St.error();
        }, mkdev: function() {
          St.error();
        }, registerDevice: function() {
          St.error();
        }, analyzePath: function() {
          St.error();
        }, loadFilesFromDB: function() {
          St.error();
        }, ErrnoError: function() {
          St.error();
        } };
        i.FS_createDataFile = St.createDataFile, i.FS_createPreloadedFile = St.createPreloadedFile;
        var Qn = "data:application/octet-stream;base64,";
        function Bi(l) {
          return l.startsWith(Qn);
        }
        function Zn(l) {
          return l.startsWith("file://");
        }
        function ut(l, u) {
          return function() {
            var v = l, p = u;
            return p = i.asm, D(Kr, "native function \`" + v + "\` called before runtime initialization"), p[l] || D(p[l], "exported native function \`" + v + "\` not found"), p[l].apply(null, arguments);
          };
        }
        var Et;
        Et = "laz-perf.wasm", Bi(Et) || (Et = c(Et));
        function ji(l) {
          try {
            if (l == Et && I)
              return new Uint8Array(I);
            throw "both async and sync fetching of the wasm failed";
          } catch (u) {
            yt(u);
          }
        }
        function ts() {
          return !I && g && typeof fetch == "function" ? fetch(Et, { credentials: "same-origin" }).then(function(l) {
            if (!l.ok)
              throw "failed to load wasm binary file at '" + Et + "'";
            return l.arrayBuffer();
          }).catch(function() {
            return ji(Et);
          }) : Promise.resolve().then(function() {
            return ji(Et);
          });
        }
        function es() {
          var l = { env: ia, wasi_snapshot_preview1: ia };
          function u(x, L) {
            var U = x.exports;
            i.asm = U, k = i.asm.memory, D(k, "memory not found in wasm exports"), st(k.buffer), vr = i.asm.__indirect_function_table, D(vr, "table not found in wasm exports"), Yn(i.asm.__wasm_call_ctors), Xn("wasm-instantiate");
          }
          Jn("wasm-instantiate");
          var v = i;
          function p(x) {
            D(i === v, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?"), v = null, u(x.instance);
          }
          function E(x) {
            return ts().then(function(L) {
              return WebAssembly.instantiate(L, l);
            }).then(function(L) {
              return L;
            }).then(x, function(L) {
              M("failed to asynchronously prepare wasm: " + L), Zn(Et) && M("warning: Loading from a file URI (" + Et + ") is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing"), yt(L);
            });
          }
          function G() {
            return !I && typeof WebAssembly.instantiateStreaming == "function" && !Bi(Et) && typeof fetch == "function" ? fetch(Et, { credentials: "same-origin" }).then(function(x) {
              var L = WebAssembly.instantiateStreaming(x, l);
              return L.then(p, function(U) {
                return M("wasm streaming compile failed: " + U), M("falling back to ArrayBuffer instantiation"), E(p);
              });
            }) : E(p);
          }
          if (i.instantiateWasm)
            try {
              var C = i.instantiateWasm(l, u);
              return C;
            } catch (x) {
              return M("Module.instantiateWasm callback failed with error: " + x), !1;
            }
          return G().catch(s), {};
        }
        function Jr(l) {
          for (; l.length > 0; )
            l.shift()(i);
        }
        function ae(l) {
          ae.shown || (ae.shown = {}), ae.shown[l] || (ae.shown[l] = 1, M(l));
        }
        function rs(l, u) {
          D(l.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)"), T.set(l, u);
        }
        function is(l) {
          return hi(l + 24) + 24;
        }
        function as(l) {
          this.excPtr = l, this.ptr = l - 24, this.set_type = function(u) {
            K[this.ptr + 4 >> 2] = u;
          }, this.get_type = function() {
            return K[this.ptr + 4 >> 2];
          }, this.set_destructor = function(u) {
            K[this.ptr + 8 >> 2] = u;
          }, this.get_destructor = function() {
            return K[this.ptr + 8 >> 2];
          }, this.set_refcount = function(u) {
            B[this.ptr >> 2] = u;
          }, this.set_caught = function(u) {
            u = u ? 1 : 0, T[this.ptr + 12 >> 0] = u;
          }, this.get_caught = function() {
            return T[this.ptr + 12 >> 0] != 0;
          }, this.set_rethrown = function(u) {
            u = u ? 1 : 0, T[this.ptr + 13 >> 0] = u;
          }, this.get_rethrown = function() {
            return T[this.ptr + 13 >> 0] != 0;
          }, this.init = function(u, v) {
            this.set_adjusted_ptr(0), this.set_type(u), this.set_destructor(v), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
          }, this.add_ref = function() {
            var u = B[this.ptr >> 2];
            B[this.ptr >> 2] = u + 1;
          }, this.release_ref = function() {
            var u = B[this.ptr >> 2];
            return B[this.ptr >> 2] = u - 1, D(u > 0), u === 1;
          }, this.set_adjusted_ptr = function(u) {
            K[this.ptr + 16 >> 2] = u;
          }, this.get_adjusted_ptr = function() {
            return K[this.ptr + 16 >> 2];
          }, this.get_exception_ptr = function() {
            var u = To(this.get_type());
            if (u)
              return K[this.excPtr >> 2];
            var v = this.get_adjusted_ptr();
            return v !== 0 ? v : this.excPtr;
          };
        }
        function ns(l, u, v) {
          var p = new as(l);
          throw p.init(u, v), l + " - Exception catching is disabled, this exception cannot be caught. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.";
        }
        function ss(l, u, v, p, E) {
        }
        function Xr(l) {
          switch (l) {
            case 1:
              return 0;
            case 2:
              return 1;
            case 4:
              return 2;
            case 8:
              return 3;
            default:
              throw new TypeError("Unknown type size: " + l);
          }
        }
        function os() {
          for (var l = new Array(256), u = 0; u < 256; ++u)
            l[u] = String.fromCharCode(u);
          ki = l;
        }
        var ki = void 0;
        function xt(l) {
          for (var u = "", v = l; q[v]; )
            u += ki[q[v++]];
          return u;
        }
        var _e = {}, ve = {}, yr = {}, hs = 48, ls = 57;
        function qi(l) {
          if (l === void 0)
            return "_unknown";
          l = l.replace(/[^a-zA-Z0-9_]/g, "$");
          var u = l.charCodeAt(0);
          return u >= hs && u <= ls ? "_" + l : l;
        }
        function $i(l, u) {
          return l = qi(l), function() {
            return u.apply(this, arguments);
          };
        }
        function Qr(l, u) {
          var v = $i(u, function(p) {
            this.name = u, this.message = p;
            var E = new Error(p).stack;
            E !== void 0 && (this.stack = this.toString() + \`
\` + E.replace(/^Error(:[^\\n]*)?\\n/, ""));
          });
          return v.prototype = Object.create(l.prototype), v.prototype.constructor = v, v.prototype.toString = function() {
            return this.message === void 0 ? this.name : this.name + ": " + this.message;
          }, v;
        }
        var ye = void 0;
        function J(l) {
          throw new ye(l);
        }
        var zi = void 0;
        function mr(l) {
          throw new zi(l);
        }
        function Oe(l, u, v) {
          l.forEach(function(x) {
            yr[x] = u;
          });
          function p(x) {
            var L = v(x);
            L.length !== l.length && mr("Mismatched type converter count");
            for (var U = 0; U < l.length; ++U)
              jt(l[U], L[U]);
          }
          var E = new Array(u.length), G = [], C = 0;
          u.forEach((x, L) => {
            ve.hasOwnProperty(x) ? E[L] = ve[x] : (G.push(x), _e.hasOwnProperty(x) || (_e[x] = []), _e[x].push(() => {
              E[L] = ve[x], ++C, C === G.length && p(E);
            }));
          }), G.length === 0 && p(E);
        }
        function jt(l, u, v = {}) {
          if (!("argPackAdvance" in u))
            throw new TypeError("registerType registeredInstance requires argPackAdvance");
          var p = u.name;
          if (l || J('type "' + p + '" must have a positive integer typeid pointer'), ve.hasOwnProperty(l)) {
            if (v.ignoreDuplicateRegistrations)
              return;
            J("Cannot register type '" + p + "' twice");
          }
          if (ve[l] = u, delete yr[l], _e.hasOwnProperty(l)) {
            var E = _e[l];
            delete _e[l], E.forEach((G) => G());
          }
        }
        function us(l, u, v, p, E) {
          var G = Xr(v);
          u = xt(u), jt(l, { name: u, fromWireType: function(C) {
            return !!C;
          }, toWireType: function(C, x) {
            return x ? p : E;
          }, argPackAdvance: 8, readValueFromPointer: function(C) {
            var x;
            if (v === 1)
              x = T;
            else if (v === 2)
              x = Y;
            else if (v === 4)
              x = B;
            else
              throw new TypeError("Unknown boolean type size: " + u);
            return this.fromWireType(x[C >> G]);
          }, destructorFunction: null });
        }
        function cs(l) {
          if (!(this instanceof Yt) || !(l instanceof Yt))
            return !1;
          for (var u = this.$$.ptrType.registeredClass, v = this.$$.ptr, p = l.$$.ptrType.registeredClass, E = l.$$.ptr; u.baseClass; )
            v = u.upcast(v), u = u.baseClass;
          for (; p.baseClass; )
            E = p.upcast(E), p = p.baseClass;
          return u === p && v === E;
        }
        function fs(l) {
          return { count: l.count, deleteScheduled: l.deleteScheduled, preservePointerOnDelete: l.preservePointerOnDelete, ptr: l.ptr, ptrType: l.ptrType, smartPtr: l.smartPtr, smartPtrType: l.smartPtrType };
        }
        function Zr(l) {
          function u(v) {
            return v.$$.ptrType.registeredClass.name;
          }
          J(u(l) + " instance already deleted");
        }
        var ti = !1;
        function Hi(l) {
        }
        function ds(l) {
          l.smartPtr ? l.smartPtrType.rawDestructor(l.smartPtr) : l.ptrType.registeredClass.rawDestructor(l.ptr);
        }
        function Wi(l) {
          l.count.value -= 1;
          var u = l.count.value === 0;
          u && ds(l);
        }
        function Vi(l, u, v) {
          if (u === v)
            return l;
          if (v.baseClass === void 0)
            return null;
          var p = Vi(l, u, v.baseClass);
          return p === null ? null : v.downcast(p);
        }
        var Yi = {};
        function gs() {
          return Object.keys(Le).length;
        }
        function _s() {
          var l = [];
          for (var u in Le)
            Le.hasOwnProperty(u) && l.push(Le[u]);
          return l;
        }
        var Re = [];
        function ei() {
          for (; Re.length; ) {
            var l = Re.pop();
            l.$$.deleteScheduled = !1, l.delete();
          }
        }
        var Ne = void 0;
        function vs(l) {
          Ne = l, Re.length && Ne && Ne(ei);
        }
        function ys() {
          i.getInheritedInstanceCount = gs, i.getLiveInheritedInstances = _s, i.flushPendingDeletes = ei, i.setDelayFunction = vs;
        }
        var Le = {};
        function ms(l, u) {
          for (u === void 0 && J("ptr should not be undefined"); l.baseClass; )
            u = l.upcast(u), l = l.baseClass;
          return u;
        }
        function Ms(l, u) {
          return u = ms(l, u), Le[u];
        }
        function Mr(l, u) {
          (!u.ptrType || !u.ptr) && mr("makeClassHandle requires ptr and ptrType");
          var v = !!u.smartPtrType, p = !!u.smartPtr;
          return v !== p && mr("Both smartPtrType and smartPtr must be specified"), u.count = { value: 1 }, Fe(Object.create(l, { $$: { value: u } }));
        }
        function Ki(l) {
          var u = this.getPointee(l);
          if (!u)
            return this.destructor(l), null;
          var v = Ms(this.registeredClass, u);
          if (v !== void 0) {
            if (v.$$.count.value === 0)
              return v.$$.ptr = u, v.$$.smartPtr = l, v.clone();
            var p = v.clone();
            return this.destructor(l), p;
          }
          function E() {
            return this.isSmartPointer ? Mr(this.registeredClass.instancePrototype, { ptrType: this.pointeeType, ptr: u, smartPtrType: this, smartPtr: l }) : Mr(this.registeredClass.instancePrototype, { ptrType: this, ptr: l });
          }
          var G = this.registeredClass.getActualType(u), C = Yi[G];
          if (!C)
            return E.call(this);
          var x;
          this.isConst ? x = C.constPointerType : x = C.pointerType;
          var L = Vi(u, this.registeredClass, x.registeredClass);
          return L === null ? E.call(this) : this.isSmartPointer ? Mr(x.registeredClass.instancePrototype, { ptrType: x, ptr: L, smartPtrType: this, smartPtr: l }) : Mr(x.registeredClass.instancePrototype, { ptrType: x, ptr: L });
        }
        function Fe(l) {
          return typeof FinalizationRegistry > "u" ? (Fe = (u) => u, l) : (ti = new FinalizationRegistry((u) => {
            console.warn(u.leakWarning.stack.replace(/^Error: /, "")), Wi(u.$$);
          }), Fe = (u) => {
            var v = u.$$, p = !!v.smartPtr;
            if (p) {
              var E = { $$: v }, G = v.ptrType.registeredClass;
              E.leakWarning = new Error("Embind found a leaked C++ instance " + G.name + " <0x" + v.ptr.toString(16) + \`>.
We'll free it automatically in this case, but this functionality is not reliable across various environments.
Make sure to invoke .delete() manually once you're done with the instance instead.
Originally allocated\`), "captureStackTrace" in Error && Error.captureStackTrace(E.leakWarning, Ki), ti.register(u, E, u);
            }
            return u;
          }, Hi = (u) => ti.unregister(u), Fe(l));
        }
        function ps() {
          if (this.$$.ptr || Zr(this), this.$$.preservePointerOnDelete)
            return this.$$.count.value += 1, this;
          var l = Fe(Object.create(Object.getPrototypeOf(this), { $$: { value: fs(this.$$) } }));
          return l.$$.count.value += 1, l.$$.deleteScheduled = !1, l;
        }
        function ws() {
          this.$$.ptr || Zr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && J("Object already scheduled for deletion"), Hi(this), Wi(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
        }
        function bs() {
          return !this.$$.ptr;
        }
        function Es() {
          return this.$$.ptr || Zr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && J("Object already scheduled for deletion"), Re.push(this), Re.length === 1 && Ne && Ne(ei), this.$$.deleteScheduled = !0, this;
        }
        function Ps() {
          Yt.prototype.isAliasOf = cs, Yt.prototype.clone = ps, Yt.prototype.delete = ws, Yt.prototype.isDeleted = bs, Yt.prototype.deleteLater = Es;
        }
        function Yt() {
        }
        function Ji(l, u, v) {
          if (l[u].overloadTable === void 0) {
            var p = l[u];
            l[u] = function() {
              return l[u].overloadTable.hasOwnProperty(arguments.length) || J("Function '" + v + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + l[u].overloadTable + ")!"), l[u].overloadTable[arguments.length].apply(this, arguments);
            }, l[u].overloadTable = [], l[u].overloadTable[p.argCount] = p;
          }
        }
        function Ss(l, u, v) {
          i.hasOwnProperty(l) ? (J("Cannot register public name '" + l + "' twice"), Ji(i, l, l), i.hasOwnProperty(v) && J("Cannot register multiple overloads of a function with the same number of arguments (" + v + ")!"), i[l].overloadTable[v] = u) : i[l] = u;
        }
        function xs(l, u, v, p, E, G, C, x) {
          this.name = l, this.constructor = u, this.instancePrototype = v, this.rawDestructor = p, this.baseClass = E, this.getActualType = G, this.upcast = C, this.downcast = x, this.pureVirtualFunctions = [];
        }
        function ri(l, u, v) {
          for (; u !== v; )
            u.upcast || J("Expected null or instance of " + v.name + ", got an instance of " + u.name), l = u.upcast(l), u = u.baseClass;
          return l;
        }
        function Gs(l, u) {
          if (u === null)
            return this.isReference && J("null is not a valid " + this.name), 0;
          u.$$ || J('Cannot pass "' + Me(u) + '" as a ' + this.name), u.$$.ptr || J("Cannot pass deleted object as a pointer of type " + this.name);
          var v = u.$$.ptrType.registeredClass, p = ri(u.$$.ptr, v, this.registeredClass);
          return p;
        }
        function As(l, u) {
          var v;
          if (u === null)
            return this.isReference && J("null is not a valid " + this.name), this.isSmartPointer ? (v = this.rawConstructor(), l !== null && l.push(this.rawDestructor, v), v) : 0;
          u.$$ || J('Cannot pass "' + Me(u) + '" as a ' + this.name), u.$$.ptr || J("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && u.$$.ptrType.isConst && J("Cannot convert argument of type " + (u.$$.smartPtrType ? u.$$.smartPtrType.name : u.$$.ptrType.name) + " to parameter type " + this.name);
          var p = u.$$.ptrType.registeredClass;
          if (v = ri(u.$$.ptr, p, this.registeredClass), this.isSmartPointer)
            switch (u.$$.smartPtr === void 0 && J("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy) {
              case 0:
                u.$$.smartPtrType === this ? v = u.$$.smartPtr : J("Cannot convert argument of type " + (u.$$.smartPtrType ? u.$$.smartPtrType.name : u.$$.ptrType.name) + " to parameter type " + this.name);
                break;
              case 1:
                v = u.$$.smartPtr;
                break;
              case 2:
                if (u.$$.smartPtrType === this)
                  v = u.$$.smartPtr;
                else {
                  var E = u.clone();
                  v = this.rawShare(v, si.toHandle(function() {
                    E.delete();
                  })), l !== null && l.push(this.rawDestructor, v);
                }
                break;
              default:
                J("Unsupporting sharing policy");
            }
          return v;
        }
        function Cs(l, u) {
          if (u === null)
            return this.isReference && J("null is not a valid " + this.name), 0;
          u.$$ || J('Cannot pass "' + Me(u) + '" as a ' + this.name), u.$$.ptr || J("Cannot pass deleted object as a pointer of type " + this.name), u.$$.ptrType.isConst && J("Cannot convert argument of type " + u.$$.ptrType.name + " to parameter type " + this.name);
          var v = u.$$.ptrType.registeredClass, p = ri(u.$$.ptr, v, this.registeredClass);
          return p;
        }
        function pr(l) {
          return this.fromWireType(B[l >> 2]);
        }
        function Ts(l) {
          return this.rawGetPointee && (l = this.rawGetPointee(l)), l;
        }
        function Is(l) {
          this.rawDestructor && this.rawDestructor(l);
        }
        function Os(l) {
          l !== null && l.delete();
        }
        function Rs() {
          kt.prototype.getPointee = Ts, kt.prototype.destructor = Is, kt.prototype.argPackAdvance = 8, kt.prototype.readValueFromPointer = pr, kt.prototype.deleteObject = Os, kt.prototype.fromWireType = Ki;
        }
        function kt(l, u, v, p, E, G, C, x, L, U, z) {
          this.name = l, this.registeredClass = u, this.isReference = v, this.isConst = p, this.isSmartPointer = E, this.pointeeType = G, this.sharingPolicy = C, this.rawGetPointee = x, this.rawConstructor = L, this.rawShare = U, this.rawDestructor = z, !E && u.baseClass === void 0 ? p ? (this.toWireType = Gs, this.destructorFunction = null) : (this.toWireType = Cs, this.destructorFunction = null) : this.toWireType = As;
        }
        function Ns(l, u, v) {
          i.hasOwnProperty(l) || mr("Replacing nonexistant public symbol"), i[l].overloadTable !== void 0 && v !== void 0 || (i[l] = u, i[l].argCount = v);
        }
        function Ls(l, u, v) {
          D("dynCall_" + l in i, "bad function pointer type - no table for sig '" + l + "'"), v && v.length ? D(v.length === l.substring(1).replace(/j/g, "--").length) : D(l.length == 1);
          var p = i["dynCall_" + l];
          return v && v.length ? p.apply(null, [u].concat(v)) : p.call(null, u);
        }
        var wr = [];
        function ii(l) {
          var u = wr[l];
          return u || (l >= wr.length && (wr.length = l + 1), wr[l] = u = vr.get(l)), D(vr.get(l) == u, "JavaScript-side Wasm function table mirror is out of date!"), u;
        }
        function Fs(l, u, v) {
          if (l.includes("j"))
            return Ls(l, u, v);
          D(ii(u), "missing table entry in dynCall: " + u);
          var p = ii(u).apply(null, v);
          return p;
        }
        function Ds(l, u) {
          D(l.includes("j") || l.includes("p"), "getDynCaller should only be called with i64 sigs");
          var v = [];
          return function() {
            return v.length = 0, Object.assign(v, arguments), Fs(l, u, v);
          };
        }
        function me(l, u) {
          l = xt(l);
          function v() {
            return l.includes("j") ? Ds(l, u) : ii(u);
          }
          var p = v();
          return typeof p != "function" && J("unknown function pointer with signature " + l + ": " + u), p;
        }
        var Xi = void 0;
        function Us(l) {
          var u = Co(l), v = xt(u);
          return Kt(u), v;
        }
        function ai(l, u) {
          var v = [], p = {};
          function E(G) {
            if (!p[G] && !ve[G]) {
              if (yr[G]) {
                yr[G].forEach(E);
                return;
              }
              v.push(G), p[G] = !0;
            }
          }
          throw u.forEach(E), new Xi(l + ": " + v.map(Us).join([", "]));
        }
        function Bs(l, u, v, p, E, G, C, x, L, U, z, H, $) {
          z = xt(z), G = me(E, G), x && (x = me(C, x)), U && (U = me(L, U)), $ = me(H, $);
          var at = qi(z);
          Ss(at, function() {
            ai("Cannot construct " + z + " due to unbound types", [p]);
          }), Oe([l, u, v], p ? [p] : [], function(dt) {
            dt = dt[0];
            var ht, Tt;
            p ? (ht = dt.registeredClass, Tt = ht.instancePrototype) : Tt = Yt.prototype;
            var Ut = $i(at, function() {
              if (Object.getPrototypeOf(this) !== O)
                throw new ye("Use 'new' to construct " + z);
              if (j.constructor_body === void 0)
                throw new ye(z + " has no accessible constructor");
              var Pr = j.constructor_body[arguments.length];
              if (Pr === void 0)
                throw new ye("Tried to invoke ctor of " + z + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(j.constructor_body).toString() + ") parameters instead!");
              return Pr.apply(this, arguments);
            }), O = Object.create(Tt, { constructor: { value: Ut } });
            Ut.prototype = O;
            var j = new xs(z, Ut, O, $, ht, G, x, U), gt = new kt(z, j, !0, !1, !1), ct = new kt(z + "*", j, !1, !1, !1), ne = new kt(z + " const*", j, !1, !0, !1);
            return Yi[l] = { pointerType: ct, constPointerType: ne }, Ns(at, Ut), [gt, ct, ne];
          });
        }
        function Qi(l, u) {
          for (var v = [], p = 0; p < l; p++)
            v.push(K[u + p * 4 >> 2]);
          return v;
        }
        function js(l) {
          for (; l.length; ) {
            var u = l.pop(), v = l.pop();
            v(u);
          }
        }
        function Zi(l, u, v, p, E) {
          var G = u.length;
          G < 2 && J("argTypes array size mismatch! Must at least get return value and 'this' types!");
          for (var C = u[1] !== null && v !== null, x = !1, L = 1; L < u.length; ++L)
            if (u[L] !== null && u[L].destructorFunction === void 0) {
              x = !0;
              break;
            }
          var U = u[0].name !== "void", z = G - 2, H = new Array(z), $ = [], at = [];
          return function() {
            arguments.length !== z && J("function " + l + " called with " + arguments.length + " arguments, expected " + z + " args!"), at.length = 0;
            var dt;
            $.length = C ? 2 : 1, $[0] = E, C && (dt = u[1].toWireType(at, this), $[1] = dt);
            for (var ht = 0; ht < z; ++ht)
              H[ht] = u[ht + 2].toWireType(at, arguments[ht]), $.push(H[ht]);
            var Tt = p.apply(null, $);
            function Ut(O) {
              if (x)
                js(at);
              else
                for (var j = C ? 1 : 2; j < u.length; j++) {
                  var gt = j === 1 ? dt : H[j - 2];
                  u[j].destructorFunction !== null && u[j].destructorFunction(gt);
                }
              if (U)
                return u[0].fromWireType(O);
            }
            return Ut(Tt);
          };
        }
        function ks(l, u, v, p, E, G) {
          D(u > 0);
          var C = Qi(u, v);
          E = me(p, E), Oe([], [l], function(x) {
            x = x[0];
            var L = "constructor " + x.name;
            if (x.registeredClass.constructor_body === void 0 && (x.registeredClass.constructor_body = []), x.registeredClass.constructor_body[u - 1] !== void 0)
              throw new ye("Cannot register multiple constructors with identical number of parameters (" + (u - 1) + ") for class '" + x.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
            return x.registeredClass.constructor_body[u - 1] = () => {
              ai("Cannot construct " + x.name + " due to unbound types", C);
            }, Oe([], C, function(U) {
              return U.splice(1, 0, null), x.registeredClass.constructor_body[u - 1] = Zi(L, U, null, E, G), [];
            }), [];
          });
        }
        function qs(l, u, v, p, E, G, C, x) {
          var L = Qi(v, p);
          u = xt(u), G = me(E, G), Oe([], [l], function(U) {
            U = U[0];
            var z = U.name + "." + u;
            u.startsWith("@@") && (u = Symbol[u.substring(2)]), x && U.registeredClass.pureVirtualFunctions.push(u);
            function H() {
              ai("Cannot call " + z + " due to unbound types", L);
            }
            var $ = U.registeredClass.instancePrototype, at = $[u];
            return at === void 0 || at.overloadTable === void 0 && at.className !== U.name && at.argCount === v - 2 ? (H.argCount = v - 2, H.className = U.name, $[u] = H) : (Ji($, u, z), $[u].overloadTable[v - 2] = H), Oe([], L, function(dt) {
              var ht = Zi(z, dt, U, G, C);
              return $[u].overloadTable === void 0 ? (ht.argCount = v - 2, $[u] = ht) : $[u].overloadTable[v - 2] = ht, [];
            }), [];
          });
        }
        var ni = [], Dt = [{}, { value: void 0 }, { value: null }, { value: !0 }, { value: !1 }];
        function $s(l) {
          l > 4 && --Dt[l].refcount === 0 && (Dt[l] = void 0, ni.push(l));
        }
        function zs() {
          for (var l = 0, u = 5; u < Dt.length; ++u)
            Dt[u] !== void 0 && ++l;
          return l;
        }
        function Hs() {
          for (var l = 5; l < Dt.length; ++l)
            if (Dt[l] !== void 0)
              return Dt[l];
          return null;
        }
        function Ws() {
          i.count_emval_handles = zs, i.get_first_emval = Hs;
        }
        var si = { toValue: (l) => (l || J("Cannot use deleted val. handle = " + l), Dt[l].value), toHandle: (l) => {
          switch (l) {
            case void 0:
              return 1;
            case null:
              return 2;
            case !0:
              return 3;
            case !1:
              return 4;
            default: {
              var u = ni.length ? ni.pop() : Dt.length;
              return Dt[u] = { refcount: 1, value: l }, u;
            }
          }
        } };
        function Vs(l, u) {
          u = xt(u), jt(l, { name: u, fromWireType: function(v) {
            var p = si.toValue(v);
            return $s(v), p;
          }, toWireType: function(v, p) {
            return si.toHandle(p);
          }, argPackAdvance: 8, readValueFromPointer: pr, destructorFunction: null });
        }
        function Me(l) {
          if (l === null)
            return "null";
          var u = typeof l;
          return u === "object" || u === "array" || u === "function" ? l.toString() : "" + l;
        }
        function Ys(l, u) {
          switch (u) {
            case 2:
              return function(v) {
                return this.fromWireType(ge[v >> 2]);
              };
            case 3:
              return function(v) {
                return this.fromWireType(Ce[v >> 3]);
              };
            default:
              throw new TypeError("Unknown float type: " + l);
          }
        }
        function Ks(l, u, v) {
          var p = Xr(v);
          u = xt(u), jt(l, { name: u, fromWireType: function(E) {
            return E;
          }, toWireType: function(E, G) {
            if (typeof G != "number" && typeof G != "boolean")
              throw new TypeError('Cannot convert "' + Me(G) + '" to ' + this.name);
            return G;
          }, argPackAdvance: 8, readValueFromPointer: Ys(u, p), destructorFunction: null });
        }
        function Js(l, u, v) {
          switch (u) {
            case 0:
              return v ? function(E) {
                return T[E];
              } : function(E) {
                return q[E];
              };
            case 1:
              return v ? function(E) {
                return Y[E >> 1];
              } : function(E) {
                return Z[E >> 1];
              };
            case 2:
              return v ? function(E) {
                return B[E >> 2];
              } : function(E) {
                return K[E >> 2];
              };
            default:
              throw new TypeError("Unknown integer type: " + l);
          }
        }
        function Xs(l, u, v, p, E) {
          u = xt(u), E === -1 && (E = 4294967295);
          var G = Xr(v), C = (H) => H;
          if (p === 0) {
            var x = 32 - 8 * v;
            C = (H) => H << x >>> x;
          }
          var L = u.includes("unsigned"), U = (H, $) => {
            if (typeof H != "number" && typeof H != "boolean")
              throw new TypeError('Cannot convert "' + Me(H) + '" to ' + $);
            if (H < p || H > E)
              throw new TypeError('Passing a number "' + Me(H) + '" from JS side to C/C++ side to an argument of type "' + u + '", which is outside the valid range [' + p + ", " + E + "]!");
          }, z;
          L ? z = function(H, $) {
            return U($, this.name), $ >>> 0;
          } : z = function(H, $) {
            return U($, this.name), $;
          }, jt(l, { name: u, fromWireType: C, toWireType: z, argPackAdvance: 8, readValueFromPointer: Js(u, G, p !== 0), destructorFunction: null });
        }
        function Qs(l, u, v) {
          var p = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array], E = p[u];
          function G(C) {
            C = C >> 2;
            var x = K, L = x[C], U = x[C + 1];
            return new E(b, U, L);
          }
          v = xt(v), jt(l, { name: v, fromWireType: G, argPackAdvance: 8, readValueFromPointer: G }, { ignoreDuplicateRegistrations: !0 });
        }
        function Zs(l, u) {
          u = xt(u);
          var v = u === "std::string";
          jt(l, { name: u, fromWireType: function(p) {
            var E = K[p >> 2], G = p + 4, C;
            if (v)
              for (var x = G, L = 0; L <= E; ++L) {
                var U = G + L;
                if (L == E || q[U] == 0) {
                  var z = U - x, H = it(x, z);
                  C === void 0 ? C = H : (C += "\\0", C += H), x = U + 1;
                }
              }
            else {
              for (var $ = new Array(E), L = 0; L < E; ++L)
                $[L] = String.fromCharCode(q[G + L]);
              C = $.join("");
            }
            return Kt(p), C;
          }, toWireType: function(p, E) {
            E instanceof ArrayBuffer && (E = new Uint8Array(E));
            var G, C = typeof E == "string";
            C || E instanceof Uint8Array || E instanceof Uint8ClampedArray || E instanceof Int8Array || J("Cannot pass non-string to std::string"), v && C ? G = ee(E) : G = E.length;
            var x = hi(4 + G + 1), L = x + 4;
            if (K[x >> 2] = G, v && C)
              lt(E, L, G + 1);
            else if (C)
              for (var U = 0; U < G; ++U) {
                var z = E.charCodeAt(U);
                z > 255 && (Kt(L), J("String has UTF-16 code units that do not fit in 8 bits")), q[L + U] = z;
              }
            else
              for (var U = 0; U < G; ++U)
                q[L + U] = E[U];
            return p !== null && p.push(Kt, x), x;
          }, argPackAdvance: 8, readValueFromPointer: pr, destructorFunction: function(p) {
            Kt(p);
          } });
        }
        var ta = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
        function to(l, u) {
          D(l % 2 == 0, "Pointer passed to UTF16ToString must be aligned to two bytes!");
          for (var v = l, p = v >> 1, E = p + u / 2; !(p >= E) && Z[p]; ) ++p;
          if (v = p << 1, v - l > 32 && ta)
            return ta.decode(q.subarray(l, v));
          for (var G = "", C = 0; !(C >= u / 2); ++C) {
            var x = Y[l + C * 2 >> 1];
            if (x == 0) break;
            G += String.fromCharCode(x);
          }
          return G;
        }
        function eo(l, u, v) {
          if (D(u % 2 == 0, "Pointer passed to stringToUTF16 must be aligned to two bytes!"), D(typeof v == "number", "stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), v === void 0 && (v = 2147483647), v < 2) return 0;
          v -= 2;
          for (var p = u, E = v < l.length * 2 ? v / 2 : l.length, G = 0; G < E; ++G) {
            var C = l.charCodeAt(G);
            Y[u >> 1] = C, u += 2;
          }
          return Y[u >> 1] = 0, u - p;
        }
        function ro(l) {
          return l.length * 2;
        }
        function io(l, u) {
          D(l % 4 == 0, "Pointer passed to UTF32ToString must be aligned to four bytes!");
          for (var v = 0, p = ""; !(v >= u / 4); ) {
            var E = B[l + v * 4 >> 2];
            if (E == 0) break;
            if (++v, E >= 65536) {
              var G = E - 65536;
              p += String.fromCharCode(55296 | G >> 10, 56320 | G & 1023);
            } else
              p += String.fromCharCode(E);
          }
          return p;
        }
        function ao(l, u, v) {
          if (D(u % 4 == 0, "Pointer passed to stringToUTF32 must be aligned to four bytes!"), D(typeof v == "number", "stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), v === void 0 && (v = 2147483647), v < 4) return 0;
          for (var p = u, E = p + v - 4, G = 0; G < l.length; ++G) {
            var C = l.charCodeAt(G);
            if (C >= 55296 && C <= 57343) {
              var x = l.charCodeAt(++G);
              C = 65536 + ((C & 1023) << 10) | x & 1023;
            }
            if (B[u >> 2] = C, u += 4, u + 4 > E) break;
          }
          return B[u >> 2] = 0, u - p;
        }
        function no(l) {
          for (var u = 0, v = 0; v < l.length; ++v) {
            var p = l.charCodeAt(v);
            p >= 55296 && p <= 57343 && ++v, u += 4;
          }
          return u;
        }
        function so(l, u, v) {
          v = xt(v);
          var p, E, G, C, x;
          u === 2 ? (p = to, E = eo, C = ro, G = () => Z, x = 1) : u === 4 && (p = io, E = ao, C = no, G = () => K, x = 2), jt(l, { name: v, fromWireType: function(L) {
            for (var U = K[L >> 2], z = G(), H, $ = L + 4, at = 0; at <= U; ++at) {
              var dt = L + 4 + at * u;
              if (at == U || z[dt >> x] == 0) {
                var ht = dt - $, Tt = p($, ht);
                H === void 0 ? H = Tt : (H += "\\0", H += Tt), $ = dt + u;
              }
            }
            return Kt(L), H;
          }, toWireType: function(L, U) {
            typeof U != "string" && J("Cannot pass non-string to C++ string type " + v);
            var z = C(U), H = hi(4 + z + u);
            return K[H >> 2] = z >> x, E(U, H + 4, z + u), L !== null && L.push(Kt, H), H;
          }, argPackAdvance: 8, readValueFromPointer: pr, destructorFunction: function(L) {
            Kt(L);
          } });
        }
        function oo(l, u) {
          u = xt(u), jt(l, { isVoid: !0, name: u, argPackAdvance: 0, fromWireType: function() {
          }, toWireType: function(v, p) {
          } });
        }
        function ho() {
          yt("native code called abort()");
        }
        function lo(l, u, v) {
          q.copyWithin(l, u, u + v);
        }
        function uo() {
          return 2147483648;
        }
        function co(l) {
          try {
            return k.grow(l - b.byteLength + 65535 >>> 16), st(k.buffer), 1;
          } catch (u) {
            M("emscripten_realloc_buffer: Attempted to grow heap from " + b.byteLength + " bytes to " + l + " bytes, but got error: " + u);
          }
        }
        function fo(l) {
          var u = q.length;
          l = l >>> 0, D(l > u);
          var v = uo();
          if (l > v)
            return M("Cannot enlarge memory, asked to go up to " + l + " bytes, but the limit is " + v + " bytes!"), !1;
          let p = (L, U) => L + (U - L % U) % U;
          for (var E = 1; E <= 4; E *= 2) {
            var G = u * (1 + 0.2 / E);
            G = Math.min(G, l + 100663296);
            var C = Math.min(v, p(Math.max(l, G), 65536)), x = co(C);
            if (x)
              return !0;
          }
          return M("Failed to grow the heap from " + u + " bytes to " + C + " bytes, not enough memory!"), !1;
        }
        var oi = {};
        function go() {
          return f || "./this.program";
        }
        function De() {
          if (!De.strings) {
            var l = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8", u = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: l, _: go() };
            for (var v in oi)
              oi[v] === void 0 ? delete u[v] : u[v] = oi[v];
            var p = [];
            for (var v in u)
              p.push(v + "=" + u[v]);
            De.strings = p;
          }
          return De.strings;
        }
        function _o(l, u, v) {
          for (var p = 0; p < l.length; ++p)
            D(l.charCodeAt(p) === (l.charCodeAt(p) & 255)), T[u++ >> 0] = l.charCodeAt(p);
          T[u >> 0] = 0;
        }
        function vo(l, u) {
          var v = 0;
          return De().forEach(function(p, E) {
            var G = u + v;
            K[l + E * 4 >> 2] = G, _o(p, G), v += p.length + 1;
          }), 0;
        }
        function yo(l, u) {
          var v = De();
          K[l >> 2] = v.length;
          var p = 0;
          return v.forEach(function(E) {
            p += E.length + 1;
          }), K[u >> 2] = p, 0;
        }
        function mo(l) {
          yt("fd_close called without SYSCALLS_REQUIRE_FILESYSTEM");
        }
        function Mo(l, u, v, p, E) {
          return 70;
        }
        var po = [null, [], []];
        function wo(l, u) {
          var v = po[l];
          D(v), u === 0 || u === 10 ? ((l === 1 ? y : M)(ot(v, 0)), v.length = 0) : v.push(u);
        }
        function bo(l, u, v, p) {
          for (var E = 0, G = 0; G < v; G++) {
            var C = K[u >> 2], x = K[u + 4 >> 2];
            u += 8;
            for (var L = 0; L < x; L++)
              wo(l, q[C + L]);
            E += x;
          }
          return K[p >> 2] = E, 0;
        }
        function br(l) {
          return l % 4 === 0 && (l % 100 !== 0 || l % 400 === 0);
        }
        function Eo(l, u) {
          for (var v = 0, p = 0; p <= u; v += l[p++])
            ;
          return v;
        }
        var ea = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], ra = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        function Po(l, u) {
          for (var v = new Date(l.getTime()); u > 0; ) {
            var p = br(v.getFullYear()), E = v.getMonth(), G = (p ? ea : ra)[E];
            if (u > G - v.getDate())
              u -= G - v.getDate() + 1, v.setDate(1), E < 11 ? v.setMonth(E + 1) : (v.setMonth(0), v.setFullYear(v.getFullYear() + 1));
            else
              return v.setDate(v.getDate() + u), v;
          }
          return v;
        }
        function So(l, u, v) {
          var p = ee(l) + 1, E = new Array(p);
          return tt(l, E, 0, E.length), E;
        }
        function xo(l, u, v, p) {
          var E = B[p + 40 >> 2], G = { tm_sec: B[p >> 2], tm_min: B[p + 4 >> 2], tm_hour: B[p + 8 >> 2], tm_mday: B[p + 12 >> 2], tm_mon: B[p + 16 >> 2], tm_year: B[p + 20 >> 2], tm_wday: B[p + 24 >> 2], tm_yday: B[p + 28 >> 2], tm_isdst: B[p + 32 >> 2], tm_gmtoff: B[p + 36 >> 2], tm_zone: E ? it(E) : "" }, C = it(v), x = { "%c": "%a %b %d %H:%M:%S %Y", "%D": "%m/%d/%y", "%F": "%Y-%m-%d", "%h": "%b", "%r": "%I:%M:%S %p", "%R": "%H:%M", "%T": "%H:%M:%S", "%x": "%m/%d/%y", "%X": "%H:%M:%S", "%Ec": "%c", "%EC": "%C", "%Ex": "%m/%d/%y", "%EX": "%H:%M:%S", "%Ey": "%y", "%EY": "%Y", "%Od": "%d", "%Oe": "%e", "%OH": "%H", "%OI": "%I", "%Om": "%m", "%OM": "%M", "%OS": "%S", "%Ou": "%u", "%OU": "%U", "%OV": "%V", "%Ow": "%w", "%OW": "%W", "%Oy": "%y" };
          for (var L in x)
            C = C.replace(new RegExp(L, "g"), x[L]);
          var U = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], z = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          function H(O, j, gt) {
            for (var ct = typeof O == "number" ? O.toString() : O || ""; ct.length < j; )
              ct = gt[0] + ct;
            return ct;
          }
          function $(O, j) {
            return H(O, j, "0");
          }
          function at(O, j) {
            function gt(ne) {
              return ne < 0 ? -1 : ne > 0 ? 1 : 0;
            }
            var ct;
            return (ct = gt(O.getFullYear() - j.getFullYear())) === 0 && (ct = gt(O.getMonth() - j.getMonth())) === 0 && (ct = gt(O.getDate() - j.getDate())), ct;
          }
          function dt(O) {
            switch (O.getDay()) {
              case 0:
                return new Date(O.getFullYear() - 1, 11, 29);
              case 1:
                return O;
              case 2:
                return new Date(O.getFullYear(), 0, 3);
              case 3:
                return new Date(O.getFullYear(), 0, 2);
              case 4:
                return new Date(O.getFullYear(), 0, 1);
              case 5:
                return new Date(O.getFullYear() - 1, 11, 31);
              case 6:
                return new Date(O.getFullYear() - 1, 11, 30);
            }
          }
          function ht(O) {
            var j = Po(new Date(O.tm_year + 1900, 0, 1), O.tm_yday), gt = new Date(j.getFullYear(), 0, 4), ct = new Date(j.getFullYear() + 1, 0, 4), ne = dt(gt), Pr = dt(ct);
            return at(ne, j) <= 0 ? at(Pr, j) <= 0 ? j.getFullYear() + 1 : j.getFullYear() : j.getFullYear() - 1;
          }
          var Tt = { "%a": function(O) {
            return U[O.tm_wday].substring(0, 3);
          }, "%A": function(O) {
            return U[O.tm_wday];
          }, "%b": function(O) {
            return z[O.tm_mon].substring(0, 3);
          }, "%B": function(O) {
            return z[O.tm_mon];
          }, "%C": function(O) {
            var j = O.tm_year + 1900;
            return $(j / 100 | 0, 2);
          }, "%d": function(O) {
            return $(O.tm_mday, 2);
          }, "%e": function(O) {
            return H(O.tm_mday, 2, " ");
          }, "%g": function(O) {
            return ht(O).toString().substring(2);
          }, "%G": function(O) {
            return ht(O);
          }, "%H": function(O) {
            return $(O.tm_hour, 2);
          }, "%I": function(O) {
            var j = O.tm_hour;
            return j == 0 ? j = 12 : j > 12 && (j -= 12), $(j, 2);
          }, "%j": function(O) {
            return $(O.tm_mday + Eo(br(O.tm_year + 1900) ? ea : ra, O.tm_mon - 1), 3);
          }, "%m": function(O) {
            return $(O.tm_mon + 1, 2);
          }, "%M": function(O) {
            return $(O.tm_min, 2);
          }, "%n": function() {
            return \`
\`;
          }, "%p": function(O) {
            return O.tm_hour >= 0 && O.tm_hour < 12 ? "AM" : "PM";
          }, "%S": function(O) {
            return $(O.tm_sec, 2);
          }, "%t": function() {
            return "	";
          }, "%u": function(O) {
            return O.tm_wday || 7;
          }, "%U": function(O) {
            var j = O.tm_yday + 7 - O.tm_wday;
            return $(Math.floor(j / 7), 2);
          }, "%V": function(O) {
            var j = Math.floor((O.tm_yday + 7 - (O.tm_wday + 6) % 7) / 7);
            if ((O.tm_wday + 371 - O.tm_yday - 2) % 7 <= 2 && j++, j) {
              if (j == 53) {
                var ct = (O.tm_wday + 371 - O.tm_yday) % 7;
                ct != 4 && (ct != 3 || !br(O.tm_year)) && (j = 1);
              }
            } else {
              j = 52;
              var gt = (O.tm_wday + 7 - O.tm_yday - 1) % 7;
              (gt == 4 || gt == 5 && br(O.tm_year % 400 - 1)) && j++;
            }
            return $(j, 2);
          }, "%w": function(O) {
            return O.tm_wday;
          }, "%W": function(O) {
            var j = O.tm_yday + 7 - (O.tm_wday + 6) % 7;
            return $(Math.floor(j / 7), 2);
          }, "%y": function(O) {
            return (O.tm_year + 1900).toString().substring(2);
          }, "%Y": function(O) {
            return O.tm_year + 1900;
          }, "%z": function(O) {
            var j = O.tm_gmtoff, gt = j >= 0;
            return j = Math.abs(j) / 60, j = j / 60 * 100 + j % 60, (gt ? "+" : "-") + ("0000" + j).slice(-4);
          }, "%Z": function(O) {
            return O.tm_zone;
          }, "%%": function() {
            return "%";
          } };
          C = C.replace(/%%/g, "\\0\\0");
          for (var L in Tt)
            C.includes(L) && (C = C.replace(new RegExp(L, "g"), Tt[L](G)));
          C = C.replace(/\\0\\0/g, "%");
          var Ut = So(C);
          return Ut.length > u ? 0 : (rs(Ut, l), Ut.length - 1);
        }
        function Go(l, u, v, p) {
          return xo(l, u, v, p);
        }
        os(), ye = i.BindingError = Qr(Error, "BindingError"), zi = i.InternalError = Qr(Error, "InternalError"), Ps(), ys(), Rs(), Xi = i.UnboundTypeError = Qr(Error, "UnboundTypeError"), Ws();
        function Ao() {
          S("fetchSettings");
        }
        var ia = { __cxa_allocate_exception: is, __cxa_throw: ns, _embind_register_bigint: ss, _embind_register_bool: us, _embind_register_class: Bs, _embind_register_class_constructor: ks, _embind_register_class_function: qs, _embind_register_emval: Vs, _embind_register_float: Ks, _embind_register_integer: Xs, _embind_register_memory_view: Qs, _embind_register_std_string: Zs, _embind_register_std_wstring: so, _embind_register_void: oo, abort: ho, emscripten_memcpy_big: lo, emscripten_resize_heap: fo, environ_get: vo, environ_sizes_get: yo, fd_close: mo, fd_seek: Mo, fd_write: bo, strftime_l: Go };
        es(), i.___wasm_call_ctors = ut("__wasm_call_ctors");
        var hi = i._malloc = ut("malloc"), Kt = i._free = ut("free"), Co = i.___getTypeName = ut("__getTypeName");
        i.__embind_initialize_bindings = ut("_embind_initialize_bindings"), i.___errno_location = ut("__errno_location"), i._fflush = ut("fflush");
        var aa = i._emscripten_stack_init = function() {
          return (aa = i._emscripten_stack_init = i.asm.emscripten_stack_init).apply(null, arguments);
        };
        i._emscripten_stack_get_free = function() {
          return (i._emscripten_stack_get_free = i.asm.emscripten_stack_get_free).apply(null, arguments);
        }, i._emscripten_stack_get_base = function() {
          return (i._emscripten_stack_get_base = i.asm.emscripten_stack_get_base).apply(null, arguments);
        };
        var li = i._emscripten_stack_get_end = function() {
          return (li = i._emscripten_stack_get_end = i.asm.emscripten_stack_get_end).apply(null, arguments);
        };
        i.stackSave = ut("stackSave"), i.stackRestore = ut("stackRestore"), i.stackAlloc = ut("stackAlloc");
        var To = i.___cxa_is_pointer_type = ut("__cxa_is_pointer_type");
        i.dynCall_viijii = ut("dynCall_viijii"), i.dynCall_ji = ut("dynCall_ji"), i.dynCall_jiji = ut("dynCall_jiji"), i.dynCall_iiiiij = ut("dynCall_iiiiij"), i.dynCall_iiiiijj = ut("dynCall_iiiiijj"), i.dynCall_iiiiiijj = ut("dynCall_iiiiiijj");
        var Io = ["run", "UTF8ArrayToString", "UTF8ToString", "stringToUTF8Array", "stringToUTF8", "lengthBytesUTF8", "addOnPreRun", "addOnInit", "addOnPreMain", "addOnExit", "addOnPostRun", "addRunDependency", "removeRunDependency", "FS_createFolder", "FS_createPath", "FS_createDataFile", "FS_createPreloadedFile", "FS_createLazyFile", "FS_createLink", "FS_createDevice", "FS_unlink", "getLEB", "getFunctionTables", "alignFunctionTables", "registerFunctions", "prettyPrint", "getCompilerSetting", "print", "printErr", "callMain", "abort", "keepRuntimeAlive", "wasmMemory", "stackAlloc", "stackSave", "stackRestore", "getTempRet0", "setTempRet0", "writeStackCookie", "checkStackCookie", "ptrToString", "zeroMemory", "stringToNewUTF8", "exitJS", "getHeapMax", "emscripten_realloc_buffer", "ENV", "ERRNO_CODES", "ERRNO_MESSAGES", "setErrNo", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "DNS", "getHostByName", "Protocols", "Sockets", "getRandomDevice", "warnOnce", "traverseStack", "UNWIND_CACHE", "convertPCtoSourceLocation", "readAsmConstArgsArray", "readAsmConstArgs", "mainThreadEM_ASM", "jstoi_q", "jstoi_s", "getExecutableName", "listenOnce", "autoResumeAudioContext", "dynCallLegacy", "getDynCaller", "dynCall", "handleException", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "safeSetTimeout", "asmjsMangle", "asyncLoad", "alignMemory", "mmapAlloc", "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertI32PairToI53Checked", "convertU32PairToI53", "getCFunc", "ccall", "cwrap", "uleb128Encode", "sigToWasmTypes", "convertJsFunctionToWasm", "freeTableIndexes", "functionsInTableMap", "getEmptyTableSlot", "updateTableMap", "addFunction", "removeFunction", "reallyNegative", "unSign", "strLen", "reSign", "formatString", "setValue", "getValue", "PATH", "PATH_FS", "intArrayFromString", "intArrayToString", "AsciiToString", "stringToAscii", "UTF16Decoder", "UTF16ToString", "stringToUTF16", "lengthBytesUTF16", "UTF32ToString", "stringToUTF32", "lengthBytesUTF32", "allocateUTF8", "allocateUTF8OnStack", "writeStringToMemory", "writeArrayToMemory", "writeAsciiToMemory", "SYSCALLS", "getSocketFromFD", "getSocketAddress", "JSEvents", "registerKeyEventCallback", "specialHTMLTargets", "maybeCStringToJsString", "findEventTarget", "findCanvasEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "currentFullscreenStrategy", "restoreOldWindowedStyle", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "demangle", "demangleAll", "jsStackTrace", "stackTrace", "ExitStatus", "getEnvStrings", "checkWasiClock", "flush_NO_FILESYSTEM", "dlopenMissingError", "setImmediateWrapped", "clearImmediateWrapped", "polyfillSetImmediate", "uncaughtExceptionCount", "exceptionLast", "exceptionCaught", "ExceptionInfo", "exception_addRef", "exception_decRef", "Browser", "setMainLoop", "wget", "FS", "MEMFS", "TTY", "PIPEFS", "SOCKFS", "_setNetworkCallback", "tempFixedLengthArray", "miniTempWebGLFloatBuffers", "heapObjectForWebGLType", "heapAccessShiftForWebGLHeap", "GL", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "writeGLArray", "AL", "SDL_unicode", "SDL_ttfContext", "SDL_audio", "SDL", "SDL_gfx", "GLUT", "EGL", "GLFW_Window", "GLFW", "GLEW", "IDBStore", "runAndAbortIfError", "ALLOC_NORMAL", "ALLOC_STACK", "allocate", "InternalError", "BindingError", "UnboundTypeError", "PureVirtualError", "init_embind", "throwInternalError", "throwBindingError", "throwUnboundTypeError", "ensureOverloadTable", "exposePublicSymbol", "replacePublicSymbol", "extendError", "createNamedFunction", "embindRepr", "registeredInstances", "getBasestPointer", "registerInheritedInstance", "unregisterInheritedInstance", "getInheritedInstance", "getInheritedInstanceCount", "getLiveInheritedInstances", "registeredTypes", "awaitingDependencies", "typeDependencies", "registeredPointers", "registerType", "whenDependentTypesAreResolved", "embind_charCodes", "embind_init_charCodes", "readLatin1String", "getTypeName", "heap32VectorToArray", "requireRegisteredType", "getShiftFromSize", "integerReadValueFromPointer", "enumReadValueFromPointer", "floatReadValueFromPointer", "simpleReadValueFromPointer", "runDestructors", "new_", "craftInvokerFunction", "embind__requireFunction", "tupleRegistrations", "structRegistrations", "genericPointerToWireType", "constNoSmartPtrRawPointerToWireType", "nonConstNoSmartPtrRawPointerToWireType", "init_RegisteredPointer", "RegisteredPointer", "RegisteredPointer_getPointee", "RegisteredPointer_destructor", "RegisteredPointer_deleteObject", "RegisteredPointer_fromWireType", "runDestructor", "releaseClassHandle", "finalizationRegistry", "detachFinalizer_deps", "detachFinalizer", "attachFinalizer", "makeClassHandle", "init_ClassHandle", "ClassHandle", "ClassHandle_isAliasOf", "throwInstanceAlreadyDeleted", "ClassHandle_clone", "ClassHandle_delete", "deletionQueue", "ClassHandle_isDeleted", "ClassHandle_deleteLater", "flushPendingDeletes", "delayFunction", "setDelayFunction", "RegisteredClass", "shallowCopyInternalPointer", "downcastPointer", "upcastPointer", "validateThis", "char_0", "char_9", "makeLegalFunctionName", "emval_handle_array", "emval_free_list", "emval_symbols", "init_emval", "count_emval_handles", "get_first_emval", "getStringOrSymbol", "Emval", "emval_newers", "craftEmvalAllocator", "emval_get_global", "emval_lookupTypes", "emval_allocateDestructors", "emval_methodCallers", "emval_addMethodCaller", "emval_registeredMethods"];
        Io.forEach(R);
        var Oo = ["ptrToString", "zeroMemory", "stringToNewUTF8", "exitJS", "setErrNo", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "getHostByName", "getRandomDevice", "traverseStack", "convertPCtoSourceLocation", "readAsmConstArgs", "mainThreadEM_ASM", "jstoi_q", "jstoi_s", "listenOnce", "autoResumeAudioContext", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "safeSetTimeout", "asmjsMangle", "asyncLoad", "alignMemory", "mmapAlloc", "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertU32PairToI53", "reallyNegative", "unSign", "strLen", "reSign", "formatString", "getSocketFromFD", "getSocketAddress", "registerKeyEventCallback", "maybeCStringToJsString", "findEventTarget", "findCanvasEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "checkWasiClock", "setImmediateWrapped", "clearImmediateWrapped", "polyfillSetImmediate", "exception_addRef", "exception_decRef", "setMainLoop", "_setNetworkCallback", "heapObjectForWebGLType", "heapAccessShiftForWebGLHeap", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "writeGLArray", "SDL_unicode", "SDL_ttfContext", "SDL_audio", "GLFW_Window", "runAndAbortIfError", "registerInheritedInstance", "unregisterInheritedInstance", "requireRegisteredType", "enumReadValueFromPointer", "validateThis", "getStringOrSymbol", "craftEmvalAllocator", "emval_get_global", "emval_lookupTypes", "emval_allocateDestructors", "emval_addMethodCaller"];
        Oo.forEach(P);
        var Er;
        Te = function l() {
          Er || na(), Er || (Te = l);
        };
        function Ro() {
          aa(), $n();
        }
        function na(l) {
          if (re > 0 || (Ro(), zn(), re > 0))
            return;
          function u() {
            Er || (Er = !0, i.calledRun = !0, !W && (Hn(), o(i), i.onRuntimeInitialized && i.onRuntimeInitialized(), D(!i._main, 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]'), Wn()));
          }
          i.setStatus ? (i.setStatus("Running..."), setTimeout(function() {
            setTimeout(function() {
              i.setStatus("");
            }, 1), u();
          }, 1)) : u(), Yr();
        }
        if (i.preInit)
          for (typeof i.preInit == "function" && (i.preInit = [i.preInit]); i.preInit.length > 0; )
            i.preInit.pop()();
        return na(), a.ready;
      });
    })();
    t.exports = r;
  })(fi)), fi.exports;
}
var Ga;
function Qo() {
  if (Ga) return Rt;
  Ga = 1;
  var t = Rt && Rt.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty(Rt, "__esModule", { value: !0 }), Rt.LazPerf = Rt.create = Rt.createLazPerf = void 0;
  const e = t(Xo());
  return Rt.createLazPerf = e.default, Rt.create = e.default, Rt.LazPerf = { create: e.default }, Rt;
}
var Aa;
function Zo() {
  if (Aa) return Wt;
  Aa = 1, Object.defineProperty(Wt, "__esModule", { value: !0 }), Wt.decompressFile = Wt.decompressChunk = Wt.PointData = void 0;
  const t = Qo(), e = un();
  Wt.PointData = { createLazPerf: t.createLazPerf, decompressChunk: a, decompressFile: i };
  let r;
  async function n(o) {
    return o || (r || (r = (0, t.createLazPerf)()), r);
  }
  async function a(o, { pointCount: s, pointDataRecordFormat: h, pointDataRecordLength: f }, g) {
    const d = await n(g), c = new Uint8Array(s * f), _ = d._malloc(o.byteLength), y = d._malloc(f), M = new d.ChunkDecoder();
    try {
      d.HEAPU8.set(new Uint8Array(o.buffer, o.byteOffset, o.byteLength), _), M.open(h, f, _);
      for (let m = 0; m < s; ++m)
        M.getPoint(y), c.set(new Uint8Array(d.HEAPU8.buffer, y, f), m * f);
    } finally {
      d._free(_), d._free(y), M.delete();
    }
    return c;
  }
  Wt.decompressChunk = a;
  async function i(o, s) {
    const h = await n(s), f = e.Header.parse(o), { pointCount: g, pointDataRecordLength: d } = f, c = new Uint8Array(g * d), _ = h._malloc(o.byteLength), y = h._malloc(d), M = new h.LASZip();
    try {
      h.HEAPU8.set(new Uint8Array(o.buffer, o.byteOffset, o.byteLength), _), M.open(_, o.byteLength);
      for (let m = 0; m < g; ++m)
        M.getPoint(y), c.set(new Uint8Array(h.HEAPU8.buffer, y, d), m * d);
    } finally {
      M.delete();
    }
    return c;
  }
  return Wt.decompressFile = i, Wt;
}
var Ve = {}, Ca;
function th() {
  if (Ca) return Ve;
  Ca = 1, Object.defineProperty(Ve, "__esModule", { value: !0 }), Ve.View = void 0;
  const t = Ft(), e = hn(), r = ln();
  Ve.View = { create: n };
  function n(a, i, o = [], s) {
    let h = r.Extractor.create(i, o);
    if (s) {
      const y = /* @__PURE__ */ new Set([...s]);
      h = Object.entries(h).reduce((M, [m, S]) => (y.has(m) && (M[m] = S), M), {});
    }
    const f = e.Dimensions.create(h, o), g = t.Binary.toDataView(a), d = i.pointDataRecordLength;
    if (g.byteLength % d !== 0)
      throw new Error(\`Invalid buffer length (\${g.byteLength}) for point length \${d}\`);
    const c = g.byteLength / i.pointDataRecordLength;
    function _(y) {
      const M = h[y];
      if (!M)
        throw new Error(\`No extractor for dimension: \${y}\`);
      return function(m) {
        if (m >= c)
          throw new RangeError(\`View index (\${m}) out of range: \${c}\`);
        return M(g, m);
      };
    }
    return { pointCount: c, dimensions: f, getter: _ };
  }
  return Ve;
}
var Ye = {}, Ta;
function eh() {
  if (Ta) return Ye;
  Ta = 1, Object.defineProperty(Ye, "__esModule", { value: !0 }), Ye.Vlr = void 0;
  const t = Ft(), e = Si();
  Ye.Vlr = { walk: i, parse: o, find: r, at: n, fetch: a };
  function r(g, d, c) {
    return g.find((_) => _.userId === d && _.recordId === c);
  }
  function n(g, d, c) {
    const _ = r(g, d, c);
    if (!_)
      throw new Error(\`VLR not found: \${d}/\${c}\`);
    return _;
  }
  function a(g, { contentOffset: d, contentLength: c }) {
    return c === 0 ? new Uint8Array() : t.Getter.create(g)(d, d + c);
  }
  async function i(g, d) {
    const c = t.Getter.create(g), _ = await f({
      get: c,
      startOffset: d.headerLength,
      count: d.vlrCount,
      isExtended: !1
    }), y = await f({
      get: c,
      startOffset: d.evlrOffset,
      count: d.evlrCount,
      isExtended: !0
    });
    return [..._, ...y];
  }
  function o(g, d) {
    return (d ? h : s)(g);
  }
  function s(g) {
    const d = t.Binary.toDataView(g);
    if (d.byteLength !== e.vlrHeaderLength)
      throw new Error(\`Invalid VLR header length (must be \${e.vlrHeaderLength}): \${d.byteLength}\`);
    return {
      userId: t.Binary.toCString(g.slice(2, 18)),
      recordId: d.getUint16(18, !0),
      contentLength: d.getUint16(20, !0),
      description: t.Binary.toCString(g.slice(22, 54)),
      isExtended: !1
    };
  }
  function h(g) {
    const d = t.Binary.toDataView(g);
    if (d.byteLength !== e.evlrHeaderLength)
      throw new Error(\`Invalid EVLR header length (must be \${e.evlrHeaderLength}): \${d.byteLength}\`);
    return {
      userId: t.Binary.toCString(g.slice(2, 18)),
      recordId: d.getUint16(18, !0),
      contentLength: (0, t.parseBigInt)((0, t.getBigUint64)(d, 20, !0)),
      description: t.Binary.toCString(g.slice(28, 60)),
      isExtended: !0
    };
  }
  async function f({ get: g, startOffset: d, count: c, isExtended: _ }) {
    const y = [];
    let M = d;
    const m = _ ? e.evlrHeaderLength : e.vlrHeaderLength;
    for (let S = 0; S < c; ++S) {
      const w = m ? await g(M, M + m) : new Uint8Array(), { userId: P, recordId: R, contentLength: I, description: k } = o(w, _);
      y.push({
        userId: P,
        recordId: R,
        contentOffset: M + m,
        contentLength: I,
        description: k,
        isExtended: _
      }), M += m + I;
    }
    return y;
  }
  return Ye;
}
var Ia;
function cn() {
  return Ia || (Ia = 1, (function(t) {
    var e = $t && $t.__createBinding || (Object.create ? (function(d, c, _, y) {
      y === void 0 && (y = _);
      var M = Object.getOwnPropertyDescriptor(c, _);
      (!M || ("get" in M ? !c.__esModule : M.writable || M.configurable)) && (M = { enumerable: !0, get: function() {
        return c[_];
      } }), Object.defineProperty(d, y, M);
    }) : (function(d, c, _, y) {
      y === void 0 && (y = _), d[y] = c[_];
    })), r = $t && $t.__setModuleDefault || (Object.create ? (function(d, c) {
      Object.defineProperty(d, "default", { enumerable: !0, value: c });
    }) : function(d, c) {
      d.default = c;
    }), n = $t && $t.__importStar || function(d) {
      if (d && d.__esModule) return d;
      var c = {};
      if (d != null) for (var _ in d) _ !== "default" && Object.prototype.hasOwnProperty.call(d, _) && e(c, d, _);
      return r(c, d), c;
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Vlr = t.View = t.PointData = t.Header = t.Extractor = t.ExtraBytes = t.Dimensions = t.Constants = void 0, t.Constants = n(Si());
    var a = hn();
    Object.defineProperty(t, "Dimensions", { enumerable: !0, get: function() {
      return a.Dimensions;
    } });
    var i = on();
    Object.defineProperty(t, "ExtraBytes", { enumerable: !0, get: function() {
      return i.ExtraBytes;
    } });
    var o = ln();
    Object.defineProperty(t, "Extractor", { enumerable: !0, get: function() {
      return o.Extractor;
    } });
    var s = un();
    Object.defineProperty(t, "Header", { enumerable: !0, get: function() {
      return s.Header;
    } });
    var h = Zo();
    Object.defineProperty(t, "PointData", { enumerable: !0, get: function() {
      return h.PointData;
    } });
    var f = th();
    Object.defineProperty(t, "View", { enumerable: !0, get: function() {
      return f.View;
    } });
    var g = eh();
    Object.defineProperty(t, "Vlr", { enumerable: !0, get: function() {
      return g.Vlr;
    } });
  })($t)), $t;
}
var Ke = {}, Oa;
function fn() {
  if (Oa) return Ke;
  Oa = 1, Object.defineProperty(Ke, "__esModule", { value: !0 }), Ke.Hierarchy = void 0;
  const t = Ft(), e = Pi();
  Ke.Hierarchy = { parse: r, load: n };
  function r(a) {
    const i = t.Binary.toDataView(a);
    if (i.byteLength % e.hierarchyItemLength !== 0)
      throw new Error(\`Invalid hierarchy page length: \${i.byteLength}\`);
    const o = {}, s = {};
    for (let h = 0; h < i.byteLength; h += e.hierarchyItemLength) {
      const f = i.getInt32(h + 0, !0), g = i.getInt32(h + 4, !0), d = i.getInt32(h + 8, !0), c = i.getInt32(h + 12, !0), _ = (0, t.parseBigInt)((0, t.getBigUint64)(i, h + 16, !0)), y = i.getInt32(h + 24, !0), M = i.getInt32(h + 28, !0), m = t.Key.toString([f, g, d, c]);
      if (M < -1)
        throw new Error(\`Invalid hierarchy point count at key: \${m}\`);
      M === -1 ? s[m] = {
        pageOffset: _,
        pageLength: y
      } : o[m] = {
        pointCount: M,
        pointDataOffset: _,
        pointDataLength: y
      };
    }
    return { nodes: o, pages: s };
  }
  async function n(a, i) {
    const o = t.Getter.create(a);
    return r(await o(i.pageOffset, i.pageOffset + i.pageLength));
  }
  return Ke;
}
var Je = {}, Ra;
function dn() {
  if (Ra) return Je;
  Ra = 1, Object.defineProperty(Je, "__esModule", { value: !0 }), Je.Info = void 0;
  const t = Ft(), e = Pi();
  Je.Info = { parse: r };
  function r(n) {
    const a = t.Binary.toDataView(n);
    if (a.byteLength !== e.infoLength)
      throw new Error(\`Invalid COPC info VLR length (should be \${e.infoLength}): \${a.byteLength}\`);
    const i = [
      a.getFloat64(0, !0),
      a.getFloat64(8, !0),
      a.getFloat64(16, !0)
    ], o = a.getFloat64(24, !0);
    return {
      cube: [
        i[0] - o,
        i[1] - o,
        i[2] - o,
        i[0] + o,
        i[1] + o,
        i[2] + o
      ],
      spacing: a.getFloat64(32, !0),
      rootHierarchyPage: {
        pageOffset: (0, t.parseBigInt)((0, t.getBigUint64)(a, 40, !0)),
        pageLength: (0, t.parseBigInt)((0, t.getBigUint64)(a, 48, !0))
      },
      gpsTimeRange: [a.getFloat64(56, !0), a.getFloat64(64, !0)]
    };
  }
  return Je;
}
var Na;
function rh() {
  if (Na) return Ot;
  Na = 1;
  var t = Ot && Ot.__createBinding || (Object.create ? (function(c, _, y, M) {
    M === void 0 && (M = y);
    var m = Object.getOwnPropertyDescriptor(_, y);
    (!m || ("get" in m ? !_.__esModule : m.writable || m.configurable)) && (m = { enumerable: !0, get: function() {
      return _[y];
    } }), Object.defineProperty(c, M, m);
  }) : (function(c, _, y, M) {
    M === void 0 && (M = y), c[M] = _[y];
  })), e = Ot && Ot.__setModuleDefault || (Object.create ? (function(c, _) {
    Object.defineProperty(c, "default", { enumerable: !0, value: _ });
  }) : function(c, _) {
    c.default = _;
  }), r = Ot && Ot.__importStar || function(c) {
    if (c && c.__esModule) return c;
    var _ = {};
    if (c != null) for (var y in c) y !== "default" && Object.prototype.hasOwnProperty.call(c, y) && t(_, c, y);
    return e(_, c), _;
  };
  Object.defineProperty(Ot, "__esModule", { value: !0 }), Ot.Copc = void 0;
  const n = r(cn()), a = Ft(), i = fn(), o = dn();
  Ot.Copc = {
    create: s,
    loadHierarchyPage: h,
    loadCompressedPointDataBuffer: f,
    loadPointDataBuffer: g,
    loadPointDataView: d
  };
  async function s(c) {
    const _ = a.Getter.create(c), y = 65536, M = _(0, y);
    async function m(V, ot) {
      return ot >= y ? _(V, ot) : (await M).slice(V, ot);
    }
    const S = n.Header.parse(await m(0, n.Constants.minHeaderLength)), w = await n.Vlr.walk(m, S), P = n.Vlr.find(w, "copc", 1);
    if (!P)
      throw new Error("COPC info VLR is required");
    const R = o.Info.parse(await n.Vlr.fetch(m, P));
    let I;
    const k = n.Vlr.find(w, "LASF_Projection", 2112);
    k && k.contentLength && (I = a.Binary.toCString(await n.Vlr.fetch(m, k)), I === "" && (I = void 0));
    let W = [];
    const D = n.Vlr.find(w, "LASF_Spec", 4);
    return D && (W = n.ExtraBytes.parse(await n.Vlr.fetch(m, D))), { header: S, vlrs: w, info: R, wkt: I, eb: W };
  }
  async function h(c, _) {
    const y = a.Getter.create(c);
    return i.Hierarchy.load(y, _);
  }
  async function f(c, { pointDataOffset: _, pointDataLength: y }) {
    return a.Getter.create(c)(_, _ + y);
  }
  async function g(c, { pointDataRecordFormat: _, pointDataRecordLength: y }, M, m) {
    const S = await f(c, M), { pointCount: w } = M;
    return n.PointData.decompressChunk(S, { pointCount: w, pointDataRecordFormat: _, pointDataRecordLength: y }, m);
  }
  async function d(c, _, y, { lazPerf: M, include: m } = {}) {
    const S = await g(c, _.header, y, M);
    return n.View.create(S, _.header, _.eb, m);
  }
  return Ot;
}
var La;
function ih() {
  return La || (La = 1, (function(t) {
    var e = qt && qt.__createBinding || (Object.create ? (function(s, h, f, g) {
      g === void 0 && (g = f);
      var d = Object.getOwnPropertyDescriptor(h, f);
      (!d || ("get" in d ? !h.__esModule : d.writable || d.configurable)) && (d = { enumerable: !0, get: function() {
        return h[f];
      } }), Object.defineProperty(s, g, d);
    }) : (function(s, h, f, g) {
      g === void 0 && (g = f), s[g] = h[f];
    })), r = qt && qt.__setModuleDefault || (Object.create ? (function(s, h) {
      Object.defineProperty(s, "default", { enumerable: !0, value: h });
    }) : function(s, h) {
      s.default = h;
    }), n = qt && qt.__importStar || function(s) {
      if (s && s.__esModule) return s;
      var h = {};
      if (s != null) for (var f in s) f !== "default" && Object.prototype.hasOwnProperty.call(s, f) && e(h, s, f);
      return r(h, s), h;
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Info = t.Hierarchy = t.Copc = t.Constants = void 0, t.Constants = n(Pi());
    var a = rh();
    Object.defineProperty(t, "Copc", { enumerable: !0, get: function() {
      return a.Copc;
    } });
    var i = fn();
    Object.defineProperty(t, "Hierarchy", { enumerable: !0, get: function() {
      return i.Hierarchy;
    } });
    var o = dn();
    Object.defineProperty(t, "Info", { enumerable: !0, get: function() {
      return o.Info;
    } });
  })(qt)), qt;
}
var Fa;
function ah() {
  return Fa || (Fa = 1, (function(t) {
    var e = It && It.__createBinding || (Object.create ? (function(i, o, s, h) {
      h === void 0 && (h = s);
      var f = Object.getOwnPropertyDescriptor(o, s);
      (!f || ("get" in f ? !o.__esModule : f.writable || f.configurable)) && (f = { enumerable: !0, get: function() {
        return o[s];
      } }), Object.defineProperty(i, h, f);
    }) : (function(i, o, s, h) {
      h === void 0 && (h = s), i[h] = o[s];
    })), r = It && It.__setModuleDefault || (Object.create ? (function(i, o) {
      Object.defineProperty(i, "default", { enumerable: !0, value: o });
    }) : function(i, o) {
      i.default = o;
    }), n = It && It.__importStar || function(i) {
      if (i && i.__esModule) return i;
      var o = {};
      if (i != null) for (var s in i) s !== "default" && Object.prototype.hasOwnProperty.call(i, s) && e(o, i, s);
      return r(o, i), o;
    }, a = It && It.__exportStar || function(i, o) {
      for (var s in i) s !== "default" && !Object.prototype.hasOwnProperty.call(o, s) && e(o, i, s);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.Las = t.Ept = void 0, t.Ept = n(Do()), a(ih(), t), t.Las = n(cn()), a(Ft(), t);
  })(It)), It;
}
var Fr = ah();
function nh(t) {
  t("EPSG:4326", "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees"), t("EPSG:4269", "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees"), t("EPSG:3857", "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs");
  for (var e = 1; e <= 60; ++e)
    t("EPSG:" + (32600 + e), "+proj=utm +zone=" + e + " +datum=WGS84 +units=m"), t("EPSG:" + (32700 + e), "+proj=utm +zone=" + e + " +south +datum=WGS84 +units=m");
  t("EPSG:5041", "+title=WGS 84 / UPS North (E,N) +proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m"), t("EPSG:5042", "+title=WGS 84 / UPS South (E,N) +proj=stere +lat_0=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m"), t.WGS84 = t["EPSG:4326"], t["EPSG:3785"] = t["EPSG:3857"], t.GOOGLE = t["EPSG:3857"], t["EPSG:900913"] = t["EPSG:3857"], t["EPSG:102113"] = t["EPSG:3857"];
}
var fe = 1, de = 2, Se = 3, sh = 4, yi = 5, Da = 6378137, oh = 6356752314e-3, Ua = 0.0066943799901413165, rr = 484813681109536e-20, A = Math.PI / 2, hh = 0.16666666666666666, lh = 0.04722222222222222, uh = 0.022156084656084655, N = 1e-10, rt = 0.017453292519943295, wt = 57.29577951308232, X = Math.PI / 4, or = Math.PI * 2, nt = 3.14159265359, bt = {};
bt.greenwich = 0;
bt.lisbon = -9.131906111111;
bt.paris = 2.337229166667;
bt.bogota = -74.080916666667;
bt.madrid = -3.687938888889;
bt.rome = 12.452333333333;
bt.bern = 7.439583333333;
bt.jakarta = 106.807719444444;
bt.ferro = -17.666666666667;
bt.brussels = 4.367975;
bt.stockholm = 18.058277777778;
bt.athens = 23.7163375;
bt.oslo = 10.722916666667;
var ch = {
  mm: { to_meter: 1e-3 },
  cm: { to_meter: 0.01 },
  ft: { to_meter: 0.3048 },
  "us-ft": { to_meter: 1200 / 3937 },
  fath: { to_meter: 1.8288 },
  kmi: { to_meter: 1852 },
  "us-ch": { to_meter: 20.1168402336805 },
  "us-mi": { to_meter: 1609.34721869444 },
  km: { to_meter: 1e3 },
  "ind-ft": { to_meter: 0.30479841 },
  "ind-yd": { to_meter: 0.91439523 },
  mi: { to_meter: 1609.344 },
  yd: { to_meter: 0.9144 },
  ch: { to_meter: 20.1168 },
  link: { to_meter: 0.201168 },
  dm: { to_meter: 0.1 },
  in: { to_meter: 0.0254 },
  "ind-ch": { to_meter: 20.11669506 },
  "us-in": { to_meter: 0.025400050800101 },
  "us-yd": { to_meter: 0.914401828803658 }
}, Ba = /[\\s_\\-\\/\\(\\)]/g;
function Qt(t, e) {
  if (t[e])
    return t[e];
  for (var r = Object.keys(t), n = e.toLowerCase().replace(Ba, ""), a = -1, i, o; ++a < r.length; )
    if (i = r[a], o = i.toLowerCase().replace(Ba, ""), o === n)
      return t[i];
}
function mi(t) {
  var e = {}, r = t.split("+").map(function(s) {
    return s.trim();
  }).filter(function(s) {
    return s;
  }).reduce(function(s, h) {
    var f = h.split("=");
    return f.push(!0), s[f[0].toLowerCase()] = f[1], s;
  }, {}), n, a, i, o = {
    proj: "projName",
    datum: "datumCode",
    rf: function(s) {
      e.rf = parseFloat(s);
    },
    lat_0: function(s) {
      e.lat0 = s * rt;
    },
    lat_1: function(s) {
      e.lat1 = s * rt;
    },
    lat_2: function(s) {
      e.lat2 = s * rt;
    },
    lat_ts: function(s) {
      e.lat_ts = s * rt;
    },
    lon_0: function(s) {
      e.long0 = s * rt;
    },
    lon_1: function(s) {
      e.long1 = s * rt;
    },
    lon_2: function(s) {
      e.long2 = s * rt;
    },
    alpha: function(s) {
      e.alpha = parseFloat(s) * rt;
    },
    gamma: function(s) {
      e.rectified_grid_angle = parseFloat(s) * rt;
    },
    lonc: function(s) {
      e.longc = s * rt;
    },
    x_0: function(s) {
      e.x0 = parseFloat(s);
    },
    y_0: function(s) {
      e.y0 = parseFloat(s);
    },
    k_0: function(s) {
      e.k0 = parseFloat(s);
    },
    k: function(s) {
      e.k0 = parseFloat(s);
    },
    a: function(s) {
      e.a = parseFloat(s);
    },
    b: function(s) {
      e.b = parseFloat(s);
    },
    r: function(s) {
      e.a = e.b = parseFloat(s);
    },
    r_a: function() {
      e.R_A = !0;
    },
    zone: function(s) {
      e.zone = parseInt(s, 10);
    },
    south: function() {
      e.utmSouth = !0;
    },
    towgs84: function(s) {
      e.datum_params = s.split(",").map(function(h) {
        return parseFloat(h);
      });
    },
    to_meter: function(s) {
      e.to_meter = parseFloat(s);
    },
    units: function(s) {
      e.units = s;
      var h = Qt(ch, s);
      h && (e.to_meter = h.to_meter);
    },
    from_greenwich: function(s) {
      e.from_greenwich = s * rt;
    },
    pm: function(s) {
      var h = Qt(bt, s);
      e.from_greenwich = (h || parseFloat(s)) * rt;
    },
    nadgrids: function(s) {
      s === "@null" ? e.datumCode = "none" : e.nadgrids = s;
    },
    axis: function(s) {
      var h = "ewnsud";
      s.length === 3 && h.indexOf(s.substr(0, 1)) !== -1 && h.indexOf(s.substr(1, 1)) !== -1 && h.indexOf(s.substr(2, 1)) !== -1 && (e.axis = s);
    },
    approx: function() {
      e.approx = !0;
    },
    over: function() {
      e.over = !0;
    }
  };
  for (n in r)
    a = r[n], n in o ? (i = o[n], typeof i == "function" ? i(a) : e[i] = a) : e[n] = a;
  return typeof e.datumCode == "string" && e.datumCode !== "WGS84" && (e.datumCode = e.datumCode.toLowerCase()), e.projStr = t, e;
}
class gn {
  static getId(e) {
    const r = e.find((n) => Array.isArray(n) && n[0] === "ID");
    return r && r.length >= 3 ? {
      authority: r[1],
      code: parseInt(r[2], 10)
    } : null;
  }
  static convertUnit(e, r = "unit") {
    if (!e || e.length < 3)
      return { type: r, name: "unknown", conversion_factor: null };
    const n = e[1], a = parseFloat(e[2]) || null, i = e.find((s) => Array.isArray(s) && s[0] === "ID"), o = i ? {
      authority: i[1],
      code: parseInt(i[2], 10)
    } : null;
    return {
      type: r,
      name: n,
      conversion_factor: a,
      id: o
    };
  }
  static convertAxis(e) {
    const r = e[1] || "Unknown";
    let n;
    const a = r.match(/^\\((.)\\)$/);
    if (a) {
      const f = a[1].toUpperCase();
      if (f === "E") n = "east";
      else if (f === "N") n = "north";
      else if (f === "U") n = "up";
      else if (e[2]) n = e[2];
      else throw new Error(\`Unknown axis abbreviation: \${f}\`);
    } else
      n = e[2] || "unknown";
    const i = e.find((f) => Array.isArray(f) && f[0] === "ORDER"), o = i ? parseInt(i[1], 10) : null, s = e.find(
      (f) => Array.isArray(f) && (f[0] === "LENGTHUNIT" || f[0] === "ANGLEUNIT" || f[0] === "SCALEUNIT")
    ), h = this.convertUnit(s);
    return {
      name: r,
      direction: n,
      // Use the valid PROJJSON direction value
      unit: h,
      order: o
    };
  }
  static extractAxes(e) {
    return e.filter((r) => Array.isArray(r) && r[0] === "AXIS").map((r) => this.convertAxis(r)).sort((r, n) => (r.order || 0) - (n.order || 0));
  }
  static convert(e, r = {}) {
    switch (e[0]) {
      case "PROJCRS":
        r.type = "ProjectedCRS", r.name = e[1], r.base_crs = e.find((c) => Array.isArray(c) && c[0] === "BASEGEOGCRS") ? this.convert(e.find((c) => Array.isArray(c) && c[0] === "BASEGEOGCRS")) : null, r.conversion = e.find((c) => Array.isArray(c) && c[0] === "CONVERSION") ? this.convert(e.find((c) => Array.isArray(c) && c[0] === "CONVERSION")) : null;
        const n = e.find((c) => Array.isArray(c) && c[0] === "CS");
        n && (r.coordinate_system = {
          type: n[1],
          axis: this.extractAxes(e)
        });
        const a = e.find((c) => Array.isArray(c) && c[0] === "LENGTHUNIT");
        if (a) {
          const c = this.convertUnit(a);
          r.coordinate_system.unit = c;
        }
        r.id = this.getId(e);
        break;
      case "BASEGEOGCRS":
      case "GEOGCRS":
      case "GEODCRS":
        r.type = e[0] === "GEODCRS" ? "GeodeticCRS" : "GeographicCRS", r.name = e[1];
        const i = e.find(
          (c) => Array.isArray(c) && (c[0] === "DATUM" || c[0] === "ENSEMBLE")
        );
        if (i) {
          const c = this.convert(i);
          i[0] === "ENSEMBLE" ? r.datum_ensemble = c : r.datum = c;
          const _ = e.find((y) => Array.isArray(y) && y[0] === "PRIMEM");
          _ && _[1] !== "Greenwich" && (c.prime_meridian = {
            name: _[1],
            longitude: parseFloat(_[2])
          });
        }
        r.coordinate_system = {
          type: "ellipsoidal",
          axis: this.extractAxes(e)
        }, r.id = this.getId(e);
        break;
      case "DATUM":
        r.type = "GeodeticReferenceFrame", r.name = e[1], r.ellipsoid = e.find((c) => Array.isArray(c) && c[0] === "ELLIPSOID") ? this.convert(e.find((c) => Array.isArray(c) && c[0] === "ELLIPSOID")) : null;
        break;
      case "ENSEMBLE":
        r.type = "DatumEnsemble", r.name = e[1], r.members = e.filter((c) => Array.isArray(c) && c[0] === "MEMBER").map((c) => ({
          type: "DatumEnsembleMember",
          name: c[1],
          id: this.getId(c)
          // Extract ID as { authority, code }
        }));
        const o = e.find((c) => Array.isArray(c) && c[0] === "ENSEMBLEACCURACY");
        o && (r.accuracy = parseFloat(o[1]));
        const s = e.find((c) => Array.isArray(c) && c[0] === "ELLIPSOID");
        s && (r.ellipsoid = this.convert(s)), r.id = this.getId(e);
        break;
      case "ELLIPSOID":
        r.type = "Ellipsoid", r.name = e[1], r.semi_major_axis = parseFloat(e[2]), r.inverse_flattening = parseFloat(e[3]), e.find((c) => Array.isArray(c) && c[0] === "LENGTHUNIT") && this.convert(e.find((c) => Array.isArray(c) && c[0] === "LENGTHUNIT"), r);
        break;
      case "CONVERSION":
        r.type = "Conversion", r.name = e[1], r.method = e.find((c) => Array.isArray(c) && c[0] === "METHOD") ? this.convert(e.find((c) => Array.isArray(c) && c[0] === "METHOD")) : null, r.parameters = e.filter((c) => Array.isArray(c) && c[0] === "PARAMETER").map((c) => this.convert(c));
        break;
      case "METHOD":
        r.type = "Method", r.name = e[1], r.id = this.getId(e);
        break;
      case "PARAMETER":
        r.type = "Parameter", r.name = e[1], r.value = parseFloat(e[2]), r.unit = this.convertUnit(
          e.find(
            (c) => Array.isArray(c) && (c[0] === "LENGTHUNIT" || c[0] === "ANGLEUNIT" || c[0] === "SCALEUNIT")
          )
        ), r.id = this.getId(e);
        break;
      case "BOUNDCRS":
        r.type = "BoundCRS";
        const h = e.find((c) => Array.isArray(c) && c[0] === "SOURCECRS");
        if (h) {
          const c = h.find((_) => Array.isArray(_));
          r.source_crs = c ? this.convert(c) : null;
        }
        const f = e.find((c) => Array.isArray(c) && c[0] === "TARGETCRS");
        if (f) {
          const c = f.find((_) => Array.isArray(_));
          r.target_crs = c ? this.convert(c) : null;
        }
        const g = e.find((c) => Array.isArray(c) && c[0] === "ABRIDGEDTRANSFORMATION");
        g ? r.transformation = this.convert(g) : r.transformation = null;
        break;
      case "ABRIDGEDTRANSFORMATION":
        if (r.type = "Transformation", r.name = e[1], r.method = e.find((c) => Array.isArray(c) && c[0] === "METHOD") ? this.convert(e.find((c) => Array.isArray(c) && c[0] === "METHOD")) : null, r.parameters = e.filter((c) => Array.isArray(c) && (c[0] === "PARAMETER" || c[0] === "PARAMETERFILE")).map((c) => {
          if (c[0] === "PARAMETER")
            return this.convert(c);
          if (c[0] === "PARAMETERFILE")
            return {
              name: c[1],
              value: c[2],
              id: {
                authority: "EPSG",
                code: 8656
              }
            };
        }), r.parameters.length === 7) {
          const c = r.parameters[6];
          c.name === "Scale difference" && (c.value = Math.round((c.value - 1) * 1e12) / 1e6);
        }
        r.id = this.getId(e);
        break;
      case "AXIS":
        r.coordinate_system || (r.coordinate_system = { type: "unspecified", axis: [] }), r.coordinate_system.axis.push(this.convertAxis(e));
        break;
      case "LENGTHUNIT":
        const d = this.convertUnit(e, "LinearUnit");
        r.coordinate_system && r.coordinate_system.axis && r.coordinate_system.axis.forEach((c) => {
          c.unit || (c.unit = d);
        }), d.conversion_factor && d.conversion_factor !== 1 && r.semi_major_axis && (r.semi_major_axis = {
          value: r.semi_major_axis,
          unit: d
        });
        break;
      default:
        r.keyword = e[0];
        break;
    }
    return r;
  }
}
class fh extends gn {
  static convert(e, r = {}) {
    return super.convert(e, r), r.coordinate_system && r.coordinate_system.subtype === "Cartesian" && delete r.coordinate_system, r.usage && delete r.usage, r;
  }
}
class dh extends gn {
  static convert(e, r = {}) {
    super.convert(e, r);
    const n = e.find((i) => Array.isArray(i) && i[0] === "CS");
    n && (r.coordinate_system = {
      subtype: n[1],
      axis: this.extractAxes(e)
    });
    const a = e.find((i) => Array.isArray(i) && i[0] === "USAGE");
    if (a) {
      const i = a.find((h) => Array.isArray(h) && h[0] === "SCOPE"), o = a.find((h) => Array.isArray(h) && h[0] === "AREA"), s = a.find((h) => Array.isArray(h) && h[0] === "BBOX");
      r.usage = {}, i && (r.usage.scope = i[1]), o && (r.usage.area = o[1]), s && (r.usage.bbox = s.slice(1));
    }
    return r;
  }
}
function gh(t) {
  return t.find((e) => Array.isArray(e) && e[0] === "USAGE") ? "2019" : (t.find((e) => Array.isArray(e) && e[0] === "CS") || t[0] === "BOUNDCRS" || t[0] === "PROJCRS" || t[0] === "GEOGCRS", "2015");
}
function _h(t) {
  return (gh(t) === "2019" ? dh : fh).convert(t);
}
function vh(t) {
  const e = t.toUpperCase();
  return e.includes("PROJCRS") || e.includes("GEOGCRS") || e.includes("BOUNDCRS") || e.includes("VERTCRS") || e.includes("LENGTHUNIT") || e.includes("ANGLEUNIT") || e.includes("SCALEUNIT") ? "WKT2" : (e.includes("PROJCS") || e.includes("GEOGCS") || e.includes("LOCAL_CS") || e.includes("VERT_CS") || e.includes("UNIT"), "WKT1");
}
var hr = 1, _n = 2, vn = 3, Dr = 4, yn = 5, xi = -1, yh = /\\s/, mh = /[A-Za-z]/, Mh = /[A-Za-z84_]/, Wr = /[,\\]]/, mn = /[\\d\\.E\\-\\+]/;
function Vt(t) {
  if (typeof t != "string")
    throw new Error("not a string");
  this.text = t.trim(), this.level = 0, this.place = 0, this.root = null, this.stack = [], this.currentObject = null, this.state = hr;
}
Vt.prototype.readCharicter = function() {
  var t = this.text[this.place++];
  if (this.state !== Dr)
    for (; yh.test(t); ) {
      if (this.place >= this.text.length)
        return;
      t = this.text[this.place++];
    }
  switch (this.state) {
    case hr:
      return this.neutral(t);
    case _n:
      return this.keyword(t);
    case Dr:
      return this.quoted(t);
    case yn:
      return this.afterquote(t);
    case vn:
      return this.number(t);
    case xi:
      return;
  }
};
Vt.prototype.afterquote = function(t) {
  if (t === '"') {
    this.word += '"', this.state = Dr;
    return;
  }
  if (Wr.test(t)) {
    this.word = this.word.trim(), this.afterItem(t);
    return;
  }
  throw new Error(\`havn't handled "\` + t + '" in afterquote yet, index ' + this.place);
};
Vt.prototype.afterItem = function(t) {
  if (t === ",") {
    this.word !== null && this.currentObject.push(this.word), this.word = null, this.state = hr;
    return;
  }
  if (t === "]") {
    this.level--, this.word !== null && (this.currentObject.push(this.word), this.word = null), this.state = hr, this.currentObject = this.stack.pop(), this.currentObject || (this.state = xi);
    return;
  }
};
Vt.prototype.number = function(t) {
  if (mn.test(t)) {
    this.word += t;
    return;
  }
  if (Wr.test(t)) {
    this.word = parseFloat(this.word), this.afterItem(t);
    return;
  }
  throw new Error(\`havn't handled "\` + t + '" in number yet, index ' + this.place);
};
Vt.prototype.quoted = function(t) {
  if (t === '"') {
    this.state = yn;
    return;
  }
  this.word += t;
};
Vt.prototype.keyword = function(t) {
  if (Mh.test(t)) {
    this.word += t;
    return;
  }
  if (t === "[") {
    var e = [];
    e.push(this.word), this.level++, this.root === null ? this.root = e : this.currentObject.push(e), this.stack.push(this.currentObject), this.currentObject = e, this.state = hr;
    return;
  }
  if (Wr.test(t)) {
    this.afterItem(t);
    return;
  }
  throw new Error(\`havn't handled "\` + t + '" in keyword yet, index ' + this.place);
};
Vt.prototype.neutral = function(t) {
  if (mh.test(t)) {
    this.word = t, this.state = _n;
    return;
  }
  if (t === '"') {
    this.word = "", this.state = Dr;
    return;
  }
  if (mn.test(t)) {
    this.word = t, this.state = vn;
    return;
  }
  if (Wr.test(t)) {
    this.afterItem(t);
    return;
  }
  throw new Error(\`havn't handled "\` + t + '" in neutral yet, index ' + this.place);
};
Vt.prototype.output = function() {
  for (; this.place < this.text.length; )
    this.readCharicter();
  if (this.state === xi)
    return this.root;
  throw new Error('unable to parse string "' + this.text + '". State is ' + this.state);
};
function ph(t) {
  var e = new Vt(t);
  return e.output();
}
function di(t, e, r) {
  Array.isArray(e) && (r.unshift(e), e = null);
  var n = e ? {} : t, a = r.reduce(function(i, o) {
    return we(o, i), i;
  }, n);
  e && (t[e] = a);
}
function we(t, e) {
  if (!Array.isArray(t)) {
    e[t] = !0;
    return;
  }
  var r = t.shift();
  if (r === "PARAMETER" && (r = t.shift()), t.length === 1) {
    if (Array.isArray(t[0])) {
      e[r] = {}, we(t[0], e[r]);
      return;
    }
    e[r] = t[0];
    return;
  }
  if (!t.length) {
    e[r] = !0;
    return;
  }
  if (r === "TOWGS84") {
    e[r] = t;
    return;
  }
  if (r === "AXIS") {
    r in e || (e[r] = []), e[r].push(t);
    return;
  }
  Array.isArray(r) || (e[r] = {});
  var n;
  switch (r) {
    case "UNIT":
    case "PRIMEM":
    case "VERT_DATUM":
      e[r] = {
        name: t[0].toLowerCase(),
        convert: t[1]
      }, t.length === 3 && we(t[2], e[r]);
      return;
    case "SPHEROID":
    case "ELLIPSOID":
      e[r] = {
        name: t[0],
        a: t[1],
        rf: t[2]
      }, t.length === 4 && we(t[3], e[r]);
      return;
    case "EDATUM":
    case "ENGINEERINGDATUM":
    case "LOCAL_DATUM":
    case "DATUM":
    case "VERT_CS":
    case "VERTCRS":
    case "VERTICALCRS":
      t[0] = ["name", t[0]], di(e, r, t);
      return;
    case "COMPD_CS":
    case "COMPOUNDCRS":
    case "FITTED_CS":
    // the followings are the crs defined in
    // https://github.com/proj4js/proj4js/blob/1da4ed0b865d0fcb51c136090569210cdcc9019e/lib/parseCode.js#L11
    case "PROJECTEDCRS":
    case "PROJCRS":
    case "GEOGCS":
    case "GEOCCS":
    case "PROJCS":
    case "LOCAL_CS":
    case "GEODCRS":
    case "GEODETICCRS":
    case "GEODETICDATUM":
    case "ENGCRS":
    case "ENGINEERINGCRS":
      t[0] = ["name", t[0]], di(e, r, t), e[r].type = r;
      return;
    default:
      for (n = -1; ++n < t.length; )
        if (!Array.isArray(t[n]))
          return we(t, e[r]);
      return di(e, r, t);
  }
}
var wh = 0.017453292519943295;
function Nt(t) {
  return t * wh;
}
function Mn(t) {
  const e = (t.projName || "").toLowerCase().replace(/_/g, " ");
  !t.long0 && t.longc && (e === "albers conic equal area" || e === "lambert azimuthal equal area") && (t.long0 = t.longc), !t.lat_ts && t.lat1 && (e === "stereographic south pole" || e === "polar stereographic (variant b)") ? (t.lat0 = Nt(t.lat1 > 0 ? 90 : -90), t.lat_ts = t.lat1, delete t.lat1) : !t.lat_ts && t.lat0 && (e === "polar stereographic" || e === "polar stereographic (variant a)") && (t.lat_ts = t.lat0, t.lat0 = Nt(t.lat0 > 0 ? 90 : -90), delete t.lat1);
}
function ja(t) {
  let e = { units: null, to_meter: void 0 };
  return typeof t == "string" ? (e.units = t.toLowerCase(), e.units === "metre" && (e.units = "meter"), e.units === "meter" && (e.to_meter = 1)) : t && t.name && (e.units = t.name.toLowerCase(), e.units === "metre" && (e.units = "meter"), e.to_meter = t.conversion_factor), e;
}
function ka(t) {
  return typeof t == "object" ? t.value * t.unit.conversion_factor : t;
}
function qa(t, e) {
  t.ellipsoid.radius ? (e.a = t.ellipsoid.radius, e.rf = 0) : (e.a = ka(t.ellipsoid.semi_major_axis), t.ellipsoid.inverse_flattening !== void 0 ? e.rf = t.ellipsoid.inverse_flattening : t.ellipsoid.semi_major_axis !== void 0 && t.ellipsoid.semi_minor_axis !== void 0 && (e.rf = e.a / (e.a - ka(t.ellipsoid.semi_minor_axis))));
}
function Ur(t, e = {}) {
  return !t || typeof t != "object" ? t : t.type === "BoundCRS" ? (Ur(t.source_crs, e), t.transformation && (t.transformation.method && t.transformation.method.name === "NTv2" ? e.nadgrids = t.transformation.parameters[0].value : e.datum_params = t.transformation.parameters.map((r) => r.value)), e) : (Object.keys(t).forEach((r) => {
    const n = t[r];
    if (n !== null)
      switch (r) {
        case "name":
          if (e.srsCode)
            break;
          e.name = n, e.srsCode = n;
          break;
        case "type":
          n === "GeographicCRS" ? e.projName = "longlat" : n === "GeodeticCRS" ? t.coordinate_system && t.coordinate_system.subtype === "Cartesian" ? e.projName = "geocent" : e.projName = "longlat" : n === "ProjectedCRS" && t.conversion && t.conversion.method && (e.projName = t.conversion.method.name);
          break;
        case "datum":
        case "datum_ensemble":
          n.ellipsoid && (e.ellps = n.ellipsoid.name, qa(n, e)), n.prime_meridian && (e.from_greenwich = n.prime_meridian.longitude * Math.PI / 180);
          break;
        case "ellipsoid":
          e.ellps = n.name, qa(n, e);
          break;
        case "prime_meridian":
          e.long0 = (n.longitude || 0) * Math.PI / 180;
          break;
        case "coordinate_system":
          if (n.axis) {
            const a = {
              east: "e",
              north: "n",
              west: "w",
              south: "s",
              up: "u",
              down: "d",
              geocentricx: "e",
              geocentricy: "n",
              geocentricz: "u"
            }, i = n.axis.map((o) => a[o.direction.toLowerCase()]);
            if (i.every(Boolean) && (e.axis = i.join(""), e.axis.length === 2 && (e.axis += "u")), n.unit) {
              const { units: o, to_meter: s } = ja(n.unit);
              e.units = o, e.to_meter = s;
            } else if (n.axis[0] && n.axis[0].unit) {
              const { units: o, to_meter: s } = ja(n.axis[0].unit);
              e.units = o, e.to_meter = s;
            }
          }
          break;
        case "id":
          n.authority && n.code && (e.title = n.authority + ":" + n.code);
          break;
        case "conversion":
          n.method && n.method.name && (e.projName = n.method.name), n.parameters && n.parameters.forEach((a) => {
            const i = a.name.toLowerCase().replace(/\\s+/g, "_"), o = a.value;
            a.unit && a.unit.conversion_factor ? e[i] = o * a.unit.conversion_factor : a.unit === "degree" ? e[i] = o * Math.PI / 180 : e[i] = o;
          });
          break;
        case "unit":
          n.name && (e.units = n.name.toLowerCase(), e.units === "metre" && (e.units = "meter")), n.conversion_factor && (e.to_meter = n.conversion_factor);
          break;
        case "base_crs":
          Ur(n, e), e.datumCode = n.id ? n.id.authority + "_" + n.id.code : n.name;
          break;
      }
  }), e.latitude_of_false_origin !== void 0 && (e.lat0 = e.latitude_of_false_origin), e.longitude_of_false_origin !== void 0 && (e.long0 = e.longitude_of_false_origin), e.latitude_of_standard_parallel !== void 0 && (e.lat0 = e.latitude_of_standard_parallel, e.lat1 = e.latitude_of_standard_parallel), e.latitude_of_1st_standard_parallel !== void 0 && (e.lat1 = e.latitude_of_1st_standard_parallel), e.latitude_of_2nd_standard_parallel !== void 0 && (e.lat2 = e.latitude_of_2nd_standard_parallel), e.latitude_of_projection_centre !== void 0 && (e.lat0 = e.latitude_of_projection_centre), e.longitude_of_projection_centre !== void 0 && (e.longc = e.longitude_of_projection_centre), e.easting_at_false_origin !== void 0 && (e.x0 = e.easting_at_false_origin), e.northing_at_false_origin !== void 0 && (e.y0 = e.northing_at_false_origin), e.latitude_of_natural_origin !== void 0 && (e.lat0 = e.latitude_of_natural_origin), e.longitude_of_natural_origin !== void 0 && (e.long0 = e.longitude_of_natural_origin), e.longitude_of_origin !== void 0 && (e.long0 = e.longitude_of_origin), e.false_easting !== void 0 && (e.x0 = e.false_easting), e.easting_at_projection_centre && (e.x0 = e.easting_at_projection_centre), e.false_northing !== void 0 && (e.y0 = e.false_northing), e.northing_at_projection_centre && (e.y0 = e.northing_at_projection_centre), e.standard_parallel_1 !== void 0 && (e.lat1 = e.standard_parallel_1), e.standard_parallel_2 !== void 0 && (e.lat2 = e.standard_parallel_2), e.scale_factor_at_natural_origin !== void 0 && (e.k0 = e.scale_factor_at_natural_origin), e.scale_factor_at_projection_centre !== void 0 && (e.k0 = e.scale_factor_at_projection_centre), e.scale_factor_on_pseudo_standard_parallel !== void 0 && (e.k0 = e.scale_factor_on_pseudo_standard_parallel), e.azimuth !== void 0 && (e.alpha = e.azimuth), e.azimuth_at_projection_centre !== void 0 && (e.alpha = e.azimuth_at_projection_centre), e.angle_from_rectified_to_skew_grid && (e.rectified_grid_angle = e.angle_from_rectified_to_skew_grid), Mn(e), e);
}
var bh = [
  "PROJECTEDCRS",
  "PROJCRS",
  "GEOGCS",
  "GEOCCS",
  "PROJCS",
  "LOCAL_CS",
  "GEODCRS",
  "GEODETICCRS",
  "GEODETICDATUM",
  "ENGCRS",
  "ENGINEERINGCRS"
];
function Eh(t, e) {
  var r = e[0], n = e[1];
  !(r in t) && n in t && (t[r] = t[n], e.length === 3 && (t[r] = e[2](t[r])));
}
function pn(t) {
  for (var e = Object.keys(t), r = 0, n = e.length; r < n; ++r) {
    var a = e[r];
    bh.indexOf(a) !== -1 && Ph(t[a]), typeof t[a] == "object" && pn(t[a]);
  }
}
function Ph(t) {
  if (t.AUTHORITY) {
    var e = Object.keys(t.AUTHORITY)[0];
    e && e in t.AUTHORITY && (t.title = e + ":" + t.AUTHORITY[e]);
  }
  if (t.type === "GEOGCS" ? t.projName = "longlat" : t.type === "LOCAL_CS" ? (t.projName = "identity", t.local = !0) : typeof t.PROJECTION == "object" ? t.projName = Object.keys(t.PROJECTION)[0] : t.projName = t.PROJECTION, t.AXIS) {
    for (var r = "", n = 0, a = t.AXIS.length; n < a; ++n) {
      var i = [t.AXIS[n][0].toLowerCase(), t.AXIS[n][1].toLowerCase()];
      i[0].indexOf("north") !== -1 || (i[0] === "y" || i[0] === "lat") && i[1] === "north" ? r += "n" : i[0].indexOf("south") !== -1 || (i[0] === "y" || i[0] === "lat") && i[1] === "south" ? r += "s" : i[0].indexOf("east") !== -1 || (i[0] === "x" || i[0] === "lon") && i[1] === "east" ? r += "e" : (i[0].indexOf("west") !== -1 || (i[0] === "x" || i[0] === "lon") && i[1] === "west") && (r += "w");
    }
    r.length === 2 && (r += "u"), r.length === 3 && (t.axis = r);
  }
  t.UNIT && (t.units = t.UNIT.name.toLowerCase(), t.units === "metre" && (t.units = "meter"), t.UNIT.convert && (t.type === "GEOGCS" ? t.DATUM && t.DATUM.SPHEROID && (t.to_meter = t.UNIT.convert * t.DATUM.SPHEROID.a) : t.to_meter = t.UNIT.convert));
  var o = t.GEOGCS;
  t.type === "GEOGCS" && (o = t), o && (o.DATUM ? t.datumCode = o.DATUM.name.toLowerCase() : t.datumCode = o.name.toLowerCase(), t.datumCode.slice(0, 2) === "d_" && (t.datumCode = t.datumCode.slice(2)), t.datumCode === "new_zealand_1949" && (t.datumCode = "nzgd49"), (t.datumCode === "wgs_1984" || t.datumCode === "world_geodetic_system_1984") && (t.PROJECTION === "Mercator_Auxiliary_Sphere" && (t.sphere = !0), t.datumCode = "wgs84"), t.datumCode === "belge_1972" && (t.datumCode = "rnb72"), o.DATUM && o.DATUM.SPHEROID && (t.ellps = o.DATUM.SPHEROID.name.replace("_19", "").replace(/[Cc]larke\\_18/, "clrk"), t.ellps.toLowerCase().slice(0, 13) === "international" && (t.ellps = "intl"), t.a = o.DATUM.SPHEROID.a, t.rf = parseFloat(o.DATUM.SPHEROID.rf)), o.DATUM && o.DATUM.TOWGS84 && (t.datum_params = o.DATUM.TOWGS84), ~t.datumCode.indexOf("osgb_1936") && (t.datumCode = "osgb36"), ~t.datumCode.indexOf("osni_1952") && (t.datumCode = "osni52"), (~t.datumCode.indexOf("tm65") || ~t.datumCode.indexOf("geodetic_datum_of_1965")) && (t.datumCode = "ire65"), t.datumCode === "ch1903+" && (t.datumCode = "ch1903"), ~t.datumCode.indexOf("israel") && (t.datumCode = "isr93")), t.b && !isFinite(t.b) && (t.b = t.a), t.rectified_grid_angle && (t.rectified_grid_angle = Nt(t.rectified_grid_angle));
  function s(g) {
    var d = t.to_meter || 1;
    return g * d;
  }
  var h = function(g) {
    return Eh(t, g);
  }, f = [
    ["standard_parallel_1", "Standard_Parallel_1"],
    ["standard_parallel_1", "Latitude of 1st standard parallel"],
    ["standard_parallel_2", "Standard_Parallel_2"],
    ["standard_parallel_2", "Latitude of 2nd standard parallel"],
    ["false_easting", "False_Easting"],
    ["false_easting", "False easting"],
    ["false-easting", "Easting at false origin"],
    ["false_northing", "False_Northing"],
    ["false_northing", "False northing"],
    ["false_northing", "Northing at false origin"],
    ["central_meridian", "Central_Meridian"],
    ["central_meridian", "Longitude of natural origin"],
    ["central_meridian", "Longitude of false origin"],
    ["latitude_of_origin", "Latitude_Of_Origin"],
    ["latitude_of_origin", "Central_Parallel"],
    ["latitude_of_origin", "Latitude of natural origin"],
    ["latitude_of_origin", "Latitude of false origin"],
    ["scale_factor", "Scale_Factor"],
    ["k0", "scale_factor"],
    ["latitude_of_center", "Latitude_Of_Center"],
    ["latitude_of_center", "Latitude_of_center"],
    ["lat0", "latitude_of_center", Nt],
    ["longitude_of_center", "Longitude_Of_Center"],
    ["longitude_of_center", "Longitude_of_center"],
    ["longc", "longitude_of_center", Nt],
    ["x0", "false_easting", s],
    ["y0", "false_northing", s],
    ["long0", "central_meridian", Nt],
    ["lat0", "latitude_of_origin", Nt],
    ["lat0", "standard_parallel_1", Nt],
    ["lat1", "standard_parallel_1", Nt],
    ["lat2", "standard_parallel_2", Nt],
    ["azimuth", "Azimuth"],
    ["alpha", "azimuth", Nt],
    ["srsCode", "name"]
  ];
  f.forEach(h), Mn(t);
}
function Br(t) {
  if (typeof t == "object")
    return Ur(t);
  const e = vh(t);
  var r = ph(t);
  if (e === "WKT2") {
    const i = _h(r);
    return Ur(i);
  }
  var n = r[0], a = {};
  return we(r, a), pn(a), a[n];
}
function ft(t) {
  var e = this;
  if (arguments.length === 2) {
    var r = arguments[1];
    typeof r == "string" ? r.charAt(0) === "+" ? ft[
      /** @type {string} */
      t
    ] = mi(arguments[1]) : ft[
      /** @type {string} */
      t
    ] = Br(arguments[1]) : r && typeof r == "object" && !("projName" in r) ? ft[
      /** @type {string} */
      t
    ] = Br(arguments[1]) : (ft[
      /** @type {string} */
      t
    ] = r, r || delete ft[
      /** @type {string} */
      t
    ]);
  } else if (arguments.length === 1) {
    if (Array.isArray(t))
      return t.map(function(n) {
        return Array.isArray(n) ? ft.apply(e, n) : ft(n);
      });
    if (typeof t == "string") {
      if (t in ft)
        return ft[t];
    } else "EPSG" in t ? ft["EPSG:" + t.EPSG] = t : "ESRI" in t ? ft["ESRI:" + t.ESRI] = t : "IAU2000" in t ? ft["IAU2000:" + t.IAU2000] = t : console.log(t);
    return;
  }
}
nh(ft);
function Sh(t) {
  return typeof t == "string";
}
function xh(t) {
  return t in ft;
}
function Gh(t) {
  return t.indexOf("+") !== 0 && t.indexOf("[") !== -1 || typeof t == "object" && !("srsCode" in t);
}
var $a = ["3857", "900913", "3785", "102113"];
function Ah(t) {
  if (t.title)
    return t.title.toLowerCase().indexOf("epsg:") === 0 && $a.indexOf(t.title.substr(5)) > -1;
  var e = Qt(t, "authority");
  if (e) {
    var r = Qt(e, "epsg");
    return r && $a.indexOf(r) > -1;
  }
}
function Ch(t) {
  var e = Qt(t, "extension");
  if (e)
    return Qt(e, "proj4");
}
function Th(t) {
  return t[0] === "+";
}
function Ih(t) {
  let e;
  if (Sh(t))
    if (xh(t))
      e = ft[t];
    else if (Gh(t)) {
      e = Br(t);
      var r = Ch(e);
      r && (e = mi(r));
    } else Th(t) && (e = mi(t));
  else "projName" in t ? e = t : e = Br(t);
  return e && Ah(e) ? ft["EPSG:3857"] : e;
}
function za(t, e) {
  t = t || {};
  var r, n;
  if (!e)
    return t;
  for (n in e)
    r = e[n], r !== void 0 && (t[n] = r);
  return t;
}
function Bt(t, e, r) {
  var n = t * e;
  return r / Math.sqrt(1 - n * n);
}
function cr(t) {
  return t < 0 ? -1 : 1;
}
function F(t, e) {
  return e || Math.abs(t) <= nt ? t : t - cr(t) * or;
}
function Lt(t, e, r) {
  var n = t * r, a = 0.5 * t;
  return n = Math.pow((1 - n) / (1 + n), a), Math.tan(0.5 * (A - e)) / n;
}
function lr(t, e) {
  for (var r = 0.5 * t, n, a, i = A - 2 * Math.atan(e), o = 0; o <= 15; o++)
    if (n = t * Math.sin(i), a = A - 2 * Math.atan(e * Math.pow((1 - n) / (1 + n), r)) - i, i += a, Math.abs(a) <= 1e-10)
      return i;
  return -9999;
}
function Oh() {
  var t = this.b / this.a;
  this.es = 1 - t * t, "x0" in this || (this.x0 = 0), "y0" in this || (this.y0 = 0), this.e = Math.sqrt(this.es), this.lat_ts ? this.sphere ? this.k0 = Math.cos(this.lat_ts) : this.k0 = Bt(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)) : this.k0 || (this.k ? this.k0 = this.k : this.k0 = 1);
}
function Rh(t) {
  var e = t.x, r = t.y;
  if (r * wt > 90 && r * wt < -90 && e * wt > 180 && e * wt < -180)
    return null;
  var n, a;
  if (Math.abs(Math.abs(r) - A) <= N)
    return null;
  if (this.sphere)
    n = this.x0 + this.a * this.k0 * F(e - this.long0, this.over), a = this.y0 + this.a * this.k0 * Math.log(Math.tan(X + 0.5 * r));
  else {
    var i = Math.sin(r), o = Lt(this.e, r, i);
    n = this.x0 + this.a * this.k0 * F(e - this.long0, this.over), a = this.y0 - this.a * this.k0 * Math.log(o);
  }
  return t.x = n, t.y = a, t;
}
function Nh(t) {
  var e = t.x - this.x0, r = t.y - this.y0, n, a;
  if (this.sphere)
    a = A - 2 * Math.atan(Math.exp(-r / (this.a * this.k0)));
  else {
    var i = Math.exp(-r / (this.a * this.k0));
    if (a = lr(this.e, i), a === -9999)
      return null;
  }
  return n = F(this.long0 + e / (this.a * this.k0), this.over), t.x = n, t.y = a, t;
}
var Lh = ["Mercator", "Popular Visualisation Pseudo Mercator", "Mercator_1SP", "Mercator_Auxiliary_Sphere", "Mercator_Variant_A", "merc"], Fh = {
  init: Oh,
  forward: Rh,
  inverse: Nh,
  names: Lh
};
function Dh() {
}
function Ha(t) {
  return t;
}
var wn = ["longlat", "identity"], Uh = {
  init: Dh,
  forward: Ha,
  inverse: Ha,
  names: wn
}, Bh = [Fh, Uh], ce = {}, be = [];
function bn(t, e) {
  var r = be.length;
  return t.names ? (be[r] = t, t.names.forEach(function(n) {
    ce[n.toLowerCase()] = r;
  }), this) : (console.log(e), !0);
}
function En(t) {
  return t.replace(/[-\\(\\)\\s]+/g, " ").trim().replace(/ /g, "_");
}
function jh(t) {
  if (!t)
    return !1;
  var e = t.toLowerCase();
  if (typeof ce[e] < "u" && be[ce[e]] || (e = En(e), e in ce && be[ce[e]]))
    return be[ce[e]];
}
function kh() {
  Bh.forEach(bn);
}
var qh = {
  start: kh,
  add: bn,
  get: jh
}, Pn = {
  MERIT: {
    a: 6378137,
    rf: 298.257,
    ellipseName: "MERIT 1983"
  },
  SGS85: {
    a: 6378136,
    rf: 298.257,
    ellipseName: "Soviet Geodetic System 85"
  },
  GRS80: {
    a: 6378137,
    rf: 298.257222101,
    ellipseName: "GRS 1980(IUGG, 1980)"
  },
  IAU76: {
    a: 6378140,
    rf: 298.257,
    ellipseName: "IAU 1976"
  },
  airy: {
    a: 6377563396e-3,
    b: 635625691e-2,
    ellipseName: "Airy 1830"
  },
  APL4: {
    a: 6378137,
    rf: 298.25,
    ellipseName: "Appl. Physics. 1965"
  },
  NWL9D: {
    a: 6378145,
    rf: 298.25,
    ellipseName: "Naval Weapons Lab., 1965"
  },
  mod_airy: {
    a: 6377340189e-3,
    b: 6356034446e-3,
    ellipseName: "Modified Airy"
  },
  andrae: {
    a: 637710443e-2,
    rf: 300,
    ellipseName: "Andrae 1876 (Den., Iclnd.)"
  },
  aust_SA: {
    a: 6378160,
    rf: 298.25,
    ellipseName: "Australian Natl & S. Amer. 1969"
  },
  GRS67: {
    a: 6378160,
    rf: 298.247167427,
    ellipseName: "GRS 67(IUGG 1967)"
  },
  bessel: {
    a: 6377397155e-3,
    rf: 299.1528128,
    ellipseName: "Bessel 1841"
  },
  bess_nam: {
    a: 6377483865e-3,
    rf: 299.1528128,
    ellipseName: "Bessel 1841 (Namibia)"
  },
  clrk66: {
    a: 63782064e-1,
    b: 63565838e-1,
    ellipseName: "Clarke 1866"
  },
  clrk80: {
    a: 6378249145e-3,
    rf: 293.4663,
    ellipseName: "Clarke 1880 mod."
  },
  clrk80ign: {
    a: 63782492e-1,
    b: 6356515,
    rf: 293.4660213,
    ellipseName: "Clarke 1880 (IGN)"
  },
  clrk58: {
    a: 6378293645208759e-9,
    rf: 294.2606763692654,
    ellipseName: "Clarke 1858"
  },
  CPM: {
    a: 63757387e-1,
    rf: 334.29,
    ellipseName: "Comm. des Poids et Mesures 1799"
  },
  delmbr: {
    a: 6376428,
    rf: 311.5,
    ellipseName: "Delambre 1810 (Belgium)"
  },
  engelis: {
    a: 637813605e-2,
    rf: 298.2566,
    ellipseName: "Engelis 1985"
  },
  evrst30: {
    a: 6377276345e-3,
    rf: 300.8017,
    ellipseName: "Everest 1830"
  },
  evrst48: {
    a: 6377304063e-3,
    rf: 300.8017,
    ellipseName: "Everest 1948"
  },
  evrst56: {
    a: 6377301243e-3,
    rf: 300.8017,
    ellipseName: "Everest 1956"
  },
  evrst69: {
    a: 6377295664e-3,
    rf: 300.8017,
    ellipseName: "Everest 1969"
  },
  evrstSS: {
    a: 6377298556e-3,
    rf: 300.8017,
    ellipseName: "Everest (Sabah & Sarawak)"
  },
  fschr60: {
    a: 6378166,
    rf: 298.3,
    ellipseName: "Fischer (Mercury Datum) 1960"
  },
  fschr60m: {
    a: 6378155,
    rf: 298.3,
    ellipseName: "Fischer 1960"
  },
  fschr68: {
    a: 6378150,
    rf: 298.3,
    ellipseName: "Fischer 1968"
  },
  helmert: {
    a: 6378200,
    rf: 298.3,
    ellipseName: "Helmert 1906"
  },
  hough: {
    a: 6378270,
    rf: 297,
    ellipseName: "Hough"
  },
  intl: {
    a: 6378388,
    rf: 297,
    ellipseName: "International 1909 (Hayford)"
  },
  kaula: {
    a: 6378163,
    rf: 298.24,
    ellipseName: "Kaula 1961"
  },
  lerch: {
    a: 6378139,
    rf: 298.257,
    ellipseName: "Lerch 1979"
  },
  mprts: {
    a: 6397300,
    rf: 191,
    ellipseName: "Maupertius 1738"
  },
  new_intl: {
    a: 63781575e-1,
    b: 63567722e-1,
    ellipseName: "New International 1967"
  },
  plessis: {
    a: 6376523,
    rf: 6355863,
    ellipseName: "Plessis 1817 (France)"
  },
  krass: {
    a: 6378245,
    rf: 298.3,
    ellipseName: "Krassovsky, 1942"
  },
  SEasia: {
    a: 6378155,
    b: 63567733205e-4,
    ellipseName: "Southeast Asia"
  },
  walbeck: {
    a: 6376896,
    b: 63558348467e-4,
    ellipseName: "Walbeck"
  },
  WGS60: {
    a: 6378165,
    rf: 298.3,
    ellipseName: "WGS 60"
  },
  WGS66: {
    a: 6378145,
    rf: 298.25,
    ellipseName: "WGS 66"
  },
  WGS7: {
    a: 6378135,
    rf: 298.26,
    ellipseName: "WGS 72"
  },
  WGS84: {
    a: 6378137,
    rf: 298.257223563,
    ellipseName: "WGS 84"
  },
  sphere: {
    a: 6370997,
    b: 6370997,
    ellipseName: "Normal Sphere (r=6370997)"
  }
};
const $h = Pn.WGS84;
function zh(t, e, r, n) {
  var a = t * t, i = e * e, o = (a - i) / a, s = 0;
  n ? (t *= 1 - o * (hh + o * (lh + o * uh)), a = t * t, o = 0) : s = Math.sqrt(o);
  var h = (a - i) / i;
  return {
    es: o,
    e: s,
    ep2: h
  };
}
function Hh(t, e, r, n, a) {
  if (!t) {
    var i = Qt(Pn, n);
    i || (i = $h), t = i.a, e = i.b, r = i.rf;
  }
  return r && !e && (e = (1 - 1 / r) * t), (r === 0 || Math.abs(t - e) < N) && (a = !0, e = t), {
    a: t,
    b: e,
    rf: r,
    sphere: a
  };
}
var Tr = {
  wgs84: {
    towgs84: "0,0,0",
    ellipse: "WGS84",
    datumName: "WGS84"
  },
  ch1903: {
    towgs84: "674.374,15.056,405.346",
    ellipse: "bessel",
    datumName: "swiss"
  },
  ggrs87: {
    towgs84: "-199.87,74.79,246.62",
    ellipse: "GRS80",
    datumName: "Greek_Geodetic_Reference_System_1987"
  },
  nad83: {
    towgs84: "0,0,0",
    ellipse: "GRS80",
    datumName: "North_American_Datum_1983"
  },
  nad27: {
    nadgrids: "@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat",
    ellipse: "clrk66",
    datumName: "North_American_Datum_1927"
  },
  potsdam: {
    towgs84: "598.1,73.7,418.2,0.202,0.045,-2.455,6.7",
    ellipse: "bessel",
    datumName: "Potsdam Rauenberg 1950 DHDN"
  },
  carthage: {
    towgs84: "-263.0,6.0,431.0",
    ellipse: "clark80",
    datumName: "Carthage 1934 Tunisia"
  },
  hermannskogel: {
    towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
    ellipse: "bessel",
    datumName: "Hermannskogel"
  },
  mgi: {
    towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
    ellipse: "bessel",
    datumName: "Militar-Geographische Institut"
  },
  osni52: {
    towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
    ellipse: "airy",
    datumName: "Irish National"
  },
  ire65: {
    towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
    ellipse: "mod_airy",
    datumName: "Ireland 1965"
  },
  rassadiran: {
    towgs84: "-133.63,-157.5,-158.62",
    ellipse: "intl",
    datumName: "Rassadiran"
  },
  nzgd49: {
    towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
    ellipse: "intl",
    datumName: "New Zealand Geodetic Datum 1949"
  },
  osgb36: {
    towgs84: "446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894",
    ellipse: "airy",
    datumName: "Ordnance Survey of Great Britain 1936"
  },
  s_jtsk: {
    towgs84: "589,76,480",
    ellipse: "bessel",
    datumName: "S-JTSK (Ferro)"
  },
  beduaram: {
    towgs84: "-106,-87,188",
    ellipse: "clrk80",
    datumName: "Beduaram"
  },
  gunung_segara: {
    towgs84: "-403,684,41",
    ellipse: "bessel",
    datumName: "Gunung Segara Jakarta"
  },
  rnb72: {
    towgs84: "106.869,-52.2978,103.724,-0.33657,0.456955,-1.84218,1",
    ellipse: "intl",
    datumName: "Reseau National Belge 1972"
  },
  EPSG_5451: {
    towgs84: "6.41,-49.05,-11.28,1.5657,0.5242,6.9718,-5.7649"
  },
  IGNF_LURESG: {
    towgs84: "-192.986,13.673,-39.309,-0.4099,-2.9332,2.6881,0.43"
  },
  EPSG_4614: {
    towgs84: "-119.4248,-303.65872,-11.00061,1.164298,0.174458,1.096259,3.657065"
  },
  EPSG_4615: {
    towgs84: "-494.088,-312.129,279.877,-1.423,-1.013,1.59,-0.748"
  },
  ESRI_37241: {
    towgs84: "-76.822,257.457,-12.817,2.136,-0.033,-2.392,-0.031"
  },
  ESRI_37249: {
    towgs84: "-440.296,58.548,296.265,1.128,10.202,4.559,-0.438"
  },
  ESRI_37245: {
    towgs84: "-511.151,-181.269,139.609,1.05,2.703,1.798,3.071"
  },
  EPSG_4178: {
    towgs84: "24.9,-126.4,-93.2,-0.063,-0.247,-0.041,1.01"
  },
  EPSG_4622: {
    towgs84: "-472.29,-5.63,-304.12,0.4362,-0.8374,0.2563,1.8984"
  },
  EPSG_4625: {
    towgs84: "126.93,547.94,130.41,-2.7867,5.1612,-0.8584,13.8227"
  },
  EPSG_5252: {
    towgs84: "0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439"
  },
  EPSG_4314: {
    towgs84: "597.1,71.4,412.1,0.894,0.068,-1.563,7.58"
  },
  EPSG_4282: {
    towgs84: "-178.3,-316.7,-131.5,5.278,6.077,10.979,19.166"
  },
  EPSG_4231: {
    towgs84: "-83.11,-97.38,-117.22,0.005693,-0.044698,0.044285,0.1218"
  },
  EPSG_4274: {
    towgs84: "-230.994,102.591,25.199,0.633,-0.239,0.9,1.95"
  },
  EPSG_4134: {
    towgs84: "-180.624,-225.516,173.919,-0.81,-1.898,8.336,16.71006"
  },
  EPSG_4254: {
    towgs84: "18.38,192.45,96.82,0.056,-0.142,-0.2,-0.0013"
  },
  EPSG_4159: {
    towgs84: "-194.513,-63.978,-25.759,-3.4027,3.756,-3.352,-0.9175"
  },
  EPSG_4687: {
    towgs84: "0.072,-0.507,-0.245,0.0183,-0.0003,0.007,-0.0093"
  },
  EPSG_4227: {
    towgs84: "-83.58,-397.54,458.78,-17.595,-2.847,4.256,3.225"
  },
  EPSG_4746: {
    towgs84: "599.4,72.4,419.2,-0.062,-0.022,-2.723,6.46"
  },
  EPSG_4745: {
    towgs84: "612.4,77,440.2,-0.054,0.057,-2.797,2.55"
  },
  EPSG_6311: {
    towgs84: "8.846,-4.394,-1.122,-0.00237,-0.146528,0.130428,0.783926"
  },
  EPSG_4289: {
    towgs84: "565.7381,50.4018,465.2904,-0.395026,0.330772,-1.876073,4.07244"
  },
  EPSG_4230: {
    towgs84: "-68.863,-134.888,-111.49,-0.53,-0.14,0.57,-3.4"
  },
  EPSG_4154: {
    towgs84: "-123.02,-158.95,-168.47"
  },
  EPSG_4156: {
    towgs84: "570.8,85.7,462.8,4.998,1.587,5.261,3.56"
  },
  EPSG_4299: {
    towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15"
  },
  EPSG_4179: {
    towgs84: "33.4,-146.6,-76.3,-0.359,-0.053,0.844,-0.84"
  },
  EPSG_4313: {
    towgs84: "-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747"
  },
  EPSG_4194: {
    towgs84: "163.511,127.533,-159.789"
  },
  EPSG_4195: {
    towgs84: "105,326,-102.5"
  },
  EPSG_4196: {
    towgs84: "-45,417,-3.5"
  },
  EPSG_4611: {
    towgs84: "-162.619,-276.959,-161.764,0.067753,-2.243648,-1.158828,-1.094246"
  },
  EPSG_4633: {
    towgs84: "137.092,131.66,91.475,-1.9436,-11.5993,-4.3321,-7.4824"
  },
  EPSG_4641: {
    towgs84: "-408.809,366.856,-412.987,1.8842,-0.5308,2.1655,-121.0993"
  },
  EPSG_4643: {
    towgs84: "-480.26,-438.32,-643.429,16.3119,20.1721,-4.0349,-111.7002"
  },
  EPSG_4300: {
    towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15"
  },
  EPSG_4188: {
    towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15"
  },
  EPSG_4660: {
    towgs84: "982.6087,552.753,-540.873,6.681627,-31.611492,-19.848161,16.805"
  },
  EPSG_4662: {
    towgs84: "97.295,-263.247,310.882,-1.5999,0.8386,3.1409,13.3259"
  },
  EPSG_3906: {
    towgs84: "577.88891,165.22205,391.18289,4.9145,-0.94729,-13.05098,7.78664"
  },
  EPSG_4307: {
    towgs84: "-209.3622,-87.8162,404.6198,0.0046,3.4784,0.5805,-1.4547"
  },
  EPSG_6892: {
    towgs84: "-76.269,-16.683,68.562,-6.275,10.536,-4.286,-13.686"
  },
  EPSG_4690: {
    towgs84: "221.597,152.441,176.523,2.403,1.3893,0.884,11.4648"
  },
  EPSG_4691: {
    towgs84: "218.769,150.75,176.75,3.5231,2.0037,1.288,10.9817"
  },
  EPSG_4629: {
    towgs84: "72.51,345.411,79.241,-1.5862,-0.8826,-0.5495,1.3653"
  },
  EPSG_4630: {
    towgs84: "165.804,216.213,180.26,-0.6251,-0.4515,-0.0721,7.4111"
  },
  EPSG_4692: {
    towgs84: "217.109,86.452,23.711,0.0183,-0.0003,0.007,-0.0093"
  },
  EPSG_9333: {
    towgs84: "0,0,0,-0.008393,0.000749,-0.010276,0"
  },
  EPSG_9059: {
    towgs84: "0,0,0"
  },
  EPSG_4312: {
    towgs84: "601.705,84.263,485.227,4.7354,1.3145,5.393,-2.3887"
  },
  EPSG_4123: {
    towgs84: "-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496"
  },
  EPSG_4309: {
    towgs84: "-124.45,183.74,44.64,-0.4384,0.5446,-0.9706,-2.1365"
  },
  ESRI_104106: {
    towgs84: "-283.088,-70.693,117.445,-1.157,0.059,-0.652,-4.058"
  },
  EPSG_4281: {
    towgs84: "-219.247,-73.802,269.529"
  },
  EPSG_4322: {
    towgs84: "0,0,4.5"
  },
  EPSG_4324: {
    towgs84: "0,0,1.9"
  },
  EPSG_4284: {
    towgs84: "43.822,-108.842,-119.585,1.455,-0.761,0.737,0.549"
  },
  EPSG_4277: {
    towgs84: "446.448,-125.157,542.06,0.15,0.247,0.842,-20.489"
  },
  EPSG_4207: {
    towgs84: "-282.1,-72.2,120,-1.529,0.145,-0.89,-4.46"
  },
  EPSG_4688: {
    towgs84: "347.175,1077.618,2623.677,33.9058,-70.6776,9.4013,186.0647"
  },
  EPSG_4689: {
    towgs84: "410.793,54.542,80.501,-2.5596,-2.3517,-0.6594,17.3218"
  },
  EPSG_4720: {
    towgs84: "0,0,4.5"
  },
  EPSG_4273: {
    towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21"
  },
  EPSG_4240: {
    towgs84: "204.64,834.74,293.8"
  },
  EPSG_4817: {
    towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21"
  },
  ESRI_104131: {
    towgs84: "426.62,142.62,460.09,4.98,4.49,-12.42,-17.1"
  },
  EPSG_4265: {
    towgs84: "-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68"
  },
  EPSG_4263: {
    towgs84: "-111.92,-87.85,114.5,1.875,0.202,0.219,0.032"
  },
  EPSG_4298: {
    towgs84: "-689.5937,623.84046,-65.93566,-0.02331,1.17094,-0.80054,5.88536"
  },
  EPSG_4270: {
    towgs84: "-253.4392,-148.452,386.5267,0.15605,0.43,-0.1013,-0.0424"
  },
  EPSG_4229: {
    towgs84: "-121.8,98.1,-10.7"
  },
  EPSG_4220: {
    towgs84: "-55.5,-348,-229.2"
  },
  EPSG_4214: {
    towgs84: "12.646,-155.176,-80.863"
  },
  EPSG_4232: {
    towgs84: "-345,3,223"
  },
  EPSG_4238: {
    towgs84: "-1.977,-13.06,-9.993,0.364,0.254,0.689,-1.037"
  },
  EPSG_4168: {
    towgs84: "-170,33,326"
  },
  EPSG_4131: {
    towgs84: "199,931,318.9"
  },
  EPSG_4152: {
    towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0"
  },
  EPSG_5228: {
    towgs84: "572.213,85.334,461.94,4.9732,1.529,5.2484,3.5378"
  },
  EPSG_8351: {
    towgs84: "485.021,169.465,483.839,7.786342,4.397554,4.102655,0"
  },
  EPSG_4683: {
    towgs84: "-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06"
  },
  EPSG_4133: {
    towgs84: "0,0,0"
  },
  EPSG_7373: {
    towgs84: "0.819,-0.5762,-1.6446,-0.00378,-0.03317,0.00318,0.0693"
  },
  EPSG_9075: {
    towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0"
  },
  EPSG_9072: {
    towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0"
  },
  EPSG_9294: {
    towgs84: "1.16835,-1.42001,-2.24431,-0.00822,-0.05508,0.01818,0.23388"
  },
  EPSG_4212: {
    towgs84: "-267.434,173.496,181.814,-13.4704,8.7154,7.3926,14.7492"
  },
  EPSG_4191: {
    towgs84: "-44.183,-0.58,-38.489,2.3867,2.7072,-3.5196,-8.2703"
  },
  EPSG_4237: {
    towgs84: "52.684,-71.194,-13.975,-0.312,-0.1063,-0.3729,1.0191"
  },
  EPSG_4740: {
    towgs84: "-1.08,-0.27,-0.9"
  },
  EPSG_4124: {
    towgs84: "419.3836,99.3335,591.3451,0.850389,1.817277,-7.862238,-0.99496"
  },
  EPSG_5681: {
    towgs84: "584.9636,107.7175,413.8067,1.1155,0.2824,-3.1384,7.9922"
  },
  EPSG_4141: {
    towgs84: "23.772,17.49,17.859,-0.3132,-1.85274,1.67299,-5.4262"
  },
  EPSG_4204: {
    towgs84: "-85.645,-273.077,-79.708,2.289,-1.421,2.532,3.194"
  },
  EPSG_4319: {
    towgs84: "226.702,-193.337,-35.371,-2.229,-4.391,9.238,0.9798"
  },
  EPSG_4200: {
    towgs84: "24.82,-131.21,-82.66"
  },
  EPSG_4130: {
    towgs84: "0,0,0"
  },
  EPSG_4127: {
    towgs84: "-82.875,-57.097,-156.768,-2.158,1.524,-0.982,-0.359"
  },
  EPSG_4149: {
    towgs84: "674.374,15.056,405.346"
  },
  EPSG_4617: {
    towgs84: "-0.991,1.9072,0.5129,0.02579,0.00965,0.01166,0"
  },
  EPSG_4663: {
    towgs84: "-210.502,-66.902,-48.476,2.094,-15.067,-5.817,0.485"
  },
  EPSG_4664: {
    towgs84: "-211.939,137.626,58.3,-0.089,0.251,0.079,0.384"
  },
  EPSG_4665: {
    towgs84: "-105.854,165.589,-38.312,-0.003,-0.026,0.024,-0.048"
  },
  EPSG_4666: {
    towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43"
  },
  EPSG_4756: {
    towgs84: "-192.873,-39.382,-111.202,-0.00205,-0.0005,0.00335,0.0188"
  },
  EPSG_4723: {
    towgs84: "-179.483,-69.379,-27.584,-7.862,8.163,6.042,-13.925"
  },
  EPSG_4726: {
    towgs84: "8.853,-52.644,180.304,-0.393,-2.323,2.96,-24.081"
  },
  EPSG_4267: {
    towgs84: "-8.0,160.0,176.0"
  },
  EPSG_5365: {
    towgs84: "-0.16959,0.35312,0.51846,0.03385,-0.16325,0.03446,0.03693"
  },
  EPSG_4218: {
    towgs84: "304.5,306.5,-318.1"
  },
  EPSG_4242: {
    towgs84: "-33.722,153.789,94.959,-8.581,-4.478,4.54,8.95"
  },
  EPSG_4216: {
    towgs84: "-292.295,248.758,429.447,4.9971,2.99,6.6906,1.0289"
  },
  ESRI_104105: {
    towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43"
  },
  ESRI_104129: {
    towgs84: "0,0,0"
  },
  EPSG_4673: {
    towgs84: "174.05,-25.49,112.57"
  },
  EPSG_4202: {
    towgs84: "-124,-60,154"
  },
  EPSG_4203: {
    towgs84: "-117.763,-51.51,139.061,0.292,0.443,0.277,-0.191"
  },
  EPSG_3819: {
    towgs84: "595.48,121.69,515.35,4.115,-2.9383,0.853,-3.408"
  },
  EPSG_8694: {
    towgs84: "-93.799,-132.737,-219.073,-1.844,0.648,-6.37,-0.169"
  },
  EPSG_4145: {
    towgs84: "275.57,676.78,229.6"
  },
  EPSG_4283: {
    towgs84: "0.06155,-0.01087,-0.04019,0.039492,0.032722,0.032898,-0.009994"
  },
  EPSG_4317: {
    towgs84: "2.3287,-147.0425,-92.0802,-0.309248,0.324822,0.497299,5.689063"
  },
  EPSG_4272: {
    towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993"
  },
  EPSG_4248: {
    towgs84: "-307.7,265.3,-363.5"
  },
  EPSG_5561: {
    towgs84: "24,-121,-76"
  },
  EPSG_5233: {
    towgs84: "-0.293,766.95,87.713,0.195704,1.695068,3.473016,-0.039338"
  },
  ESRI_104130: {
    towgs84: "-86,-98,-119"
  },
  ESRI_104102: {
    towgs84: "682,-203,480"
  },
  ESRI_37207: {
    towgs84: "7,-10,-26"
  },
  EPSG_4675: {
    towgs84: "59.935,118.4,-10.871"
  },
  ESRI_104109: {
    towgs84: "-89.121,-348.182,260.871"
  },
  ESRI_104112: {
    towgs84: "-185.583,-230.096,281.361"
  },
  ESRI_104113: {
    towgs84: "25.1,-275.6,222.6"
  },
  IGNF_WGS72G: {
    towgs84: "0,12,6"
  },
  IGNF_NTFG: {
    towgs84: "-168,-60,320"
  },
  IGNF_EFATE57G: {
    towgs84: "-127,-769,472"
  },
  IGNF_PGP50G: {
    towgs84: "324.8,153.6,172.1"
  },
  IGNF_REUN47G: {
    towgs84: "94,-948,-1262"
  },
  IGNF_CSG67G: {
    towgs84: "-186,230,110"
  },
  IGNF_GUAD48G: {
    towgs84: "-467,-16,-300"
  },
  IGNF_TAHI51G: {
    towgs84: "162,117,154"
  },
  IGNF_TAHAAG: {
    towgs84: "65,342,77"
  },
  IGNF_NUKU72G: {
    towgs84: "84,274,65"
  },
  IGNF_PETRELS72G: {
    towgs84: "365,194,166"
  },
  IGNF_WALL78G: {
    towgs84: "253,-133,-127"
  },
  IGNF_MAYO50G: {
    towgs84: "-382,-59,-262"
  },
  IGNF_TANNAG: {
    towgs84: "-139,-967,436"
  },
  IGNF_IGN72G: {
    towgs84: "-13,-348,292"
  },
  IGNF_ATIGG: {
    towgs84: "1118,23,66"
  },
  IGNF_FANGA84G: {
    towgs84: "150.57,158.33,118.32"
  },
  IGNF_RUSAT84G: {
    towgs84: "202.13,174.6,-15.74"
  },
  IGNF_KAUE70G: {
    towgs84: "126.74,300.1,-75.49"
  },
  IGNF_MOP90G: {
    towgs84: "-10.8,-1.8,12.77"
  },
  IGNF_MHPF67G: {
    towgs84: "338.08,212.58,-296.17"
  },
  IGNF_TAHI79G: {
    towgs84: "160.61,116.05,153.69"
  },
  IGNF_ANAA92G: {
    towgs84: "1.5,3.84,4.81"
  },
  IGNF_MARQUI72G: {
    towgs84: "330.91,-13.92,58.56"
  },
  IGNF_APAT86G: {
    towgs84: "143.6,197.82,74.05"
  },
  IGNF_TUBU69G: {
    towgs84: "237.17,171.61,-77.84"
  },
  IGNF_STPM50G: {
    towgs84: "11.363,424.148,373.13"
  },
  EPSG_4150: {
    towgs84: "674.374,15.056,405.346"
  },
  EPSG_4754: {
    towgs84: "-208.4058,-109.8777,-2.5764"
  },
  ESRI_104101: {
    towgs84: "372.87,149.23,585.29"
  },
  EPSG_4693: {
    towgs84: "0,-0.15,0.68"
  },
  EPSG_6207: {
    towgs84: "293.17,726.18,245.36"
  },
  EPSG_4153: {
    towgs84: "-133.63,-157.5,-158.62"
  },
  EPSG_4132: {
    towgs84: "-241.54,-163.64,396.06"
  },
  EPSG_4221: {
    towgs84: "-154.5,150.7,100.4"
  },
  EPSG_4266: {
    towgs84: "-80.7,-132.5,41.1"
  },
  EPSG_4193: {
    towgs84: "-70.9,-151.8,-41.4"
  },
  EPSG_5340: {
    towgs84: "-0.41,0.46,-0.35"
  },
  EPSG_4246: {
    towgs84: "-294.7,-200.1,525.5"
  },
  EPSG_4318: {
    towgs84: "-3.2,-5.7,2.8"
  },
  EPSG_4121: {
    towgs84: "-199.87,74.79,246.62"
  },
  EPSG_4223: {
    towgs84: "-260.1,5.5,432.2"
  },
  EPSG_4158: {
    towgs84: "-0.465,372.095,171.736"
  },
  EPSG_4285: {
    towgs84: "-128.16,-282.42,21.93"
  },
  EPSG_4613: {
    towgs84: "-404.78,685.68,45.47"
  },
  EPSG_4607: {
    towgs84: "195.671,332.517,274.607"
  },
  EPSG_4475: {
    towgs84: "-381.788,-57.501,-256.673"
  },
  EPSG_4208: {
    towgs84: "-157.84,308.54,-146.6"
  },
  EPSG_4743: {
    towgs84: "70.995,-335.916,262.898"
  },
  EPSG_4710: {
    towgs84: "-323.65,551.39,-491.22"
  },
  EPSG_7881: {
    towgs84: "-0.077,0.079,0.086"
  },
  EPSG_4682: {
    towgs84: "283.729,735.942,261.143"
  },
  EPSG_4739: {
    towgs84: "-156,-271,-189"
  },
  EPSG_4679: {
    towgs84: "-80.01,253.26,291.19"
  },
  EPSG_4750: {
    towgs84: "-56.263,16.136,-22.856"
  },
  EPSG_4644: {
    towgs84: "-10.18,-350.43,291.37"
  },
  EPSG_4695: {
    towgs84: "-103.746,-9.614,-255.95"
  },
  EPSG_4292: {
    towgs84: "-355,21,72"
  },
  EPSG_4302: {
    towgs84: "-61.702,284.488,472.052"
  },
  EPSG_4143: {
    towgs84: "-124.76,53,466.79"
  },
  EPSG_4606: {
    towgs84: "-153,153,307"
  },
  EPSG_4699: {
    towgs84: "-770.1,158.4,-498.2"
  },
  EPSG_4247: {
    towgs84: "-273.5,110.6,-357.9"
  },
  EPSG_4160: {
    towgs84: "8.88,184.86,106.69"
  },
  EPSG_4161: {
    towgs84: "-233.43,6.65,173.64"
  },
  EPSG_9251: {
    towgs84: "-9.5,122.9,138.2"
  },
  EPSG_9253: {
    towgs84: "-78.1,101.6,133.3"
  },
  EPSG_4297: {
    towgs84: "-198.383,-240.517,-107.909"
  },
  EPSG_4269: {
    towgs84: "0,0,0"
  },
  EPSG_4301: {
    towgs84: "-147,506,687"
  },
  EPSG_4618: {
    towgs84: "-59,-11,-52"
  },
  EPSG_4612: {
    towgs84: "0,0,0"
  },
  EPSG_4678: {
    towgs84: "44.585,-131.212,-39.544"
  },
  EPSG_4250: {
    towgs84: "-130,29,364"
  },
  EPSG_4144: {
    towgs84: "214,804,268"
  },
  EPSG_4147: {
    towgs84: "-17.51,-108.32,-62.39"
  },
  EPSG_4259: {
    towgs84: "-254.1,-5.36,-100.29"
  },
  EPSG_4164: {
    towgs84: "-76,-138,67"
  },
  EPSG_4211: {
    towgs84: "-378.873,676.002,-46.255"
  },
  EPSG_4182: {
    towgs84: "-422.651,-172.995,84.02"
  },
  EPSG_4224: {
    towgs84: "-143.87,243.37,-33.52"
  },
  EPSG_4225: {
    towgs84: "-205.57,168.77,-4.12"
  },
  EPSG_5527: {
    towgs84: "-67.35,3.88,-38.22"
  },
  EPSG_4752: {
    towgs84: "98,390,-22"
  },
  EPSG_4310: {
    towgs84: "-30,190,89"
  },
  EPSG_9248: {
    towgs84: "-192.26,65.72,132.08"
  },
  EPSG_4680: {
    towgs84: "124.5,-63.5,-281"
  },
  EPSG_4701: {
    towgs84: "-79.9,-158,-168.9"
  },
  EPSG_4706: {
    towgs84: "-146.21,112.63,4.05"
  },
  EPSG_4805: {
    towgs84: "682,-203,480"
  },
  EPSG_4201: {
    towgs84: "-165,-11,206"
  },
  EPSG_4210: {
    towgs84: "-157,-2,-299"
  },
  EPSG_4183: {
    towgs84: "-104,167,-38"
  },
  EPSG_4139: {
    towgs84: "11,72,-101"
  },
  EPSG_4668: {
    towgs84: "-86,-98,-119"
  },
  EPSG_4717: {
    towgs84: "-2,151,181"
  },
  EPSG_4732: {
    towgs84: "102,52,-38"
  },
  EPSG_4280: {
    towgs84: "-377,681,-50"
  },
  EPSG_4209: {
    towgs84: "-138,-105,-289"
  },
  EPSG_4261: {
    towgs84: "31,146,47"
  },
  EPSG_4658: {
    towgs84: "-73,46,-86"
  },
  EPSG_4721: {
    towgs84: "265.025,384.929,-194.046"
  },
  EPSG_4222: {
    towgs84: "-136,-108,-292"
  },
  EPSG_4601: {
    towgs84: "-255,-15,71"
  },
  EPSG_4602: {
    towgs84: "725,685,536"
  },
  EPSG_4603: {
    towgs84: "72,213.7,93"
  },
  EPSG_4605: {
    towgs84: "9,183,236"
  },
  EPSG_4621: {
    towgs84: "137,248,-430"
  },
  EPSG_4657: {
    towgs84: "-28,199,5"
  },
  EPSG_4316: {
    towgs84: "103.25,-100.4,-307.19"
  },
  EPSG_4642: {
    towgs84: "-13,-348,292"
  },
  EPSG_4698: {
    towgs84: "145,-187,103"
  },
  EPSG_4192: {
    towgs84: "-206.1,-174.7,-87.7"
  },
  EPSG_4311: {
    towgs84: "-265,120,-358"
  },
  EPSG_4135: {
    towgs84: "58,-283,-182"
  },
  ESRI_104138: {
    towgs84: "198,-226,-347"
  },
  EPSG_4245: {
    towgs84: "-11,851,5"
  },
  EPSG_4142: {
    towgs84: "-125,53,467"
  },
  EPSG_4213: {
    towgs84: "-106,-87,188"
  },
  EPSG_4253: {
    towgs84: "-133,-77,-51"
  },
  EPSG_4129: {
    towgs84: "-132,-110,-335"
  },
  EPSG_4713: {
    towgs84: "-77,-128,142"
  },
  EPSG_4239: {
    towgs84: "217,823,299"
  },
  EPSG_4146: {
    towgs84: "295,736,257"
  },
  EPSG_4155: {
    towgs84: "-83,37,124"
  },
  EPSG_4165: {
    towgs84: "-173,253,27"
  },
  EPSG_4672: {
    towgs84: "175,-38,113"
  },
  EPSG_4236: {
    towgs84: "-637,-549,-203"
  },
  EPSG_4251: {
    towgs84: "-90,40,88"
  },
  EPSG_4271: {
    towgs84: "-2,374,172"
  },
  EPSG_4175: {
    towgs84: "-88,4,101"
  },
  EPSG_4716: {
    towgs84: "298,-304,-375"
  },
  EPSG_4315: {
    towgs84: "-23,259,-9"
  },
  EPSG_4744: {
    towgs84: "-242.2,-144.9,370.3"
  },
  EPSG_4244: {
    towgs84: "-97,787,86"
  },
  EPSG_4293: {
    towgs84: "616,97,-251"
  },
  EPSG_4714: {
    towgs84: "-127,-769,472"
  },
  EPSG_4736: {
    towgs84: "260,12,-147"
  },
  EPSG_6883: {
    towgs84: "-235,-110,393"
  },
  EPSG_6894: {
    towgs84: "-63,176,185"
  },
  EPSG_4205: {
    towgs84: "-43,-163,45"
  },
  EPSG_4256: {
    towgs84: "41,-220,-134"
  },
  EPSG_4262: {
    towgs84: "639,405,60"
  },
  EPSG_4604: {
    towgs84: "174,359,365"
  },
  EPSG_4169: {
    towgs84: "-115,118,426"
  },
  EPSG_4620: {
    towgs84: "-106,-129,165"
  },
  EPSG_4184: {
    towgs84: "-203,141,53"
  },
  EPSG_4616: {
    towgs84: "-289,-124,60"
  },
  EPSG_9403: {
    towgs84: "-307,-92,127"
  },
  EPSG_4684: {
    towgs84: "-133,-321,50"
  },
  EPSG_4708: {
    towgs84: "-491,-22,435"
  },
  EPSG_4707: {
    towgs84: "114,-116,-333"
  },
  EPSG_4709: {
    towgs84: "145,75,-272"
  },
  EPSG_4712: {
    towgs84: "-205,107,53"
  },
  EPSG_4711: {
    towgs84: "124,-234,-25"
  },
  EPSG_4718: {
    towgs84: "230,-199,-752"
  },
  EPSG_4719: {
    towgs84: "211,147,111"
  },
  EPSG_4724: {
    towgs84: "208,-435,-229"
  },
  EPSG_4725: {
    towgs84: "189,-79,-202"
  },
  EPSG_4735: {
    towgs84: "647,1777,-1124"
  },
  EPSG_4722: {
    towgs84: "-794,119,-298"
  },
  EPSG_4728: {
    towgs84: "-307,-92,127"
  },
  EPSG_4734: {
    towgs84: "-632,438,-609"
  },
  EPSG_4727: {
    towgs84: "912,-58,1227"
  },
  EPSG_4729: {
    towgs84: "185,165,42"
  },
  EPSG_4730: {
    towgs84: "170,42,84"
  },
  EPSG_4733: {
    towgs84: "276,-57,149"
  },
  ESRI_37218: {
    towgs84: "230,-199,-752"
  },
  ESRI_37240: {
    towgs84: "-7,215,225"
  },
  ESRI_37221: {
    towgs84: "252,-209,-751"
  },
  ESRI_4305: {
    towgs84: "-123,-206,219"
  },
  ESRI_104139: {
    towgs84: "-73,-247,227"
  },
  EPSG_4748: {
    towgs84: "51,391,-36"
  },
  EPSG_4219: {
    towgs84: "-384,664,-48"
  },
  EPSG_4255: {
    towgs84: "-333,-222,114"
  },
  EPSG_4257: {
    towgs84: "-587.8,519.75,145.76"
  },
  EPSG_4646: {
    towgs84: "-963,510,-359"
  },
  EPSG_6881: {
    towgs84: "-24,-203,268"
  },
  EPSG_6882: {
    towgs84: "-183,-15,273"
  },
  EPSG_4715: {
    towgs84: "-104,-129,239"
  },
  IGNF_RGF93GDD: {
    towgs84: "0,0,0"
  },
  IGNF_RGM04GDD: {
    towgs84: "0,0,0"
  },
  IGNF_RGSPM06GDD: {
    towgs84: "0,0,0"
  },
  IGNF_RGTAAF07GDD: {
    towgs84: "0,0,0"
  },
  IGNF_RGFG95GDD: {
    towgs84: "0,0,0"
  },
  IGNF_RGNCG: {
    towgs84: "0,0,0"
  },
  IGNF_RGPFGDD: {
    towgs84: "0,0,0"
  },
  IGNF_ETRS89G: {
    towgs84: "0,0,0"
  },
  IGNF_RGR92GDD: {
    towgs84: "0,0,0"
  },
  EPSG_4173: {
    towgs84: "0,0,0"
  },
  EPSG_4180: {
    towgs84: "0,0,0"
  },
  EPSG_4619: {
    towgs84: "0,0,0"
  },
  EPSG_4667: {
    towgs84: "0,0,0"
  },
  EPSG_4075: {
    towgs84: "0,0,0"
  },
  EPSG_6706: {
    towgs84: "0,0,0"
  },
  EPSG_7798: {
    towgs84: "0,0,0"
  },
  EPSG_4661: {
    towgs84: "0,0,0"
  },
  EPSG_4669: {
    towgs84: "0,0,0"
  },
  EPSG_8685: {
    towgs84: "0,0,0"
  },
  EPSG_4151: {
    towgs84: "0,0,0"
  },
  EPSG_9702: {
    towgs84: "0,0,0"
  },
  EPSG_4758: {
    towgs84: "0,0,0"
  },
  EPSG_4761: {
    towgs84: "0,0,0"
  },
  EPSG_4765: {
    towgs84: "0,0,0"
  },
  EPSG_8997: {
    towgs84: "0,0,0"
  },
  EPSG_4023: {
    towgs84: "0,0,0"
  },
  EPSG_4670: {
    towgs84: "0,0,0"
  },
  EPSG_4694: {
    towgs84: "0,0,0"
  },
  EPSG_4148: {
    towgs84: "0,0,0"
  },
  EPSG_4163: {
    towgs84: "0,0,0"
  },
  EPSG_4167: {
    towgs84: "0,0,0"
  },
  EPSG_4189: {
    towgs84: "0,0,0"
  },
  EPSG_4190: {
    towgs84: "0,0,0"
  },
  EPSG_4176: {
    towgs84: "0,0,0"
  },
  EPSG_4659: {
    towgs84: "0,0,0"
  },
  EPSG_3824: {
    towgs84: "0,0,0"
  },
  EPSG_3889: {
    towgs84: "0,0,0"
  },
  EPSG_4046: {
    towgs84: "0,0,0"
  },
  EPSG_4081: {
    towgs84: "0,0,0"
  },
  EPSG_4558: {
    towgs84: "0,0,0"
  },
  EPSG_4483: {
    towgs84: "0,0,0"
  },
  EPSG_5013: {
    towgs84: "0,0,0"
  },
  EPSG_5264: {
    towgs84: "0,0,0"
  },
  EPSG_5324: {
    towgs84: "0,0,0"
  },
  EPSG_5354: {
    towgs84: "0,0,0"
  },
  EPSG_5371: {
    towgs84: "0,0,0"
  },
  EPSG_5373: {
    towgs84: "0,0,0"
  },
  EPSG_5381: {
    towgs84: "0,0,0"
  },
  EPSG_5393: {
    towgs84: "0,0,0"
  },
  EPSG_5489: {
    towgs84: "0,0,0"
  },
  EPSG_5593: {
    towgs84: "0,0,0"
  },
  EPSG_6135: {
    towgs84: "0,0,0"
  },
  EPSG_6365: {
    towgs84: "0,0,0"
  },
  EPSG_5246: {
    towgs84: "0,0,0"
  },
  EPSG_7886: {
    towgs84: "0,0,0"
  },
  EPSG_8431: {
    towgs84: "0,0,0"
  },
  EPSG_8427: {
    towgs84: "0,0,0"
  },
  EPSG_8699: {
    towgs84: "0,0,0"
  },
  EPSG_8818: {
    towgs84: "0,0,0"
  },
  EPSG_4757: {
    towgs84: "0,0,0"
  },
  EPSG_9140: {
    towgs84: "0,0,0"
  },
  EPSG_8086: {
    towgs84: "0,0,0"
  },
  EPSG_4686: {
    towgs84: "0,0,0"
  },
  EPSG_4737: {
    towgs84: "0,0,0"
  },
  EPSG_4702: {
    towgs84: "0,0,0"
  },
  EPSG_4747: {
    towgs84: "0,0,0"
  },
  EPSG_4749: {
    towgs84: "0,0,0"
  },
  EPSG_4674: {
    towgs84: "0,0,0"
  },
  EPSG_4755: {
    towgs84: "0,0,0"
  },
  EPSG_4759: {
    towgs84: "0,0,0"
  },
  EPSG_4762: {
    towgs84: "0,0,0"
  },
  EPSG_4763: {
    towgs84: "0,0,0"
  },
  EPSG_4764: {
    towgs84: "0,0,0"
  },
  EPSG_4166: {
    towgs84: "0,0,0"
  },
  EPSG_4170: {
    towgs84: "0,0,0"
  },
  EPSG_5546: {
    towgs84: "0,0,0"
  },
  EPSG_7844: {
    towgs84: "0,0,0"
  },
  EPSG_4818: {
    towgs84: "589,76,480"
  },
  EPSG_10328: {
    towgs84: "0,0,0"
  },
  EPSG_9782: {
    towgs84: "0,0,0"
  },
  EPSG_9777: {
    towgs84: "0,0,0"
  },
  EPSG_10690: {
    towgs84: "0,0,0"
  },
  EPSG_10639: {
    towgs84: "0,0,0"
  },
  EPSG_10739: {
    towgs84: "0,0,0"
  },
  EPSG_7686: {
    towgs84: "0,0,0"
  },
  EPSG_8900: {
    towgs84: "0,0,0"
  },
  EPSG_5886: {
    towgs84: "0,0,0"
  },
  EPSG_7683: {
    towgs84: "0,0,0"
  },
  EPSG_6668: {
    towgs84: "0,0,0"
  },
  EPSG_20046: {
    towgs84: "0,0,0"
  },
  EPSG_10299: {
    towgs84: "0,0,0"
  },
  EPSG_10310: {
    towgs84: "0,0,0"
  },
  EPSG_10475: {
    towgs84: "0,0,0"
  },
  EPSG_4742: {
    towgs84: "0,0,0"
  },
  EPSG_10671: {
    towgs84: "0,0,0"
  },
  EPSG_10762: {
    towgs84: "0,0,0"
  },
  EPSG_10725: {
    towgs84: "0,0,0"
  },
  EPSG_10791: {
    towgs84: "0,0,0"
  },
  EPSG_10800: {
    towgs84: "0,0,0"
  },
  EPSG_10305: {
    towgs84: "0,0,0"
  },
  EPSG_10941: {
    towgs84: "0,0,0"
  },
  EPSG_10968: {
    towgs84: "0,0,0"
  },
  EPSG_10875: {
    towgs84: "0,0,0"
  },
  EPSG_6318: {
    towgs84: "0,0,0"
  },
  EPSG_10910: {
    towgs84: "0,0,0"
  }
};
for (var Wh in Tr) {
  var gi = Tr[Wh];
  gi.datumName && (Tr[gi.datumName] = gi);
}
function Vh(t, e, r, n, a, i, o) {
  var s = {};
  return t === void 0 || t === "none" ? s.datum_type = yi : s.datum_type = sh, e && (s.datum_params = e.map(parseFloat), (s.datum_params[0] !== 0 || s.datum_params[1] !== 0 || s.datum_params[2] !== 0) && (s.datum_type = fe), s.datum_params.length > 3 && (s.datum_params[3] !== 0 || s.datum_params[4] !== 0 || s.datum_params[5] !== 0 || s.datum_params[6] !== 0) && (s.datum_type = de, s.datum_params[3] *= rr, s.datum_params[4] *= rr, s.datum_params[5] *= rr, s.datum_params[6] = s.datum_params[6] / 1e6 + 1)), o && (s.datum_type = Se, s.grids = o), s.a = r, s.b = n, s.es = a, s.ep2 = i, s;
}
var Gi = {};
function Yh(t, e, r) {
  return e instanceof ArrayBuffer ? Kh(t, e, r) : { ready: Jh(t, e) };
}
function Kh(t, e, r) {
  var n = !0;
  r !== void 0 && r.includeErrorFields === !1 && (n = !1);
  var a = new DataView(e), i = Zh(a), o = t0(a, i), s = e0(a, o, i, n), h = { header: o, subgrids: s };
  return Gi[t] = h, h;
}
async function Jh(t, e) {
  for (var r = [], n = await e.getImageCount(), a = n - 1; a >= 0; a--) {
    var i = await e.getImage(a), o = await i.readRasters(), s = o, h = [i.getWidth(), i.getHeight()], f = i.getBoundingBox().map(Wa), g = [i.fileDirectory.ModelPixelScale[0], i.fileDirectory.ModelPixelScale[1]].map(Wa), d = f[0] + (h[0] - 1) * g[0], c = f[3] - (h[1] - 1) * g[1], _ = s[0], y = s[1], M = [];
    for (let w = h[1] - 1; w >= 0; w--)
      for (let P = h[0] - 1; P >= 0; P--) {
        var m = w * h[0] + P;
        M.push([-Jt(y[m]), Jt(_[m])]);
      }
    r.push({
      del: g,
      lim: h,
      ll: [-d, c],
      cvs: M
    });
  }
  var S = {
    header: {
      nSubgrids: n
    },
    subgrids: r
  };
  return Gi[t] = S, S;
}
function Xh(t) {
  if (t === void 0)
    return null;
  var e = t.split(",");
  return e.map(Qh);
}
function Qh(t) {
  if (t.length === 0)
    return null;
  var e = t[0] === "@";
  return e && (t = t.slice(1)), t === "null" ? { name: "null", mandatory: !e, grid: null, isNull: !0 } : {
    name: t,
    mandatory: !e,
    grid: Gi[t] || null,
    isNull: !1
  };
}
function Wa(t) {
  return t * Math.PI / 180;
}
function Jt(t) {
  return t / 3600 * Math.PI / 180;
}
function Zh(t) {
  var e = t.getInt32(8, !1);
  return e === 11 ? !1 : (e = t.getInt32(8, !0), e !== 11 && console.warn("Failed to detect nadgrid endian-ness, defaulting to little-endian"), !0);
}
function t0(t, e) {
  return {
    nFields: t.getInt32(8, e),
    nSubgridFields: t.getInt32(24, e),
    nSubgrids: t.getInt32(40, e),
    shiftType: Mi(t, 56, 64).trim(),
    fromSemiMajorAxis: t.getFloat64(120, e),
    fromSemiMinorAxis: t.getFloat64(136, e),
    toSemiMajorAxis: t.getFloat64(152, e),
    toSemiMinorAxis: t.getFloat64(168, e)
  };
}
function Mi(t, e, r) {
  return String.fromCharCode.apply(null, new Uint8Array(t.buffer.slice(e, r)));
}
function e0(t, e, r, n) {
  for (var a = 176, i = [], o = 0; o < e.nSubgrids; o++) {
    var s = i0(t, a, r), h = a0(t, a, s, r, n), f = Math.round(
      1 + (s.upperLongitude - s.lowerLongitude) / s.longitudeInterval
    ), g = Math.round(
      1 + (s.upperLatitude - s.lowerLatitude) / s.latitudeInterval
    );
    i.push({
      ll: [Jt(s.lowerLongitude), Jt(s.lowerLatitude)],
      del: [Jt(s.longitudeInterval), Jt(s.latitudeInterval)],
      lim: [f, g],
      count: s.gridNodeCount,
      cvs: r0(h)
    });
    var d = 16;
    n === !1 && (d = 8), a += 176 + s.gridNodeCount * d;
  }
  return i;
}
function r0(t) {
  return t.map(function(e) {
    return [Jt(e.longitudeShift), Jt(e.latitudeShift)];
  });
}
function i0(t, e, r) {
  return {
    name: Mi(t, e + 8, e + 16).trim(),
    parent: Mi(t, e + 24, e + 24 + 8).trim(),
    lowerLatitude: t.getFloat64(e + 72, r),
    upperLatitude: t.getFloat64(e + 88, r),
    lowerLongitude: t.getFloat64(e + 104, r),
    upperLongitude: t.getFloat64(e + 120, r),
    latitudeInterval: t.getFloat64(e + 136, r),
    longitudeInterval: t.getFloat64(e + 152, r),
    gridNodeCount: t.getInt32(e + 168, r)
  };
}
function a0(t, e, r, n, a) {
  var i = e + 176, o = 16;
  a === !1 && (o = 8);
  for (var s = [], h = 0; h < r.gridNodeCount; h++) {
    var f = {
      latitudeShift: t.getFloat32(i + h * o, n),
      longitudeShift: t.getFloat32(i + h * o + 4, n)
    };
    a !== !1 && (f.latitudeAccuracy = t.getFloat32(i + h * o + 8, n), f.longitudeAccuracy = t.getFloat32(i + h * o + 12, n)), s.push(f);
  }
  return s;
}
function At(t, e) {
  if (!(this instanceof At))
    return new At(t);
  this.forward = null, this.inverse = null, this.init = null, this.name, this.names = null, this.title, e = e || function(f) {
    if (f)
      throw f;
  };
  var r = Ih(t);
  if (typeof r != "object") {
    e("Could not parse to valid json: " + t);
    return;
  }
  var n = At.projections.get(r.projName);
  if (!n) {
    e("Could not get projection name from: " + t);
    return;
  }
  if (r.datumCode && r.datumCode !== "none") {
    var a = Qt(Tr, r.datumCode);
    a && (r.datum_params = r.datum_params || (a.towgs84 ? a.towgs84.split(",") : null), r.ellps = a.ellipse, r.datumName = a.datumName ? a.datumName : r.datumCode);
  }
  r.k0 = r.k0 || 1, r.axis = r.axis || "enu", r.ellps = r.ellps || "wgs84", r.lat1 = r.lat1 || r.lat0;
  var i = Hh(r.a, r.b, r.rf, r.ellps, r.sphere), o = zh(i.a, i.b, i.rf, r.R_A), s = Xh(r.nadgrids), h = r.datum || Vh(
    r.datumCode,
    r.datum_params,
    i.a,
    i.b,
    o.es,
    o.ep2,
    s
  );
  za(this, r), za(this, n), this.a = i.a, this.b = i.b, this.rf = i.rf, this.sphere = i.sphere, this.es = o.es, this.e = o.e, this.ep2 = o.ep2, this.datum = h, "init" in this && typeof this.init == "function" && this.init(), e(null, this);
}
At.projections = qh;
At.projections.start();
function n0(t, e) {
  return t.datum_type !== e.datum_type || t.a !== e.a || Math.abs(t.es - e.es) > 5e-11 ? !1 : t.datum_type === fe ? t.datum_params[0] === e.datum_params[0] && t.datum_params[1] === e.datum_params[1] && t.datum_params[2] === e.datum_params[2] : t.datum_type === de ? t.datum_params[0] === e.datum_params[0] && t.datum_params[1] === e.datum_params[1] && t.datum_params[2] === e.datum_params[2] && t.datum_params[3] === e.datum_params[3] && t.datum_params[4] === e.datum_params[4] && t.datum_params[5] === e.datum_params[5] && t.datum_params[6] === e.datum_params[6] : !0;
}
function Sn(t, e, r) {
  var n = t.x, a = t.y, i = t.z ? t.z : 0, o, s, h, f;
  if (a < -A && a > -1.001 * A)
    a = -A;
  else if (a > A && a < 1.001 * A)
    a = A;
  else {
    if (a < -A)
      return { x: -1 / 0, y: -1 / 0, z: t.z };
    if (a > A)
      return { x: 1 / 0, y: 1 / 0, z: t.z };
  }
  return n > Math.PI && (n -= 2 * Math.PI), s = Math.sin(a), f = Math.cos(a), h = s * s, o = r / Math.sqrt(1 - e * h), {
    x: (o + i) * f * Math.cos(n),
    y: (o + i) * f * Math.sin(n),
    z: (o * (1 - e) + i) * s
  };
}
function xn(t, e, r, n) {
  var a = 1e-12, i = a * a, o = 30, s, h, f, g, d, c, _, y, M, m, S, w, P, R = t.x, I = t.y, k = t.z ? t.z : 0, W, D, V;
  if (s = Math.sqrt(R * R + I * I), h = Math.sqrt(R * R + I * I + k * k), s / r < a) {
    if (W = 0, h / r < a)
      return D = A, V = -n, {
        x: t.x,
        y: t.y,
        z: t.z
      };
  } else
    W = Math.atan2(I, R);
  f = k / h, g = s / h, d = 1 / Math.sqrt(1 - e * (2 - e) * g * g), y = g * (1 - e) * d, M = f * d, P = 0;
  do
    P++, _ = r / Math.sqrt(1 - e * M * M), V = s * y + k * M - _ * (1 - e * M * M), c = e * _ / (_ + V), d = 1 / Math.sqrt(1 - c * (2 - c) * g * g), m = g * (1 - c) * d, S = f * d, w = S * y - m * M, y = m, M = S;
  while (w * w > i && P < o);
  return D = Math.atan(S / Math.abs(m)), {
    x: W,
    y: D,
    z: V
  };
}
function s0(t, e, r) {
  if (e === fe)
    return {
      x: t.x + r[0],
      y: t.y + r[1],
      z: t.z + r[2]
    };
  if (e === de) {
    var n = r[0], a = r[1], i = r[2], o = r[3], s = r[4], h = r[5], f = r[6];
    return {
      x: f * (t.x - h * t.y + s * t.z) + n,
      y: f * (h * t.x + t.y - o * t.z) + a,
      z: f * (-s * t.x + o * t.y + t.z) + i
    };
  }
}
function o0(t, e, r) {
  if (e === fe)
    return {
      x: t.x - r[0],
      y: t.y - r[1],
      z: t.z - r[2]
    };
  if (e === de) {
    var n = r[0], a = r[1], i = r[2], o = r[3], s = r[4], h = r[5], f = r[6], g = (t.x - n) / f, d = (t.y - a) / f, c = (t.z - i) / f;
    return {
      x: g + h * d - s * c,
      y: -h * g + d + o * c,
      z: s * g - o * d + c
    };
  }
}
function Gr(t) {
  return t === fe || t === de;
}
function h0(t, e, r) {
  if (n0(t, e) || t.datum_type === yi || e.datum_type === yi)
    return r;
  var n = t.a, a = t.es;
  if (t.datum_type === Se) {
    var i = Va(t, !1, r);
    if (i !== 0)
      return;
    n = Da, a = Ua;
  }
  var o = e.a, s = e.b, h = e.es;
  if (e.datum_type === Se && (o = Da, s = oh, h = Ua), a === h && n === o && !Gr(t.datum_type) && !Gr(e.datum_type))
    return r;
  if (r = Sn(r, a, n), Gr(t.datum_type) && (r = s0(r, t.datum_type, t.datum_params)), Gr(e.datum_type) && (r = o0(r, e.datum_type, e.datum_params)), r = xn(r, h, o, s), e.datum_type === Se) {
    var f = Va(e, !0, r);
    if (f !== 0)
      return;
  }
  return r;
}
function Va(t, e, r) {
  if (t.grids === null || t.grids.length === 0)
    return console.log("Grid shift grids not found"), -1;
  var n = { x: -r.x, y: r.y }, a = { x: Number.NaN, y: Number.NaN }, i = [];
  t:
    for (var o = 0; o < t.grids.length; o++) {
      var s = t.grids[o];
      if (i.push(s.name), s.isNull) {
        a = n;
        break;
      }
      if (s.grid === null) {
        if (s.mandatory)
          return console.log("Unable to find mandatory grid '" + s.name + "'"), -1;
        continue;
      }
      for (var h = s.grid.subgrids, f = 0, g = h.length; f < g; f++) {
        var d = h[f], c = (Math.abs(d.del[1]) + Math.abs(d.del[0])) / 1e4, _ = d.ll[0] - c, y = d.ll[1] - c, M = d.ll[0] + (d.lim[0] - 1) * d.del[0] + c, m = d.ll[1] + (d.lim[1] - 1) * d.del[1] + c;
        if (!(y > n.y || _ > n.x || m < n.y || M < n.x) && (a = l0(n, e, d), !isNaN(a.x)))
          break t;
      }
    }
  return isNaN(a.x) ? (console.log("Failed to find a grid shift table for location '" + -n.x * wt + " " + n.y * wt + " tried: '" + i + "'"), -1) : (r.x = -a.x, r.y = a.y, 0);
}
function l0(t, e, r) {
  var n = { x: Number.NaN, y: Number.NaN };
  if (isNaN(t.x))
    return n;
  var a = { x: t.x, y: t.y };
  a.x -= r.ll[0], a.y -= r.ll[1], a.x = F(a.x - Math.PI) + Math.PI;
  var i = Ya(a, r);
  if (e) {
    if (isNaN(i.x))
      return n;
    i.x = a.x - i.x, i.y = a.y - i.y;
    var o = 9, s = 1e-12, h, f;
    do {
      if (f = Ya(i, r), isNaN(f.x)) {
        console.log("Inverse grid shift iteration failed, presumably at grid edge.  Using first approximation.");
        break;
      }
      h = { x: a.x - (f.x + i.x), y: a.y - (f.y + i.y) }, i.x += h.x, i.y += h.y;
    } while (o-- && Math.abs(h.x) > s && Math.abs(h.y) > s);
    if (o < 0)
      return console.log("Inverse grid shift iterator failed to converge."), n;
    n.x = F(i.x + r.ll[0]), n.y = i.y + r.ll[1];
  } else
    isNaN(i.x) || (n.x = t.x + i.x, n.y = t.y + i.y);
  return n;
}
function Ya(t, e) {
  var r = { x: t.x / e.del[0], y: t.y / e.del[1] }, n = { x: Math.floor(r.x), y: Math.floor(r.y) }, a = { x: r.x - 1 * n.x, y: r.y - 1 * n.y }, i = { x: Number.NaN, y: Number.NaN }, o;
  if (n.x < 0 || n.x >= e.lim[0] || n.y < 0 || n.y >= e.lim[1])
    return i;
  o = n.y * e.lim[0] + n.x;
  var s = { x: e.cvs[o][0], y: e.cvs[o][1] };
  o++;
  var h = { x: e.cvs[o][0], y: e.cvs[o][1] };
  o += e.lim[0];
  var f = { x: e.cvs[o][0], y: e.cvs[o][1] };
  o--;
  var g = { x: e.cvs[o][0], y: e.cvs[o][1] }, d = a.x * a.y, c = a.x * (1 - a.y), _ = (1 - a.x) * (1 - a.y), y = (1 - a.x) * a.y;
  return i.x = _ * s.x + c * h.x + y * g.x + d * f.x, i.y = _ * s.y + c * h.y + y * g.y + d * f.y, i;
}
function Ka(t, e, r) {
  var n = r.x, a = r.y, i = r.z || 0, o, s, h, f = {};
  for (h = 0; h < 3; h++)
    if (!(e && h === 2 && r.z === void 0))
      switch (h === 0 ? (o = n, "ew".indexOf(t.axis[h]) !== -1 ? s = "x" : s = "y") : h === 1 ? (o = a, "ns".indexOf(t.axis[h]) !== -1 ? s = "y" : s = "x") : (o = i, s = "z"), t.axis[h]) {
        case "e":
          f[s] = o;
          break;
        case "w":
          f[s] = -o;
          break;
        case "n":
          f[s] = o;
          break;
        case "s":
          f[s] = -o;
          break;
        case "u":
          r[s] !== void 0 && (f.z = o);
          break;
        case "d":
          r[s] !== void 0 && (f.z = -o);
          break;
        default:
          return null;
      }
  return f;
}
function Gn(t) {
  var e = {
    x: t[0],
    y: t[1]
  };
  return t.length > 2 && (e.z = t[2]), t.length > 3 && (e.m = t[3]), e;
}
function u0(t) {
  Ja(t.x), Ja(t.y);
}
function Ja(t) {
  if (typeof Number.isFinite == "function") {
    if (Number.isFinite(t))
      return;
    throw new TypeError("coordinates must be finite numbers");
  }
  if (typeof t != "number" || t !== t || !isFinite(t))
    throw new TypeError("coordinates must be finite numbers");
}
function c0(t, e) {
  return (t.datum.datum_type === fe || t.datum.datum_type === de || t.datum.datum_type === Se) && e.datumCode !== "WGS84" || (e.datum.datum_type === fe || e.datum.datum_type === de || e.datum.datum_type === Se) && t.datumCode !== "WGS84";
}
function jr(t, e, r, n) {
  var a;
  Array.isArray(r) ? r = Gn(r) : r = {
    x: r.x,
    y: r.y,
    z: r.z,
    m: r.m
  };
  var i = r.z !== void 0;
  if (u0(r), t.datum && e.datum && c0(t, e) && (a = new At("WGS84"), r = jr(t, a, r, n), t = a), n && t.axis !== "enu" && (r = Ka(t, !1, r)), t.projName === "longlat")
    r = {
      x: r.x * rt,
      y: r.y * rt,
      z: r.z || 0
    };
  else if (t.to_meter && (r = {
    x: r.x * t.to_meter,
    y: r.y * t.to_meter,
    z: r.z || 0
  }), r = t.inverse(r), !r)
    return;
  if (t.from_greenwich && (r.x += t.from_greenwich), r = h0(t.datum, e.datum, r), !!r)
    return r = /** @type {import('./core').InterfaceCoordinates} */
    r, e.from_greenwich && (r = {
      x: r.x - e.from_greenwich,
      y: r.y,
      z: r.z || 0
    }), e.projName === "longlat" ? r = {
      x: r.x * wt,
      y: r.y * wt,
      z: r.z || 0
    } : (r = e.forward(r), e.to_meter && (r = {
      x: r.x / e.to_meter,
      y: r.y / e.to_meter,
      z: r.z || 0
    })), n && e.axis !== "enu" ? Ka(e, !0, r) : (r && !i && delete r.z, r);
}
var Xa = At("WGS84");
function _i(t, e, r, n) {
  var a, i, o;
  return Array.isArray(r) ? (a = jr(t, e, r, n) || { x: NaN, y: NaN }, r.length > 2 ? typeof t.name < "u" && t.name === "geocent" || typeof e.name < "u" && e.name === "geocent" ? typeof a.z == "number" ? (
    /** @type {T} */
    [a.x, a.y, a.z].concat(r.slice(3))
  ) : (
    /** @type {T} */
    [a.x, a.y, r[2]].concat(r.slice(3))
  ) : (
    /** @type {T} */
    [a.x, a.y].concat(r.slice(2))
  ) : (
    /** @type {T} */
    [a.x, a.y]
  )) : (i = jr(t, e, r, n), o = Object.keys(r), o.length === 2 || o.forEach(function(s) {
    if (typeof t.name < "u" && t.name === "geocent" || typeof e.name < "u" && e.name === "geocent") {
      if (s === "x" || s === "y" || s === "z")
        return;
    } else if (s === "x" || s === "y")
      return;
    i[s] = r[s];
  }), /** @type {T} */
  i);
}
function Ar(t) {
  return t instanceof At ? t : typeof t == "object" && "oProj" in t ? t.oProj : At(
    /** @type {string | PROJJSONDefinition} */
    t
  );
}
function f0(t, e, r) {
  var n, a, i = !1, o;
  return typeof e > "u" ? (a = Ar(t), n = Xa, i = !0) : (typeof /** @type {?} */
  e.x < "u" || Array.isArray(e)) && (r = /** @type {T} */
  /** @type {?} */
  e, a = Ar(t), n = Xa, i = !0), n || (n = Ar(t)), a || (a = Ar(
    /** @type {string | PROJJSONDefinition | proj } */
    e
  )), r ? _i(n, a, r) : (o = {
    /**
     * @template {TemplateCoordinates} T
     * @param {T} coords
     * @param {boolean=} enforceAxis
     * @returns {T}
     */
    forward: function(s, h) {
      return _i(n, a, s, h);
    },
    /**
     * @template {TemplateCoordinates} T
     * @param {T} coords
     * @param {boolean=} enforceAxis
     * @returns {T}
     */
    inverse: function(s, h) {
      return _i(a, n, s, h);
    }
  }, i && (o.oProj = a), o);
}
var Qa = 6, An = "AJSAJS", Cn = "AFAFAF", Ee = 65, mt = 73, Gt = 79, Qe = 86, Ze = 90, d0 = {
  forward: Tn,
  inverse: g0,
  toPoint: In
};
function Tn(t, e) {
  return e = e || 5, y0(_0({
    lat: t[1],
    lon: t[0]
  }), e);
}
function g0(t) {
  var e = Ai(Rn(t.toUpperCase()));
  return e.lat && e.lon ? [e.lon, e.lat, e.lon, e.lat] : [e.left, e.bottom, e.right, e.top];
}
function In(t) {
  var e = Ai(Rn(t.toUpperCase()));
  return e.lat && e.lon ? [e.lon, e.lat] : [(e.left + e.right) / 2, (e.top + e.bottom) / 2];
}
function vi(t) {
  return t * (Math.PI / 180);
}
function Za(t) {
  return 180 * (t / Math.PI);
}
function _0(t) {
  var e = t.lat, r = t.lon, n = 6378137, a = 669438e-8, i = 0.9996, o, s, h, f, g, d, c, _ = vi(e), y = vi(r), M, m;
  m = Math.floor((r + 180) / 6) + 1, r === 180 && (m = 60), e >= 56 && e < 64 && r >= 3 && r < 12 && (m = 32), e >= 72 && e < 84 && (r >= 0 && r < 9 ? m = 31 : r >= 9 && r < 21 ? m = 33 : r >= 21 && r < 33 ? m = 35 : r >= 33 && r < 42 && (m = 37)), o = (m - 1) * 6 - 180 + 3, M = vi(o), s = a / (1 - a), h = n / Math.sqrt(1 - a * Math.sin(_) * Math.sin(_)), f = Math.tan(_) * Math.tan(_), g = s * Math.cos(_) * Math.cos(_), d = Math.cos(_) * (y - M), c = n * ((1 - a / 4 - 3 * a * a / 64 - 5 * a * a * a / 256) * _ - (3 * a / 8 + 3 * a * a / 32 + 45 * a * a * a / 1024) * Math.sin(2 * _) + (15 * a * a / 256 + 45 * a * a * a / 1024) * Math.sin(4 * _) - 35 * a * a * a / 3072 * Math.sin(6 * _));
  var S = i * h * (d + (1 - f + g) * d * d * d / 6 + (5 - 18 * f + f * f + 72 * g - 58 * s) * d * d * d * d * d / 120) + 5e5, w = i * (c + h * Math.tan(_) * (d * d / 2 + (5 - f + 9 * g + 4 * g * g) * d * d * d * d / 24 + (61 - 58 * f + f * f + 600 * g - 330 * s) * d * d * d * d * d * d / 720));
  return e < 0 && (w += 1e7), {
    northing: Math.round(w),
    easting: Math.round(S),
    zoneNumber: m,
    zoneLetter: v0(e)
  };
}
function Ai(t) {
  var e = t.northing, r = t.easting, n = t.zoneLetter, a = t.zoneNumber;
  if (a < 0 || a > 60)
    return null;
  var i = 0.9996, o = 6378137, s = 669438e-8, h, f = (1 - Math.sqrt(1 - s)) / (1 + Math.sqrt(1 - s)), g, d, c, _, y, M, m, S, w, P = r - 5e5, R = e;
  n < "N" && (R -= 1e7), m = (a - 1) * 6 - 180 + 3, h = s / (1 - s), M = R / i, S = M / (o * (1 - s / 4 - 3 * s * s / 64 - 5 * s * s * s / 256)), w = S + (3 * f / 2 - 27 * f * f * f / 32) * Math.sin(2 * S) + (21 * f * f / 16 - 55 * f * f * f * f / 32) * Math.sin(4 * S) + 151 * f * f * f / 96 * Math.sin(6 * S), g = o / Math.sqrt(1 - s * Math.sin(w) * Math.sin(w)), d = Math.tan(w) * Math.tan(w), c = h * Math.cos(w) * Math.cos(w), _ = o * (1 - s) / Math.pow(1 - s * Math.sin(w) * Math.sin(w), 1.5), y = P / (g * i);
  var I = w - g * Math.tan(w) / _ * (y * y / 2 - (5 + 3 * d + 10 * c - 4 * c * c - 9 * h) * y * y * y * y / 24 + (61 + 90 * d + 298 * c + 45 * d * d - 252 * h - 3 * c * c) * y * y * y * y * y * y / 720);
  I = Za(I);
  var k = (y - (1 + 2 * d + c) * y * y * y / 6 + (5 - 2 * c + 28 * d - 3 * c * c + 8 * h + 24 * d * d) * y * y * y * y * y / 120) / Math.cos(w);
  k = m + Za(k);
  var W;
  if (t.accuracy) {
    var D = Ai({
      northing: t.northing + t.accuracy,
      easting: t.easting + t.accuracy,
      zoneLetter: t.zoneLetter,
      zoneNumber: t.zoneNumber
    });
    W = {
      top: D.lat,
      right: D.lon,
      bottom: I,
      left: k
    };
  } else
    W = {
      lat: I,
      lon: k
    };
  return W;
}
function v0(t) {
  var e = "Z";
  return 84 >= t && t >= 72 ? e = "X" : 72 > t && t >= 64 ? e = "W" : 64 > t && t >= 56 ? e = "V" : 56 > t && t >= 48 ? e = "U" : 48 > t && t >= 40 ? e = "T" : 40 > t && t >= 32 ? e = "S" : 32 > t && t >= 24 ? e = "R" : 24 > t && t >= 16 ? e = "Q" : 16 > t && t >= 8 ? e = "P" : 8 > t && t >= 0 ? e = "N" : 0 > t && t >= -8 ? e = "M" : -8 > t && t >= -16 ? e = "L" : -16 > t && t >= -24 ? e = "K" : -24 > t && t >= -32 ? e = "J" : -32 > t && t >= -40 ? e = "H" : -40 > t && t >= -48 ? e = "G" : -48 > t && t >= -56 ? e = "F" : -56 > t && t >= -64 ? e = "E" : -64 > t && t >= -72 ? e = "D" : -72 > t && t >= -80 && (e = "C"), e;
}
function y0(t, e) {
  var r = "00000" + t.easting, n = "00000" + t.northing;
  return t.zoneNumber + t.zoneLetter + m0(t.easting, t.northing, t.zoneNumber) + r.substr(r.length - 5, e) + n.substr(n.length - 5, e);
}
function m0(t, e, r) {
  var n = On(r), a = Math.floor(t / 1e5), i = Math.floor(e / 1e5) % 20;
  return M0(a, i, n);
}
function On(t) {
  var e = t % Qa;
  return e === 0 && (e = Qa), e;
}
function M0(t, e, r) {
  var n = r - 1, a = An.charCodeAt(n), i = Cn.charCodeAt(n), o = a + t - 1, s = i + e, h = !1;
  o > Ze && (o = o - Ze + Ee - 1, h = !0), (o === mt || a < mt && o > mt || (o > mt || a < mt) && h) && o++, (o === Gt || a < Gt && o > Gt || (o > Gt || a < Gt) && h) && (o++, o === mt && o++), o > Ze && (o = o - Ze + Ee - 1), s > Qe ? (s = s - Qe + Ee - 1, h = !0) : h = !1, (s === mt || i < mt && s > mt || (s > mt || i < mt) && h) && s++, (s === Gt || i < Gt && s > Gt || (s > Gt || i < Gt) && h) && (s++, s === mt && s++), s > Qe && (s = s - Qe + Ee - 1);
  var f = String.fromCharCode(o) + String.fromCharCode(s);
  return f;
}
function Rn(t) {
  if (t && t.length === 0)
    throw "MGRSPoint coverting from nothing";
  for (var e = t.length, r = null, n = "", a, i = 0; !/[A-Z]/.test(a = t.charAt(i)); ) {
    if (i >= 2)
      throw "MGRSPoint bad conversion from: " + t;
    n += a, i++;
  }
  var o = parseInt(n, 10);
  if (i === 0 || i + 3 > e)
    throw "MGRSPoint bad conversion from: " + t;
  var s = t.charAt(i++);
  if (s <= "A" || s === "B" || s === "Y" || s >= "Z" || s === "I" || s === "O")
    throw "MGRSPoint zone letter " + s + " not handled: " + t;
  r = t.substring(i, i += 2);
  for (var h = On(o), f = p0(r.charAt(0), h), g = w0(r.charAt(1), h); g < b0(s); )
    g += 2e6;
  var d = e - i;
  if (d % 2 !== 0)
    throw \`MGRSPoint has to have an even number 
of digits after the zone letter and two 100km letters - front 
half for easting meters, second half for 
northing meters\` + t;
  var c = d / 2, _ = 0, y = 0, M, m, S, w, P;
  return c > 0 && (M = 1e5 / Math.pow(10, c), m = t.substring(i, i + c), _ = parseFloat(m) * M, S = t.substring(i + c), y = parseFloat(S) * M), w = _ + f, P = y + g, {
    easting: w,
    northing: P,
    zoneLetter: s,
    zoneNumber: o,
    accuracy: M
  };
}
function p0(t, e) {
  for (var r = An.charCodeAt(e - 1), n = 1e5, a = !1; r !== t.charCodeAt(0); ) {
    if (r++, r === mt && r++, r === Gt && r++, r > Ze) {
      if (a)
        throw "Bad character: " + t;
      r = Ee, a = !0;
    }
    n += 1e5;
  }
  return n;
}
function w0(t, e) {
  if (t > "V")
    throw "MGRSPoint given invalid Northing " + t;
  for (var r = Cn.charCodeAt(e - 1), n = 0, a = !1; r !== t.charCodeAt(0); ) {
    if (r++, r === mt && r++, r === Gt && r++, r > Qe) {
      if (a)
        throw "Bad character: " + t;
      r = Ee, a = !0;
    }
    n += 1e5;
  }
  return n;
}
function b0(t) {
  var e;
  switch (t) {
    case "C":
      e = 11e5;
      break;
    case "D":
      e = 2e6;
      break;
    case "E":
      e = 28e5;
      break;
    case "F":
      e = 37e5;
      break;
    case "G":
      e = 46e5;
      break;
    case "H":
      e = 55e5;
      break;
    case "J":
      e = 64e5;
      break;
    case "K":
      e = 73e5;
      break;
    case "L":
      e = 82e5;
      break;
    case "M":
      e = 91e5;
      break;
    case "N":
      e = 0;
      break;
    case "P":
      e = 8e5;
      break;
    case "Q":
      e = 17e5;
      break;
    case "R":
      e = 26e5;
      break;
    case "S":
      e = 35e5;
      break;
    case "T":
      e = 44e5;
      break;
    case "U":
      e = 53e5;
      break;
    case "V":
      e = 62e5;
      break;
    case "W":
      e = 7e6;
      break;
    case "X":
      e = 79e5;
      break;
    default:
      e = -1;
  }
  if (e >= 0)
    return e;
  throw "Invalid zone letter: " + t;
}
function Ge(t, e, r) {
  if (!(this instanceof Ge))
    return new Ge(t, e, r);
  if (Array.isArray(t))
    this.x = t[0], this.y = t[1], this.z = t[2] || 0;
  else if (typeof t == "object")
    this.x = t.x, this.y = t.y, this.z = t.z || 0;
  else if (typeof t == "string" && typeof e > "u") {
    var n = t.split(",");
    this.x = parseFloat(n[0]), this.y = parseFloat(n[1]), this.z = parseFloat(n[2]) || 0;
  } else
    this.x = t, this.y = e, this.z = r || 0;
  console.warn("proj4.Point will be removed in version 3, use proj4.toPoint");
}
Ge.fromMGRS = function(t) {
  return new Ge(In(t));
};
Ge.prototype.toMGRS = function(t) {
  return Tn([this.x, this.y], t);
};
var E0 = 1, P0 = 0.25, tn = 0.046875, en = 0.01953125, rn = 0.01068115234375, S0 = 0.75, x0 = 0.46875, G0 = 0.013020833333333334, A0 = 0.007120768229166667, C0 = 0.3645833333333333, T0 = 0.005696614583333333, I0 = 0.3076171875;
function Ci(t) {
  var e = [];
  e[0] = E0 - t * (P0 + t * (tn + t * (en + t * rn))), e[1] = t * (S0 - t * (tn + t * (en + t * rn)));
  var r = t * t;
  return e[2] = r * (x0 - t * (G0 + t * A0)), r *= t, e[3] = r * (C0 - t * T0), e[4] = r * t * I0, e;
}
function Ae(t, e, r, n) {
  return r *= e, e *= e, n[0] * t - r * (n[1] + e * (n[2] + e * (n[3] + e * n[4])));
}
var O0 = 20;
function Ti(t, e, r) {
  for (var n = 1 / (1 - e), a = t, i = O0; i; --i) {
    var o = Math.sin(a), s = 1 - e * o * o;
    if (s = (Ae(a, o, Math.cos(a), r) - t) * (s * Math.sqrt(s)) * n, a -= s, Math.abs(s) < N)
      return a;
  }
  return a;
}
function R0() {
  this.x0 = this.x0 !== void 0 ? this.x0 : 0, this.y0 = this.y0 !== void 0 ? this.y0 : 0, this.long0 = this.long0 !== void 0 ? this.long0 : 0, this.lat0 = this.lat0 !== void 0 ? this.lat0 : 0, this.es && (this.en = Ci(this.es), this.ml0 = Ae(this.lat0, Math.sin(this.lat0), Math.cos(this.lat0), this.en));
}
function N0(t) {
  var e = t.x, r = t.y, n = F(e - this.long0, this.over), a, i, o, s = Math.sin(r), h = Math.cos(r);
  if (this.es) {
    var g = h * n, d = Math.pow(g, 2), c = this.ep2 * Math.pow(h, 2), _ = Math.pow(c, 2), y = Math.abs(h) > N ? Math.tan(r) : 0, M = Math.pow(y, 2), m = Math.pow(M, 2);
    a = 1 - this.es * Math.pow(s, 2), g = g / Math.sqrt(a);
    var S = Ae(r, s, h, this.en);
    i = this.a * (this.k0 * g * (1 + d / 6 * (1 - M + c + d / 20 * (5 - 18 * M + m + 14 * c - 58 * M * c + d / 42 * (61 + 179 * m - m * M - 479 * M))))) + this.x0, o = this.a * (this.k0 * (S - this.ml0 + s * n * g / 2 * (1 + d / 12 * (5 - M + 9 * c + 4 * _ + d / 30 * (61 + m - 58 * M + 270 * c - 330 * M * c + d / 56 * (1385 + 543 * m - m * M - 3111 * M)))))) + this.y0;
  } else {
    var f = h * Math.sin(n);
    if (Math.abs(Math.abs(f) - 1) < N)
      return 93;
    if (i = 0.5 * this.a * this.k0 * Math.log((1 + f) / (1 - f)) + this.x0, o = h * Math.cos(n) / Math.sqrt(1 - Math.pow(f, 2)), f = Math.abs(o), f >= 1) {
      if (f - 1 > N)
        return 93;
      o = 0;
    } else
      o = Math.acos(o);
    r < 0 && (o = -o), o = this.a * this.k0 * (o - this.lat0) + this.y0;
  }
  return t.x = i, t.y = o, t;
}
function L0(t) {
  var e, r, n, a, i = (t.x - this.x0) * (1 / this.a), o = (t.y - this.y0) * (1 / this.a);
  if (this.es)
    if (e = this.ml0 + o / this.k0, r = Ti(e, this.es, this.en), Math.abs(r) < A) {
      var d = Math.sin(r), c = Math.cos(r), _ = Math.abs(c) > N ? Math.tan(r) : 0, y = this.ep2 * Math.pow(c, 2), M = Math.pow(y, 2), m = Math.pow(_, 2), S = Math.pow(m, 2);
      e = 1 - this.es * Math.pow(d, 2);
      var w = i * Math.sqrt(e) / this.k0, P = Math.pow(w, 2);
      e = e * _, n = r - e * P / (1 - this.es) * 0.5 * (1 - P / 12 * (5 + 3 * m - 9 * y * m + y - 4 * M - P / 30 * (61 + 90 * m - 252 * y * m + 45 * S + 46 * y - P / 56 * (1385 + 3633 * m + 4095 * S + 1574 * S * m)))), a = F(this.long0 + w * (1 - P / 6 * (1 + 2 * m + y - P / 20 * (5 + 28 * m + 24 * S + 8 * y * m + 6 * y - P / 42 * (61 + 662 * m + 1320 * S + 720 * S * m)))) / c, this.over);
    } else
      n = A * cr(o), a = 0;
  else {
    var s = Math.exp(i / this.k0), h = 0.5 * (s - 1 / s), f = this.lat0 + o / this.k0, g = Math.cos(f);
    e = Math.sqrt((1 - Math.pow(g, 2)) / (1 + Math.pow(h, 2))), n = Math.asin(e), o < 0 && (n = -n), h === 0 && g === 0 ? a = 0 : a = F(Math.atan2(h, g) + this.long0, this.over);
  }
  return t.x = a, t.y = n, t;
}
var F0 = ["Fast_Transverse_Mercator", "Fast Transverse Mercator"], Ir = {
  init: R0,
  forward: N0,
  inverse: L0,
  names: F0
};
function Nn(t) {
  var e = Math.exp(t);
  return e = (e - 1 / e) / 2, e;
}
function pt(t, e) {
  t = Math.abs(t), e = Math.abs(e);
  var r = Math.max(t, e), n = Math.min(t, e) / (r || 1);
  return r * Math.sqrt(1 + Math.pow(n, 2));
}
function D0(t) {
  var e = 1 + t, r = e - 1;
  return r === 0 ? t : t * Math.log(e) / r;
}
function U0(t) {
  var e = Math.abs(t);
  return e = D0(e * (1 + e / (pt(1, e) + 1))), t < 0 ? -e : e;
}
function Ii(t, e) {
  for (var r = 2 * Math.cos(2 * e), n = t.length - 1, a = t[n], i = 0, o; --n >= 0; )
    o = -i + r * a + t[n], i = a, a = o;
  return e + o * Math.sin(2 * e);
}
function B0(t, e) {
  for (var r = 2 * Math.cos(e), n = t.length - 1, a = t[n], i = 0, o; --n >= 0; )
    o = -i + r * a + t[n], i = a, a = o;
  return Math.sin(e) * o;
}
function j0(t) {
  var e = Math.exp(t);
  return e = (e + 1 / e) / 2, e;
}
function Ln(t, e, r) {
  for (var n = Math.sin(e), a = Math.cos(e), i = Nn(r), o = j0(r), s = 2 * a * o, h = -2 * n * i, f = t.length - 1, g = t[f], d = 0, c = 0, _ = 0, y, M; --f >= 0; )
    y = c, M = d, c = g, d = _, g = -y + s * c - h * d + t[f], _ = -M + h * c + s * d;
  return s = n * o, h = a * i, [s * g - h * _, s * _ + h * g];
}
function k0() {
  if (!this.approx && (isNaN(this.es) || this.es <= 0))
    throw new Error('Incorrect elliptical usage. Try using the +approx option in the proj string, or PROJECTION["Fast_Transverse_Mercator"] in the WKT.');
  this.approx && (Ir.init.apply(this), this.forward = Ir.forward, this.inverse = Ir.inverse), this.x0 = this.x0 !== void 0 ? this.x0 : 0, this.y0 = this.y0 !== void 0 ? this.y0 : 0, this.long0 = this.long0 !== void 0 ? this.long0 : 0, this.lat0 = this.lat0 !== void 0 ? this.lat0 : 0, this.cgb = [], this.cbg = [], this.utg = [], this.gtu = [];
  var t = this.es / (1 + Math.sqrt(1 - this.es)), e = t / (2 - t), r = e;
  this.cgb[0] = e * (2 + e * (-2 / 3 + e * (-2 + e * (116 / 45 + e * (26 / 45 + e * (-2854 / 675)))))), this.cbg[0] = e * (-2 + e * (2 / 3 + e * (4 / 3 + e * (-82 / 45 + e * (32 / 45 + e * (4642 / 4725)))))), r = r * e, this.cgb[1] = r * (7 / 3 + e * (-8 / 5 + e * (-227 / 45 + e * (2704 / 315 + e * (2323 / 945))))), this.cbg[1] = r * (5 / 3 + e * (-16 / 15 + e * (-13 / 9 + e * (904 / 315 + e * (-1522 / 945))))), r = r * e, this.cgb[2] = r * (56 / 15 + e * (-136 / 35 + e * (-1262 / 105 + e * (73814 / 2835)))), this.cbg[2] = r * (-26 / 15 + e * (34 / 21 + e * (8 / 5 + e * (-12686 / 2835)))), r = r * e, this.cgb[3] = r * (4279 / 630 + e * (-332 / 35 + e * (-399572 / 14175))), this.cbg[3] = r * (1237 / 630 + e * (-12 / 5 + e * (-24832 / 14175))), r = r * e, this.cgb[4] = r * (4174 / 315 + e * (-144838 / 6237)), this.cbg[4] = r * (-734 / 315 + e * (109598 / 31185)), r = r * e, this.cgb[5] = r * (601676 / 22275), this.cbg[5] = r * (444337 / 155925), r = Math.pow(e, 2), this.Qn = this.k0 / (1 + e) * (1 + r * (1 / 4 + r * (1 / 64 + r / 256))), this.utg[0] = e * (-0.5 + e * (2 / 3 + e * (-37 / 96 + e * (1 / 360 + e * (81 / 512 + e * (-96199 / 604800)))))), this.gtu[0] = e * (0.5 + e * (-2 / 3 + e * (5 / 16 + e * (41 / 180 + e * (-127 / 288 + e * (7891 / 37800)))))), this.utg[1] = r * (-1 / 48 + e * (-1 / 15 + e * (437 / 1440 + e * (-46 / 105 + e * (1118711 / 3870720))))), this.gtu[1] = r * (13 / 48 + e * (-3 / 5 + e * (557 / 1440 + e * (281 / 630 + e * (-1983433 / 1935360))))), r = r * e, this.utg[2] = r * (-17 / 480 + e * (37 / 840 + e * (209 / 4480 + e * (-5569 / 90720)))), this.gtu[2] = r * (61 / 240 + e * (-103 / 140 + e * (15061 / 26880 + e * (167603 / 181440)))), r = r * e, this.utg[3] = r * (-4397 / 161280 + e * (11 / 504 + e * (830251 / 7257600))), this.gtu[3] = r * (49561 / 161280 + e * (-179 / 168 + e * (6601661 / 7257600))), r = r * e, this.utg[4] = r * (-4583 / 161280 + e * (108847 / 3991680)), this.gtu[4] = r * (34729 / 80640 + e * (-3418889 / 1995840)), r = r * e, this.utg[5] = r * (-20648693 / 638668800), this.gtu[5] = r * (212378941 / 319334400);
  var n = Ii(this.cbg, this.lat0);
  this.Zb = -this.Qn * (n + B0(this.gtu, 2 * n));
}
function q0(t) {
  var e = F(t.x - this.long0, this.over), r = t.y;
  r = Ii(this.cbg, r);
  var n = Math.sin(r), a = Math.cos(r), i = Math.sin(e), o = Math.cos(e);
  r = Math.atan2(n, o * a), e = Math.atan2(i * a, pt(n, a * o)), e = U0(Math.tan(e));
  var s = Ln(this.gtu, 2 * r, 2 * e);
  r = r + s[0], e = e + s[1];
  var h, f;
  return Math.abs(e) <= 2.623395162778 ? (h = this.a * (this.Qn * e) + this.x0, f = this.a * (this.Qn * r + this.Zb) + this.y0) : (h = 1 / 0, f = 1 / 0), t.x = h, t.y = f, t;
}
function $0(t) {
  var e = (t.x - this.x0) * (1 / this.a), r = (t.y - this.y0) * (1 / this.a);
  r = (r - this.Zb) / this.Qn, e = e / this.Qn;
  var n, a;
  if (Math.abs(e) <= 2.623395162778) {
    var i = Ln(this.utg, 2 * r, 2 * e);
    r = r + i[0], e = e + i[1], e = Math.atan(Nn(e));
    var o = Math.sin(r), s = Math.cos(r), h = Math.sin(e), f = Math.cos(e);
    r = Math.atan2(o * f, pt(h, f * s)), e = Math.atan2(h, f * s), n = F(e + this.long0, this.over), a = Ii(this.cgb, r);
  } else
    n = 1 / 0, a = 1 / 0;
  return t.x = n, t.y = a, t;
}
var z0 = ["Extended_Transverse_Mercator", "Extended Transverse Mercator", "etmerc", "Transverse_Mercator", "Transverse Mercator", "Gauss Kruger", "Gauss_Kruger", "tmerc"], Or = {
  init: k0,
  forward: q0,
  inverse: $0,
  names: z0
};
function H0(t, e) {
  if (t === void 0) {
    if (t = Math.floor((F(e) + Math.PI) * 30 / Math.PI) + 1, t < 0)
      return 0;
    if (t > 60)
      return 60;
  }
  return t;
}
var W0 = "etmerc";
function V0() {
  var t = H0(this.zone, this.long0);
  if (t === void 0)
    throw new Error("unknown utm zone");
  this.lat0 = 0, this.long0 = (6 * Math.abs(t) - 183) * rt, this.x0 = 5e5, this.y0 = this.utmSouth ? 1e7 : 0, this.k0 = 0.9996, Or.init.apply(this), this.forward = Or.forward, this.inverse = Or.inverse;
}
var Y0 = ["Universal Transverse Mercator System", "utm"], K0 = {
  init: V0,
  names: Y0,
  dependsOn: W0
};
function Oi(t, e) {
  return Math.pow((1 - t) / (1 + t), e);
}
var J0 = 20;
function X0() {
  var t = Math.sin(this.lat0), e = Math.cos(this.lat0);
  e *= e, this.rc = Math.sqrt(1 - this.es) / (1 - this.es * t * t), this.C = Math.sqrt(1 + this.es * e * e / (1 - this.es)), this.phic0 = Math.asin(t / this.C), this.ratexp = 0.5 * this.C * this.e, this.K = Math.tan(0.5 * this.phic0 + X) / (Math.pow(Math.tan(0.5 * this.lat0 + X), this.C) * Oi(this.e * t, this.ratexp));
}
function Q0(t) {
  var e = t.x, r = t.y;
  return t.y = 2 * Math.atan(this.K * Math.pow(Math.tan(0.5 * r + X), this.C) * Oi(this.e * Math.sin(r), this.ratexp)) - A, t.x = this.C * e, t;
}
function Z0(t) {
  for (var e = 1e-14, r = t.x / this.C, n = t.y, a = Math.pow(Math.tan(0.5 * n + X) / this.K, 1 / this.C), i = J0; i > 0 && (n = 2 * Math.atan(a * Oi(this.e * Math.sin(t.y), -0.5 * this.e)) - A, !(Math.abs(n - t.y) < e)); --i)
    t.y = n;
  return i ? (t.x = r, t.y = n, t) : null;
}
var Ri = {
  init: X0,
  forward: Q0,
  inverse: Z0
};
function tl() {
  Ri.init.apply(this), this.rc && (this.sinc0 = Math.sin(this.phic0), this.cosc0 = Math.cos(this.phic0), this.R2 = 2 * this.rc, this.title || (this.title = "Oblique Stereographic Alternative"));
}
function el(t) {
  var e, r, n, a;
  return t.x = F(t.x - this.long0, this.over), Ri.forward.apply(this, [t]), e = Math.sin(t.y), r = Math.cos(t.y), n = Math.cos(t.x), a = this.k0 * this.R2 / (1 + this.sinc0 * e + this.cosc0 * r * n), t.x = a * r * Math.sin(t.x), t.y = a * (this.cosc0 * e - this.sinc0 * r * n), t.x = this.a * t.x + this.x0, t.y = this.a * t.y + this.y0, t;
}
function rl(t) {
  var e, r, n, a, i;
  if (t.x = (t.x - this.x0) / this.a, t.y = (t.y - this.y0) / this.a, t.x /= this.k0, t.y /= this.k0, i = pt(t.x, t.y)) {
    var o = 2 * Math.atan2(i, this.R2);
    e = Math.sin(o), r = Math.cos(o), a = Math.asin(r * this.sinc0 + t.y * e * this.cosc0 / i), n = Math.atan2(t.x * e, i * this.cosc0 * r - t.y * this.sinc0 * e);
  } else
    a = this.phic0, n = 0;
  return t.x = n, t.y = a, Ri.inverse.apply(this, [t]), t.x = F(t.x + this.long0, this.over), t;
}
var il = ["Stereographic_North_Pole", "Oblique_Stereographic", "sterea", "Oblique Stereographic Alternative", "Double_Stereographic"], al = {
  init: tl,
  forward: el,
  inverse: rl,
  names: il
};
function Ni(t, e, r) {
  return e *= r, Math.tan(0.5 * (A + t)) * Math.pow((1 - e) / (1 + e), 0.5 * r);
}
function nl() {
  this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.coslat0 = Math.cos(this.lat0), this.sinlat0 = Math.sin(this.lat0), this.sphere ? this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= N && (this.k0 = 0.5 * (1 + cr(this.lat0) * Math.sin(this.lat_ts))) : (Math.abs(this.coslat0) <= N && (this.lat0 > 0 ? this.con = 1 : this.con = -1), this.cons = Math.sqrt(Math.pow(1 + this.e, 1 + this.e) * Math.pow(1 - this.e, 1 - this.e)), this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= N && Math.abs(Math.cos(this.lat_ts)) > N && (this.k0 = 0.5 * this.cons * Bt(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)) / Lt(this.e, this.con * this.lat_ts, this.con * Math.sin(this.lat_ts))), this.ms1 = Bt(this.e, this.sinlat0, this.coslat0), this.X0 = 2 * Math.atan(Ni(this.lat0, this.sinlat0, this.e)) - A, this.cosX0 = Math.cos(this.X0), this.sinX0 = Math.sin(this.X0));
}
function sl(t) {
  var e = t.x, r = t.y, n = Math.sin(r), a = Math.cos(r), i, o, s, h, f, g, d = F(e - this.long0, this.over);
  return Math.abs(Math.abs(e - this.long0) - Math.PI) <= N && Math.abs(r + this.lat0) <= N ? (t.x = NaN, t.y = NaN, t) : this.sphere ? (i = 2 * this.k0 / (1 + this.sinlat0 * n + this.coslat0 * a * Math.cos(d)), t.x = this.a * i * a * Math.sin(d) + this.x0, t.y = this.a * i * (this.coslat0 * n - this.sinlat0 * a * Math.cos(d)) + this.y0, t) : (o = 2 * Math.atan(Ni(r, n, this.e)) - A, h = Math.cos(o), s = Math.sin(o), Math.abs(this.coslat0) <= N ? (f = Lt(this.e, r * this.con, this.con * n), g = 2 * this.a * this.k0 * f / this.cons, t.x = this.x0 + g * Math.sin(e - this.long0), t.y = this.y0 - this.con * g * Math.cos(e - this.long0), t) : (Math.abs(this.sinlat0) < N ? (i = 2 * this.a * this.k0 / (1 + h * Math.cos(d)), t.y = i * s) : (i = 2 * this.a * this.k0 * this.ms1 / (this.cosX0 * (1 + this.sinX0 * s + this.cosX0 * h * Math.cos(d))), t.y = i * (this.cosX0 * s - this.sinX0 * h * Math.cos(d)) + this.y0), t.x = i * h * Math.sin(d) + this.x0, t));
}
function ol(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e, r, n, a, i, o = Math.sqrt(t.x * t.x + t.y * t.y);
  if (this.sphere) {
    var s = 2 * Math.atan(o / (2 * this.a * this.k0));
    return e = this.long0, r = this.lat0, o <= N ? (t.x = e, t.y = r, t) : (r = Math.asin(Math.cos(s) * this.sinlat0 + t.y * Math.sin(s) * this.coslat0 / o), Math.abs(this.coslat0) < N ? this.lat0 > 0 ? e = F(this.long0 + Math.atan2(t.x, -1 * t.y), this.over) : e = F(this.long0 + Math.atan2(t.x, t.y), this.over) : e = F(this.long0 + Math.atan2(t.x * Math.sin(s), o * this.coslat0 * Math.cos(s) - t.y * this.sinlat0 * Math.sin(s)), this.over), t.x = e, t.y = r, t);
  } else if (Math.abs(this.coslat0) <= N) {
    if (o <= N)
      return r = this.lat0, e = this.long0, t.x = e, t.y = r, t;
    t.x *= this.con, t.y *= this.con, n = o * this.cons / (2 * this.a * this.k0), r = this.con * lr(this.e, n), e = this.con * F(this.con * this.long0 + Math.atan2(t.x, -1 * t.y), this.over);
  } else
    a = 2 * Math.atan(o * this.cosX0 / (2 * this.a * this.k0 * this.ms1)), e = this.long0, o <= N ? i = this.X0 : (i = Math.asin(Math.cos(a) * this.sinX0 + t.y * Math.sin(a) * this.cosX0 / o), e = F(this.long0 + Math.atan2(t.x * Math.sin(a), o * this.cosX0 * Math.cos(a) - t.y * this.sinX0 * Math.sin(a)), this.over)), r = -1 * lr(this.e, Math.tan(0.5 * (A + i)));
  return t.x = e, t.y = r, t;
}
var hl = ["stere", "Stereographic_South_Pole", "Polar_Stereographic_variant_A", "Polar_Stereographic_variant_B", "Polar_Stereographic"], ll = {
  init: nl,
  forward: sl,
  inverse: ol,
  names: hl,
  ssfn_: Ni
};
function ul() {
  var t = this.lat0;
  this.lambda0 = this.long0;
  var e = Math.sin(t), r = this.a, n = this.rf, a = 1 / n, i = 2 * a - Math.pow(a, 2), o = this.e = Math.sqrt(i);
  this.R = this.k0 * r * Math.sqrt(1 - i) / (1 - i * Math.pow(e, 2)), this.alpha = Math.sqrt(1 + i / (1 - i) * Math.pow(Math.cos(t), 4)), this.b0 = Math.asin(e / this.alpha);
  var s = Math.log(Math.tan(Math.PI / 4 + this.b0 / 2)), h = Math.log(Math.tan(Math.PI / 4 + t / 2)), f = Math.log((1 + o * e) / (1 - o * e));
  this.K = s - this.alpha * h + this.alpha * o / 2 * f;
}
function cl(t) {
  var e = Math.log(Math.tan(Math.PI / 4 - t.y / 2)), r = this.e / 2 * Math.log((1 + this.e * Math.sin(t.y)) / (1 - this.e * Math.sin(t.y))), n = -this.alpha * (e + r) + this.K, a = 2 * (Math.atan(Math.exp(n)) - Math.PI / 4), i = this.alpha * (t.x - this.lambda0), o = Math.atan(Math.sin(i) / (Math.sin(this.b0) * Math.tan(a) + Math.cos(this.b0) * Math.cos(i))), s = Math.asin(Math.cos(this.b0) * Math.sin(a) - Math.sin(this.b0) * Math.cos(a) * Math.cos(i));
  return t.y = this.R / 2 * Math.log((1 + Math.sin(s)) / (1 - Math.sin(s))) + this.y0, t.x = this.R * o + this.x0, t;
}
function fl(t) {
  for (var e = t.x - this.x0, r = t.y - this.y0, n = e / this.R, a = 2 * (Math.atan(Math.exp(r / this.R)) - Math.PI / 4), i = Math.asin(Math.cos(this.b0) * Math.sin(a) + Math.sin(this.b0) * Math.cos(a) * Math.cos(n)), o = Math.atan(Math.sin(n) / (Math.cos(this.b0) * Math.cos(n) - Math.sin(this.b0) * Math.tan(a))), s = this.lambda0 + o / this.alpha, h = 0, f = i, g = -1e3, d = 0; Math.abs(f - g) > 1e-7; ) {
    if (++d > 20)
      return;
    h = 1 / this.alpha * (Math.log(Math.tan(Math.PI / 4 + i / 2)) - this.K) + this.e * Math.log(Math.tan(Math.PI / 4 + Math.asin(this.e * Math.sin(f)) / 2)), g = f, f = 2 * Math.atan(Math.exp(h)) - Math.PI / 2;
  }
  return t.x = s, t.y = f, t;
}
var dl = ["somerc"], gl = {
  init: ul,
  forward: cl,
  inverse: fl,
  names: dl
}, pe = 1e-7;
function _l(t) {
  var e = ["Hotine_Oblique_Mercator", "Hotine_Oblique_Mercator_variant_A", "Hotine_Oblique_Mercator_Azimuth_Natural_Origin"], r = typeof t.projName == "object" ? Object.keys(t.projName)[0] : t.projName;
  return "no_uoff" in t || "no_off" in t || e.indexOf(r) !== -1 || e.indexOf(En(r)) !== -1;
}
function vl() {
  var t, e, r, n, a, i, o, s, h, f, g = 0, d, c = 0, _ = 0, y = 0, M = 0, m = 0, S = 0;
  this.no_off = _l(this), this.no_rot = "no_rot" in this;
  var w = !1;
  "alpha" in this && (w = !0);
  var P = !1;
  if ("rectified_grid_angle" in this && (P = !0), w && (S = this.alpha), P && (g = this.rectified_grid_angle), w || P)
    c = this.longc;
  else if (_ = this.long1, M = this.lat1, y = this.long2, m = this.lat2, Math.abs(M - m) <= pe || (t = Math.abs(M)) <= pe || Math.abs(t - A) <= pe || Math.abs(Math.abs(this.lat0) - A) <= pe || Math.abs(Math.abs(m) - A) <= pe)
    throw new Error();
  var R = 1 - this.es;
  e = Math.sqrt(R), Math.abs(this.lat0) > N ? (s = Math.sin(this.lat0), r = Math.cos(this.lat0), t = 1 - this.es * s * s, this.B = r * r, this.B = Math.sqrt(1 + this.es * this.B * this.B / R), this.A = this.B * this.k0 * e / t, n = this.B * e / (r * Math.sqrt(t)), a = n * n - 1, a <= 0 ? a = 0 : (a = Math.sqrt(a), this.lat0 < 0 && (a = -a)), this.E = a += n, this.E *= Math.pow(Lt(this.e, this.lat0, s), this.B)) : (this.B = 1 / e, this.A = this.k0, this.E = n = a = 1), w || P ? (w ? (d = Math.asin(Math.sin(S) / n), P || (g = S)) : (d = g, S = Math.asin(n * Math.sin(d))), this.lam0 = c - Math.asin(0.5 * (a - 1 / a) * Math.tan(d)) / this.B) : (i = Math.pow(Lt(this.e, M, Math.sin(M)), this.B), o = Math.pow(Lt(this.e, m, Math.sin(m)), this.B), a = this.E / i, h = (o - i) / (o + i), f = this.E * this.E, f = (f - o * i) / (f + o * i), t = _ - y, t < -Math.PI ? y -= or : t > Math.PI && (y += or), this.lam0 = F(0.5 * (_ + y) - Math.atan(f * Math.tan(0.5 * this.B * (_ - y)) / h) / this.B, this.over), d = Math.atan(2 * Math.sin(this.B * F(_ - this.lam0, this.over)) / (a - 1 / a)), g = S = Math.asin(n * Math.sin(d))), this.singam = Math.sin(d), this.cosgam = Math.cos(d), this.sinrot = Math.sin(g), this.cosrot = Math.cos(g), this.rB = 1 / this.B, this.ArB = this.A * this.rB, this.BrA = 1 / this.ArB, this.no_off ? this.u_0 = 0 : (this.u_0 = Math.abs(this.ArB * Math.atan(Math.sqrt(n * n - 1) / Math.cos(S))), this.lat0 < 0 && (this.u_0 = -this.u_0)), a = 0.5 * d, this.v_pole_n = this.ArB * Math.log(Math.tan(X - a)), this.v_pole_s = this.ArB * Math.log(Math.tan(X + a));
}
function yl(t) {
  var e = {}, r, n, a, i, o, s, h, f;
  if (t.x = t.x - this.lam0, Math.abs(Math.abs(t.y) - A) > N) {
    if (o = this.E / Math.pow(Lt(this.e, t.y, Math.sin(t.y)), this.B), s = 1 / o, r = 0.5 * (o - s), n = 0.5 * (o + s), i = Math.sin(this.B * t.x), a = (r * this.singam - i * this.cosgam) / n, Math.abs(Math.abs(a) - 1) < N)
      throw new Error();
    f = 0.5 * this.ArB * Math.log((1 - a) / (1 + a)), s = Math.cos(this.B * t.x), Math.abs(s) < pe ? h = this.A * t.x : h = this.ArB * Math.atan2(r * this.cosgam + i * this.singam, s);
  } else
    f = t.y > 0 ? this.v_pole_n : this.v_pole_s, h = this.ArB * t.y;
  return this.no_rot ? (e.x = h, e.y = f) : (h -= this.u_0, e.x = f * this.cosrot + h * this.sinrot, e.y = h * this.cosrot - f * this.sinrot), e.x = this.a * e.x + this.x0, e.y = this.a * e.y + this.y0, e;
}
function ml(t) {
  var e, r, n, a, i, o, s, h = {};
  if (t.x = (t.x - this.x0) * (1 / this.a), t.y = (t.y - this.y0) * (1 / this.a), this.no_rot ? (r = t.y, e = t.x) : (r = t.x * this.cosrot - t.y * this.sinrot, e = t.y * this.cosrot + t.x * this.sinrot + this.u_0), n = Math.exp(-this.BrA * r), a = 0.5 * (n - 1 / n), i = 0.5 * (n + 1 / n), o = Math.sin(this.BrA * e), s = (o * this.cosgam + a * this.singam) / i, Math.abs(Math.abs(s) - 1) < N)
    h.x = 0, h.y = s < 0 ? -A : A;
  else {
    if (h.y = this.E / Math.sqrt((1 + s) / (1 - s)), h.y = lr(this.e, Math.pow(h.y, 1 / this.B)), h.y === 1 / 0)
      throw new Error();
    h.x = -this.rB * Math.atan2(a * this.cosgam - o * this.singam, Math.cos(this.BrA * e));
  }
  return h.x += this.lam0, h;
}
var Ml = ["Hotine_Oblique_Mercator", "Hotine Oblique Mercator", "Hotine_Oblique_Mercator_variant_A", "Hotine_Oblique_Mercator_Variant_B", "Hotine_Oblique_Mercator_Azimuth_Natural_Origin", "Hotine_Oblique_Mercator_Two_Point_Natural_Origin", "Hotine_Oblique_Mercator_Azimuth_Center", "Oblique_Mercator", "omerc"], pl = {
  init: vl,
  forward: yl,
  inverse: ml,
  names: Ml
};
function wl() {
  if (this.lat2 || (this.lat2 = this.lat1), this.k0 || (this.k0 = 1), this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, !(Math.abs(this.lat1 + this.lat2) < N)) {
    var t = this.b / this.a;
    this.e = Math.sqrt(1 - t * t);
    var e = Math.sin(this.lat1), r = Math.cos(this.lat1), n = Bt(this.e, e, r), a = Lt(this.e, this.lat1, e), i = Math.sin(this.lat2), o = Math.cos(this.lat2), s = Bt(this.e, i, o), h = Lt(this.e, this.lat2, i), f = Math.abs(Math.abs(this.lat0) - A) < N ? 0 : Lt(this.e, this.lat0, Math.sin(this.lat0));
    Math.abs(this.lat1 - this.lat2) > N ? this.ns = Math.log(n / s) / Math.log(a / h) : this.ns = e, isNaN(this.ns) && (this.ns = e), this.f0 = n / (this.ns * Math.pow(a, this.ns)), this.rh = this.a * this.f0 * Math.pow(f, this.ns), this.title || (this.title = "Lambert Conformal Conic");
  }
}
function bl(t) {
  var e = t.x, r = t.y;
  Math.abs(2 * Math.abs(r) - Math.PI) <= N && (r = cr(r) * (A - 2 * N));
  var n = Math.abs(Math.abs(r) - A), a, i;
  if (n > N)
    a = Lt(this.e, r, Math.sin(r)), i = this.a * this.f0 * Math.pow(a, this.ns);
  else {
    if (n = r * this.ns, n <= 0)
      return null;
    i = 0;
  }
  var o = this.ns * F(e - this.long0, this.over);
  return t.x = this.k0 * (i * Math.sin(o)) + this.x0, t.y = this.k0 * (this.rh - i * Math.cos(o)) + this.y0, t;
}
function El(t) {
  var e, r, n, a, i, o = (t.x - this.x0) / this.k0, s = this.rh - (t.y - this.y0) / this.k0;
  this.ns > 0 ? (e = Math.sqrt(o * o + s * s), r = 1) : (e = -Math.sqrt(o * o + s * s), r = -1);
  var h = 0;
  if (e !== 0 && (h = Math.atan2(r * o, r * s)), e !== 0 || this.ns > 0) {
    if (r = 1 / this.ns, n = Math.pow(e / (this.a * this.f0), r), a = lr(this.e, n), a === -9999)
      return null;
  } else
    a = -A;
  return i = F(h / this.ns + this.long0, this.over), t.x = i, t.y = a, t;
}
var Pl = [
  "Lambert Tangential Conformal Conic Projection",
  "Lambert_Conformal_Conic",
  "Lambert_Conformal_Conic_1SP",
  "Lambert_Conformal_Conic_2SP",
  "lcc",
  "Lambert Conic Conformal (1SP)",
  "Lambert Conic Conformal (2SP)"
], Sl = {
  init: wl,
  forward: bl,
  inverse: El,
  names: Pl
};
function xl() {
  this.a = 6377397155e-3, this.es = 0.006674372230614, this.e = Math.sqrt(this.es), this.lat0 || (this.lat0 = 0.863937979737193), this.long0 || (this.long0 = 0.7417649320975901 - 0.308341501185665), this.k0 || (this.k0 = 0.9999), this.s45 = 0.785398163397448, this.s90 = 2 * this.s45, this.fi0 = this.lat0, this.e2 = this.es, this.e = Math.sqrt(this.e2), this.alfa = Math.sqrt(1 + this.e2 * Math.pow(Math.cos(this.fi0), 4) / (1 - this.e2)), this.uq = 1.04216856380474, this.u0 = Math.asin(Math.sin(this.fi0) / this.alfa), this.g = Math.pow((1 + this.e * Math.sin(this.fi0)) / (1 - this.e * Math.sin(this.fi0)), this.alfa * this.e / 2), this.k = Math.tan(this.u0 / 2 + this.s45) / Math.pow(Math.tan(this.fi0 / 2 + this.s45), this.alfa) * this.g, this.k1 = this.k0, this.n0 = this.a * Math.sqrt(1 - this.e2) / (1 - this.e2 * Math.pow(Math.sin(this.fi0), 2)), this.s0 = 1.37008346281555, this.n = Math.sin(this.s0), this.ro0 = this.k1 * this.n0 / Math.tan(this.s0), this.ad = this.s90 - this.uq;
}
function Gl(t) {
  var e, r, n, a, i, o, s, h = t.x, f = t.y, g = F(h - this.long0, this.over);
  return e = Math.pow((1 + this.e * Math.sin(f)) / (1 - this.e * Math.sin(f)), this.alfa * this.e / 2), r = 2 * (Math.atan(this.k * Math.pow(Math.tan(f / 2 + this.s45), this.alfa) / e) - this.s45), n = -g * this.alfa, a = Math.asin(Math.cos(this.ad) * Math.sin(r) + Math.sin(this.ad) * Math.cos(r) * Math.cos(n)), i = Math.asin(Math.cos(r) * Math.sin(n) / Math.cos(a)), o = this.n * i, s = this.ro0 * Math.pow(Math.tan(this.s0 / 2 + this.s45), this.n) / Math.pow(Math.tan(a / 2 + this.s45), this.n), t.y = s * Math.cos(o) / 1, t.x = s * Math.sin(o) / 1, this.czech || (t.y *= -1, t.x *= -1), t;
}
function Al(t) {
  var e, r, n, a, i, o, s, h, f = t.x;
  t.x = t.y, t.y = f, this.czech || (t.y *= -1, t.x *= -1), o = Math.sqrt(t.x * t.x + t.y * t.y), i = Math.atan2(t.y, t.x), a = i / Math.sin(this.s0), n = 2 * (Math.atan(Math.pow(this.ro0 / o, 1 / this.n) * Math.tan(this.s0 / 2 + this.s45)) - this.s45), e = Math.asin(Math.cos(this.ad) * Math.sin(n) - Math.sin(this.ad) * Math.cos(n) * Math.cos(a)), r = Math.asin(Math.cos(n) * Math.sin(a) / Math.cos(e)), t.x = this.long0 - r / this.alfa, s = e, h = 0;
  var g = 0;
  do
    t.y = 2 * (Math.atan(Math.pow(this.k, -1 / this.alfa) * Math.pow(Math.tan(e / 2 + this.s45), 1 / this.alfa) * Math.pow((1 + this.e * Math.sin(s)) / (1 - this.e * Math.sin(s)), this.e / 2)) - this.s45), Math.abs(s - t.y) < 1e-10 && (h = 1), s = t.y, g += 1;
  while (h === 0 && g < 15);
  return g >= 15 ? null : t;
}
var Cl = ["Krovak", "Krovak Modified", "Krovak (North Orientated)", "Krovak Modified (North Orientated)", "krovak"], Tl = {
  init: xl,
  forward: Gl,
  inverse: Al,
  names: Cl
};
function vt(t, e, r, n, a) {
  return t * a - e * Math.sin(2 * a) + r * Math.sin(4 * a) - n * Math.sin(6 * a);
}
function fr(t) {
  return 1 - 0.25 * t * (1 + t / 16 * (3 + 1.25 * t));
}
function dr(t) {
  return 0.375 * t * (1 + 0.25 * t * (1 + 0.46875 * t));
}
function gr(t) {
  return 0.05859375 * t * t * (1 + 0.75 * t);
}
function _r(t) {
  return t * t * t * (35 / 3072);
}
function Li(t, e, r) {
  var n = e * r;
  return t / Math.sqrt(1 - n * n);
}
function te(t) {
  return Math.abs(t) < A ? t : t - cr(t) * Math.PI;
}
function kr(t, e, r, n, a) {
  var i, o;
  i = t / e;
  for (var s = 0; s < 15; s++)
    if (o = (t - (e * i - r * Math.sin(2 * i) + n * Math.sin(4 * i) - a * Math.sin(6 * i))) / (e - 2 * r * Math.cos(2 * i) + 4 * n * Math.cos(4 * i) - 6 * a * Math.cos(6 * i)), i += o, Math.abs(o) <= 1e-10)
      return i;
  return NaN;
}
function Il() {
  this.sphere || (this.e0 = fr(this.es), this.e1 = dr(this.es), this.e2 = gr(this.es), this.e3 = _r(this.es), this.ml0 = this.a * vt(this.e0, this.e1, this.e2, this.e3, this.lat0));
}
function Ol(t) {
  var e, r, n = t.x, a = t.y;
  if (n = F(n - this.long0, this.over), this.sphere)
    e = this.a * Math.asin(Math.cos(a) * Math.sin(n)), r = this.a * (Math.atan2(Math.tan(a), Math.cos(n)) - this.lat0);
  else {
    var i = Math.sin(a), o = Math.cos(a), s = Li(this.a, this.e, i), h = Math.tan(a) * Math.tan(a), f = n * Math.cos(a), g = f * f, d = this.es * o * o / (1 - this.es), c = this.a * vt(this.e0, this.e1, this.e2, this.e3, a);
    e = s * f * (1 - g * h * (1 / 6 - (8 - h + 8 * d) * g / 120)), r = c - this.ml0 + s * i / o * g * (0.5 + (5 - h + 6 * d) * g / 24);
  }
  return t.x = e + this.x0, t.y = r + this.y0, t;
}
function Rl(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e = t.x / this.a, r = t.y / this.a, n, a;
  if (this.sphere) {
    var i = r + this.lat0;
    n = Math.asin(Math.sin(i) * Math.cos(e)), a = Math.atan2(Math.tan(e), Math.cos(i));
  } else {
    var o = this.ml0 / this.a + r, s = kr(o, this.e0, this.e1, this.e2, this.e3);
    if (Math.abs(Math.abs(s) - A) <= N)
      return t.x = this.long0, t.y = A, r < 0 && (t.y *= -1), t;
    var h = Li(this.a, this.e, Math.sin(s)), f = h * h * h / this.a / this.a * (1 - this.es), g = Math.pow(Math.tan(s), 2), d = e * this.a / h, c = d * d;
    n = s - h * Math.tan(s) / f * d * d * (0.5 - (1 + 3 * g) * d * d / 24), a = d * (1 - c * (g / 3 + (1 + 3 * g) * g * c / 15)) / Math.cos(s);
  }
  return t.x = F(a + this.long0, this.over), t.y = te(n), t;
}
var Nl = ["Cassini", "Cassini_Soldner", "cass"], Ll = {
  init: Il,
  forward: Ol,
  inverse: Rl,
  names: Nl
};
function Xt(t, e) {
  var r;
  return t > 1e-7 ? (r = t * e, (1 - t * t) * (e / (1 - r * r) - 0.5 / t * Math.log((1 - r) / (1 + r)))) : 2 * e;
}
var pi = 1, wi = 2, bi = 3, Rr = 4;
function Fl() {
  var t = Math.abs(this.lat0);
  if (Math.abs(t - A) < N ? this.mode = this.lat0 < 0 ? pi : wi : Math.abs(t) < N ? this.mode = bi : this.mode = Rr, this.es > 0) {
    var e;
    switch (this.qp = Xt(this.e, 1), this.mmf = 0.5 / (1 - this.es), this.apa = Hl(this.es), this.mode) {
      case wi:
        this.dd = 1;
        break;
      case pi:
        this.dd = 1;
        break;
      case bi:
        this.rq = Math.sqrt(0.5 * this.qp), this.dd = 1 / this.rq, this.xmf = 1, this.ymf = 0.5 * this.qp;
        break;
      case Rr:
        this.rq = Math.sqrt(0.5 * this.qp), e = Math.sin(this.lat0), this.sinb1 = Xt(this.e, e) / this.qp, this.cosb1 = Math.sqrt(1 - this.sinb1 * this.sinb1), this.dd = Math.cos(this.lat0) / (Math.sqrt(1 - this.es * e * e) * this.rq * this.cosb1), this.ymf = (this.xmf = this.rq) / this.dd, this.xmf *= this.dd;
        break;
    }
  } else
    this.mode === Rr && (this.sinph0 = Math.sin(this.lat0), this.cosph0 = Math.cos(this.lat0));
}
function Dl(t) {
  var e, r, n, a, i, o, s, h, f, g, d = t.x, c = t.y;
  if (d = F(d - this.long0, this.over), this.sphere) {
    if (i = Math.sin(c), g = Math.cos(c), n = Math.cos(d), this.mode === this.OBLIQ || this.mode === this.EQUIT) {
      if (r = this.mode === this.EQUIT ? 1 + g * n : 1 + this.sinph0 * i + this.cosph0 * g * n, r <= N)
        return null;
      r = Math.sqrt(2 / r), e = r * g * Math.sin(d), r *= this.mode === this.EQUIT ? i : this.cosph0 * i - this.sinph0 * g * n;
    } else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
      if (this.mode === this.N_POLE && (n = -n), Math.abs(c + this.lat0) < N)
        return null;
      r = X - c * 0.5, r = 2 * (this.mode === this.S_POLE ? Math.cos(r) : Math.sin(r)), e = r * Math.sin(d), r *= n;
    }
  } else {
    switch (s = 0, h = 0, f = 0, n = Math.cos(d), a = Math.sin(d), i = Math.sin(c), o = Xt(this.e, i), (this.mode === this.OBLIQ || this.mode === this.EQUIT) && (s = o / this.qp, h = Math.sqrt(1 - s * s)), this.mode) {
      case this.OBLIQ:
        f = 1 + this.sinb1 * s + this.cosb1 * h * n;
        break;
      case this.EQUIT:
        f = 1 + h * n;
        break;
      case this.N_POLE:
        f = A + c, o = this.qp - o;
        break;
      case this.S_POLE:
        f = c - A, o = this.qp + o;
        break;
    }
    if (Math.abs(f) < N)
      return null;
    switch (this.mode) {
      case this.OBLIQ:
      case this.EQUIT:
        f = Math.sqrt(2 / f), this.mode === this.OBLIQ ? r = this.ymf * f * (this.cosb1 * s - this.sinb1 * h * n) : r = (f = Math.sqrt(2 / (1 + h * n))) * s * this.ymf, e = this.xmf * f * h * a;
        break;
      case this.N_POLE:
      case this.S_POLE:
        o >= 0 ? (e = (f = Math.sqrt(o)) * a, r = n * (this.mode === this.S_POLE ? f : -f)) : e = r = 0;
        break;
    }
  }
  return t.x = this.a * e + this.x0, t.y = this.a * r + this.y0, t;
}
function Ul(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e = t.x / this.a, r = t.y / this.a, n, a, i, o, s, h, f;
  if (this.sphere) {
    var g = 0, d, c = 0;
    if (d = Math.sqrt(e * e + r * r), a = d * 0.5, a > 1)
      return null;
    switch (a = 2 * Math.asin(a), (this.mode === this.OBLIQ || this.mode === this.EQUIT) && (c = Math.sin(a), g = Math.cos(a)), this.mode) {
      case this.EQUIT:
        a = Math.abs(d) <= N ? 0 : Math.asin(r * c / d), e *= c, r = g * d;
        break;
      case this.OBLIQ:
        a = Math.abs(d) <= N ? this.lat0 : Math.asin(g * this.sinph0 + r * c * this.cosph0 / d), e *= c * this.cosph0, r = (g - Math.sin(a) * this.sinph0) * d;
        break;
      case this.N_POLE:
        r = -r, a = A - a;
        break;
      case this.S_POLE:
        a -= A;
        break;
    }
    n = r === 0 && (this.mode === this.EQUIT || this.mode === this.OBLIQ) ? 0 : Math.atan2(e, r);
  } else {
    if (f = 0, this.mode === this.OBLIQ || this.mode === this.EQUIT) {
      if (e /= this.dd, r *= this.dd, h = Math.sqrt(e * e + r * r), h < N)
        return t.x = this.long0, t.y = this.lat0, t;
      o = 2 * Math.asin(0.5 * h / this.rq), i = Math.cos(o), e *= o = Math.sin(o), this.mode === this.OBLIQ ? (f = i * this.sinb1 + r * o * this.cosb1 / h, s = this.qp * f, r = h * this.cosb1 * i - r * this.sinb1 * o) : (f = r * o / h, s = this.qp * f, r = h * i);
    } else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
      if (this.mode === this.N_POLE && (r = -r), s = e * e + r * r, !s)
        return t.x = this.long0, t.y = this.lat0, t;
      f = 1 - s / this.qp, this.mode === this.S_POLE && (f = -f);
    }
    n = Math.atan2(e, r), a = Wl(Math.asin(f), this.apa);
  }
  return t.x = F(this.long0 + n, this.over), t.y = a, t;
}
var Bl = 0.3333333333333333, jl = 0.17222222222222222, kl = 0.10257936507936508, ql = 0.06388888888888888, $l = 0.0664021164021164, zl = 0.016415012942191543;
function Hl(t) {
  var e, r = [];
  return r[0] = t * Bl, e = t * t, r[0] += e * jl, r[1] = e * ql, e *= t, r[0] += e * kl, r[1] += e * $l, r[2] = e * zl, r;
}
function Wl(t, e) {
  var r = t + t;
  return t + e[0] * Math.sin(r) + e[1] * Math.sin(r + r) + e[2] * Math.sin(r + r + r);
}
var Vl = ["Lambert Azimuthal Equal Area", "Lambert_Azimuthal_Equal_Area", "laea"], Yl = {
  init: Fl,
  forward: Dl,
  inverse: Ul,
  names: Vl,
  S_POLE: pi,
  N_POLE: wi,
  EQUIT: bi,
  OBLIQ: Rr
};
function Zt(t) {
  return Math.abs(t) > 1 && (t = t > 1 ? 1 : -1), Math.asin(t);
}
function Kl() {
  Math.abs(this.lat1 + this.lat2) < N || (this.temp = this.b / this.a, this.es = 1 - Math.pow(this.temp, 2), this.e3 = Math.sqrt(this.es), this.sin_po = Math.sin(this.lat1), this.cos_po = Math.cos(this.lat1), this.t1 = this.sin_po, this.con = this.sin_po, this.ms1 = Bt(this.e3, this.sin_po, this.cos_po), this.qs1 = Xt(this.e3, this.sin_po), this.sin_po = Math.sin(this.lat2), this.cos_po = Math.cos(this.lat2), this.t2 = this.sin_po, this.ms2 = Bt(this.e3, this.sin_po, this.cos_po), this.qs2 = Xt(this.e3, this.sin_po), this.sin_po = Math.sin(this.lat0), this.cos_po = Math.cos(this.lat0), this.t3 = this.sin_po, this.qs0 = Xt(this.e3, this.sin_po), Math.abs(this.lat1 - this.lat2) > N ? this.ns0 = (this.ms1 * this.ms1 - this.ms2 * this.ms2) / (this.qs2 - this.qs1) : this.ns0 = this.con, this.c = this.ms1 * this.ms1 + this.ns0 * this.qs1, this.rh = this.a * Math.sqrt(this.c - this.ns0 * this.qs0) / this.ns0);
}
function Jl(t) {
  var e = t.x, r = t.y;
  this.sin_phi = Math.sin(r), this.cos_phi = Math.cos(r);
  var n = Xt(this.e3, this.sin_phi), a = this.a * Math.sqrt(this.c - this.ns0 * n) / this.ns0, i = this.ns0 * F(e - this.long0, this.over), o = a * Math.sin(i) + this.x0, s = this.rh - a * Math.cos(i) + this.y0;
  return t.x = o, t.y = s, t;
}
function Xl(t) {
  var e, r, n, a, i, o;
  return t.x -= this.x0, t.y = this.rh - t.y + this.y0, this.ns0 >= 0 ? (e = Math.sqrt(t.x * t.x + t.y * t.y), n = 1) : (e = -Math.sqrt(t.x * t.x + t.y * t.y), n = -1), a = 0, e !== 0 && (a = Math.atan2(n * t.x, n * t.y)), n = e * this.ns0 / this.a, this.sphere ? o = Math.asin((this.c - n * n) / (2 * this.ns0)) : (r = (this.c - n * n) / this.ns0, o = this.phi1z(this.e3, r)), i = F(a / this.ns0 + this.long0, this.over), t.x = i, t.y = o, t;
}
function Ql(t, e) {
  var r, n, a, i, o, s = Zt(0.5 * e);
  if (t < N)
    return s;
  for (var h = t * t, f = 1; f <= 25; f++)
    if (r = Math.sin(s), n = Math.cos(s), a = t * r, i = 1 - a * a, o = 0.5 * i * i / n * (e / (1 - h) - r / i + 0.5 / t * Math.log((1 - a) / (1 + a))), s = s + o, Math.abs(o) <= 1e-7)
      return s;
  return null;
}
var Zl = ["Albers_Conic_Equal_Area", "Albers_Equal_Area", "Albers", "aea"], tu = {
  init: Kl,
  forward: Jl,
  inverse: Xl,
  names: Zl,
  phi1z: Ql
};
function eu() {
  this.sin_p14 = Math.sin(this.lat0), this.cos_p14 = Math.cos(this.lat0), this.infinity_dist = 1e3 * this.a, this.rc = 1;
}
function ru(t) {
  var e, r, n, a, i, o, s, h, f = t.x, g = t.y;
  return n = F(f - this.long0, this.over), e = Math.sin(g), r = Math.cos(g), a = Math.cos(n), o = this.sin_p14 * e + this.cos_p14 * r * a, i = 1, o > 0 || Math.abs(o) <= N ? (s = this.x0 + this.a * i * r * Math.sin(n) / o, h = this.y0 + this.a * i * (this.cos_p14 * e - this.sin_p14 * r * a) / o) : (s = this.x0 + this.infinity_dist * r * Math.sin(n), h = this.y0 + this.infinity_dist * (this.cos_p14 * e - this.sin_p14 * r * a)), t.x = s, t.y = h, t;
}
function iu(t) {
  var e, r, n, a, i, o;
  return t.x = (t.x - this.x0) / this.a, t.y = (t.y - this.y0) / this.a, t.x /= this.k0, t.y /= this.k0, (e = Math.sqrt(t.x * t.x + t.y * t.y)) ? (a = Math.atan2(e, this.rc), r = Math.sin(a), n = Math.cos(a), o = Zt(n * this.sin_p14 + t.y * r * this.cos_p14 / e), i = Math.atan2(t.x * r, e * this.cos_p14 * n - t.y * this.sin_p14 * r), i = F(this.long0 + i, this.over)) : (o = this.phic0, i = 0), t.x = i, t.y = o, t;
}
var au = ["gnom"], nu = {
  init: eu,
  forward: ru,
  inverse: iu,
  names: au
};
function su(t, e) {
  var r = 1 - (1 - t * t) / (2 * t) * Math.log((1 - t) / (1 + t));
  if (Math.abs(Math.abs(e) - r) < 1e-6)
    return e < 0 ? -1 * A : A;
  for (var n = Math.asin(0.5 * e), a, i, o, s, h = 0; h < 30; h++)
    if (i = Math.sin(n), o = Math.cos(n), s = t * i, a = Math.pow(1 - s * s, 2) / (2 * o) * (e / (1 - t * t) - i / (1 - s * s) + 0.5 / t * Math.log((1 - s) / (1 + s))), n += a, Math.abs(a) <= 1e-10)
      return n;
  return NaN;
}
function ou() {
  this.sphere || (this.k0 = Bt(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)));
}
function hu(t) {
  var e = t.x, r = t.y, n, a, i = F(e - this.long0, this.over);
  if (this.sphere)
    n = this.x0 + this.a * i * Math.cos(this.lat_ts), a = this.y0 + this.a * Math.sin(r) / Math.cos(this.lat_ts);
  else {
    var o = Xt(this.e, Math.sin(r));
    n = this.x0 + this.a * this.k0 * i, a = this.y0 + this.a * o * 0.5 / this.k0;
  }
  return t.x = n, t.y = a, t;
}
function lu(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e, r;
  return this.sphere ? (e = F(this.long0 + t.x / this.a / Math.cos(this.lat_ts), this.over), r = Math.asin(t.y / this.a * Math.cos(this.lat_ts))) : (r = su(this.e, 2 * t.y * this.k0 / this.a), e = F(this.long0 + t.x / (this.a * this.k0), this.over)), t.x = e, t.y = r, t;
}
var uu = ["cea"], cu = {
  init: ou,
  forward: hu,
  inverse: lu,
  names: uu
};
function fu() {
  this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.lat_ts = this.lat_ts || 0, this.title = this.title || "Equidistant Cylindrical (Plate Carre)", this.rc = Math.cos(this.lat_ts);
}
function du(t) {
  var e = t.x, r = t.y, n = F(e - this.long0, this.over), a = te(r - this.lat0);
  return t.x = this.x0 + this.a * n * this.rc, t.y = this.y0 + this.a * a, t;
}
function gu(t) {
  var e = t.x, r = t.y;
  return t.x = F(this.long0 + (e - this.x0) / (this.a * this.rc), this.over), t.y = te(this.lat0 + (r - this.y0) / this.a), t;
}
var _u = ["Equirectangular", "Equidistant_Cylindrical", "Equidistant_Cylindrical_Spherical", "eqc"], vu = {
  init: fu,
  forward: du,
  inverse: gu,
  names: _u
}, an = 20;
function yu() {
  this.temp = this.b / this.a, this.es = 1 - Math.pow(this.temp, 2), this.e = Math.sqrt(this.es), this.e0 = fr(this.es), this.e1 = dr(this.es), this.e2 = gr(this.es), this.e3 = _r(this.es), this.ml0 = this.a * vt(this.e0, this.e1, this.e2, this.e3, this.lat0);
}
function mu(t) {
  var e = t.x, r = t.y, n, a, i, o = F(e - this.long0, this.over);
  if (i = o * Math.sin(r), this.sphere)
    Math.abs(r) <= N ? (n = this.a * o, a = -1 * this.a * this.lat0) : (n = this.a * Math.sin(i) / Math.tan(r), a = this.a * (te(r - this.lat0) + (1 - Math.cos(i)) / Math.tan(r)));
  else if (Math.abs(r) <= N)
    n = this.a * o, a = -1 * this.ml0;
  else {
    var s = Li(this.a, this.e, Math.sin(r)) / Math.tan(r);
    n = s * Math.sin(i), a = this.a * vt(this.e0, this.e1, this.e2, this.e3, r) - this.ml0 + s * (1 - Math.cos(i));
  }
  return t.x = n + this.x0, t.y = a + this.y0, t;
}
function Mu(t) {
  var e, r, n, a, i, o, s, h, f;
  if (n = t.x - this.x0, a = t.y - this.y0, this.sphere)
    if (Math.abs(a + this.a * this.lat0) <= N)
      e = F(n / this.a + this.long0, this.over), r = 0;
    else {
      o = this.lat0 + a / this.a, s = n * n / this.a / this.a + o * o, h = o;
      var g;
      for (i = an; i; --i)
        if (g = Math.tan(h), f = -1 * (o * (h * g + 1) - h - 0.5 * (h * h + s) * g) / ((h - o) / g - 1), h += f, Math.abs(f) <= N) {
          r = h;
          break;
        }
      e = F(this.long0 + Math.asin(n * Math.tan(h) / this.a) / Math.sin(r), this.over);
    }
  else if (Math.abs(a + this.ml0) <= N)
    r = 0, e = F(this.long0 + n / this.a, this.over);
  else {
    o = (this.ml0 + a) / this.a, s = n * n / this.a / this.a + o * o, h = o;
    var d, c, _, y, M;
    for (i = an; i; --i)
      if (M = this.e * Math.sin(h), d = Math.sqrt(1 - M * M) * Math.tan(h), c = this.a * vt(this.e0, this.e1, this.e2, this.e3, h), _ = this.e0 - 2 * this.e1 * Math.cos(2 * h) + 4 * this.e2 * Math.cos(4 * h) - 6 * this.e3 * Math.cos(6 * h), y = c / this.a, f = (o * (d * y + 1) - y - 0.5 * d * (y * y + s)) / (this.es * Math.sin(2 * h) * (y * y + s - 2 * o * y) / (4 * d) + (o - y) * (d * _ - 2 / Math.sin(2 * h)) - _), h -= f, Math.abs(f) <= N) {
        r = h;
        break;
      }
    d = Math.sqrt(1 - this.es * Math.pow(Math.sin(r), 2)) * Math.tan(r), e = F(this.long0 + Math.asin(n * d / this.a) / Math.sin(r), this.over);
  }
  return t.x = e, t.y = r, t;
}
var pu = ["Polyconic", "American_Polyconic", "poly"], wu = {
  init: yu,
  forward: mu,
  inverse: Mu,
  names: pu
};
function bu() {
  this.A = [], this.A[1] = 0.6399175073, this.A[2] = -0.1358797613, this.A[3] = 0.063294409, this.A[4] = -0.02526853, this.A[5] = 0.0117879, this.A[6] = -55161e-7, this.A[7] = 26906e-7, this.A[8] = -1333e-6, this.A[9] = 67e-5, this.A[10] = -34e-5, this.B_re = [], this.B_im = [], this.B_re[1] = 0.7557853228, this.B_im[1] = 0, this.B_re[2] = 0.249204646, this.B_im[2] = 3371507e-9, this.B_re[3] = -1541739e-9, this.B_im[3] = 0.04105856, this.B_re[4] = -0.10162907, this.B_im[4] = 0.01727609, this.B_re[5] = -0.26623489, this.B_im[5] = -0.36249218, this.B_re[6] = -0.6870983, this.B_im[6] = -1.1651967, this.C_re = [], this.C_im = [], this.C_re[1] = 1.3231270439, this.C_im[1] = 0, this.C_re[2] = -0.577245789, this.C_im[2] = -7809598e-9, this.C_re[3] = 0.508307513, this.C_im[3] = -0.112208952, this.C_re[4] = -0.15094762, this.C_im[4] = 0.18200602, this.C_re[5] = 1.01418179, this.C_im[5] = 1.64497696, this.C_re[6] = 1.9660549, this.C_im[6] = 2.5127645, this.D = [], this.D[1] = 1.5627014243, this.D[2] = 0.5185406398, this.D[3] = -0.03333098, this.D[4] = -0.1052906, this.D[5] = -0.0368594, this.D[6] = 7317e-6, this.D[7] = 0.0122, this.D[8] = 394e-5, this.D[9] = -13e-4;
}
function Eu(t) {
  var e, r = t.x, n = t.y, a = n - this.lat0, i = r - this.long0, o = a / rr * 1e-5, s = i, h = 1, f = 0;
  for (e = 1; e <= 10; e++)
    h = h * o, f = f + this.A[e] * h;
  var g = f, d = s, c = 1, _ = 0, y, M, m = 0, S = 0;
  for (e = 1; e <= 6; e++)
    y = c * g - _ * d, M = _ * g + c * d, c = y, _ = M, m = m + this.B_re[e] * c - this.B_im[e] * _, S = S + this.B_im[e] * c + this.B_re[e] * _;
  return t.x = S * this.a + this.x0, t.y = m * this.a + this.y0, t;
}
function Pu(t) {
  var e, r = t.x, n = t.y, a = r - this.x0, i = n - this.y0, o = i / this.a, s = a / this.a, h = 1, f = 0, g, d, c = 0, _ = 0;
  for (e = 1; e <= 6; e++)
    g = h * o - f * s, d = f * o + h * s, h = g, f = d, c = c + this.C_re[e] * h - this.C_im[e] * f, _ = _ + this.C_im[e] * h + this.C_re[e] * f;
  for (var y = 0; y < this.iterations; y++) {
    var M = c, m = _, S, w, P = o, R = s;
    for (e = 2; e <= 6; e++)
      S = M * c - m * _, w = m * c + M * _, M = S, m = w, P = P + (e - 1) * (this.B_re[e] * M - this.B_im[e] * m), R = R + (e - 1) * (this.B_im[e] * M + this.B_re[e] * m);
    M = 1, m = 0;
    var I = this.B_re[1], k = this.B_im[1];
    for (e = 2; e <= 6; e++)
      S = M * c - m * _, w = m * c + M * _, M = S, m = w, I = I + e * (this.B_re[e] * M - this.B_im[e] * m), k = k + e * (this.B_im[e] * M + this.B_re[e] * m);
    var W = I * I + k * k;
    c = (P * I + R * k) / W, _ = (R * I - P * k) / W;
  }
  var D = c, V = _, ot = 1, it = 0;
  for (e = 1; e <= 9; e++)
    ot = ot * D, it = it + this.D[e] * ot;
  var tt = this.lat0 + it * rr * 1e5, lt = this.long0 + V;
  return t.x = lt, t.y = tt, t;
}
var Su = ["New_Zealand_Map_Grid", "nzmg"], xu = {
  init: bu,
  forward: Eu,
  inverse: Pu,
  names: Su
};
function Gu() {
}
function Au(t) {
  var e = t.x, r = t.y, n = F(e - this.long0, this.over), a = this.x0 + this.a * n, i = this.y0 + this.a * Math.log(Math.tan(Math.PI / 4 + r / 2.5)) * 1.25;
  return t.x = a, t.y = i, t;
}
function Cu(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e = F(this.long0 + t.x / this.a, this.over), r = 2.5 * (Math.atan(Math.exp(0.8 * t.y / this.a)) - Math.PI / 4);
  return t.x = e, t.y = r, t;
}
var Tu = ["Miller_Cylindrical", "mill"], Iu = {
  init: Gu,
  forward: Au,
  inverse: Cu,
  names: Tu
}, Ou = 20;
function Ru() {
  this.sphere ? (this.n = 1, this.m = 0, this.es = 0, this.C_y = Math.sqrt((this.m + 1) / this.n), this.C_x = this.C_y / (this.m + 1)) : this.en = Ci(this.es);
}
function Nu(t) {
  var e, r, n = t.x, a = t.y;
  if (n = F(n - this.long0, this.over), this.sphere) {
    if (!this.m)
      a = this.n !== 1 ? Math.asin(this.n * Math.sin(a)) : a;
    else
      for (var i = this.n * Math.sin(a), o = Ou; o; --o) {
        var s = (this.m * a + Math.sin(a) - i) / (this.m + Math.cos(a));
        if (a -= s, Math.abs(s) < N)
          break;
      }
    e = this.a * this.C_x * n * (this.m + Math.cos(a)), r = this.a * this.C_y * a;
  } else {
    var h = Math.sin(a), f = Math.cos(a);
    r = this.a * Ae(a, h, f, this.en), e = this.a * n * f / Math.sqrt(1 - this.es * h * h);
  }
  return t.x = e, t.y = r, t;
}
function Lu(t) {
  var e, r, n, a;
  return t.x -= this.x0, n = t.x / this.a, t.y -= this.y0, e = t.y / this.a, this.sphere ? (e /= this.C_y, n = n / (this.C_x * (this.m + Math.cos(e))), this.m ? e = Zt((this.m * e + Math.sin(e)) / this.n) : this.n !== 1 && (e = Zt(Math.sin(e) / this.n)), n = F(n + this.long0, this.over), e = te(e)) : (e = Ti(t.y / this.a, this.es, this.en), a = Math.abs(e), a < A ? (a = Math.sin(e), r = this.long0 + t.x * Math.sqrt(1 - this.es * a * a) / (this.a * Math.cos(e)), n = F(r, this.over)) : a - N < A && (n = this.long0)), t.x = n, t.y = e, t;
}
var Fu = ["Sinusoidal", "sinu"], Du = {
  init: Ru,
  forward: Nu,
  inverse: Lu,
  names: Fu
};
function Uu() {
  this.x0 = this.x0 !== void 0 ? this.x0 : 0, this.y0 = this.y0 !== void 0 ? this.y0 : 0, this.long0 = this.long0 !== void 0 ? this.long0 : 0;
}
function Bu(t) {
  for (var e = t.x, r = t.y, n = F(e - this.long0, this.over), a = r, i = Math.PI * Math.sin(r); ; ) {
    var o = -(a + Math.sin(a) - i) / (1 + Math.cos(a));
    if (a += o, Math.abs(o) < N)
      break;
  }
  a /= 2, Math.PI / 2 - Math.abs(r) < N && (n = 0);
  var s = 0.900316316158 * this.a * n * Math.cos(a) + this.x0, h = 1.4142135623731 * this.a * Math.sin(a) + this.y0;
  return t.x = s, t.y = h, t;
}
function ju(t) {
  var e, r;
  t.x -= this.x0, t.y -= this.y0, r = t.y / (1.4142135623731 * this.a), Math.abs(r) > 0.999999999999 && (r = 0.999999999999), e = Math.asin(r);
  var n = F(this.long0 + t.x / (0.900316316158 * this.a * Math.cos(e)), this.over);
  n < -Math.PI && (n = -Math.PI), n > Math.PI && (n = Math.PI), r = (2 * e + Math.sin(2 * e)) / Math.PI, Math.abs(r) > 1 && (r = 1);
  var a = Math.asin(r);
  return t.x = n, t.y = a, t;
}
var ku = ["Mollweide", "moll"], qu = {
  init: Uu,
  forward: Bu,
  inverse: ju,
  names: ku
};
function $u() {
  Math.abs(this.lat1 + this.lat2) < N || (this.lat2 = this.lat2 || this.lat1, this.temp = this.b / this.a, this.es = 1 - Math.pow(this.temp, 2), this.e = Math.sqrt(this.es), this.e0 = fr(this.es), this.e1 = dr(this.es), this.e2 = gr(this.es), this.e3 = _r(this.es), this.sin_phi = Math.sin(this.lat1), this.cos_phi = Math.cos(this.lat1), this.ms1 = Bt(this.e, this.sin_phi, this.cos_phi), this.ml1 = vt(this.e0, this.e1, this.e2, this.e3, this.lat1), Math.abs(this.lat1 - this.lat2) < N ? this.ns = this.sin_phi : (this.sin_phi = Math.sin(this.lat2), this.cos_phi = Math.cos(this.lat2), this.ms2 = Bt(this.e, this.sin_phi, this.cos_phi), this.ml2 = vt(this.e0, this.e1, this.e2, this.e3, this.lat2), this.ns = (this.ms1 - this.ms2) / (this.ml2 - this.ml1)), this.g = this.ml1 + this.ms1 / this.ns, this.ml0 = vt(this.e0, this.e1, this.e2, this.e3, this.lat0), this.rh = this.a * (this.g - this.ml0));
}
function zu(t) {
  var e = t.x, r = t.y, n;
  if (this.sphere)
    n = this.a * (this.g - r);
  else {
    var a = vt(this.e0, this.e1, this.e2, this.e3, r);
    n = this.a * (this.g - a);
  }
  var i = this.ns * F(e - this.long0, this.over), o = this.x0 + n * Math.sin(i), s = this.y0 + this.rh - n * Math.cos(i);
  return t.x = o, t.y = s, t;
}
function Hu(t) {
  t.x -= this.x0, t.y = this.rh - t.y + this.y0;
  var e, r, n, a;
  this.ns >= 0 ? (r = Math.sqrt(t.x * t.x + t.y * t.y), e = 1) : (r = -Math.sqrt(t.x * t.x + t.y * t.y), e = -1);
  var i = 0;
  if (r !== 0 && (i = Math.atan2(e * t.x, e * t.y)), this.sphere)
    return a = F(this.long0 + i / this.ns, this.over), n = te(this.g - r / this.a), t.x = a, t.y = n, t;
  var o = this.g - r / this.a;
  return n = kr(o, this.e0, this.e1, this.e2, this.e3), a = F(this.long0 + i / this.ns, this.over), t.x = a, t.y = n, t;
}
var Wu = ["Equidistant_Conic", "eqdc"], Vu = {
  init: $u,
  forward: zu,
  inverse: Hu,
  names: Wu
};
function Yu() {
  this.R = this.a;
}
function Ku(t) {
  var e = t.x, r = t.y, n = F(e - this.long0, this.over), a, i;
  Math.abs(r) <= N && (a = this.x0 + this.R * n, i = this.y0);
  var o = Zt(2 * Math.abs(r / Math.PI));
  (Math.abs(n) <= N || Math.abs(Math.abs(r) - A) <= N) && (a = this.x0, r >= 0 ? i = this.y0 + Math.PI * this.R * Math.tan(0.5 * o) : i = this.y0 + Math.PI * this.R * -Math.tan(0.5 * o));
  var s = 0.5 * Math.abs(Math.PI / n - n / Math.PI), h = s * s, f = Math.sin(o), g = Math.cos(o), d = g / (f + g - 1), c = d * d, _ = d * (2 / f - 1), y = _ * _, M = Math.PI * this.R * (s * (d - y) + Math.sqrt(h * (d - y) * (d - y) - (y + h) * (c - y))) / (y + h);
  n < 0 && (M = -M), a = this.x0 + M;
  var m = h + d;
  return M = Math.PI * this.R * (_ * m - s * Math.sqrt((y + h) * (h + 1) - m * m)) / (y + h), r >= 0 ? i = this.y0 + M : i = this.y0 - M, t.x = a, t.y = i, t;
}
function Ju(t) {
  var e, r, n, a, i, o, s, h, f, g, d, c, _;
  return t.x -= this.x0, t.y -= this.y0, d = Math.PI * this.R, n = t.x / d, a = t.y / d, i = n * n + a * a, o = -Math.abs(a) * (1 + i), s = o - 2 * a * a + n * n, h = -2 * o + 1 + 2 * a * a + i * i, _ = a * a / h + (2 * s * s * s / h / h / h - 9 * o * s / h / h) / 27, f = (o - s * s / 3 / h) / h, g = 2 * Math.sqrt(-f / 3), d = 3 * _ / f / g, Math.abs(d) > 1 && (d >= 0 ? d = 1 : d = -1), c = Math.acos(d) / 3, t.y >= 0 ? r = (-g * Math.cos(c + Math.PI / 3) - s / 3 / h) * Math.PI : r = -(-g * Math.cos(c + Math.PI / 3) - s / 3 / h) * Math.PI, Math.abs(n) < N ? e = this.long0 : e = F(this.long0 + Math.PI * (i - 1 + Math.sqrt(1 + 2 * (n * n - a * a) + i * i)) / 2 / n, this.over), t.x = e, t.y = r, t;
}
var Xu = ["Van_der_Grinten_I", "VanDerGrinten", "Van_der_Grinten", "vandg"], Qu = {
  init: Yu,
  forward: Ku,
  inverse: Ju,
  names: Xu
};
function Zu(t, e, r, n, a, i) {
  const o = n - e, s = Math.atan((1 - i) * Math.tan(t)), h = Math.atan((1 - i) * Math.tan(r)), f = Math.sin(s), g = Math.cos(s), d = Math.sin(h), c = Math.cos(h);
  let _ = o, y, M = 100, m, S, w, P, R, I, k, W, D, V, ot, it, tt, lt;
  do {
    if (m = Math.sin(_), S = Math.cos(_), w = Math.sqrt(
      c * m * (c * m) + (g * d - f * c * S) * (g * d - f * c * S)
    ), w === 0)
      return { azi1: 0, s12: 0 };
    P = f * d + g * c * S, R = Math.atan2(w, P), I = g * c * m / w, k = 1 - I * I, W = k !== 0 ? P - 2 * f * d / k : 0, D = i / 16 * k * (4 + i * (4 - 3 * k)), y = _, _ = o + (1 - D) * i * I * (R + D * w * (W + D * P * (-1 + 2 * W * W)));
  } while (Math.abs(_ - y) > 1e-12 && --M > 0);
  return M === 0 ? { azi1: NaN, s12: NaN } : (V = k * (a * a - a * (1 - i) * (a * (1 - i))) / (a * (1 - i) * (a * (1 - i))), ot = 1 + V / 16384 * (4096 + V * (-768 + V * (320 - 175 * V))), it = V / 1024 * (256 + V * (-128 + V * (74 - 47 * V))), tt = it * w * (W + it / 4 * (P * (-1 + 2 * W * W) - it / 6 * W * (-3 + 4 * w * w) * (-3 + 4 * W * W))), lt = a * (1 - i) * ot * (R - tt), { azi1: Math.atan2(c * m, g * d - f * c * S), s12: lt });
}
function tc(t, e, r, n, a, i) {
  const o = Math.atan((1 - i) * Math.tan(t)), s = Math.sin(o), h = Math.cos(o), f = Math.sin(r), g = Math.cos(r), d = Math.atan2(s, h * g), c = h * f, _ = 1 - c * c, y = _ * (a * a - a * (1 - i) * (a * (1 - i))) / (a * (1 - i) * (a * (1 - i))), M = 1 + y / 16384 * (4096 + y * (-768 + y * (320 - 175 * y))), m = y / 1024 * (256 + y * (-128 + y * (74 - 47 * y)));
  let S = n / (a * (1 - i) * M), w, P = 100, R, I, k, W;
  do
    R = Math.cos(2 * d + S), I = Math.sin(S), k = Math.cos(S), W = m * I * (R + m / 4 * (k * (-1 + 2 * R * R) - m / 6 * R * (-3 + 4 * I * I) * (-3 + 4 * R * R))), w = S, S = n / (a * (1 - i) * M) + W;
  while (Math.abs(S - w) > 1e-12 && --P > 0);
  if (P === 0)
    return { lat2: NaN, lon2: NaN };
  const D = s * I - h * k * g, V = Math.atan2(
    s * k + h * I * g,
    (1 - i) * Math.sqrt(c * c + D * D)
  ), ot = Math.atan2(
    I * f,
    h * k - s * I * g
  ), it = i / 16 * _ * (4 + i * (4 - 3 * _)), tt = ot - (1 - it) * i * c * (S + it * I * (R + it * k * (-1 + 2 * R * R))), lt = e + tt;
  return { lat2: V, lon2: lt };
}
function ec() {
  this.sin_p12 = Math.sin(this.lat0), this.cos_p12 = Math.cos(this.lat0), this.f = this.es / (1 + Math.sqrt(1 - this.es));
}
function rc(t) {
  var e = t.x, r = t.y, n = Math.sin(t.y), a = Math.cos(t.y), i = F(e - this.long0, this.over), o, s, h, f, g, d, c, _, y, M, m;
  return this.sphere ? Math.abs(this.sin_p12 - 1) <= N ? (t.x = this.x0 + this.a * (A - r) * Math.sin(i), t.y = this.y0 - this.a * (A - r) * Math.cos(i), t) : Math.abs(this.sin_p12 + 1) <= N ? (t.x = this.x0 + this.a * (A + r) * Math.sin(i), t.y = this.y0 + this.a * (A + r) * Math.cos(i), t) : (y = this.sin_p12 * n + this.cos_p12 * a * Math.cos(i), c = Math.acos(y), _ = c ? c / Math.sin(c) : 1, t.x = this.x0 + this.a * _ * a * Math.sin(i), t.y = this.y0 + this.a * _ * (this.cos_p12 * n - this.sin_p12 * a * Math.cos(i)), t) : (o = fr(this.es), s = dr(this.es), h = gr(this.es), f = _r(this.es), Math.abs(this.sin_p12 - 1) <= N ? (g = this.a * vt(o, s, h, f, A), d = this.a * vt(o, s, h, f, r), t.x = this.x0 + (g - d) * Math.sin(i), t.y = this.y0 - (g - d) * Math.cos(i), t) : Math.abs(this.sin_p12 + 1) <= N ? (g = this.a * vt(o, s, h, f, A), d = this.a * vt(o, s, h, f, r), t.x = this.x0 + (g + d) * Math.sin(i), t.y = this.y0 + (g + d) * Math.cos(i), t) : Math.abs(e) < N && Math.abs(r - this.lat0) < N ? (t.x = t.y = 0, t) : (M = Zu(this.lat0, this.long0, r, e, this.a, this.f), m = M.azi1, t.x = M.s12 * Math.sin(m), t.y = M.s12 * Math.cos(m), t));
}
function ic(t) {
  t.x -= this.x0, t.y -= this.y0;
  var e, r, n, a, i, o, s, h, f, g, d, c, _, y, M, m;
  return this.sphere ? (e = Math.sqrt(t.x * t.x + t.y * t.y), e > 2 * A * this.a ? void 0 : (r = e / this.a, n = Math.sin(r), a = Math.cos(r), i = this.long0, Math.abs(e) <= N ? o = this.lat0 : (o = Zt(a * this.sin_p12 + t.y * n * this.cos_p12 / e), s = Math.abs(this.lat0) - A, Math.abs(s) <= N ? this.lat0 >= 0 ? i = F(this.long0 + Math.atan2(t.x, -t.y), this.over) : i = F(this.long0 - Math.atan2(-t.x, t.y), this.over) : i = F(this.long0 + Math.atan2(t.x * n, e * this.cos_p12 * a - t.y * this.sin_p12 * n), this.over)), t.x = i, t.y = o, t)) : (h = fr(this.es), f = dr(this.es), g = gr(this.es), d = _r(this.es), Math.abs(this.sin_p12 - 1) <= N ? (c = this.a * vt(h, f, g, d, A), e = Math.sqrt(t.x * t.x + t.y * t.y), _ = c - e, o = kr(_ / this.a, h, f, g, d), i = F(this.long0 + Math.atan2(t.x, -1 * t.y), this.over), t.x = i, t.y = o, t) : Math.abs(this.sin_p12 + 1) <= N ? (c = this.a * vt(h, f, g, d, A), e = Math.sqrt(t.x * t.x + t.y * t.y), _ = e - c, o = kr(_ / this.a, h, f, g, d), i = F(this.long0 + Math.atan2(t.x, t.y), this.over), t.x = i, t.y = o, t) : (y = Math.atan2(t.x, t.y), M = Math.sqrt(t.x * t.x + t.y * t.y), m = tc(this.lat0, this.long0, y, M, this.a, this.f), t.x = m.lon2, t.y = m.lat2, t));
}
var ac = ["Azimuthal_Equidistant", "aeqd"], nc = {
  init: ec,
  forward: rc,
  inverse: ic,
  names: ac
};
function sc() {
  this.sin_p14 = Math.sin(this.lat0 || 0), this.cos_p14 = Math.cos(this.lat0 || 0);
}
function oc(t) {
  var e, r, n, a, i, o, s, h, f = t.x, g = t.y;
  return n = F(f - (this.long0 || 0), this.over), e = Math.sin(g), r = Math.cos(g), a = Math.cos(n), o = this.sin_p14 * e + this.cos_p14 * r * a, i = 1, (o > 0 || Math.abs(o) <= N) && (s = this.a * i * r * Math.sin(n), h = (this.y0 || 0) + this.a * i * (this.cos_p14 * e - this.sin_p14 * r * a)), t.x = s, t.y = h, t;
}
function hc(t) {
  var e, r, n, a, i, o, s, h, f;
  return t.x -= this.x0 || 0, t.y -= this.y0 || 0, e = Math.sqrt(t.x * t.x + t.y * t.y), r = Zt(e / this.a), n = Math.sin(r), a = Math.cos(r), h = this.long0 || 0, f = this.lat0 || 0, o = h, Math.abs(e) <= N ? (s = f, t.x = o, t.y = s, t) : (s = Zt(a * this.sin_p14 + t.y * n * this.cos_p14 / e), i = Math.abs(f) - A, Math.abs(i) <= N ? (f >= 0 ? o = F(h + Math.atan2(t.x, -t.y), this.over) : o = F(h - Math.atan2(-t.x, t.y), this.over), t.x = o, t.y = s, t) : (o = F(h + Math.atan2(t.x * n, e * this.cos_p14 * a - t.y * this.sin_p14 * n), this.over), t.x = o, t.y = s, t));
}
var lc = ["ortho"], uc = {
  init: sc,
  forward: oc,
  inverse: hc,
  names: lc
}, et = {
  FRONT: 1,
  RIGHT: 2,
  BACK: 3,
  LEFT: 4,
  TOP: 5,
  BOTTOM: 6
}, Q = {
  AREA_0: 1,
  AREA_1: 2,
  AREA_2: 3,
  AREA_3: 4
};
function cc() {
  this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.lat_ts = this.lat_ts || 0, this.title = this.title || "Quadrilateralized Spherical Cube", this.lat0 >= A - X / 2 ? this.face = et.TOP : this.lat0 <= -(A - X / 2) ? this.face = et.BOTTOM : Math.abs(this.long0) <= X ? this.face = et.FRONT : Math.abs(this.long0) <= A + X ? this.face = this.long0 > 0 ? et.RIGHT : et.LEFT : this.face = et.BACK, this.es !== 0 && (this.one_minus_f = 1 - (this.a - this.b) / this.a, this.one_minus_f_squared = this.one_minus_f * this.one_minus_f);
}
function fc(t) {
  var e = { x: 0, y: 0 }, r, n, a, i, o, s, h = { value: 0 };
  if (t.x -= this.long0, this.es !== 0 ? r = Math.atan(this.one_minus_f_squared * Math.tan(t.y)) : r = t.y, n = t.x, this.face === et.TOP)
    i = A - r, n >= X && n <= A + X ? (h.value = Q.AREA_0, a = n - A) : n > A + X || n <= -(A + X) ? (h.value = Q.AREA_1, a = n > 0 ? n - nt : n + nt) : n > -(A + X) && n <= -X ? (h.value = Q.AREA_2, a = n + A) : (h.value = Q.AREA_3, a = n);
  else if (this.face === et.BOTTOM)
    i = A + r, n >= X && n <= A + X ? (h.value = Q.AREA_0, a = -n + A) : n < X && n >= -X ? (h.value = Q.AREA_1, a = -n) : n < -X && n >= -(A + X) ? (h.value = Q.AREA_2, a = -n - A) : (h.value = Q.AREA_3, a = n > 0 ? -n + nt : -n - nt);
  else {
    var f, g, d, c, _, y, M;
    this.face === et.RIGHT ? n = xe(n, +A) : this.face === et.BACK ? n = xe(n, +nt) : this.face === et.LEFT && (n = xe(n, -A)), c = Math.sin(r), _ = Math.cos(r), y = Math.sin(n), M = Math.cos(n), f = _ * M, g = _ * y, d = c, this.face === et.FRONT ? (i = Math.acos(f), a = Cr(i, d, g, h)) : this.face === et.RIGHT ? (i = Math.acos(g), a = Cr(i, d, -f, h)) : this.face === et.BACK ? (i = Math.acos(-f), a = Cr(i, d, -g, h)) : this.face === et.LEFT ? (i = Math.acos(-g), a = Cr(i, d, f, h)) : (i = a = 0, h.value = Q.AREA_0);
  }
  return s = Math.atan(12 / nt * (a + Math.acos(Math.sin(a) * Math.cos(X)) - A)), o = Math.sqrt((1 - Math.cos(i)) / (Math.cos(s) * Math.cos(s)) / (1 - Math.cos(Math.atan(1 / Math.cos(a))))), h.value === Q.AREA_1 ? s += A : h.value === Q.AREA_2 ? s += nt : h.value === Q.AREA_3 && (s += 1.5 * nt), e.x = o * Math.cos(s), e.y = o * Math.sin(s), e.x = e.x * this.a + this.x0, e.y = e.y * this.a + this.y0, t.x = e.x, t.y = e.y, t;
}
function dc(t) {
  var e = { lam: 0, phi: 0 }, r, n, a, i, o, s, h, f, g, d = { value: 0 };
  if (t.x = (t.x - this.x0) / this.a, t.y = (t.y - this.y0) / this.a, n = Math.atan(Math.sqrt(t.x * t.x + t.y * t.y)), r = Math.atan2(t.y, t.x), t.x >= 0 && t.x >= Math.abs(t.y) ? d.value = Q.AREA_0 : t.y >= 0 && t.y >= Math.abs(t.x) ? (d.value = Q.AREA_1, r -= A) : t.x < 0 && -t.x >= Math.abs(t.y) ? (d.value = Q.AREA_2, r = r < 0 ? r + nt : r - nt) : (d.value = Q.AREA_3, r += A), g = nt / 12 * Math.tan(r), o = Math.sin(g) / (Math.cos(g) - 1 / Math.sqrt(2)), s = Math.atan(o), a = Math.cos(r), i = Math.tan(n), h = 1 - a * a * i * i * (1 - Math.cos(Math.atan(1 / Math.cos(s)))), h < -1 ? h = -1 : h > 1 && (h = 1), this.face === et.TOP)
    f = Math.acos(h), e.phi = A - f, d.value === Q.AREA_0 ? e.lam = s + A : d.value === Q.AREA_1 ? e.lam = s < 0 ? s + nt : s - nt : d.value === Q.AREA_2 ? e.lam = s - A : e.lam = s;
  else if (this.face === et.BOTTOM)
    f = Math.acos(h), e.phi = f - A, d.value === Q.AREA_0 ? e.lam = -s + A : d.value === Q.AREA_1 ? e.lam = -s : d.value === Q.AREA_2 ? e.lam = -s - A : e.lam = s < 0 ? -s - nt : -s + nt;
  else {
    var c, _, y;
    c = h, g = c * c, g >= 1 ? y = 0 : y = Math.sqrt(1 - g) * Math.sin(s), g += y * y, g >= 1 ? _ = 0 : _ = Math.sqrt(1 - g), d.value === Q.AREA_1 ? (g = _, _ = -y, y = g) : d.value === Q.AREA_2 ? (_ = -_, y = -y) : d.value === Q.AREA_3 && (g = _, _ = y, y = -g), this.face === et.RIGHT ? (g = c, c = -_, _ = g) : this.face === et.BACK ? (c = -c, _ = -_) : this.face === et.LEFT && (g = c, c = _, _ = -g), e.phi = Math.acos(-y) - A, e.lam = Math.atan2(_, c), this.face === et.RIGHT ? e.lam = xe(e.lam, -A) : this.face === et.BACK ? e.lam = xe(e.lam, -nt) : this.face === et.LEFT && (e.lam = xe(e.lam, +A));
  }
  if (this.es !== 0) {
    var M, m, S;
    M = e.phi < 0 ? 1 : 0, m = Math.tan(e.phi), S = this.b / Math.sqrt(m * m + this.one_minus_f_squared), e.phi = Math.atan(Math.sqrt(this.a * this.a - S * S) / (this.one_minus_f * S)), M && (e.phi = -e.phi);
  }
  return e.lam += this.long0, t.x = e.lam, t.y = e.phi, t;
}
function Cr(t, e, r, n) {
  var a;
  return t < N ? (n.value = Q.AREA_0, a = 0) : (a = Math.atan2(e, r), Math.abs(a) <= X ? n.value = Q.AREA_0 : a > X && a <= A + X ? (n.value = Q.AREA_1, a -= A) : a > A + X || a <= -(A + X) ? (n.value = Q.AREA_2, a = a >= 0 ? a - nt : a + nt) : (n.value = Q.AREA_3, a += A)), a;
}
function xe(t, e) {
  var r = t + e;
  return r < -nt ? r += or : r > +nt && (r -= or), r;
}
var gc = ["Quadrilateralized Spherical Cube", "Quadrilateralized_Spherical_Cube", "qsc"], _c = {
  init: cc,
  forward: fc,
  inverse: dc,
  names: gc
}, Ei = [
  [1, 22199e-21, -715515e-10, 31103e-10],
  [0.9986, -482243e-9, -24897e-9, -13309e-10],
  [0.9954, -83103e-8, -448605e-10, -986701e-12],
  [0.99, -135364e-8, -59661e-9, 36777e-10],
  [0.9822, -167442e-8, -449547e-11, -572411e-11],
  [0.973, -214868e-8, -903571e-10, 18736e-12],
  [0.96, -305085e-8, -900761e-10, 164917e-11],
  [0.9427, -382792e-8, -653386e-10, -26154e-10],
  [0.9216, -467746e-8, -10457e-8, 481243e-11],
  [0.8962, -536223e-8, -323831e-10, -543432e-11],
  [0.8679, -609363e-8, -113898e-9, 332484e-11],
  [0.835, -698325e-8, -640253e-10, 934959e-12],
  [0.7986, -755338e-8, -500009e-10, 935324e-12],
  [0.7597, -798324e-8, -35971e-9, -227626e-11],
  [0.7186, -851367e-8, -701149e-10, -86303e-10],
  [0.6732, -986209e-8, -199569e-9, 191974e-10],
  [0.6213, -0.010418, 883923e-10, 624051e-11],
  [0.5722, -906601e-8, 182e-6, 624051e-11],
  [0.5322, -677797e-8, 275608e-9, 624051e-11]
], tr = [
  [-520417e-23, 0.0124, 121431e-23, -845284e-16],
  [0.062, 0.0124, -126793e-14, 422642e-15],
  [0.124, 0.0124, 507171e-14, -160604e-14],
  [0.186, 0.0123999, -190189e-13, 600152e-14],
  [0.248, 0.0124002, 710039e-13, -224e-10],
  [0.31, 0.0123992, -264997e-12, 835986e-13],
  [0.372, 0.0124029, 988983e-12, -311994e-12],
  [0.434, 0.0123893, -369093e-11, -435621e-12],
  [0.4958, 0.0123198, -102252e-10, -345523e-12],
  [0.5571, 0.0121916, -154081e-10, -582288e-12],
  [0.6176, 0.0119938, -241424e-10, -525327e-12],
  [0.6769, 0.011713, -320223e-10, -516405e-12],
  [0.7346, 0.0113541, -397684e-10, -609052e-12],
  [0.7903, 0.0109107, -489042e-10, -104739e-11],
  [0.8435, 0.0103431, -64615e-9, -140374e-14],
  [0.8936, 969686e-8, -64636e-9, -8547e-9],
  [0.9394, 840947e-8, -192841e-9, -42106e-10],
  [0.9761, 616527e-8, -256e-6, -42106e-10],
  [1, 328947e-8, -319159e-9, -42106e-10]
], Fn = 0.8487, Dn = 1.3523, Un = wt / 5, vc = 1 / Un, Pe = 18, qr = function(t, e) {
  return t[0] + e * (t[1] + e * (t[2] + e * t[3]));
}, yc = function(t, e) {
  return t[1] + e * (2 * t[2] + e * 3 * t[3]);
};
function mc(t, e, r, n) {
  for (var a = e; n; --n) {
    var i = t(a);
    if (a -= i, Math.abs(i) < r)
      break;
  }
  return a;
}
function Mc() {
  this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.long0 = this.long0 || 0, this.es = 0, this.title = this.title || "Robinson";
}
function pc(t) {
  var e = F(t.x - this.long0, this.over), r = Math.abs(t.y), n = Math.floor(r * Un);
  n < 0 ? n = 0 : n >= Pe && (n = Pe - 1), r = wt * (r - vc * n);
  var a = {
    x: qr(Ei[n], r) * e,
    y: qr(tr[n], r)
  };
  return t.y < 0 && (a.y = -a.y), a.x = a.x * this.a * Fn + this.x0, a.y = a.y * this.a * Dn + this.y0, a;
}
function wc(t) {
  var e = {
    x: (t.x - this.x0) / (this.a * Fn),
    y: Math.abs(t.y - this.y0) / (this.a * Dn)
  };
  if (e.y >= 1)
    e.x /= Ei[Pe][0], e.y = t.y < 0 ? -A : A;
  else {
    var r = Math.floor(e.y * Pe);
    for (r < 0 ? r = 0 : r >= Pe && (r = Pe - 1); ; )
      if (tr[r][0] > e.y)
        --r;
      else if (tr[r + 1][0] <= e.y)
        ++r;
      else
        break;
    var n = tr[r], a = 5 * (e.y - n[0]) / (tr[r + 1][0] - n[0]);
    a = mc(function(i) {
      return (qr(n, i) - e.y) / yc(n, i);
    }, a, N, 100), e.x /= qr(Ei[r], a), e.y = (5 * r + a) * rt, t.y < 0 && (e.y = -e.y);
  }
  return e.x = F(e.x + this.long0, this.over), e;
}
var bc = ["Robinson", "robin"], Ec = {
  init: Mc,
  forward: pc,
  inverse: wc,
  names: bc
};
function Pc() {
  this.name = "geocent";
}
function Sc(t) {
  var e = Sn(t, this.es, this.a);
  return e;
}
function xc(t) {
  var e = xn(t, this.es, this.a, this.b);
  return e;
}
var Gc = ["Geocentric", "geocentric", "geocent", "Geocent"], Ac = {
  init: Pc,
  forward: Sc,
  inverse: xc,
  names: Gc
}, _t = {
  N_POLE: 0,
  S_POLE: 1,
  EQUIT: 2,
  OBLIQ: 3
}, Xe = {
  h: { def: 1e5, num: !0 },
  // default is Karman line, no default in PROJ.7
  azi: { def: 0, num: !0, degrees: !0 },
  // default is North
  tilt: { def: 0, num: !0, degrees: !0 },
  // default is Nadir
  long0: { def: 0, num: !0 },
  // default is Greenwich, conversion to rad is automatic
  lat0: { def: 0, num: !0 }
  // default is Equator, conversion to rad is automatic
};
function Cc() {
  if (Object.keys(Xe).forEach((function(r) {
    if (typeof this[r] > "u")
      this[r] = Xe[r].def;
    else {
      if (Xe[r].num && isNaN(this[r]))
        throw new Error("Invalid parameter value, must be numeric " + r + " = " + this[r]);
      Xe[r].num && (this[r] = parseFloat(this[r]));
    }
    Xe[r].degrees && (this[r] = this[r] * rt);
  }).bind(this)), Math.abs(Math.abs(this.lat0) - A) < N ? this.mode = this.lat0 < 0 ? _t.S_POLE : _t.N_POLE : Math.abs(this.lat0) < N ? this.mode = _t.EQUIT : (this.mode = _t.OBLIQ, this.sinph0 = Math.sin(this.lat0), this.cosph0 = Math.cos(this.lat0)), this.pn1 = this.h / this.a, this.pn1 <= 0 || this.pn1 > 1e10)
    throw new Error("Invalid height");
  this.p = 1 + this.pn1, this.rp = 1 / this.p, this.h1 = 1 / this.pn1, this.pfact = (this.p + 1) * this.h1, this.es = 0;
  var t = this.tilt, e = this.azi;
  this.cg = Math.cos(e), this.sg = Math.sin(e), this.cw = Math.cos(t), this.sw = Math.sin(t);
}
function Tc(t) {
  t.x -= this.long0;
  var e = Math.sin(t.y), r = Math.cos(t.y), n = Math.cos(t.x), a, i;
  switch (this.mode) {
    case _t.OBLIQ:
      i = this.sinph0 * e + this.cosph0 * r * n;
      break;
    case _t.EQUIT:
      i = r * n;
      break;
    case _t.S_POLE:
      i = -e;
      break;
    case _t.N_POLE:
      i = e;
      break;
  }
  switch (i = this.pn1 / (this.p - i), a = i * r * Math.sin(t.x), this.mode) {
    case _t.OBLIQ:
      i *= this.cosph0 * e - this.sinph0 * r * n;
      break;
    case _t.EQUIT:
      i *= e;
      break;
    case _t.N_POLE:
      i *= -(r * n);
      break;
    case _t.S_POLE:
      i *= r * n;
      break;
  }
  var o, s;
  return o = i * this.cg + a * this.sg, s = 1 / (o * this.sw * this.h1 + this.cw), a = (a * this.cg - i * this.sg) * this.cw * s, i = o * s, t.x = a * this.a, t.y = i * this.a, t;
}
function Ic(t) {
  t.x /= this.a, t.y /= this.a;
  var e = { x: t.x, y: t.y }, r, n, a;
  a = 1 / (this.pn1 - t.y * this.sw), r = this.pn1 * t.x * a, n = this.pn1 * t.y * this.cw * a, t.x = r * this.cg + n * this.sg, t.y = n * this.cg - r * this.sg;
  var i = pt(t.x, t.y);
  if (Math.abs(i) < N)
    e.x = 0, e.y = t.y;
  else {
    var o, s;
    switch (s = 1 - i * i * this.pfact, s = (this.p - Math.sqrt(s)) / (this.pn1 / i + i / this.pn1), o = Math.sqrt(1 - s * s), this.mode) {
      case _t.OBLIQ:
        e.y = Math.asin(o * this.sinph0 + t.y * s * this.cosph0 / i), t.y = (o - this.sinph0 * Math.sin(e.y)) * i, t.x *= s * this.cosph0;
        break;
      case _t.EQUIT:
        e.y = Math.asin(t.y * s / i), t.y = o * i, t.x *= s;
        break;
      case _t.N_POLE:
        e.y = Math.asin(o), t.y = -t.y;
        break;
      case _t.S_POLE:
        e.y = -Math.asin(o);
        break;
    }
    e.x = Math.atan2(t.x, t.y);
  }
  return t.x = e.x + this.long0, t.y = e.y, t;
}
var Oc = ["Tilted_Perspective", "tpers"], Rc = {
  init: Cc,
  forward: Tc,
  inverse: Ic,
  names: Oc
};
function Nc() {
  if (this.flip_axis = this.sweep === "x" ? 1 : 0, this.h = Number(this.h), this.radius_g_1 = this.h / this.a, this.radius_g_1 <= 0 || this.radius_g_1 > 1e10)
    throw new Error();
  if (this.radius_g = 1 + this.radius_g_1, this.C = this.radius_g * this.radius_g - 1, this.es !== 0) {
    var t = 1 - this.es, e = 1 / t;
    this.radius_p = Math.sqrt(t), this.radius_p2 = t, this.radius_p_inv2 = e, this.shape = "ellipse";
  } else
    this.radius_p = 1, this.radius_p2 = 1, this.radius_p_inv2 = 1, this.shape = "sphere";
  this.title || (this.title = "Geostationary Satellite View");
}
function Lc(t) {
  var e = t.x, r = t.y, n, a, i, o;
  if (e = e - this.long0, this.shape === "ellipse") {
    r = Math.atan(this.radius_p2 * Math.tan(r));
    var s = this.radius_p / pt(this.radius_p * Math.cos(r), Math.sin(r));
    if (a = s * Math.cos(e) * Math.cos(r), i = s * Math.sin(e) * Math.cos(r), o = s * Math.sin(r), (this.radius_g - a) * a - i * i - o * o * this.radius_p_inv2 < 0)
      return t.x = Number.NaN, t.y = Number.NaN, t;
    n = this.radius_g - a, this.flip_axis ? (t.x = this.radius_g_1 * Math.atan(i / pt(o, n)), t.y = this.radius_g_1 * Math.atan(o / n)) : (t.x = this.radius_g_1 * Math.atan(i / n), t.y = this.radius_g_1 * Math.atan(o / pt(i, n)));
  } else this.shape === "sphere" && (n = Math.cos(r), a = Math.cos(e) * n, i = Math.sin(e) * n, o = Math.sin(r), n = this.radius_g - a, this.flip_axis ? (t.x = this.radius_g_1 * Math.atan(i / pt(o, n)), t.y = this.radius_g_1 * Math.atan(o / n)) : (t.x = this.radius_g_1 * Math.atan(i / n), t.y = this.radius_g_1 * Math.atan(o / pt(i, n))));
  return t.x = t.x * this.a, t.y = t.y * this.a, t;
}
function Fc(t) {
  var e = -1, r = 0, n = 0, a, i, o, s;
  if (t.x = t.x / this.a, t.y = t.y / this.a, this.shape === "ellipse") {
    this.flip_axis ? (n = Math.tan(t.y / this.radius_g_1), r = Math.tan(t.x / this.radius_g_1) * pt(1, n)) : (r = Math.tan(t.x / this.radius_g_1), n = Math.tan(t.y / this.radius_g_1) * pt(1, r));
    var h = n / this.radius_p;
    if (a = r * r + h * h + e * e, i = 2 * this.radius_g * e, o = i * i - 4 * a * this.C, o < 0)
      return t.x = Number.NaN, t.y = Number.NaN, t;
    s = (-i - Math.sqrt(o)) / (2 * a), e = this.radius_g + s * e, r *= s, n *= s, t.x = Math.atan2(r, e), t.y = Math.atan(n * Math.cos(t.x) / e), t.y = Math.atan(this.radius_p_inv2 * Math.tan(t.y));
  } else if (this.shape === "sphere") {
    if (this.flip_axis ? (n = Math.tan(t.y / this.radius_g_1), r = Math.tan(t.x / this.radius_g_1) * Math.sqrt(1 + n * n)) : (r = Math.tan(t.x / this.radius_g_1), n = Math.tan(t.y / this.radius_g_1) * Math.sqrt(1 + r * r)), a = r * r + n * n + e * e, i = 2 * this.radius_g * e, o = i * i - 4 * a * this.C, o < 0)
      return t.x = Number.NaN, t.y = Number.NaN, t;
    s = (-i - Math.sqrt(o)) / (2 * a), e = this.radius_g + s * e, r *= s, n *= s, t.x = Math.atan2(r, e), t.y = Math.atan(n * Math.cos(t.x) / e);
  }
  return t.x = t.x + this.long0, t;
}
var Dc = ["Geostationary Satellite View", "Geostationary_Satellite", "geos"], Uc = {
  init: Nc,
  forward: Lc,
  inverse: Fc,
  names: Dc
}, ir = 1.340264, ar = -0.081106, nr = 893e-6, sr = 3796e-6, $r = Math.sqrt(3) / 2;
function Bc() {
  this.es = 0, this.long0 = this.long0 !== void 0 ? this.long0 : 0, this.x0 = this.x0 !== void 0 ? this.x0 : 0, this.y0 = this.y0 !== void 0 ? this.y0 : 0;
}
function jc(t) {
  var e = F(t.x - this.long0, this.over), r = t.y, n = Math.asin($r * Math.sin(r)), a = n * n, i = a * a * a;
  return t.x = e * Math.cos(n) / ($r * (ir + 3 * ar * a + i * (7 * nr + 9 * sr * a))), t.y = n * (ir + ar * a + i * (nr + sr * a)), t.x = this.a * t.x + this.x0, t.y = this.a * t.y + this.y0, t;
}
function kc(t) {
  t.x = (t.x - this.x0) / this.a, t.y = (t.y - this.y0) / this.a;
  var e = 1e-9, r = 12, n = t.y, a, i, o, s, h, f;
  for (f = 0; f < r && (a = n * n, i = a * a * a, o = n * (ir + ar * a + i * (nr + sr * a)) - t.y, s = ir + 3 * ar * a + i * (7 * nr + 9 * sr * a), n -= h = o / s, !(Math.abs(h) < e)); ++f)
    ;
  return a = n * n, i = a * a * a, t.x = $r * t.x * (ir + 3 * ar * a + i * (7 * nr + 9 * sr * a)) / Math.cos(n), t.y = Math.asin(Math.sin(n) / $r), t.x = F(t.x + this.long0, this.over), t;
}
var qc = ["eqearth", "Equal Earth", "Equal_Earth"], $c = {
  init: Bc,
  forward: jc,
  inverse: kc,
  names: qc
}, ur = 1e-10;
function zc() {
  var t;
  if (this.phi1 = this.lat1, Math.abs(this.phi1) < ur)
    throw new Error();
  this.es ? (this.en = Ci(this.es), this.m1 = Ae(
    this.phi1,
    this.am1 = Math.sin(this.phi1),
    t = Math.cos(this.phi1),
    this.en
  ), this.am1 = t / (Math.sqrt(1 - this.es * this.am1 * this.am1) * this.am1), this.inverse = Wc, this.forward = Hc) : (Math.abs(this.phi1) + ur >= A ? this.cphi1 = 0 : this.cphi1 = 1 / Math.tan(this.phi1), this.inverse = Yc, this.forward = Vc);
}
function Hc(t) {
  var e = F(t.x - (this.long0 || 0), this.over), r = t.y, n, a, i;
  return n = this.am1 + this.m1 - Ae(r, a = Math.sin(r), i = Math.cos(r), this.en), a = i * e / (n * Math.sqrt(1 - this.es * a * a)), t.x = n * Math.sin(a), t.y = this.am1 - n * Math.cos(a), t.x = this.a * t.x + (this.x0 || 0), t.y = this.a * t.y + (this.y0 || 0), t;
}
function Wc(t) {
  t.x = (t.x - (this.x0 || 0)) / this.a, t.y = (t.y - (this.y0 || 0)) / this.a;
  var e, r, n, a;
  if (r = pt(t.x, t.y = this.am1 - t.y), a = Ti(this.am1 + this.m1 - r, this.es, this.en), (e = Math.abs(a)) < A)
    e = Math.sin(a), n = r * Math.atan2(t.x, t.y) * Math.sqrt(1 - this.es * e * e) / Math.cos(a);
  else if (Math.abs(e - A) <= ur)
    n = 0;
  else
    throw new Error();
  return t.x = F(n + (this.long0 || 0), this.over), t.y = te(a), t;
}
function Vc(t) {
  var e = F(t.x - (this.long0 || 0), this.over), r = t.y, n, a;
  return a = this.cphi1 + this.phi1 - r, Math.abs(a) > ur ? (t.x = a * Math.sin(n = e * Math.cos(r) / a), t.y = this.cphi1 - a * Math.cos(n)) : t.x = t.y = 0, t.x = this.a * t.x + (this.x0 || 0), t.y = this.a * t.y + (this.y0 || 0), t;
}
function Yc(t) {
  t.x = (t.x - (this.x0 || 0)) / this.a, t.y = (t.y - (this.y0 || 0)) / this.a;
  var e, r, n = pt(t.x, t.y = this.cphi1 - t.y);
  if (r = this.cphi1 + this.phi1 - n, Math.abs(r) > A)
    throw new Error();
  return Math.abs(Math.abs(r) - A) <= ur ? e = 0 : e = n * Math.atan2(t.x, t.y) / Math.cos(r), t.x = F(e + (this.long0 || 0), this.over), t.y = te(r), t;
}
var Kc = ["bonne", "Bonne (Werner lat_1=90)"], Jc = {
  init: zc,
  names: Kc
};
const nn = {
  OBLIQUE: {
    forward: ef,
    inverse: af
  },
  TRANSVERSE: {
    forward: rf,
    inverse: nf
  }
}, zr = {
  ROTATE: {
    o_alpha: "oAlpha",
    o_lon_c: "oLongC",
    o_lat_c: "oLatC"
  },
  NEW_POLE: {
    o_lat_p: "oLatP",
    o_lon_p: "oLongP"
  },
  NEW_EQUATOR: {
    o_lon_1: "oLong1",
    o_lat_1: "oLat1",
    o_lon_2: "oLong2",
    o_lat_2: "oLat2"
  }
};
function Xc() {
  if (this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.long0 = this.long0 || 0, this.title = this.title || "General Oblique Transformation", this.isIdentity = wn.includes(this.o_proj), !this.o_proj)
    throw new Error("Missing parameter: o_proj");
  if (this.o_proj === "ob_tran")
    throw new Error("Invalid value for o_proj: " + this.o_proj);
  const t = this.projStr.replace("+proj=ob_tran", "").replace("+o_proj=", "+proj=").trim(), e = At(t);
  if (!e)
    throw new Error("Invalid parameter: o_proj. Unknown projection " + this.o_proj);
  e.long0 = 0, this.obliqueProjection = e;
  let r;
  const n = Object.keys(zr), a = (s) => {
    if (typeof this[s] > "u")
      return;
    const h = parseFloat(this[s]) * rt;
    if (isNaN(h))
      throw new Error("Invalid value for " + s + ": " + this[s]);
    return h;
  };
  for (let s = 0; s < n.length; s++) {
    const h = n[s], f = zr[h], g = Object.entries(f);
    if (g.some(
      ([c]) => typeof this[c] < "u"
    )) {
      r = f;
      for (let c = 0; c < g.length; c++) {
        const [_, y] = g[c], M = a(_);
        if (typeof M > "u")
          throw new Error("Missing parameter: " + _ + ".");
        this[y] = M;
      }
      break;
    }
  }
  if (!r)
    throw new Error("No valid parameters provided for ob_tran projection.");
  const { lamp: i, phip: o } = tf(this, r);
  this.lamp = i, Math.abs(o) > N ? (this.cphip = Math.cos(o), this.sphip = Math.sin(o), this.projectionType = nn.OBLIQUE) : this.projectionType = nn.TRANSVERSE;
}
function Qc(t) {
  return this.projectionType.forward(this, t);
}
function Zc(t) {
  return this.projectionType.inverse(this, t);
}
function tf(t, e) {
  let r, n;
  if (e === zr.ROTATE) {
    let a = t.oLongC, i = t.oLatC, o = t.oAlpha;
    if (Math.abs(Math.abs(i) - A) <= N)
      throw new Error("Invalid value for o_lat_c: " + t.o_lat_c + " should be < 90°");
    n = a + Math.atan2(-1 * Math.cos(o), -1 * Math.sin(o) * Math.sin(i)), r = Math.asin(Math.cos(i) * Math.sin(o));
  } else if (e === zr.NEW_POLE)
    n = t.oLongP, r = t.oLatP;
  else {
    let a = t.oLong1, i = t.oLat1, o = t.oLong2, s = t.oLat2, h = Math.abs(i);
    if (Math.abs(i) > A - N)
      throw new Error("Invalid value for o_lat_1: " + t.o_lat_1 + " should be < 90°");
    if (Math.abs(s) > A - N)
      throw new Error("Invalid value for o_lat_2: " + t.o_lat_2 + " should be < 90°");
    if (Math.abs(i - s) < N)
      throw new Error("Invalid value for o_lat_1 and o_lat_2: o_lat_1 should be different from o_lat_2");
    if (h < N)
      throw new Error("Invalid value for o_lat_1: o_lat_1 should be different from zero");
    n = Math.atan2(
      Math.cos(i) * Math.sin(s) * Math.cos(a) - Math.sin(i) * Math.cos(s) * Math.cos(o),
      Math.sin(i) * Math.cos(s) * Math.sin(o) - Math.cos(i) * Math.sin(s) * Math.sin(a)
    ), r = Math.atan(-1 * Math.cos(n - a) / Math.tan(i));
  }
  return { lamp: n, phip: r };
}
function ef(t, e) {
  let { x: r, y: n } = e;
  r += t.long0;
  const a = Math.cos(r), i = Math.sin(n), o = Math.cos(n);
  e.x = F(
    Math.atan2(
      o * Math.sin(r),
      t.sphip * o * a + t.cphip * i
    ) + t.lamp
  ), e.y = Math.asin(
    t.sphip * i - t.cphip * o * a
  );
  const s = t.obliqueProjection.forward(e);
  return t.isIdentity && (s.x *= wt, s.y *= wt), s;
}
function rf(t, e) {
  let { x: r, y: n } = e;
  r += t.long0;
  const a = Math.cos(n), i = Math.cos(r);
  e.x = F(
    Math.atan2(
      a * Math.sin(r),
      Math.sin(n)
    ) + t.lamp
  ), e.y = Math.asin(-1 * a * i);
  const o = t.obliqueProjection.forward(e);
  return t.isIdentity && (o.x *= wt, o.y *= wt), o;
}
function af(t, e) {
  t.isIdentity && (e.x *= rt, e.y *= rt);
  const r = t.obliqueProjection.inverse(e);
  let { x: n, y: a } = r;
  if (n < Number.MAX_VALUE) {
    n -= t.lamp;
    const i = Math.cos(n), o = Math.sin(a), s = Math.cos(a);
    e.x = Math.atan2(
      s * Math.sin(n),
      t.sphip * s * i - t.cphip * o
    ), e.y = Math.asin(
      t.sphip * o + t.cphip * s * i
    );
  }
  return e.x = F(e.x + t.long0), e;
}
function nf(t, e) {
  t.isIdentity && (e.x *= rt, e.y *= rt);
  const r = t.obliqueProjection.inverse(e);
  let { x: n, y: a } = r;
  if (n < Number.MAX_VALUE) {
    const i = Math.cos(a);
    n -= t.lamp, e.x = Math.atan2(
      i * Math.sin(n),
      -1 * Math.sin(a)
    ), e.y = Math.asin(
      i * Math.cos(n)
    );
  }
  return e.x = F(e.x + t.long0), e;
}
var sf = ["General Oblique Transformation", "General_Oblique_Transformation", "ob_tran"], of = {
  init: Xc,
  forward: Qc,
  inverse: Zc,
  names: sf
};
function hf(t) {
  t.Proj.projections.add(Ir), t.Proj.projections.add(Or), t.Proj.projections.add(K0), t.Proj.projections.add(al), t.Proj.projections.add(ll), t.Proj.projections.add(gl), t.Proj.projections.add(pl), t.Proj.projections.add(Sl), t.Proj.projections.add(Tl), t.Proj.projections.add(Ll), t.Proj.projections.add(Yl), t.Proj.projections.add(tu), t.Proj.projections.add(nu), t.Proj.projections.add(cu), t.Proj.projections.add(vu), t.Proj.projections.add(wu), t.Proj.projections.add(xu), t.Proj.projections.add(Iu), t.Proj.projections.add(Du), t.Proj.projections.add(qu), t.Proj.projections.add(Vu), t.Proj.projections.add(Qu), t.Proj.projections.add(nc), t.Proj.projections.add(uc), t.Proj.projections.add(_c), t.Proj.projections.add(Ec), t.Proj.projections.add(Ac), t.Proj.projections.add(Rc), t.Proj.projections.add(Uc), t.Proj.projections.add($c), t.Proj.projections.add(Jc), t.Proj.projections.add(of);
}
const Bn = Object.assign(f0, {
  defaultDatum: "WGS84",
  Proj: At,
  WGS84: new At("WGS84"),
  Point: Ge,
  toPoint: Gn,
  defs: ft,
  nadgrid: Yh,
  transform: jr,
  mgrs: d0,
  version: "__VERSION__"
});
hf(Bn);
function lf(t, e) {
  const r = t[0] - e[0], n = t[1] - e[1], a = t[2] - e[2];
  return Math.sqrt(r * r + n * n + a * a);
}
function uf(t, e, r, n, a, i) {
  let o = lf(t, e);
  i !== void 0 && o > i && (o = i);
  const s = r * (Math.PI / 180);
  return n * a / (2 * o * Math.tan(s / 2));
}
let Mt = null, jn, Hr, Nr = {}, Lr = {}, kn, qn = "rgb";
const er = /* @__PURE__ */ new Set();
const bf = {
  0: [0.6, 0.6, 0.6],
  1: [0.7, 0.7, 0.7],
  2: [0.55, 0.35, 0.2],
  3: [0.18, 0.55, 0.22],
  4: [0.12, 0.4, 0.12],
  5: [0.75, 0.85, 0.32],
  6: [0.9, 0.2, 0.2],
  7: [0.05, 0.1, 0.4],
  8: [0.85, 0.85, 0.9],
  9: [0.1, 0.75, 0.95],
  10: [0.1, 0.45, 0.95],
  11: [0.95, 0.65, 0.15],
  12: [1, 0.2, 0.7],
  13: [0.6, 0.15, 0.75],
  14: [0.2, 0.85, 0.8],
  15: [0.95, 0.1, 0.1],
  16: [0.55, 0.3, 0.15],
  17: [0.95, 0.5, 0.2],
  18: [0.5, 0.8, 0.95]
};
function pf(t) {
  const e = bf[t];
  if (e)
    return e;
  const r = (t * 73 + 41) % 255 / 255, n = (t * 151 + 89) % 255 / 255, a = (t * 199 + 123) % 255 / 255;
  return [r, n, a];
}
function cf(t, e) {
  const r = e.split("-").map(Number), [n, a, i, o] = r, s = 2 ** n, h = [
    (t[3] - t[0]) / s,
    (t[4] - t[1]) / s,
    (t[5] - t[2]) / s
  ];
  return [
    t[0] + h[0] * a + h[0] / 2,
    t[1] + h[1] * i + h[1] / 2,
    t[2] + h[2] * o + h[2] / 2
  ];
}
async function ff(t) {
  try {
    if (Mt = await Fr.Copc.create(t), !(Mt != null && Mt.wkt)) {
      self.postMessage({
        type: "error",
        message: "Failed to initialize COPC or WKT is missing"
      });
      return;
    }
    Hr = Bn(Mt.wkt);
    const { nodes: e } = await Fr.Copc.loadHierarchyPage(
      t,
      Mt.info.rootHierarchyPage
    );
    Nr = e, Lr = {};
    for (const a of Object.keys(Nr))
      Lr[a] = cf(Mt.info.cube, a);
    const r = Lr["0-0-0-0"], n = Hr.inverse([r[0], r[1]]);
    self.postMessage({
      type: "initialized",
      center: n,
      nodeCount: Object.keys(Nr).length
    });
  } catch (e) {
    self.postMessage({
      type: "error",
      message: \`Error initializing COPC: \${e instanceof Error ? e.message : String(e)}\`
    });
  }
}
const df = 2 * Math.PI * 6378137, sn = Math.PI / 180;
async function gf(t) {
  if (!Mt) {
    self.postMessage({ type: "error", message: "COPC not initialized" });
    return;
  }
  if (er.has(t)) {
    er.delete(t);
    return;
  }
  try {
    const e = Nr[t];
    if (!e) {
      self.postMessage({ type: "error", message: \`Node \${t} not found\` });
      return;
    }
    const r = await Fr.Copc.loadPointDataView(kn, Mt, e, {
      lazPerf: jn
    });
    if (er.has(t)) {
      er.delete(t);
      return;
    }
    const n = new Float64Array(e.pointCount * 3), a = new Float32Array(e.pointCount * 3), i = r.dimensions.Red && r.dimensions.Green && r.dimensions.Blue, o = r.dimensions.Intensity, E = r.dimensions.Classification, s = r.getter("X"), h = r.getter("Y"), f = r.getter("Z"), g = i ? r.getter("Red") : null, d = i ? r.getter("Green") : null, c = i ? r.getter("Blue") : null, _ = o ? r.getter("Intensity") : null, C = E ? r.getter("Classification") : null, y = Mt.info.cube[2], M = Mt.info.cube[5] - y;
    for (let m = 0; m < e.pointCount; m++) {
      const S = s(m), w = h(m), P = f(m), [R, I] = Hr.inverse([S, w]), k = R * sn, W = I * sn, D = 0.5 + k / (2 * Math.PI), V = Math.sin(W), ot = (1 + V) / (1 - V), it = 0.5 - Math.log(ot) / (4 * Math.PI), tt = P / df;
      switch (n[m * 3] = D, n[m * 3 + 1] = it, n[m * 3 + 2] = tt, qn) {
        case "rgb":
          g && d && c ? (a[m * 3] = g(m) / 65535, a[m * 3 + 1] = d(m) / 65535, a[m * 3 + 2] = c(m) / 65535) : a[m * 3] = a[m * 3 + 1] = a[m * 3 + 2] = 1;
          break;
        case "height": {
          const lt = (P - y) / M;
          a[m * 3] = Math.min(1, Math.max(0, lt * 2)), a[m * 3 + 1] = Math.min(
            1,
            Math.max(
              0,
              lt > 0.5 ? 2 - lt * 2 : lt * 2
            )
          ), a[m * 3 + 2] = Math.min(
            1,
            Math.max(0, 1 - lt * 2)
          );
          break;
        }
        case "intensity":
          if (_) {
            const lt = _(m) / 65535;
            a[m * 3] = a[m * 3 + 1] = a[m * 3 + 2] = lt;
          } else
            a[m * 3] = a[m * 3 + 1] = a[m * 3 + 2] = 1;
          break;
        case "classification": {
          const lt = C ? C(m) : 0, [vt, mt, gt] = pf(lt);
          a[m * 3] = vt, a[m * 3 + 1] = mt, a[m * 3 + 2] = gt;
          break;
        }
        case "white":
        default:
          a[m * 3] = a[m * 3 + 1] = a[m * 3 + 2] = 1;
          break;
      }
    }
    self.postMessage(
      {
        type: "nodeLoaded",
        node: t,
        positions: n.buffer,
        colors: a.buffer,
        pointCount: e.pointCount
      },
      { transfer: [n.buffer, a.buffer] }
    );
  } catch (e) {
    self.postMessage({
      type: "error",
      message: \`Error loading node \${t}: \${e instanceof Error ? e.message : String(e)}\`
    });
  }
}
function _f(t, e, r, n) {
  if (!Mt) {
    self.postMessage({ type: "error", message: "COPC not initialized" });
    return;
  }
  try {
    const a = [
      ...Hr.forward([t[0], t[1]]),
      t[2]
    ], i = r * (Math.PI / 180), s = Mt.info.spacing * e / (2 * n * Math.tan(i / 2)), h = [];
    for (const [f, g] of Object.entries(Lr)) {
      const d = Number.parseInt(f.split("-")[0]);
      uf(
        a,
        g,
        r,
        Mt.info.spacing * 0.5 ** d,
        e,
        s
      ) > n && h.push(f);
    }
    h.length === 0 && h.push("0-0-0-0"), self.postMessage({
      type: "nodesToLoad",
      nodes: h,
      cameraPosition: t
    });
  } catch (a) {
    self.postMessage({
      type: "error",
      message: \`Error updating points: \${a instanceof Error ? a.message : String(a)}\`
    });
  }
}
self.onmessage = async (t) => {
  var r;
  const e = t.data;
  try {
    switch (e.type) {
      case "init":
        if (kn = e.url, e.options && (qn = e.options.colorMode || "rgb"), (r = e.options) != null && r.wasmPath) {
          const n = e.options.wasmPath;
          jn = await Fr.Las.PointData.createLazPerf({
            locateFile: () => n
          });
        }
        await ff(e.url);
        break;
      case "loadNode":
        await gf(e.node);
        break;
      case "updatePoints":
        _f(
          e.cameraPosition,
          e.mapHeight,
          e.fov,
          e.sseThreshold
        );
        break;
      case "cancelRequests":
        for (const n of e.nodes)
          er.add(n);
        break;
      case "setOptions":
        e.options && e.options.colorMode && (qn = e.options.colorMode);
        break;
    }
  } catch (n) {
    self.postMessage({
      type: "error",
      message: \`Error processing message: \${n instanceof Error ? n.message : String(n)}\`
    });
  }
};
`, M = typeof self < "u" && self.Blob && new Blob(["", u], { type: "text/javascript;charset=utf-8" });
function Y(E) {
  let A;
  try {
    if (A = M && (self.URL || self.webkitURL).createObjectURL(M), !A) throw "";
    const g = new Worker(A, {
      type: "module",
      name: E == null ? void 0 : E.name
    });
    return g.addEventListener("error", () => {
      (self.URL || self.webkitURL).revokeObjectURL(A);
    }), g;
  } catch {
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(u),
      {
        type: "module",
        name: E == null ? void 0 : E.name
      }
    );
  }
}
const k = "data:application/wasm;base64,AGFzbQEAAAABwgM2YAF/AGABfwF/YAJ/fwBgAn9/AX9gA39/fwF/YAN/f38AYAZ/f39/f38Bf2AEf39/fwF/YAV/f39/fwF/YAR/f39/AGAFf39/f38AYAZ/f39/f38AYAAAYAh/f39/f39/fwF/YAd/f39/f39/AX9gAAF/YAF/AX5gBX9+fn5+AGAHf39/f39/fwBgBX9/fn9/AGAFf39/f34Bf2ADf35/AX5gCH9/f39/f39/AGAEf35+fwBgCn9/f39/f39/f38Bf2AGf39/f35+AX9gB39/f39/fn4Bf2ADf39+AX9gAn9+AGAEf39/fwF+YAx/f39/f39/f39/f38Bf2AFf39/f3wBf2ALf39/f39/f39/f38Bf2AKf39/f39/f39/fwBgD39/f39/f39/f39/f39/fwBgA39/fwF+YA1/f39/f39/f39/f39/AGAEf39/fgF/YAJ/fABgBH5+fn4Bf2ADfn5+AX9gAX8BfGACf38BfmACfn4BfWACfn4BfGADf39+AGACfH8BfGACfn8Bf2AGf3x/f39/AX9gBH9/f34BfmADf39/AX1gA39/fwF8YAl/f39/f39/f38Bf2AEf39+fgACwAUXA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzACQDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IACwNlbnYfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgAWA2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAQNlbnYLX19jeGFfdGhyb3cABQNlbnYVX2VtYmluZF9yZWdpc3Rlcl92b2lkAAIDZW52FV9lbWJpbmRfcmVnaXN0ZXJfYm9vbAAKA2VudhhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIACgNlbnYWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAAFA2VudhtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmcAAgNlbnYcX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZwAFA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsAAIDZW52HF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcABQNlbnYVZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAUD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GkH0GkESIABBABACQQgQpAQiAEEANgIEIABBEzYCAEGQGkGpCUEDQZwdQfwZQRQgAEEAEAILBQBB9BYLQAECfyAABEACQCAAKAIEIgFFDQAgASABKAIEIgJBAWs2AgQgAg0AIAEgASgCACgCCBEAACABEKMECyAAEKMBCwsHACAAEQ8ACxIBAX9BCBCkBCIAQgA3AgAgAAuiNQIPfwJ+QQgQpAQhDyMAQSBrIg0kAEGIBBCkBCIGQgA3AwAgBiAGQRBqIgM2AgwgBiADNgIIIANCADcCBCADQcyCzbIENgIAIANBgQY7ARggA0IANwIMIANBADYCFCADQRpqQQBBzwAQngEaIANBADsBggEgA0IANwF6IANCADcBciADQgA3AWogA0IANwOIASADQgA3A5ABIANCADcDmAEgA0IANwOgASADQgA3A6gBIANCADcDsAEgA0L/////////9/8ANwPgASADQv////////93NwPYASADQv/////////3/wA3A9ABIANC/////////3c3A8gBIANC//////////f/ADcDwAEgA0L/////////dzcDuAEgBkGQAmpBAEGAARCeARogBkEANgKIAiAGQgA3A4ACIAZCADcD+AEgBkIANwKUAyAGQQA6AJADIAZBBDoAKSAGQgA3AqQDIAZCADcDuAMgBkHkwQA2AqADIAZCADcCrAMgBkIANwPAAyAGQgA3A8gDIAZBADYC0AMgBkIANwLcAyAGQQA2AuQDIAZBgMIANgLYAyAGQgA3A4AEIAZCADcD+AMgBkIANwPwAyAGQgA3A+gDIA8gBjYCAEGQARCkBCEDIA1CADcDGCANQgA3AxAgA0H0yQA2AgAgA0EEahC9AyADQgA3AhggA0IANwIQIANCADcCCCADQgA3AyAgA0HgPDYCACADQgA3AyggDSANKQMYNwMIIA0gDSkDEDcDACADIA0pAwA3AyAgAyANKQMINwMoIAMgATYCMCADIAE2AhggAyABIAJqIgI2AhAgAyABNgIMIAMgATYCCCADIAI2AhwgAyABNgIUIANBQGsiAUHMygA2AgAgA0G4ygA2AjggA0EANgI8IAFBADYCFCABIAM2AhggAUEANgIMIAFCgqCAgOAANwIEIAEgA0U2AhAgAUEgakEAQSgQngEaIAFBHGoQvQMgA0KAgICAcDcDiAEg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DAELIAJFDQEgAigCAEEUagshAyACIAMoAgARAAALIAEQowELAkACfyAHKAKwASILIAdBoAFqRgRAIAdBoAFqIQsgBygCoAFBEGoMAQsgC0UNASALKAIAQRRqCyEBIAsgASgCABEAAAsgBBAwGgsgB0HwAWokAAwBC0EIEAMgB0EgakGjFRByEHNBzD1BIBAEAAsLIAgoAgAiASABKAIAQQxrKAIAakEAEOMBIAgoAgAhASAKIAgoAgg1AmAiEkIIfCASIAgtAJADGyISNwNIIAogEjcDCCAKQgA3A0AgCkIANwMAIAEgChDNAQJAAn8gCCgCBCgCACIMKAIIIgEgDCgCBCIEayIGQf//P00EQEGAgMAAIAZrIhAgDCgCDCICIAFrTQRAIAFBACAQEJ4BIBBqDAILIAIgBGsiA0EBdCICQYCAwAAgAkGAgMAASxtB/////wcgA0H/////A0kbIgMQpAQiDiAGakEAIBAQngEaIA5BgIBAayECIAEgBEcEQCAOIAQgBhCcARoLIAwgAyAOajYCDCAMIAI2AgggDCAONgIEIARFDQIgBBCjASAMKAIIIQIMAgsgASECIAZBgIDAAEYNASAEQYCAQGsLIQIgDCACNgIICyAMIAIgDCgCBGs2AhBBAQshASARBEAgERCjAQsgCkGgAWokACABDAILEDMAC0EIEAMgCkHwAGpB8hMQchBzQcw9QSAQBAALRQRAQQgQAyANQRBqQf8NEHIQc0HMPUEgEAQACyANQSBqJABBEBCkBCIBIA82AgwgAUHgFzYCACABQgA3AgQgACAPNgIAIAAoAgQhAiAAIAE2AgQCQCACRQ0AIAIgAigCBCIAQQFrNgIEIAANACACIAIoAgAoAggRAAAgAhCjBAsLOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQUACxAAIAAoAgAoAgBBEGovAWoLNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAQALEAAgACgCACgCAEEQai0AaAv5BAIEfwF+AkAgACgCACgCACEDIwBBQGoiACQAAkACQCADLQCQA0UEQCAAIAMoAgQoAgA2AiwgAEEANgIoIABBHzYCJCAAQfwdNgIgIAAgAEEgajYCMCADKAIILwFqIQMgACABNgI8IAAgAzYCOCAAKAIwIgFFDQIgASAAQTxqIABBOGogASgCACgCGBEFAAJ/IAAoAjAiASAAQSBqRgRAIABBIGohASAAKAIgQRBqDAELIAFFDQIgASgCAEEUagshAyABIAMoAgARAAAMAQsCQCADKAKUAyICBEAgAygC6AMpAwAgAzUC7ANSDQELIABBCGoiAiADKAIEKAIANgIMIAJBADYCCCACQR82AgQgAkH8HTYCACACIAI2AhAgAEEgaiACIAMoAggiAi0AaAJAIAItAGhBD3EiBUEISw0AQc8DIAV2QQFxRQ0AIAVBAnRB0B1qKAIAIAIvAWpqIQQLIAQQYCAAKQMgIQYgAEIANwMgIAMoApgDIQIgAyAGNwKUAwJAIAJFDQAgAiACKAIEIgRBAWs2AgQgBA0AIAIgAigCACgCCBEAACACEKMECwJAIAAoAiQiAkUNACACIAIoAgQiBEEBazYCBCAEDQAgAiACKAIAKAIIEQAAIAIQowQLAkACfyAAKAIYIgIgAEEIakYEQCAAQQhqIQIgACgCCEEQagwBCyACRQ0BIAIoAgBBFGoLIQQgAiAEKAIAEQAACyADQQA2AuwDIAMgAygC6AMiAkEQaiADKALwAyACGzYC6AMgAygClAMhAgsgAiABIAIoAgAoAgARAwAaIAMgAygC7ANBAWo2AuwDCyAAQUBrJAAMAQsQdAALCzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRAgALOgEBfwJ+AkAgACgCACgCACIBKAIIIgAtABhBAU0EQCAALQAZQQRJDQELIAEpA5ACDAELIAA1AmwLpwsFAEGQGguVBAIEfwF+IAFBD3EiBEEITQR/IARBAnRBrB1qKAIABUEACyEHQQQQpAQhBiMAQUBqIgQkAEEMEKQEIgVCADcCACAGIAU2AgAgBSADNgIIIARBADYCMCAEIAU2AjQgBCAFNgIUIARB6wA2AiwgBEH0PTYCKCAEQfQ9NgIIIAQgBCkCLDcCDCAEIARBKGo2AjggBCAEQQhqIgM2AhggBEEgaiADIAEgAiAHaxBgIAYoAgAhAiAEKQMgIQggBEIANwMgIAIoAgQhASACIAg3AgACQCABRQ0AIAEgASgCBCICQQFrNgIEIAINACABIAEoAgAoAggRAAAgARCjBAsCQCAEKAIkIgFFDQAgASABKAIEIgJBAWs2AgQgAg0AIAEgASgCACgCCBEAACABEKMECwJAAn8gBCgCGCIBIARBCGpGBEAgBEEIaiEBIAQoAghBEGoMAQsgAUUNASABKAIAQRRqCyECIAEgAigCABEAAAsCQAJ/IAQoAjgiASAEQShqRgRAIARBKGohASAEKAIoQRBqDAELIAFFDQEgASgCAEEUagshAiABIAIoAgARAAALIARBQGskACAGIQFBEBCkBCICIAE2AgwgAkGEGzYCACACQgA3AgQgACABNgIAIAAoAgQhASAAIAI2AgQCQCABRQ0AIAEgASgCBCIAQQFrNgIEIAANACABIAEoAgAoAggRAAAgARCjBAsLOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRCQALHQAgACgCACgCACgCACIAIAEgACgCACgCABEDABoLBwAgABCjAQu8AgEEfyAAKAIMIgQEQCAEKAIEIQAgBEEANgIEIAAEQCAAQThqELwBGiAAELABEKMBCyAEKAIAIQAgBEEANgIAIAAEQCAAKAL8AyICBEAgAiEDIAIgACgCgAQiAUcEQANAIAFBDWssAABBAEgEQCABQRhrKAIAEKMBCyABQTBrIQMgAUElaywAAEEASARAIAMoAgAQowELIAMiASACRw0ACyAAKAL8AyEDCyAAIAI2AoAEIAMQowELIAAoAvADIgEEQCAAIAE2AvQDIAEQowELIABB2ANqEJQBGiAAQaADahCPARoCQCAAKAKYAyIBRQ0AIAEgASgCBCICQQFrNgIEIAINACABIAEoAgAoAggRAAAgARCjBAsgACgCBCEBIABBADYCBCABBEAgARAwEKMBCyAAEKMBCyAEEKMBCwsTACAAQQxqQQAgASgCBEGMGUYbC10BA38gACgCDCIBBEAgASgCACECIAFBADYCACACBEACQCACKAIEIgBFDQAgACAAKAIEIgNBAWs2AgQgAw0AIAAgACgCACgCCBEAACAAEKMECyACEKMBCyABEKMBCwsTACAAQQxqQQAgASgCBEG4HEYbC9QDAQF/IAFB4wEQpARBAEHjARCeASIBQeMBEMoBIAAgASgAADYCACAA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QQZqQQF2IgE2AhwgAiABNgIYIABBADYCfCAAQgA3AnQgAEHABRCkBCIBNgJ0IAAgATYCeCAAIAFBwAVqIgM2AnwgASACEIMBIgFBLGogAhCDARogAUHYAGogAhCDARogAUGEAWogAhCDARogAUGwAWogAhCDARogAUHcAWogAhCDARogAUGIAmogAhCDARogAUG0AmogAhCDARogAUHgAmogAhCDARogAUGMA2ogAhCDARogAUG4A2ogAhCDARogAUHkA2ogAhCDARogAUGQBGogAhCDARogAUG8BGogAhCDARogAUHoBGogAhCDARogAUGUBWogAhCDARogACADNgJ4IAIoAggiAQRAIAFBBGsoAgAQowELIAIoAgwiAQRAIAFBBGsoAgAQowELIAIoAhAiAQRAIAFBBGsoAgAQowELQQAhAyACQYACEH4hASAAQQA2AogBIABCADcDgAEgAEGAFhCkBCIENgKAASAAIAQ2AoQBIAAgBEGAFmoiBTYCiAEDQCAEIANBLGxqIAEQgwEaIANBAWoiA0HAAEcNAAsgACAFNgKEASABKAIIIgMEQCADQQRrKAIAEKMBCyABKAIMIgMEQCADQQRrKAIAEKMBCyABKAIQIgEEQCABQQRrKAIAEKMBC0EAIQMgAkHAABB+IQEgAEEANgKUASAAQgA3AowBIABBgBYQpAQiBDYCjAEgACAENgKQASAAIARBgBZqIgU2ApQBA0AgBCADQSxsaiABEIMBGiADQQFqIgNBwABHDQALIAAgBTYCkAEgASgCCCIDBEAgA0EEaygCABCjAQsgASgCDCIDBEAgA0EEaygCABCjAQsgASgCECIBBEAgAUEEaygCABCjAQtBACEDIAJBgAIQfiEBIABBADYCoAEgAEIANwOYASAAQYAWEKQEIgQ2ApgBIAAgBDYCnAEgACAEQYAWaiIFNgKgAQNAIAQgA0EsbGogARCDARogA0EBaiIDQcAARw0ACyAAIAU2ApwBIAEoAggiAwRAIANBBGsoAgAQowELIAEoAgwiAwRAIANBBGsoAgAQowELIAEoAhAiAQRAIAFBBGsoAgAQowELQQAhAyAAQaQBakGDBBB+GiAAQQQ2AvABIABBADoA1AEgAEEFNgLQASAAQQA2AuABIABCADcC9AFB2AAQogEiAUHEAGpBQHEiBEEEayABNgIAIAAgBDYC2AFB2AAQogEiBEHEAGpBQHEiAUEEayAENgIAIABCgICAgNAANwLkASAAIAE2AtwBIABB0AFqIQQDQCABIANBAnRqQQE2AgAgA0EBaiIDIAQoAgBJDQALIAQQggEgAEECNgK4AiAAQQA2AqQCIABCADcCnAIgAEKCgICAgAE3AoQCIABCgKCAgBA3A7ACIABBADYCxAIgAEIANwK8AiAAQoSAgIDAADcDqAIgAEKAgICA+P////8ANwKUAiAAQiA3AowCIABCgICAgIAENwL8ASAAQQg2AtQCIABBADYC8AIgAEKggICA4AI3AswCIABCADcD6AIgAEKBgICAIDcDgAMgACAAKALQAUEGakEBdiIBNgLsASAAIAE2AugBIABBgCA2AvwCIABChICAgMAANwL0AiAAQQA2ApADIABCADcDiAMgAEIgNwPYAiAAQoCAgID4/////wA3A+ACIABBADYCyAIgAEEINgKgAyAAQQA2ArwDIABCoICAgMACNwOYAyAAQgA3ArQDIABCgYCAgCA3AswDIABBgCA2AsgDIABChICAgMAANwPAAyAAQQA2AtwDIABCADcC1AMgAEKAgICA+P////8ANwKsAyAAQiA3AqQDIABCgYCAgCA3A5gEIABCgICAgMAANwOIBCAAQgA3A4AEIABBCDYC7AMgAEKQgICAwAA3AuQDIABBADYClAMgAEIANwOgBCAAQoSAgICAgAQ3A5AEIABBADYCqAQgAEKAgP7///8fNwP4AyAAQpCAgICAgMAANwPwAyAAQoGAgIAgNwLkBCAAQgA3AswEIABCkICAgCA3A7AEIABBADYC1AQgAEEINgK4BCAAQQA2AuADIABBgCA2AuAEIABBBDYC3AQgAEEANgL0BCAAQgA3AuwEIABBBDYC2AQgAEKAgP7///8fNwLEBCAAQpCAgICAgMAANwK8BCAAQoGAgIAgNwOwBSAAQQA2AqAFIABCADcDmAUgAEEINgKEBSAAQpCAgIAQNwL8BCAAQQA2AqwEIABBgCA2AqwFIABBBDYCqAUgAEEANgLABSAAQgA3A7gFIABBBDYCpAUgAEKAgP7///8fNwOQBSAAQpCAgICAgMAANwOIBSAAQoGAgIAgNwL8BSAAQQA2AuwFIABCADcC5AUgAEEINgLQBSAAQqCAgICQATcDyAUgAEEANgL4BCAAQYAgNgL4BSAAQQQ2AvQFIABBADYCjAYgAEIANwKEBiAAQQQ2AvAFIABCgICAgPj/////ADcC3AUgAEIgNwLUBSAAQoGAgIAgNwLMBiAAQQA2ArwGIABCADcCtAYgAEIINwKcBiAAQqCAgIAgNwKUBiAAQQA2AsQFIABBgCA2AsgGIABBBDYCxAYgAEEANgLcBiAAQgA3AtQGIABBBDYCwAYgAEKAgICA+P////8ANwKsBiAAQiA3AqQGIABCgYCAgCA3ApwHIABBADYCjAcgAEIANwKEByAAQgg3AuwGIABCoICAgOACNwLkBiAAQQA2ApAGIABBgCA2ApgHIABBBDYClAcgAEEANgKsByAAQgA3AqQHIABBBDYCkAcgAEKAgICA+P////8ANwL8BiAAQiA3AvQGIABCgYCAgCA3AuwHIABBADYC3AcgAEIANwLUByAAQgg3ArwHIABCoICAgMACNwK0ByAAQQA2AuAGIABBgCA2AugHIABBBDYC5AcgAEEANgL8ByAAQgA3AvQHIABBBDYC4AcgAEKAgICA+P////8ANwLMByAAQiA3AsQHIABBvAhqQoGAgIAgNwIAIABBrAhqQQA2AgAgAEGkCGpCADcCACAAQYwIakIINwIAIABBhAhqQpCAgIDAADcCACAAQQA2ArAHIABBuAhqQYAgNgIAIABBtAhqQQQ2AgAgAEHMCGpBADYCACAAQcQIakIANwIAIABBsAhqQQQ2AgAgAEGcCGpCgID+////HzcCACAAQZQIakKQgICAgIDAADcCACAAQYwJakKBgICAIDcCACAAQfwIakEANgIAIABB9AhqQgA3AgAgAEHcCGpCCDcCACAAQdQIakKQgICAIDcCACAAQQA2AoAIIABBiAlqQYAgNgIAIABBhAlqQQQ2AgAgAEGcCWpBADYCACAAQZQJakIANwIAIABBgAlqQQQ2AgAgAEHsCGpCgID+////HzcCACAAQeQIakKQgICAgIDAADcCACAAQdwJakKBgICAIDcCACAAQcwJakEANgIAIABBxAlqQgA3AgAgAEGsCWpCCDcCACAAQaQJakKQgICAEDcCACAAQQA2AtAIIABB2AlqQYAgNgIAIABB1AlqQQQ2AgAgAEHsCWpBADYCACAAQeQJakIANwIAIABB0AlqQQQ2AgAgAEG8CWpCgID+////HzcCACAAQbQJakKQgICAgIDAADcCACAAQawKakKBgICAIDcCACAAQZwKakEANgIAIABBlApqQgA3AgAgAEH8CWpCCDcCACAAQfQJakKggICAkAE3AgAgAEEANgKgCSAAQagKakGAIDYCACAAQaQKakEENgIAIABBvApqQQA2AgAgAEG0CmpCADcCACAAQaAKakEENgIAIABBjApqQoCAgID4/////wA3AgAgAEGECmpCIDcCACAAQQA2AvAJIABBoAtqIgFBADYCACAAQZgLaiIDQgA3AwAgAEIANwOQCyAAQdcKakIANwAAIABB0ApqQgA3AwAgAEHICmpCADcDACAAQgA3A8AKIABBpAtqIgRBAToAACAAQbgLaiIFQQA2AgAgAEGwC2oiCEIANwMAIABBqAtqIgZCADcDACAAQbwLaiIJQQE6AAAgAEHQC2oiB0EANgIAIABByAtqIgpCADcDACAAQcALaiILQgA3AwAgAEHUC2oiDEEBOgAAIABB6AtqIg1BADYCACAAQeALaiIOQgA3AwAgAEHYC2oiD0IANwMAIABB7AtqIhBBAToAACAAQYAMaiIRQQA2AgAgAEH4C2oiEkIANwMAIABB8AtqIhNCADcDACAAQYQMaiIUQQE6AAAgAEGYDGoiFUEANgIAIABBkAxqIhZCADcDACAAQYgMaiIXQgA3AwAgAEGcDGoiGEEBOgAAIABBsAxqIhlBADYCACAAQagMaiIaQgA3AwAgAEGgDGoiG0IANwMAIABBtAxqIhxBAToAACAAQcgMaiIdQQA2AgAgAEHADGoiHkIANwMAIABBuAxqIh9CADcDACAAQcwMaiIgQQE6AAAgAEHgDGoiIUEANgIAIABB2AxqIiJCADcDACAAQdAMaiIjQgA3AwAgAEHkDGoiJEEBOgAAIABB+AxqIiVBADYCACAAQfAMaiImQgA3AwAgAEHoDGoiJ0IANwMAIABB/AxqIihBAToAACAAQZANaiIpQQA2AgAgAEGIDWoiKkIANwMAIABBgA1qIitCADcDACAAQZQNaiIsQQE6AAAgAEGoDWoiLUEANgIAIABBoA1qIi5CADcDACAAQZgNaiIvQgA3AwAgAEGsDWoiMEEBOgAAIABBwA1qIjFBADYCACAAQbgNaiIyQgA3AwAgAEIANwOwDSAAQcQNaiIzQQE6AAAgAEHYDWoiNEEANgIAIABB0A1qIjVCADcDACAAQcgNaiI2QgA3AwAgAEHcDWoiN0EBOgAAIABB8A1qIjhBADYCACAAQegNaiI5QgA3AwAgAEHgDWoiOkIANwMAIABB9A1qIjtBAToAACAAQYgOaiI8QQA2AgAgAEGADmoiPUIANwMAIABB+A1qIj5CADcDACAAQYwOaiI/QQE6AAAgAEGgDmoiQEEANgIAIABBmA5qIkFCADcDACAAQZAOaiJCQgA3AwAgAEGkDmoiQ0EBOgAAIABBuA5qIkRBADYCACAAQbAOaiJFQgA3AwAgAEGoDmoiRkIANwMAIABBvA5qIkdBAToAACAAQdAOaiJIQQA2AgAgAEHIDmoiSUIANwMAIABBwA5qIkpCADcDACAAQdQOaiJLQQE6AAAgAEHoDmoiTEEANgIAIABB4A5qIk1CADcDACAAQdgOaiJOQgA3AwAgAEHsDmoiT0EBOgAAIABBgA9qIlBBADYCACAAQfgOaiJRQgA3AwAgAEHwDmoiUkIANwMAIABBhA9qIlNBAToAACAAQZgPaiJUQQA2AgAgAEGQD2oiVUIANwMAIABBiA9qIlZCADcDACAAQZwPaiJXQQE6AAAgAEGwD2oiWEEANgIAIABBqA9qIllCADcDACAAQaAPaiJaQgA3AwAgAEG0D2oiW0EBOgAAIABByA9qIlxBADYCACAAQcAPaiJdQgA3AwAgAEG4D2oiXkIANwMAIABBzA9qIl9BAToAACAAQdAPakEAQckAEJ4BGiAAQfwBahBhIABByAJqEGEgAEGUA2oQYSAAQeADahBhIABBrARqEGEgAEH4BGoQYSAAQcQFahBhIABBkAZqEHkgAEHgBmoQeSAAQbAHahB5IABBgAhqEHkgAEHQCGoQeSAAQaAJahB5IABB8AlqEHkgAUEANgIAIANCADcDACAAQgA3A5ALIAZCADcDACAEQQE6AAAgCEIANwMAIAVBADYCACALQgA3AwAgCUEBOgAAIApCADcDACAHQQA2AgAgD0IANwMAIAxBAToAACAOQgA3AwAgDUEANgIAIBBBAToAACATQgA3AwAgEkIANwMAIBFBADYCACAVQQA2AgAgFkIANwMAIBdCADcDACAUQQE6AAAgGEEBOgAAIBlBADYCACAaQgA3AwAgG0IANwMAIBxBAToAACAdQQA2AgAgHkIANwMAIB9CADcDACAgQQE6AAAgIkIANwMAICNCADcDACAhQQA2AgAgJEEBOgAAICVBADYCACAmQgA3AwAgJ0IANwMAIChBAToAACArQgA3AwAgKkIANwMAIClBADYCACAsQQE6AAAgL0IANwMAIC5CADcDACAtQQA2AgAgMEEBOgAAIABCADcDsA0gMkIANwMAIDFBADYCACAzQQE6AAAgNEEANgIAIDVCADcDACA2QgA3AwAgOkIANwMAIDdBAToAACA5QgA3AwAgOEEANgIAID5CADcDACA7QQE6AAAgPUIANwMAIDxBADYCACBCQgA3AwAgP0EBOgAAIEFCADcDACBAQQA2AgAgRkIANwMAIENBAToAACBFQgA3AwAgREEANgIAIEdBAToAACBIQQA2AgAgSUIANwMAIEpCADcDACBLQQE6AAAgTEEANgIAIE1CADcDACBOQgA3AwAgT0EBOgAAIFBBADYCACBRQgA3AwAgUkIANwMAIFNBAToAACBUQQA2AgAgVUIANwMAIFZCADcDACBXQQE6AAAgWEEANgIAIFlCADcDACBaQgA3AwAgW0EBOgAAIFxBADYCACBdQgA3AwAgXkIANwMAIF9BAToAACACQTBqJAAgAAuHFAERfyMAQRBrIgMkACADQQQ2AgggAyADQQRqNgIMAkACQAJAIABBmMEAaigCACIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCEHIANBBDYCCCADIANBBGo2AgwgACgCmEEiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhCSADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIQogA0EENgIIIAMgA0EEajYCDCAAKAKYQSIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCELIANBBDYCCCADIANBBGo2AgwgACgCmEEiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhDCADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIQ0gA0EENgIIIAMgA0EEajYCDCAAKAKYQSIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCEOIANBBDYCCCADIANBBGo2AgwgACgCmEEiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhDyADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIRAgAEHUwgBqIQgCQCAAQdjCAGooAgAiASAAQdzCAGooAgAiAkcEQCABIAc2AgAgACABQQRqIgE2AthCDAELIAEgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIRIAc2AgAgBCABQQJ0aiECIBFBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIAk2AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIAk2AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIAo2AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIAo2AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIAs2AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIAs2AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIAw2AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIAw2AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIA02AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIA02AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIA42AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIA42AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIA82AgAgACABQQRqIgE2AthCDAELIAIgCCgCACIGayIFQQJ1IgJBAWoiAUGAgICABE8NAiAFQQF1IgQgASABIARJG0H/////AyAFQfz///8HSRsiAQR/IAFBgICAgARPDQQgAUECdBCkBAVBAAsiBCACQQJ0aiIHIA82AgAgBCABQQJ0aiECIAdBBGohASAFQQBKBEAgBCAGIAUQnAEaCyAAIAI2AtxCIAAgATYC2EIgACAENgLUQiAGRQ0AIAYQowEgACgC3EIhAiAAKALYQiEBCwJAIAEgAkcEQCABIBA2AgAgACABQQRqNgLYQgwBCyACIAgoAgAiAmsiAUECdSIGQQFqIghBgICAgARPDQIgAUEBdSIFIAggBSAISxtB/////wMgAUH8////B0kbIggEfyAIQYCAgIAETw0EIAhBAnQQpAQFQQALIgUgBkECdGoiBiAQNgIAIAFBAEoEQCAFIAIgARCcARoLIAAgBSAIQQJ0ajYC3EIgACAGQQRqNgLYQiAAIAU2AtRCIAJFDQAgAhCjAQsgA0EQaiQADwsQdAALEDMACxCEAQALggwBCX8gAEGIwQBqIQYgACgC1EIiCCgCACIBBEAgAEGwwQBqIgIoAgAgBiABEEQgAigCACIBIAEoAgwiAkEBaiIDNgIMIAIgASgCACIEai0AACEHIAEgAkECaiIFNgIMIAMgBGotAAAhAyABIAJBA2oiCTYCDCAEIAVqLQAAIQUgASACQQRqNgIMIAQgCWotAAAhASAAQajBAGpBAToAACAAIAEgA0EQdCAHQRh0ciAFQQh0cnI2AqBBCyAIKAIEIgEEQCAAQcTBAGoiAigCACAGIAEQRCACKAIAIgEgASgCDCICQQFqIgM2AgwgAiABKAIAIgRqLQAAIQcgASACQQJqIgU2AgwgAyAEai0AACEDIAEgAkEDaiIJNgIMIAQgBWotAAAhBSABIAJBBGo2AgwgBCAJai0AACEBIABBvMEAakEBOgAAIAAgASADQRB0IAdBGHRyIAVBCHRycjYCtEELIAgoAggiAQRAIABB2MEAaiICKAIAIAYgARBEIAIoAgAiASABKAIMIgJBAWoiAzYCDCACIAEoAgAiBGotAAAhByABIAJBAmoiBTYCDCADIARqLQAAIQMgASACQQNqIgk2AgwgBCAFai0AACEFIAEgAkEEajYCDCAEIAlqLQAAIQEgAEHQwQBqQQE6AAAgACABIANBEHQgB0EYdHIgBUEIdHJyNgLIQQsgCCgCDCIBBEAgAEHswQBqIgIoAgAgBiABEEQgAigCACIBIAEoAgwiAkEBaiIDNgIMIAIgASgCACIEai0AACEHIAEgAkECaiIFNgIMIAMgBGotAAAhAyABIAJBA2oiCTYCDCAEIAVqLQAAIQUgASACQQRqNgIMIAQgCWotAAAhASAAQeTBAGpBAToAACAAIAEgA0EQdCAHQRh0ciAFQQh0cnI2AtxBCyAIKAIQIgEEQCAAQYDCAGoiAigCACAGIAEQRCACKAIAIgEgASgCDCICQQFqIgM2AgwgAiABKAIAIgRqLQAAIQcgASACQQJqIgU2AgwgAyAEai0AACEDIAEgAkEDaiIJNgIMIAQgBWotAAAhBSABIAJBBGo2AgwgBCAJai0AACEBIABB+MEAakEBOgAAIAAgASADQRB0IAdBGHRyIAVBCHRycjYC8EELIAgoAhQiAQRAIABBlMIAaiICKAIAIAYgARBEIAIoAgAiASABKAIMIgJBAWoiAzYCDCACIAEoAgAiBGotAAAhByABIAJBAmoiBTYCDCADIARqLQAAIQMgASACQQNqIgk2AgwgBCAFai0AACEFIAEgAkEEajYCDCAEIAlqLQAAIQEgAEGMwgBqQQE6AAAgACABIANBEHQgB0EYdHIgBUEIdHJyNgKEQgsgCCgCGCIBBEAgAEGowgBqIgIoAgAgBiABEEQgAigCACIBIAEoAgwiAkEBaiIDNgIMIAIgASgCACIEai0AACEHIAEgAkECaiIFNgIMIAMgBGotAAAhAyABIAJBA2oiCTYCDCAEIAVqLQAAIQUgASACQQRqNgIMIAQgCWotAAAhASAAQaDCAGpBAToAACAAIAEgA0EQdCAHQRh0ciAFQQh0cnI2AphCCyAIKAIcIgEEQCAAQbzCAGoiAigCACAGIAEQRCACKAIAIgEgASgCDCICQQFqIgM2AgwgAiABKAIAIgRqLQAAIQcgASACQQJqIgU2AgwgAyAEai0AACEDIAEgAkEDaiIJNgIMIAQgBWotAAAhBSABIAJBBGo2AgwgBCAJai0AACEBIABBtMIAakEBOgAAIAAgASADQRB0IAdBGHRyIAVBCHRycjYCrEILIAgoAiAiCARAIABB0MIAaiIBKAIAIAYgCBBEIAEoAgAiBiAGKAIMIghBAWoiAjYCDCAIIAYoAgAiAWotAAAhBCAGIAhBAmoiAzYCDCABIAJqLQAAIQIgBiAIQQNqIgc2AgwgASADai0AACEDIAYgCEEEajYCDCABIAdqLQAAIQYgAEHIwgBqQQE6AAAgACAGIAJBEHQgBEEYdHIgA0EIdHJyNgLAQgsgAEHYwgBqIAAoAtRCNgIAC90mAhJ/An4jAEEQayIRJAACQAJAIAAoAoBBIgRBf0YEQCARIAE2AgwgEUEeNgIIIABBmMEAaigCACIDRQ0CIAMgEUEMaiARQQhqIAMoAgAoAhgRBQAgASgACCEEIAEvAAwhBiABLQAOIQUgASgAECELIAEvABQhCiABKQAWIRUgASkAACEWIAIgAS0ADyIHQQR2QQNxIgM2AgAgACADQaAQbGoiAyAWNwDBCiADIBU3A9gPIANBAToAwAogA0HXCmogFTcAACADQdUKaiAKOwAAIANB0QpqIAs2AAAgA0HQCmogBzoAACADQc8KaiAFOgAAIANBzQpqIAY7AAAgA0HJCmogBDYAACAAIAIoAgA2AoBBIANBjAtqIAQ2AgAgA0GIC2ogBDYCACADQYQLaiAENgIAIANBgAtqIAQ2AgAgA0H8CmogBDYCACADQfgKaiAENgIAIANB9ApqIAQ2AgAgAyAENgLwCiADQe4KaiAGOwEAIANB7ApqIAY7AQAgA0HqCmogBjsBACADQegKaiAGOwEAIANB5gpqIAY7AQAgA0HkCmogBjsBACADQeIKaiAGOwEAIAMgBjsB4AoMAQsgAEGgwQBqIgcgACAEQaAQbGoiAygCBCADLQCYEEECdEH8AXEgA0HPCmotAAAiBkEPcSIFIAZBBHZPQQF0IAVBAUZyckEsbGoQRiIKQQJxIQUgA0HQCmotAABBBHZBA3EhCyAKQcAAcQRAIAAgByADQRBqEEYgC2pBAWpBA3EiCzYCgEEgAiALNgIACyAAIAtBoBBsaiIGLQDACkUEQCAGQcAKakEBOgAAIAAgC0GgEGxqIgIgA0HBCmoiAykAADcAwQogAkHXCmogAykAFjcAACACQdEKaiADKQAQNwAAIAJByQpqIAMpAAg3AAAgAkGMC2ogACAEQaAQbGoiBEHJCmooAAAiAzYCACACQYgLaiADNgIAIAJBhAtqIAM2AgAgAkGAC2ogAzYCACACQfwKaiADNgIAIAJB+ApqIAM2AgAgAkH0CmogAzYCACACIAM2AvAKIAJB7gpqIARBzQpqLwAAIgM7AQAgAkHsCmogAzsBACACQeoKaiADOwEAIAJB6ApqIAM7AQAgAkHmCmogAzsBACACQeQKaiADOwEAIAJB4gpqIAM7AQAgAiADOwHgCiACIARB1wpqKwAAOQPYDwsgCkEQcSEPIAVFIApxIQwgACALQaAQbGoiDUHQCmoiECAQLQAAQc8BcSALQQR0cjoAACANQc8KaiIFLQAAIgJBD3EhAyACQQR2IQIgCkEEcQR/IAcgDSgCaCACQSxsahBGIQIgBS0AAEEPcQUgAwshBCAPQQR2IRIgDUHBCmohDSAFIAQgAkEEdHI6AAACQCAMBEAgA0EBakEPcSEDDAELIApBAXFFIApBAXZxBEAgA0EBa0EPcSEDDAELIApBA3FBA0cNACAPBEAgByAAIAtBoBBsaigCdCADQSxsahBGIQMMAQsgByAAIAtBoBBsakE8ahBGIANqQQJqQQ9xIQMLIAUgBS0AAEHwAXEgA3I6AAAgACALQaAQbGoiDCACQQR0IANqQaAiai0AAEEBdCASciITQRhsaiIIQZgLaiIJKAIAIQUgDEGQBmogByAMKAK0BiACQQFGIhRBLGxqEEwhDiANIAwoAqgGIgRBAEEAIAQgBCAFIA5qIgVLG2sgBUEASBsgBWoiBSANKAAAajYAACAIQZALaiEEIAkoAgAhCQJAIAhBpAtqIg4tAAAEQCAEKAIMIQggBSAJSARAIAQgCTYCDCAEIAg2AhAgBCgCBCEJIAQoAgAiCCAFSgRAIAQgCDYCBCAEIAk2AgggBCAFNgIADAMLIAUgCUgEQCAEIAU2AgQgBCAJNgIIDAMLIAQgBTYCCAwCCwJAIAUgCEgEQCAEIAU2AgwgBCAINgIQDAELIAQgBTYCEAsgDkEAOgAADAELIAQoAgQhCCAFIAlKBEAgBCAJNgIEIAQgCDYCACAEKAIMIQkgBSAEKAIQIghKBEAgBCAFNgIQIAQgCDYCDCAEIAk2AggMAgsgBSAJSgRAIAQgBTYCDCAEIAk2AggMAgsgBCAFNgIIDAELAkAgBSAISgRAIAQgBTYCBCAEIAg2AgAMAQsgBCAFNgIACyAOQQE6AAALIAAgC0GgEGxqIgkgE0EYbGoiCEG4DWoiDigCACEFIAlB4AZqIAcgCSgChAcgDCgCkAYiBEEUIARBFEkbQR5xIBRyQSxsahBMIQcgCUHFCmoiEyAJKAL4BiIEQQBBACAEIAQgBSAHaiIFSxtrIAVBAEgbIAVqIgUgEygAAGo2AAAgCEGwDWohBCAOKAIAIQcCQCAIQcQNaiIOLQAABEAgBCgCDCEIIAUgB0gEQCAEIAc2AgwgBCAINgIQIAQoAgQhByAEKAIAIgggBUoEQCAEIAg2AgQgBCAHNgIIIAQgBTYCAAwDCyAFIAdIBEAgBCAFNgIEIAQgBzYCCAwDCyAEIAU2AggMAgsCQCAFIAhIBEAgBCAFNgIMIAQgCDYCEAwBCyAEIAU2AhALIA5BADoAAAwBCyAEKAIEIQggBSAHSgRAIAQgBzYCBCAEIAg2AgAgBCgCDCEHIAUgBCgCECIISgRAIAQgBTYCECAEIAg2AgwgBCAHNgIIDAILIAUgB0oEQCAEIAU2AgwgBCAHNgIIDAILIAQgBTYCCAwBCwJAIAUgCEoEQCAEIAU2AgQgBCAINgIADAELIAQgBTYCAAsgDkEBOgAACyAAQbzBAGotAAAEQCAAIAtBoBBsaiIEIAJBBHQgA2pBoCRqLQAAQQJ0akHwCmoiBygCACEFIARBsAdqIABBtMEAaiAEKALUByAJKALgBiAMKAKQBmpBAXYiDEESIAxBEkkbQR5xIBRyQSxsahBMIQwgBEHJCmogBCgCyAciBEEAQQAgBCAEIAUgDGoiBUsbayAFQQBIGyAFaiIENgAAIAcgBDYCAAsgAEHQwQBqLQAABEAgACALQaAQbGoiBEHRCmoiBSAAQcjBAGogBCgCgAEgA0EBRiACQQJJcSAFLQAAQQF0ckE/cUEsbGoQRjoAAAsgAEHkwQBqLQAABEAgECAAQdzBAGogACALQaAQbGooAowBIA0tAA8iBEECdkEwcSAEQQ9xckEsbGoQRiIEQQ9xIBAtAABBMHFyIARBAnRBwAFxcjoAAAsgAEH4wQBqLQAABEAgACALQaAQbGoiBCACIANNQQF0IANBAUZBAnRyIgIgEnJBAXRqQeAKaiIDLwEAIQUgBEGACGogAEHwwQBqIARBpAhqKAIAIAJBAXZBLGxqEEwhByADIARBmAhqKAIAIgJBAEEAIAIgAiAFIAdqIgNLG2sgA0EASBsgA2oiAjsBACAEQc0KaiACOwAACyAKQQhxBEAgACALQaAQbGoiAkHTCmoiAy4AACEEIAJB0AhqIABBhMIAaiACQfQIaigCACASQSxsahBMIQUgAyACQegIaigCACICQQBBACACIAIgBCAFaiIDSxtrIANBAEgbIANqOwAACyAAQaDCAGotAAAEQCAAIAtBoBBsaiICQdIKaiIDIABBmMIAaiACKAKYASADLQAAQQJ2QSxsahBGOgAACyAKQSBxBEAgACALQaAQbGoiAkHVCmoiAy8AACEEIAJBoAlqIABBrMIAaiACQcQJaigCABBMIQUgAyACQbgJaigCACICQQBBACACIAIgBCAFaiIDSxtrIANBAEgbIANqOwAACyAPBEACQCAGQdABaiEEIAZBpAFqIQUgAEHAwgBqIQIgBkH4D2ohCiAGKALQDyEDA0ACQAJAAkAgCiADQQJ0aigCAEUEQAJAAkAgAiAEEEYiAw4CAwABCyAGIAYoAtQPQQFqQQNxNgLUDyAGQdgPaiIPIAYoAtAPQQN0aigCBCEDIAZB8AlqIAIgBkGUCmooAgBB4AJqEEwhBSAGQYgKaigCACECIABBxMIAaiIEIAQoAgBBEHYiBDYCACAAIAAoAsBCIgcgByAEbiIQIARsayIHNgLAQiACQQBBACACIAIgAyAFaiICSxtrIAJBAEgbIAJqrSEVIABB0MIAaigCACIMKAIMIQIgDCgCACEJA0AgDCACQQFqIgM2AgwgAiAJai0AACECIAAgBCIFQQh0IgQ2AsRCIAAgAiAHQQh0ciIHNgLAQiADIQIgBUGAgARJDQALIAAgBUEIdiICNgLEQiAAIAcgByACbiIHIAJsayIENgLAQgNAIAwgA0EBaiIFNgIMIAMgCWotAAAhCCAAIAJBCHQiAzYCxEIgACAIIARBCHRyIgQ2AsBCIAJBgIAESSEIIAMhAiAFIQMgCA0ACyAPIAYoAtQPIgJBA3RqIBBB//8DcSAHQRB0cq0gFUIghoQ3AwAgBiACNgLQDyAKIAJBAnRqQQA2AgAgBiAGKALQD0ECdGpBiBBqQQA2AgAMAwsgAyAGKALQD2pBA2ohAwwDCyACIAUQRiIDQQFGBEAgCiAGKALQD0ECdGooAgAhAyAGQfAJaiACIAZBlApqKAIAQSxqEEwhBCAGIAYoAtAPIgVBA3RqQdgPaiICIAIpAwAgBkGICmooAgAiAkEAQQAgAiACIAMgBGoiA0sbayADQQBIGyADaqx8NwMAIAYgBUECdGpBiBBqQQA2AgAMAgsgA0H+A0wEQAJAIANFBEAgBkHwCWogAiAGQZQKaigCAEG0AmoQTCECIAZBiApqKAIAIQMgBkGIEGoiBCAGKALQD0ECdGoiBSAFKAIAQQFqNgIAIAIgA0EAQQAgAyACIANJG2sgAkEASBtqIQIgBCAGKALQD0ECdGoiAygCAEEESA0BIANBADYCACAKIAYoAtAPQQJ0aiACNgIADAELIANB8wNMBEAgCiAGKALQD0ECdGooAgAhBCAGQfAJaiACIAZBlApqKAIAQdgAQYQBIANBCkgbahBMIQUgBkGICmooAgAiAkEAQQAgAiACIAUgAyAEbGoiAksbayACQQBIGyACaiECDAELIANB9ANGBEAgCiAGKALQD0ECdGooAgAhAyAGQfAJaiACIAZBlApqKAIAQbABahBMIQQgBkGICmooAgAhAiAGQYgQaiIFIAYoAtAPQQJ0aiIHIAcoAgBBAWo2AgAgAkEAQQAgAiACIAQgA0H0A2xqIgJLG2sgAkEASBsgAmohAiAFIAYoAtAPQQJ0aiIDKAIAQQRIDQEgA0EANgIAIAogBigC0A9BAnRqIAI2AgAMAQsgA0H9A00EQCAKIAYoAtAPQQJ0aigCACEEIAZB8AlqIAIgBkGUCmooAgBB3AFqEEwhBSAGQYgKaigCACICQQBBACACIAIgBSAEQfQDIANrbGoiAksbayACQQBIGyACaiECDAELIAogBigC0A9BAnRqKAIAIQMgBkHwCWogAiAGQZQKaigCAEGIAmoQTCEEIAZBiApqKAIAIQIgBkGIEGoiBSAGKALQD0ECdGoiByAHKAIAQQFqNgIAIAJBAEEAIAIgAiAEIANBdmxqIgJLG2sgAkEASBsgAmohAiAFIAYoAtAPQQJ0aiIDKAIAQQRIDQAgA0EANgIAIAogBigC0A9BAnRqIAI2AgALIAYgBigC0A9BA3RqQdgPaiIDIAMpAwAgAqx8NwMADAILIANB/wNGBEAgBiAGKALUD0EBakEDcTYC1A8gBkHYD2oiDyAGKALQD0EDdGooAgQhAyAGQfAJaiACIAZBlApqKAIAQeACahBMIQUgBkGICmooAgAhAiAAQcTCAGoiBCAEKAIAQRB2IgQ2AgAgACAAKALAQiIHIAcgBG4iECAEbGsiBzYCwEIgAkEAQQAgAiACIAMgBWoiAksbayACQQBIGyACaq0hFSAAQdDCAGooAgAiDCgCDCECIAwoAgAhCQNAIAwgAkEBaiIDNgIMIAIgCWotAAAhAiAAIAQiBUEIdCIENgLEQiAAIAIgB0EIdHIiBzYCwEIgAyECIAVBgIAESQ0ACyAAIAVBCHYiAjYCxEIgACAHIAcgAm4iByACbGsiBDYCwEIDQCAMIANBAWoiBTYCDCADIAlqLQAAIQggACACQQh0IgM2AsRCIAAgCCAEQQh0ciIENgLAQiACQYCABEkhCCADIQIgBSEDIAgNAAsgDyAGKALUDyICQQN0aiAQQf//A3EgB0EQdHKtIBVCIIaENwMAIAYgAjYC0A8gCiACQQJ0akEANgIAIAYgBigC0A9BAnRqQYgQakEANgIADAILIAMgBigC0A9qQQFqIQMMAgsgBkHwCWogAiAGQZQKaigCABBMIQIgCiAGKALQD0ECdGogAiAGQYgKaigCACIDQQBBACADIAIgA0kbayACQQBIG2oiAjYCACAGIAYoAtAPIgNBA3RqQdgPaiIEIAQpAwAgAqx8NwMAIAYgA0ECdGpBiBBqQQA2AgALIAZB1wpqIAYgBigC0A9BA3RqQdgPaisDADkAAAwCCyAGIANBA3EiAzYC0A8MAAsACwsgACALQaAQbGogEjoAmBAgASANKQAWNwAWIAEgDSkAEDcAECABIA0pAAg3AAggASANKQAANwAACyARQRBqJAAgAUEeag8LEHQAC4IEAQd/IAAgASACEEYiAjYCACACBEAgAkEfTQRAAn8gACgCDCIDIAJPBEAgASAAKAJEIAJBLGxqQSxrEEYMAQsgASAAKAJEIAJBLGxqQSxrEEYgAiADayICdCABIAIQTXILIgFBASAAKAIAIgBBAWt0TgRAIAFBAWoPCyABQX8gAHRqQQFqDwsgACgCHA8LAkAgASIDKAIAIgQgACgCOCABKAIEIgJBDXZsIgFPIghFBEAgAyABNgIEIAAgACgCPEEBajYCPAwBCyADIAIgAWsiAjYCBCADIAQgAWsiBDYCACACIQELIAFB////B00EQCADKAIQIgcoAgwhAiAHKAIAIQkDQCAHIAJBAWoiBTYCDCACIAlqLQAAIQYgAyABQQh0IgI2AgQgAyAGIARBCHRyIgQ2AgAgAUGAgARJIQYgAiEBIAUhAiAGDQALCyAAIAAoAjRBAWsiATYCNCABRQRAIAAgACgCMCIFIAAoAkBqIgE2AkACQCABQYDAAE0EQCAAKAI8IQIMAQsgACABQQFqQQF2IgM2AkAgACAAKAI8QQFqQQF2IgI2AjwgAiADRwRAIAMhAQwBCyAAIANBAWoiATYCQCADIQILIABBwAAgBUEFbCIDQQJ2IANBgwJLGyIDNgI0IAAgAzYCMCAAQYCAgIB4IAFuIAJsQRJ2NgI4CyAIC7kCAQh/IAAoAgQhAyAAKAIAIQICQCABQRRPBEAgACADQRB2IgM2AgQgACACIAIgA24iByADbGsiBDYCACAAKAIQIgUoAgwhAiAFKAIAIQYDQCAFIAJBAWoiCDYCDCACIAZqLQAAIQkgACADQQh0IgI2AgQgACAJIARBCHRyIgQ2AgAgA0GAgARJIQkgAiEDIAghAiAJDQALIAdB//8DcSAAIAFBEGsQTUEQdHIhAQwBCyAAIAMgAXYiAzYCBCAAIAIgAiADbiIBIANsayIENgIAIANB////B0sNACAAKAIQIgUoAgwhAiAFKAIAIQcDQCAFIAJBAWoiCDYCDCACIAdqLQAAIQYgACADQQh0IgI2AgQgACAGIARBCHRyIgQ2AgAgA0GAgARJIQYgAiEDIAghAiAGDQALCyABC10BAn8jAEEQayIBJAAgACgChAohAiABQQQ2AgggASABQQRqNgIMIAIoAhAiAkUEQBB0AAsgAiABQQxqIAFBCGogAigCACgCGBEFACAAIAEoAgQ2AogKIAFBEGokAAuuAQEHfyAAKAKICiIBBEAgAEGcCmoiAigCACAAKAKECiABEEQgAigCACIBIAEoAgwiAkEBaiIDNgIMIAIgASgCACIEai0AACEGIAEgAkECaiIFNgIMIAMgBGotAAAhAyABIAJBA2oiBzYCDCAEIAVqLQAAIQUgASACQQRqNgIMIAQgB2otAAAhASAAQZQKakEBOgAAIAAgASADQRB0IAZBGHRyIAVBCHRycjYCjAoLC5QHAQx/IwBBEGsiCiQAAkACQCAAKAKACiIDQX9GBEAgAigCACEHIAAoAoQKIQMgCiABNgIMIApBBjYCCCADKAIQIgNFDQIgAyAKQQxqIApBCGogAygCACgCGBEFACAAIAdBwAJsaiIDIAEvAAA7AQQgAyABLwACOwEGIAEvAAQhByADQQE2AgAgAyAHOwEIIAAgAigCADYCgAoMAQsgACgCiApFBEAgASAAIANBwAJsaiIAKAAENgAAIAEgAC8ACDsABAwBCyAAIANBwAJsakEEaiEEIAAgAigCACIFQcACbGohAgJAIAMgBUYNACAAIAU2AoAKIAIoAgANACACQQE2AgAgACAFQcACbGoiAyAEKAIANgIEIAMgBC8BBDsBCCADQQRqIQQLAn8gAEGMCmoiCCACQQxqEEYiCUEBcQRAIAggACAFQcACbGpBOGoQRiAELwAAIgNqDAELIAQvAAAiAwshDCADIQIgCUECcQRAIAggACAFQcACbGpB5ABqEEZBCHQgBC8AACIDaiECCyAMQf8BcSIGIAJBgH5xciEHAkAgCUHAAHFFBEAgAkGA/gNxQQh2IQMgByIAIQIMAQsgBiADQf8BcWshAwJ/IAlBBHEEQCAIIAAgBUHAAmxqQZABahBGQQBBfyADIAQvAAIiBkH/AXFqIgsgC0H+AUobIAtBAEwbakH/AXEMAQsgBC8AAiIGQf8BcQshCwJ/IAlBEHEEQCAIIAAgBUHAAmxqQegBahBGQQBBfyAELQAEIAMgC2ogBC8AAiIGQf8BcWtBAm1BEHRBEHVqIgMgA0H+AUobIANBAEwbakH/AXEMAQsgBC0ABAshDSACQQh2Qf8BcSIDIAQtAAFrIQ4gCwJ/IAlBCHEEQCAIIAAgBUHAAmxqQbwBahBGQQBBfyAOIAQtAANqIgIgAkH+AUobIAJBAEwbakEIdAwBCyAGQYD+A3ELIgZyIQIgCUEgcQRAIAggACAFQcACbGpBlAJqEEZBAEF/IAQtAAUgBkH//wNxQQh2IA5qIAQtAANrQQJtQRB0QRB1aiIAIABB/gFKGyAAQQBMG2pBCHQgDXIhAAwBCyAELQAFQQh0IA1yIQALIAQgADsABCAEIAI7AAIgBCAHOwAAIAEgAkEIdjoAAyABIAw6AAAgASADOgABIAEgAEEIdjoABSABIAI6AAIgASAAOgAECyAKQRBqJAAgAUEGag8LEHQAC9wBAQN/IABBBDYCCCAAQQA7AQQgAEEANgIAIABBAzYCKCAAQQA6AAwgAEEANgIYIABCADcCLEHUABCiASIBQcQAakFAcSICQQRrIAE2AgAgACACNgIQQdQAEKIBIgJBxABqQUBxIgFBBGsgAjYCACAAQoCAgIDAADcCHCAAIAE2AhQgAEEIaiECA0AgASADQQJ0akEBNgIAIANBAWoiAyACKAIASQ0ACyACEIIBIAAgACgCCEEGakEBdiIBNgIkIAAgATYCICAAQTRqQYACEH4aIABB4ABqQYACEH4aC4guARR/IwBBIGsiDiQAAkACQAJAIAEoAhAiBEUEQCAOQQA2AhgMAQsgASAERwRAIA4gBDYCGCABQQA2AhAMAgsgDiAOQQhqIgQ2AhggASAEIAEoAgAoAgwRAgAgDigCGCIEDQELIABBADYCEAwBCyAOQQhqIARGBEAgACAANgIQIA5BCGoiBCAAIA4oAggoAgwRAgACfyAEIA4oAhgiAUYEQCAOQQhqIQEgDigCCEEQagwBCyABRQ0CIAEoAgBBFGoLIQQgASAEKAIAEQAADAELIAAgBDYCECAOQQA2AhgLIABCgICAgHA3AxggACAANgIoIABBADYCJCAAQQA6ACAgAEEYaiEWIABBLGoiA0IANwIAIANCADcCNCADQQA2AhAgA0IANwIIIANCADcCPCADQQA2AkQgA0IANwJMIANBAToASCADQgA3AlQgA0EANgJcIANCADcCZCADQQE6AGAgA0IANwJsIANBADYCdCADQQE6AHggA0IANwJ8IANCADcChAEgA0EANgKMASADQgA3ApQBIANBAToAkAEgA0IANwKcASADQQA2AqQBIANBAToAqAEgA0IANwKsASADQgA3ArQBIANBADYCvAEgA0EBOgDAASADQgA3AsQBIANCADcCzAEgA0EANgLUASADQQE6ANgBIANCADcC3AEgA0IANwLkASADQQA2AuwBIANBAToA8AEgA0EANgKEAiADQgA3AvwBIANCADcC9AEgA0IANwKMAiADQQE6AIgCIANCADcClAIgA0EANgKcAiADQgA3AqQCIANBAToAoAIgA0IANwKsAiADQQA2ArQCIANCADcCvAIgA0EBOgC4AiADQgA3AsQCIANBADYCzAIgA0IANwLUAiADQQE6ANACIANCADcC3AIgA0EANgLkAiADQQE6AOgCIANBADYC/AIgA0IANwL0AiADQgA3AuwCIANBAToAgAMgA0EANgKUAyADQgA3AowDIANCADcChAMgA0EBOgCYAyADQQA2AqwDIANCADcCpAMgA0IANwKcAyADQQE6ALADIANBADYCxAMgA0IANwK8AyADQgA3ArQDIANBAToAyAMgA0EANgLcAyADQgA3AtQDIANCADcCzAMgA0EBOgDgAyADQQA2AvQDIANCADcC7AMgA0IANwLkAyADQQE6APgDIANBADYCjAQgA0IANwKEBCADQgA3AvwDIANBAToAkAQgA0EANgKkBCADQgA3ApwEIANCADcClAQgA0EBOgCoBCADQQA2ArwEIANCADcCtAQgA0IANwKsBCADQQE6AMAEIANBADYC1AQgA0IANwLMBCADQgA3AsQEIANBAToA2AQgA0EANgLsBCADQgA3AuQEIANCADcC3AQgA0EBOgDwBCADQQA2AoQFIANCADcC/AQgA0IANwL0BCADQQE6AIgFIANBADYCnAUgA0IANwKUBSADQgA3AowFIANBAToAoAUgA0EANgK0BSADQgA3AqwFIANCADcCpAUgA0EBOgC4BSADQQA2AswFIANCADcCxAUgA0IANwK8BSADQQE6ANAFIANBADYC5AUgA0IANwLcBSADQgA3AtQFIANBAToA6AUgA0EANgL8BSADQgA3AvQFIANCADcC7AUgA0EBOgCABiADQQA2ApQGIANCADcCjAYgA0IANwKEBiADQQE6AJgGIANBADYCrAYgA0IANwKkBiADQgA3ApwGIANBAToAsAYgA0HUBmpBwAAQfhogA0IANwIUIANBADoAiB8gA0IANwIcIANCADcCJCADQgA3AiwgA0EsEKQEQYACEH42AoAHQSwQpARBgAIQfiEBIANCADcCtAYgAyABNgKEByADQgA3ArwGIANCADcCxAYgA0IANwLMBiADQYgXaiEFIANBiA9qIQQgA0GIB2ohAQNAIAEgC0ECdCIHakEsEKQEQYACEH42AgAgBCAHakEsEKQEQYACEH42AgAgBSAHakEsEKQEQYACEH42AgAgC0EBaiILQYACRw0ACyADIBY2AowfIANCgICAgIACNwKQHyADQdAfakECNgIAIANBvB9qQQA2AgAgA0G0H2pCADcCACADQaAfakEANgIAIANBmB9qQoSAgICAATcCACADQcgfakKAoICAEDcCACADQdwfakEANgIAIANB1B9qQgA3AgAgA0HAH2pChICAgMAANwIAIANBrB9qQoCA/v///x83AgAgA0GkH2pCkICAgICAwAA3AgAgA0GMIGpBADYCACADQeQfakKQgICAEDcCACADQewfakIINwIAIANBhCBqQgA3AgAgA0GcIGpCgYCAgCA3AgAgA0GYIGpBgCA2AgAgA0GQIGpChICAgMAANwIAIANBrCBqQQA2AgAgA0GkIGpCADcCACADQfQfakKQgICAgIDAADcCACADQfwfakKAgP7///8fNwIAIANBADYC4B8gA0HcIGpBADYCACADQbQgakKggICAIDcCACADQbwgakIINwIAIANB1CBqQgA3AgAgA0HsIGpCgYCAgCA3AgAgA0HoIGpBgCA2AgAgA0HgIGpChICAgMAANwIAIANB/CBqQQA2AgAgA0H0IGpCADcCACADQcwgakKAgICA+P////8ANwIAIANBxCBqQiA3AgAgA0G8IWpCgYCAgCA3AgAgA0GsIWpCgICAgMAANwIAIANBpCFqQgA3AgAgA0GMIWpCCDcCACADQYQhakKggICA4AI3AgAgA0EANgKwICADQcQhakIANwIAIANBtCFqQoSAgICAgAQ3AgAgA0HMIWpBADYCACADQZwhakKAgICA+P////8ANwIAIANBlCFqQiA3AgAgA0GMImpCgYCAgCA3AgAgA0H0IWpCADcCACADQdwhakIINwIAIANB1CFqQqCAgIDAAjcCACADQfwhakEANgIAIANBADYCgCEgA0GIImpBgCA2AgAgA0GEImpBBDYCACADQZwiakEANgIAIANBlCJqQgA3AgAgA0GAImpBBDYCACADQewhakKAgICA+P////8ANwIAIANB5CFqQiA3AgAgA0EAOgCgIiADQQA2AtAhQQAhCyAAQdAiaiIFQQA6AAAgBUEEakGEBBB+GiAFQQU2AlAgBUEAOgA0IAVBBjYCMCAFQUBrQQA2AgAgBUIANwJUQdwAEKIBIgRBxABqQUBxIgFBBGsgBDYCACAFIAE2AjhB3AAQogEiAUHEAGpBQHEiBEEEayABNgIAIAVCgICAgOAANwJEIAUgBDYCPCAFQTBqIQEDQCAEIAtBAnRqQQE2AgAgC0EBaiILIAEoAgBJDQALIAEQggEgBSAFKAIwQQZqQQF2IgE2AkwgBSABNgJIIAVB3ABqQQBByAAQngEaIAVBADoAqAEgBSAWNgKkASAFQoCAgICABDcCrAEgBUECNgLsASAFQQA2AtgBIAVCADcC0AEgBUEANgK8ASAFQomAgICAATcCtAEgBUKA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AQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyAGQdjDAGoiAUH4B2oQZSABKALUByICBEAgAkEEaygCABCjAQsgASgC2AciAgRAIAJBBGsoAgAQowELIAEoAtwHIgIEQCACQQRrKAIAEKMBCyABQbgFahBlIAEoApQFIgIEQCACQQRrKAIAEKMBCyABKAKYBSICBEAgAkEEaygCABCjAQsgASgCnAUiAgRAIAJBBGsoAgAQowELIAFB+AJqEGUgASgC1AIiAgRAIAJBBGsoAgAQowELIAEoAtgCIgIEQCACQQRrKAIAEKMBCyABKALcAiICBEAgAkEEaygCABCjAQsgAUE4ahBlIAEoAhQiAgRAIAJBBGsoAgAQowELIAEoAhgiAgRAIAJBBGsoAgAQowELIAEoAhwiAQRAIAFBBGsoAgAQowELIAZBGGoiAygC1EIiAQRAIANB2MIAaiABNgIAIAEQowELIANBzMIAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0G4wgBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyADQaTCAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIANBkMIAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0H8wQBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyADQejBAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIANB1MEAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0HAwQBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyADQazBAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELAkACfyADQZjBAGooAgAiAiADQYjBAGoiAUYEQCABKAIAQRBqDAELIAJFDQEgAiIBKAIAQRRqCyECIAEg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aiIIIgIoAhAiBEUEQCABQQA2AhAgBUGoJjYCACAFQQRqIQJB0CcQpAQhBwwBCyACIARHBEAgASAENgIQIAJBADYCECAFQagmNgIAIAVBBGohAkHQJxCkBCEHDAILIAEgATYCECACIAEgAigCACgCDBECACABKAIQIQQgBUGoJjYCACAFQQRqIQJB0CcQpAQhByAEDQELIAFBADYCKAwBCyABIARGBEAgASABQRhqIgQ2AiggASAEIAEoAgAoAgwRAgAMAQsgAUEANgIQIAEgBDYCKAsgAiAHIAFBGGoiBCADEFI2AgACQAJ/IAQgASgCKCICRgRAIAFBGGohAiABKAIYQRBqDAELIAJFDQEgAigCAEEUagshAyACIAMoAgARAAALAkACfyABIAEoAhAiAkYEQCABIQIgASgCAEEQagwBCyACRQ0BIAIoAgBBFGoLIQMgAiADKAIAEQAACyAFQbwmNgIAIAFBMGokAEEQEKQEIgEgBTYCDCABQbwrNgIAIAFCADcCBCAAIAE2AgQgACAFNgIAIAggBigCqAEiAEYEQCAGQZgBaiEAIAYoApgBQRBqDAcLIABFDQcgACgCAEEUagwGC0EIEKQEIQUCQCABKAIQIgJFBEAgBkEANgKQAQwBCyABIAJGBEAgBiAGQYABaiICNgKQASABIAIgASgCACgCDBECAAwBCyAGIAI2ApABIAFBADYCEAsjAEEwayIBJAACQAJAAkAgBkGAAWoiCCICKAIQIgRFBEAgAUEANgIQIAVBqCY2AgAgBUEEaiECQdAnEKQEIQcMAQsgAiAERwRAIAEgBDYCECACQQA2AhAgBUGoJjYCACAFQQRqIQJB0CcQpAQhBwwCCyABIAE2AhAgAiABIAIoAgAoAgwRAgAgASgCECEEIAVBqCY2AgAgBUEEaiECQdAnEKQEIQcgBA0BCyABQQA2AigMAQsgASAERgRAIAEgAUEYaiIENgIoIAEgBCABKAIAKAIMEQIADAELIAFBADYCECABIAQ2AigLIAIgByABQRhqIgQgAxBSNgIAAkACfyAEIAEoAigiAkYEQCABQRhqIQIgASgCGEEQagwBCyACRQ0BIAIoAgBBFGoLIQMgAiADKAIAEQAACwJAAn8gASABKAIQIgJGBEAgASECIAEoAgBBEGoMAQsgAkUNASACKAIAQRRqCyEDIAIg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BGsoAgAQowELIAIiASAERw0ACwsgACAENgIkIAAoAkQiASAAKAJAIgJHBEADQCABQSxrIgQoAggiAwRAIANBBGsoAgAQowELIAFBIGsoAgAiAwRAIANBBGsoAgAQowELIAFBHGsoAgAiAQRAIAFBBGsoAgAQowELIAQiASACRw0ACyAAKAJAIQELIAAgAjYCRCABBEAgASACRwRAA0AgAkEsayIEKAIIIgMEQCADQQRrKAIAEKMBCyACQSBrKAIAIgMEQCADQQRrKAIAEKMBCyACQRxrKAIAIgIEQCACQQRrKAIAEKMBCyAEIgIgAUcNAAsgACgCQCECCyAAIAE2AkQgAhCjAQsgACgCICIEBEAgACgCJCIBIAQiAkcEQANAIAFBLGsiAigCCCIDBEAgA0EEaygCABCjAQsgAUEgaygCACIDBEAgA0EEaygCABCjAQsgAUEcaygCACIBBEAgAUEEaygCABCjAQsgAiIBIARHDQALIAAoAiAhAgsgACAENgIkIAIQowELC8QBAQF/IAAoAmgiAQRAIAFBBGsoAgAQowELIAAoAmwiAQRAIAFBBGsoAgAQowELIAAoAnAiAQRAIAFBBGsoAgAQowELIAAoAjwiAQRAIAFBBGsoAgAQowELIABBQGsoAgAiAQRAIAFBBGsoAgAQowELIAAoAkQiAQRAIAFBBGsoAgAQowELIAAoAhAiAQRAIAFBBGsoAgAQowELIAAoAhQiAQRAIAFBBGsoAgAQowELIAAoAhgiAARAIABBBGsoAgAQowELC44JAQR/IABB8AlqEHsgAEGgCWoQeyAAQdAIahB7IABBgAhqEHsgAEGwB2oQeyAAQeAGahB7IABBkAZqEHsgAEHEBWoQYiAAQfgEahBiIABBrARqEGIgAEHgA2oQYiAAQZQDahBiIABByAJqEGIgAEH8AWoQYiAAKALYASIBBEAgAUEEaygCABCjAQsgACgC3AEiAQRAIAFBBGsoAgAQowELIAAoAuABIgEEQCABQQRrKAIAEKMBCyAAKAKsASIBBEAgAUEEaygCABCjAQsgACgCsAEiAQRAIAFBBGsoAgAQowELIAAoArQBIgEEQCABQQRrKAIAEKMBCyAAKAKYASIDBEAgACgCnAEiASADIgJHBEADQCABQSxrIgIoAggiBARAIARBBGsoAgAQowELIAFBIGso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AyAISRtB/////wAgBUHw////B0kbIgMEQCADQYCAgIABTw0CIANBBHQQpAQhAgsgB0EEdCACakEAIAFBBHQiARCeASABaiEBIAZBAEoEQCACIAQgBhCcARoLIAAgAiADQQR0ajYCCCAAIAE2AgQgACACNgIAIAQEQCAEEKMBCw8LEDMACxCEAQALsAIBBX8jAEEQayIBJAAgACgCECECIAFBATYCCCABIAFBB2o2AgwCQCACKAIQIgJFDQAgAiABQQxqIAFBCGogAigCACgCGBEFACABLQAHIQMgACgCECECIAFBATYCCCABIAFBB2o2AgwgAigCECICRQ0AIAIgAUEMaiABQQhqIAIoAgAoAhgRBQAgAS0AByEEIAAoAhAhAiABQQE2AgggASABQQdqNgIMIAIoAhAiAkUNACACIAFBDGogAUEIaiACKAIAKAIYEQUAIAEtAAchBSAAKAIQIQIgAUEBNgIIIAEgAUEHajYCDCACKAIQIgJFDQAgAiABQQxqIAFBCGogAigCACgCGBEFACAAIAEtAAcgBEEQdCADQRh0ciAFQQh0cnI2AgAgAUEQaiQADwsQdAAL3wQBBn8jAEEwayICJAACQCAAKAIkIAAoAihHDQAgACgCCARAIABBJGohBiACQQhqIQQDQCACIAAoAhRBAWoQfiEFAkAgACgCKCIBIAAoAixJBEAgASAFKAIANgIAIAEgAi0ABDoABCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCAEQQA2AgggBEIANwIAIAAgAUEsajYCKAwBCyAGIAUQfyACKAIIIgFFDQAgAUEEaygCABCjAQsgAigCDCIBBEAgAUEEaygCABCjAQsgAigCECIBBEAgAUEEaygCABCjAQsgA0EBaiIDIAAoAghJDQALCyAAKAIURQ0AIABBxABqIQYgAkEIaiEEQQEhAwNAIAJBASADIAAoAgwiASABIANLG3QQfiEFAkAgACgCSCIBIAAoAkxJBEAgASAFKAIANgIAIAEgAi0ABDoABCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYC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IAEgACgCJEsNAQsDQCAGIAFBAWoiAUECdGogACgCAEEBazYCACABIAAoAiRNDQALCyAAIAAoAhhBBWxBAnYiASAAKAIAQQN0QTBqIgIgASACSRsiAjYCHCAAIAI2AhgLpgIBBX8gACABKAIAIgI2AgAgACABLQAEOgAEIAAgASgCFDYCFCAAIAEoAhg2AhggACABKAIcNgIcIAAgASgCIDYCICAAIAEoAiQ2AiQgACABKAIoNgIoIAJBAnQiBEHEAGoiBRCiASIGQcQAakFAcSIDQQRrIAY2AgAgACADNgIIIAIEfyADIAEoAgggBBCdASAAKAIABUEACyECIAUQogEiBEHEAGpBQHEiA0EEayAENgIAIAAgAzYCDCACBEAgAyABKAIMIAJBAnQQnQELAkAgACgCJCICBEAgAkECdEHMAGoQogEiBEHEAGpBQHEiA0EEayAENgIAIAAgAzYCECACQQJqIgJFDQEgAyABKAIQIAJBAnQQnQEgAA8LIABBADYCEAsgAAsvAQF/QQQQAyIAQfStATYCACAAQcytATYCACAAQeCtATYCACAAQdCuAUHsABAEAAs7AQF/QQgQAyIBQfStATYCACABQeSuATYCACABQQRqIAAQpQQgASIAQaivATYCACAAQcivAUHtABAEAAuABAELfyMAQRBrIgUkACAAKAIEIQcCQCABKAIQIgMEQCAAIAdBD3YiCDYCBCABKAIIIQkgAyAAKAIAIgogCG4iBiABKAIodkECdGoiAygCBEEBaiICIAMoAgAiA0EBaiIESwRAA0AgAiADakEBdiIEIAIgCSAEQQJ0aigCACAGSyILGyICIAMgBCALGyIDQQFqIgRLDQALCyAJIANBAnRqKAIAIAhsIQYgAyABKAIgRg0BIAkgBEECdGooAgAgCGwhBwwBCyAAIAdBD3YiCzYCBCABKAIAIghBAXYhAiAAKAIAIQogASgCCCEMQQAhAwNAIAYgDCACQQJ0aigCACALbCIJIAkgCksiBBshBiAJIAcgBBshByADIAIgBBsiAyADIAIgCCAEGyIIakEBdiICRw0ACwsgACAHIAZrIgI2AgQgACAKIAZrIgQ2AgACQCACQf///wdNBEADQCAAKAIQIQIgBUEBNgIIIAUgBUEHajYCDCACKAIQIgJFDQIgAiAFQQxqIAVBCGogAigCACgCGBEFACAAIAUtAAcgBEEIdHIiBDYCACAAIAAoAgRBCHQiAjYCBCACQYCAgAhJDQALCyABKAIMIANBAnRqIgAgACgCAEEBajYCACABIAEoAhxBAWsiADYCHCAARQRAIAEQggELIAVBEGokACADDwsQdAAL5wIBBH8jAEEQayIDJAAgACgCBCECIAAoAgAhBAJAAkAgAUEUTwRAIAAgAkEQdiICNgIEIAAgBCAEIAJuIgUgAmxrIgQ2AgADQCAAKAIQIQIgA0EBNgIIIAMgA0EHajYCDCACKAIQIgJFDQMgAiADQQxqIANBCGogAigCACgCGBEFACAAIAMtAAcgBEEIdHIiBDYCACAAIAAoAgRBCHQiAjYCBCACQYCAgAhJDQALIAVB//8DcSAAIAFBEGsQhwFBEHRyIQIMAQsgACACIAF2IgE2AgQgACAEIAQgAW4iAiABbGsiBDYCACABQf///wdLDQADQCAAKAIQIQEgA0EBNgIIIAMgA0EHajYCDCABKAIQIgFFDQIgASADQQxqIANBCGogASgCACgCGBEFACAAIAMtAAcgBEEIdHIiBDYCACAAIAAoAgRBCHQiATYCBCABQYCAgAhJDQALCyADQRBqJAAgAg8LEHQACwQAIAALJwEBf0EQEKQEIgFB9D02AgAgASAAKQIENwIEIAEgACgCDDYCDCABCx4AIAFB9D02AgAgASAAKQIENwIEIAEgACgCDDYCDAsTACAAQQRqQQAgASgCBEH8P0YbCwYAQdDBAAudAQEBfwJAIAEsAA9BAE4EQCAAIAFBBGoiAykCADcCACAAIAMoAgg2AggMAQsgACABKAIEIAEoAggQrQQLIAAgAS8BEDsBDCAAIAEzARI3AxAgAEEYaiEDIAEsAB9BAE4EQCADIAFBFGoiASkCADcCACADIAEoAgg2AgggACACNwMoIAAPCyADIAEoAhQgASgCGBCtBCAAIAI3AyggAAudAQEBfwJAIAEsAA9BAE4EQCAAIAFBBGoiAykCADcCACAAIAMoAgg2AggMAQsgACABKAIEIAEoAggQrQQLIAAgAS8BEDsBDCAAIAEpAxg3AxAgAEEYaiEDIAEsACtBAE4EQCADIAFBIGoiASkDADcDACADIAEoAgg2AgggACACNwMoIAAPCyADIAEoAiAgASgCJBCtBCAAIAI3AyggAAslAQF/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wAFBBCEDIAQtAAgEQCAAIAAgACgCAEEMaygCAGooAhgiAyABIAIgAygCACgCIBEEACIBNgIEQQBBBiABIAJGGyEDCyAAIAAoAgBBDGsoAgBqIAMQxwEgBEEQaiQACwkAIAAgARDjAQuEAQECfyMAQSBrIgIkACAAQn83AwggAEIANwMAIAJBGGogARDAASACLQAYBEAgAkEIaiABIAEoAgBBDGsoAgBqKAIYIgNCAEEBQQggAygCACgCEBETACAAIAIpAxA3AwggACACKQMINwMAIAEgASgCAEEMaygCAGpBABDHAQsgAkEgaiQAC+EBAQV/IwBBQGoiAiQAIAAgACgCAEEMaygCAGoiAyADKAIQQX1xIgMQywEgAkE4aiAAEMABIAItADgEQCAAIAAoAgBBDGsoAgBqKAIYIQQgAiABKQMINwMQIAIgASkDADcDCCMAQRBrIgEkACAEKAIAKAIUIQUgASACKQMQNwMIIAEgAikDCDcDACACQShqIgYgBCABQQggBREJACABQRBqJAAgAkEYaiIBQn83AwggAUIANwMAIAAgACgCAEEMaygCAGogA0EEciADIAYpAwggASkDCFEbEMcBCyACQUBrJAALqQEBBH8jAEEwayIDJAAgACAAKAIAQQxrKAIAaiICIAIoAhBBfXEiBBDLASADQShqIAAQwAEgAy0AKARAIANBGGoiBSAAIAAoAgBBDGsoAgBqKAIYIgIgAUEBQQggAigCACgCEBETACADQQhqIgJCfzcDCCACQgA3AwAgBSkDCCACKQMIUSECIAAgACgCAEEMaygCAGogBEEEciAEIAIbEMcBCyADQTBqJAALXAECfwJAIAAoAgAiAkUNAAJ/IAIoAhgiAyACKAIcRgRAIAIgAUH/AXEgAigCACgCNBEDAAwBCyACIANBAWo2AhggAyABOgAAIAFB/wFxC0F/Rw0AIABBADYCAAsLNgAgAgR/IAIEQANAIAAgASgCADYCACAAQQRqIQAgAUEEaiEBIAJBAWsiAg0ACwtBAAUgAAsaCwsAIABBrMIBEKQCCwwAIAAgARDVAUEBcwsNACAAKAIAENYBGiAACwkAIAAgARDVAQsQACAAEOABIAEQ4AFzQQFzCzEBAX8gACgCDCIBIAAoAhBGBEAgACAAKAIAKAIoEQEADwsgACABQQRqNgIMIAEoAgAL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IAEgA0FAaq2GIQJCACEBDAELIANFDQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJzIAJrIgKtQgAgAmciAkHRAGoQ6QEgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALUAEBfgJAIANBwABxBEAgAiADQUBqrYghAUIAIQIMAQsgA0UNACACQcAAIANrrYYgASADrSIEiIQhASACIASIIQILIAAgATcDACAAIAI3AwgLywoCBX8PfiMAQeAAayIFJAAgBEL///////8/gyEMIAIgBIVCgICAgICAgICAf4MhCiACQv///////z+DIg1CIIghDiAEQjCIp0H//wFxIQcCQAJAIAJCMIinQf//AXEiCUH//wFrQYKAfk8EQCAHQf//AWtBgYB+Sw0BCyABUCACQv///////////wCDIgtCgICAgICAwP//AFQgC0KAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEKDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQogAyEBDAILIAEgC0KAgICAgIDA//8AhYRQBEAgAiADhFAEQEKAgICAgIDg//8AIQpCACEBDAMLIApCgICAgICAwP//AIQhCkIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQCABIAuEIQJCACEBIAJQBEBCgICAgICA4P//ACEKDAMLIApCgICAgICAwP//AIQhCgwCCyABIAuEUARAQgAhAQwCCyACIAOEUARAQgAhAQwCCyALQv///////z9YBEAgBUHQAGogASANIAEgDSANUCIGG3kgBkEGdK18pyIGQQ9rEOkBQRAgBmshBiAFKQNYIg1CIIghDiAFKQNQIQELIAJC////////P1YNACAFQUBrIAMgDCADIAwgDFAiCBt5IAhBBnStfKciCEEPaxDpASAGIAhrQRBqIQYgBSkDSCEMIAUpA0AhAwsgA0IPhiILQoCA/v8PgyICIAFCIIgiBH4iECALQiCIIhMgAUL/////D4MiAX58Ig9CIIYiESABIAJ+fCILIBFUrSACIA1C/////w+DIg1+IhUgBCATfnwiESAMQg+GIhIgA0IxiIRC/////w+DIgMgAX58IhQgDyAQVK1CIIYgD0IgiIR8Ig8gAiAOQoCABIQiDH4iFiANIBN+fCIOIBJCIIhCgICAgAiEIgIgAX58IhAgAyAEfnwiEkIghnwiF3whASAHIAlqIAZqQf//AGshBgJAIAIgBH4iGCAMIBN+fCIEIBhUrSAEIAQgAyANfnwiBFatfCACIAx+fCAEIAQgESAVVK0gESAUVq18fCIEVq18IAMgDH4iAyACIA1+fCICIANUrUIghiACQiCIhHwgBCACQiCGfCICIARUrXwgAiACIBAgElatIA4gFlStIA4gEFatfHxCIIYgEkIgiIR8IgJWrXwgAiACIA8gFFStIA8gF1atfHwiAlatfCIEQoCAgICAgMAAg0IAUgRAIAZBAWohBgwBCyALQj+IIQMgBEIBhiACQj+IhCEEIAJCAYYgAUI/iIQhAiALQgGGIQsgAyABQgGGhCEBCyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiB0GAAU8EQEIAIQEMAwsgBUEwaiALIAEgBkH/AGoiBhDpASAFQSBqIAIgBCAGEOkBIAVBEGogCyABIAcQ6wEgBSACIAQgBxDrASAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCELIAUpAyggBSkDGIQhASAFKQMAIQIgBSkDCAwBCyAEQv///////z+DIAatQjCGhAsgCoQhCiALUCABQgBZIAFCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyALIAFCgICAgICAgICAf4WEQgBSBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC80JAgR+BH8jAEHwAGsiCiQAIARC////////////AIMhBQJAAkAgAVAiCSACQv///////////wCDIgZCgICAgICAwP//AH1CgICAgICAwICAf1QgBlAbRQRAIANCAFIgBUKAgICAgIDA//8AfSIIQoCAgICAgMCAgH9WIAhCgICAgICAwICAf1EbDQELIAkgBkKAgICAgIDA//8AVCAGQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgBkKAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgkbIQRCACABIAkbIQMMAgsgAyAFQoCAgICAgMD//wCFhFANASABIAaEUARAIAMgBYRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgBYRCAFINACABIQMgAiEEDAELIAMgASABIANUIAUgBlYgBSAGURsiDBshBSAEIAIgDBsiCEL///////8/gyEGIAIgBCAMGyIHQjCIp0H//wFxIQsgCEIwiKdB//8BcSIJRQRAIApB4ABqIAUgBiAFIAYgBlAiCRt5IAlBBnStfKciCUEPaxDpASAKKQNoIQYgCikDYCEFQRAgCWshCQsgASADIAwbIQMgB0L///////8/gyEEIAtFBEAgCkHQAGogAyAEIAMgBCAEUCILG3kgC0EGdK18pyILQQ9rEOkBQRAgC2shCyAKKQNYIQQgCikDUCEDCyAEQgOGIANCPYiEQoCAgICAgIAEhCECIAZCA4YgBUI9iIQhBCADQgOGIQEgByAIhSEDAkAgCSALRg0AIAkgC2siC0H/AEsEQEIAIQJCASEBDAELIApBQGsgASACQYABIAtrEOkBIApBMGogASACIAsQ6wEgCikDMCAKKQNAIAopA0iEQgBSrYQhASAKKQM4IQILIARCgICAgICAgASEIQcgBUIDhiEGAkAgA0IAUwRAQgAhA0IAIQQgASAGhSACIAeFhFANAiAGIAF9IQUgByACfSABIAZWrX0iBEL/////////A1YNASAKQSBqIAUgBCAFIAQgBFAiCxt5IAtBBnStfKdBDGsiCxDpASAJIAtrIQkgCikDKCEEIAopAyAhBQwBCyABIAZ8IgUgAVStIAIgB3x8IgRCgICAgICAgAiDUA0AIAVCAYMgBEI/hiAFQgGIhIQhBSAJQQFqIQkgBEIBiCEECyAIQoCAgICAgICAgH+DIQEgCUH//wFOBEAgAUKAgICAgIDA//8AhCEEQgAhAwwBC0EAIQsCQCAJQQBKBEAgCSELDAELIApBEGogBSAEIAlB/wBqEOkBIAogBSAEQQEgCWsQ6wEgCikDACAKKQMQIAopAxiEQgBSrYQhBSAKKQMIIQQLIARCPYYgBUIDiIQiAiAFp0EHcSIJQQRLrXwiAyACVK0gBEIDiEL///////8/gyALrUIwhoQgAYR8IQQCQCAJQQRGBEAgBCADQgGDIgEgA3wiAyABVK18IQQMAQsgCUUNAQsLIAAgAzcDACAAIAQ3AwggCkHwAGokAAv6AQIDfgJ/IwBBEGsiBSQAAn4gAb0iA0L///////////8AgyICQoCAgICAgIAIfUL/////////7/8AWARAIAJCPIYhBCACQgSIQoCAgICAgICAPHwMAQsgAkKAgICAgICA+P8AWgRAIANCPIYhBCADQgSIQoCAgICAgMD//wCEDAELIAJQBEBCAAwBCyAFIAJCACADp2dBIGogAkIgiKdnIAJCgICAgBBUGyIGQTFqEOkBIAUpAwAhBCAFKQMIQoCAgICAgMAAhUGM+AAgBmutQjCGhAshAiAAIAQ3AwAgACACIANCgICAgICAgICAf4OENwMIIAVBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC8QBAgF/An5BfyEDAkAgAEIAUiABQv///////////wCDIgRCgICAgICAwP//AFYgBEKAgICAgIDA//8AURsNAEEAIAJC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAAgBCAFhIRQBEBBAA8LIAEgAoNCAFkEQEEAIAEgAlMgASACURsNASAAIAEgAoWEQgBSDwsgAEIAUiABIAJVIAEgAlEbDQAgACABIAKFhEIAUiEDCyADC6kBAQF8RAAAAAAAAPA/IQECQCAAQYAITgRARAAAAAAAAOB/IQEgAEH/D0kEQCAAQf8HayEADAILRAAAAAAAAPB/IQEgAEH9FyAAQf0XSBtB/g9rIQAMAQsgAEGBeEoNAEQAAAAAAABgAyEBIABBuHBLBEAgAEHJB2ohAAwBC0QAAAAAAAAAACEBIABB8GggAEHwaEobQZIPaiEACyABIABB/wdqrUI0hr+iCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2QCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CACABZyIBQdEAahDpASACKQMIQoCAgICAgMAAhUGegAEgAWutQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQ7QEgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABDsASAEKQMoIQIgBCkDICEBIANB//8BSQRAIANB//8AayEDDAILIARBEGogASACQgBCgICAgICAgP//ABDsASADQf3/AiADQf3/AkgbQf7/AWshAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAgDkQ7AEgBCkDSCECIAQpA0AhASADQfSAfksEQCADQY3/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgIA5EOwBIANB6IF9IANB6IF9ShtBmv4BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhDsASAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALdQEBfiAAIAEgBH4gAiADfnwgA0IgiCICIAFCIIgiBH58IANC/////w+DIgMgAUL/////D4MiAX4iBUIgiCADIAR+fCIDQiCIfCABIAJ+IANC/////w+DfCIBQiCIfDcDCCAAIAVC/////w+DIAFCIIaENwMAC74PAgV/D34jAEHQAmsiBSQAIARC////////P4MhCyACQv///////z+DIQogAiAEhUKAgICAgICAgIB/gyENIARCMIinQf//AXEhCAJAAkAgAkIwiKdB//8BcSIJQf//AWtBgoB+TwRAIAhB//8Ba0GBgH5LDQELIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQ0MAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhDSADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIQ0MAwsgDUKAgICAgIDA//8AhCENQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAyEUARAQoCAgICAgOD//wAgDSACIAOEUBshDUIAIQEMAgsgAiADhFAEQCANQoCAgICAgMD//wCEIQ1CACEBDAILIAxC////////P1gEQCAFQcACaiABIAogASAKIApQIgYbeSAGQQZ0rXynIgZBD2sQ6QFBECAGayEGIAUpA8gCIQogBSkDwAIhAQsgAkL///////8/Vg0AIAVBsAJqIAMgCyADIAsgC1AiBxt5IAdBBnStfKciB0EPaxDpASAGIAdqQRBrIQYgBSkDuAIhCyAFKQOwAiEDCyAFQaACaiALQoCAgICAgMAAhCISQg+GIANCMYiEIgJCAEKAgICAsOa8gvUAIAJ9IgRCABD2ASAFQZACakIAIAUpA6gCfUIAIARCABD2ASAFQYACaiAFKQOYAkIBhiAFKQOQAkI/iIQiBEIAIAJCABD2ASAFQfABaiAEQgBCACAFKQOIAn1CABD2ASAFQeABaiAFKQP4AUIBhiAFKQPwAUI/iIQiBEIAIAJCABD2ASAFQdABaiAEQgBCACAFKQPoAX1CABD2ASAFQcABaiAFKQPYAUIBhiAFKQPQAUI/iIQiBEIAIAJCABD2ASAFQbABaiAEQgBCACAFKQPIAX1CABD2ASAFQaABaiACQgAgBSkDuAFCAYYgBSkDsAFCP4iEQgF9IgJCABD2ASAFQZABaiADQg+GQgAgAkIAEPYBIAVB8ABqIAJCAEIAIAUpA6gBIAUpA6ABIgwgBSkDmAF8IgQgDFStfCAEQgFWrXx9QgAQ9gEgBUGAAWpCASAEfUIAIAJCABD2ASAGIAkgCGtqIQYCfyAFKQNwIhNCAYYiDiAFKQOIASIPQgGGIAUpA4ABQj+IhHwiEELn7AB9IhRCIIgiAiAKQoCAgICAgMAAhCIVQgGGIhZCIIgiBH4iESABQgGGIgxCIIgiCyAQIBRWrSAOIBBWrSAFKQN4QgGGIBNCP4iEIA9CP4h8fHxCAX0iE0IgiCIQfnwiDiARVK0gDiAOIBNC/////w+DIhMgAUI/iCIXIApCAYaEQv////8PgyIKfnwiDlatfCAEIBB+fCAEIBN+IhEgCiAQfnwiDyARVK1CIIYgD0IgiIR8IA4gDiAPQiCGfCIOVq18IA4gDiAUQv////8PgyIUIAp+IhEgAiALfnwiDyARVK0gDyAPIBMgDEL+////D4MiEX58Ig9WrXx8Ig5WrXwgDiAEIBR+IhggECARfnwiBCACIAp+fCIKIAsgE358IhBCIIggCiAQVq0gBCAYVK0gBCAKVq18fEIghoR8IgQgDlStfCAEIA8gAiARfiICIAsgFH58IgtCIIggAiALVq1CIIaEfCICIA9UrSACIBBCIIZ8IAJUrXx8IgIgBFStfCIEQv////////8AWARAIBYgF4QhFSAFQdAAaiACIAQgAyASEPYBIAFCMYYgBSkDWH0gBSkDUCIBQgBSrX0hCkIAIAF9IQsgBkH+/wBqDAELIAVB4ABqIARCP4YgAkIBiIQiAiAEQgGIIgQgAyASEPYBIAFCMIYgBSkDaH0gBSkDYCIMQgBSrX0hCkIAIAx9IQsgASEMIAZB//8AagsiBkH//wFOBEAgDUKAgICAgIDA//8AhCENQgAhAQwBCwJ+IAZBAEoEQCAKQgGGIAtCP4iEIQogBEL///////8/gyAGrUIwhoQhDCALQgGGDAELIAZBj39MBEBCACEBDAILIAVBQGsgAiAEQQEgBmsQ6wEgBUEwaiAMIBUgBkHwAGoQ6QEgBUEgaiADIBIgBSkDQCICIAUpA0giDBD2ASAFKQM4IAUpAyhCAYYgBSkDICIBQj+IhH0gBSkDMCIEIAFCAYYiAVStfSEKIAQgAX0LIQQgBUEQaiADIBJCA0IAEPYBIAUgAyASQgVCABD2ASAMIAIgAiADIAJCAYMiASAEfCIDVCAKIAEgA1atfCIBIBJWIAEgElEbrXwiAlatfCIEIAIgAiAEQoCAgICAgMD//wBUIAMgBSkDEFYgASAFKQMYIgRWIAEgBFEbca18IgJWrXwiBCACIARCgICAgICAwP//AFQgAyAFKQMAViABIAUpAwgiA1YgASADURtxrXwiASACVK18IA2EIQ0LIAAgATcDACAAIA03AwggBUHQAmokAAvXBgIEfwN+IwBBgAFrIgUkAAJAAkACQCADIARCAEIAEO8BRQ0AAn8gBEL///////8/gyEJAn8gBEIwiKdB//8BcSIGQf//AUcEQEEEIAYNARpBAkEDIAMgCYRQGwwCCyADIAmEUAsLIQcgAkIwiKciCEH//wFxIgZB//8BRg0AIAcNAQsgBUEQaiABIAIgAyAEEOwBIAUgBSkDECIBIAUpAxgiAiABIAIQ9wEgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgkQ7wFBAEwEQCABIAogAyAJEO8BBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQ7AEgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABDsASAFKQNoIgpCMIinQfgAayEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAlCAEKAgICAgIDAu8AAEOwBIAUpA1giCUIwiKdB+ABrIQcgBSkDUCEDCyAJQv///////z+DQoCAgICAgMAAhCEJIApC////////P4NCgICAgICAwACEIQogBiAHSgRAA0ACfiAKIAl9IAMgBFatfSILQgBZBEAgCyAEIAN9IgSEUARAIAVBIGogASACQgBCABDsASAFKQMoIQIgBSkDICEEDAULIAtCAYYgBEI/iIQMAQsgCkIBhiAEQj+IhAshCiAEQgGGIQQgBkEBayIGIAdKDQALIAchBgsCQCAKIAl9IAMgBFatfSIJQgBTBEAgCiEJDAELIAkgBCADfSIEhEIAUg0AIAVBMGogASACQgBCABDsASAFKQM4IQIgBSkDMCEEDAELIAlC////////P1gEQANAIARCP4ghASAGQQFrIQYgBEIBhiEEIAEgCUIBhoQiCUKAgICAgIDAAFQNAAsLIAhBgIACcSEHIAZBAEwEQCAFQUBrIAQgCUL///////8/gyAGQfgAaiAHcq1CMIaEQgBCgICAgICAwMM/EOwBIAUpA0ghAiAFKQNAIQQMAQsgCUL///////8/gyAGIAdyrUIwhoQhAgsgACAENwMA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gICAgARqIQIgACAFQoCAgAiFhEIAUg0BIAIgBEEBcWohAgwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCGYinQf///wFxQYCAgP4HciECDAELQYCAgPwHIQIgBUL///////+/v8AAVg0AQQAhAiAFQjCIpyIEQZH+AEkNACADQRBqIAAgAUL///////8/g0KAgICAgIDAAIQiBSAEQYH+AGsQ6QEgAyAAIAVBgf8AIARrEOsBIAMpAwgiAEIZiKchAiADKQMAIAMpAxAgAykDGIRCAFKthCIFUCAAQv///w+DIgBCgICACFQgAEKAgIAIURtFBEAgAkEBaiECDAELIAUgAEKAgIAIhYRCAFINACACQQFxIAJqIQILIANBIGokACACIAFCIIinQYCAgIB4cXK+C9MDAgJ+An8jAEEgayIEJAACQCABQv///////////wCDIgNCgICAgICAwIA8fSADQoCAgICAgMD/wwB9VARAIAFCBIYgAEI8iIQhAyAAQv//////////D4MiAEKBgICAgICAgAhaBEAgA0KBgICAgICAgMAAfCECDAILIANCgICAgICAgIBAfSECIABCgICAgICAgIAIUg0BIAIgA0IBg3whAgwBCyAAUCADQoCAgICAgMD//wBUIANCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQIMAQtCgICAgICAgPj/ACECIANC////////v//DAFYNAEIAIQIgA0IwiKciBUGR9wBJDQAgBEEQaiAAIAFC////////P4NCgICAgICAwACEIgIgBUGB9wBrEOkBIAQgACACQYH4ACAFaxDrASAEKQMIQgSGIAQpAwAiAEI8iIQhAiAEKQMQIAQpAxiEQgBSrSAAQv//////////D4OEIgBCgYCAgICAgIAIWgRAIAJCAXwhAgwBCyAAQoCAgICAgICACFINACACQgGDIAJ8IQILIARBIGokACACIAFCgICAgICAgICAf4OEvwvlAgEGfyMAQRBrIgckACADQaDAASADGyIFKAIAIQMCQAJAAkAgAUUEQCADDQEMAwtBfiEEIAJFDQIgACAHQQxqIAAbIQYCQCADBEAgAiEADAELIAEtAAAiAEEYdEEYdSIDQQBOBEAgBiAANgIA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ajYCAAwBC0F/IQALIAxBEGokACAAC5cFAQF/IwBB8AJrIgAkACAAIAI2AuACIAAgATYC6AIgAEHIAWogAyAAQeABaiAAQdwBaiAAQdgBahDNAiAAQbgBahDYASIBIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgAAJ/IAEtAAtBB3YEQCABKAIADAELIAELIgI2ArQBIAAgAEEQajYCDCAAQQA2AgggAEEBOgAHIABBxQA6AAYDQAJAIABB6AJqIABB4AJqENIBRQ0AIAAoArQBAn8gAS0AC0EHdgRAIAEoAgQMAQsgAS0ACwsgAmpGBEACfyABLQALQQd2BEAgASgCBAwBCyABLQALCyEDIAECfyABLQALQQd2BEAgASgCBAwBCyABLQALC0EBdBDbASABIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgACADAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAmo2ArQBCwJ/IAAoAugCIgMoAgwiBiADKAIQRgRAIAMgAygCACgCJBEBAAwBCyAGKAIACyAAQQdqIABBBmogAiAAQbQBaiAAKALcASAAKALYASAAQcgBaiAAQRBqIABBDGogAEEIaiAAQeABahDOAg0AIABB6AJqENMBGgwBCwsCQAJ/IAAtANMBQQd2BEAgACgCzAEMAQsgAC0A0wELRQ0AIAAtAAdFDQAgACgCDCIDIABBEGprQZ8BSg0AIAAgA0EEajYCDCADIAAoAgg2AgALIAUgAiAAKAK0ASAEELkCOQMAIABByAFqIABBEGogACgCDCAEEKsCIABB6AJqIABB4AJqENQBBEAgBCAEKAIAQQJyNgIACyAAKALoAiECIAEQqgQaIABByAFqEKoEGiAAQfACaiQAIAILrgUCAX8BfiMAQYADayIAJAAgACACNgLwAiAAIAE2AvgCIABB2AFqIAMgAEHwAWogAEHsAWogAEHoAWoQzQIgAEHIAWoQ2AEiASABLQALQQd2BH8gASgCCEH/////B3FBAWsFQQoLENsBIAACfyABLQALQQd2BEAgASgCAAwBCyABCyICNgLEASAAIABBIGo2AhwgAEEANgIYIABBAToAFyAAQcUAOgAWA0ACQCAAQfgCaiAAQfACahDSAUUNACAAKALEAQJ/IAEtAAtBB3YEQCABKAIE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AkAgAEE8Sg0AIAFBBHENACAFIAA2AgAMAQsgBCABQQRyNgIACwwJCyAHQajwACkDADcDGCAHQaDwACkDADcDECAHQZjwACkDADcDCCAHQZDwACkDADcDACAHIAAgASACIAMgBCAFIAcgB0EgahCBAzYCOAwICyAHQThqIAIgBCAIQQEQigMhACAEKAIAIQECQAJAIABBBkoNACABQQRxDQAgBSAANgIYDAELIAQgAUEEcjYCAAsMBwsgACABIAIgAyAEIAUgACgCACgCFBEGAAwHCyAHIAAgASACIAMgBCAFAn8gAEEIaiAAKAIIKAIYEQEAIgAtAAtBB3YEQCAAKAIADAELIAALAn8gAC0AC0EHdgRAIAAoAgAMAQsgAAsCfyAALQALQQd2BEAgACgCBAwBCyAALQALC0ECdGoQgQM2AjgMBQsgBUEUaiAHQThqIAIgBCAIEIkDDAQLIAdBOGogAiAEIAhBBBCKAyEAIAQtAABBBHFFBEAgBSAAQewOazYCFAsMAwsgBkElRg0BCyAEIAQoAgBBBHI2AgAMAQsjAEEQayIAJAAgACACNgIIQQYhAQJAAkAgB0E4aiIDIABBCGoQ1AENAEEEIQEgCAJ/IAMoAgAiAigCDCIFIAIoAhBGBEAgAiACKAIAKAIkEQEADAELIAUoAgALQQAgCCgCACgCNBEEAEElRw0AQQIhASADENMBIABBCGoQ1AFFDQELIAQgBCgCACABcjYCAAsgAEEQaiQACyAHKAI4CyEAIAdBQGskACAAC4UBACMAQYABayICJAAgAiACQfQAajYCDCAAQQhqIAJBEGoiACACQQxqIAQgBSAGEI0DIAAhBCACKAIMIQMjAEEQayIAJAAgACABNgIIA0AgAyAERwRAIABBCGogBCwAABDPASAEQQFqIQQMAQsLIAAoAgghASAAQRBqJAAgAkGAAWokACABC20BAX8jAEEQayIGJAAgBkEAOgAPIAYgBToADiAGIAQ6AA0gBkElOgAMIAUEQCAGLQANIQQgBiAGLQAOOgANIAYgBDoADgsgAiABIAIoAgAgAWsgBkEMaiADIAAoAgAQFCABajYCACAGQRBqJAALBAAgAQvBAgECfyMAQaADayIIJAAgCCAIQaADaiIDNgIMIwBBkAFrIgckACAHIAdBhAFqNgIcIABBCGogB0EgaiICIAdBHGogBCAFIAYQjQMgB0IANwMQIAcgAjYCDCAIKAIMIAhBEGoiAmtBAnUhBSAAKAIIIQAjAEEQayIEJAAgBCAANgIMIARBCGogBEEMahDAAiEGIAIgB0EMaiAFIAdBEGoQlgIhACAGKAIAIgUEQEGIwAEoAgAaIAUEQEGIwAFB+LYBIAUgBUF/Rhs2AgALCyAEQRBqJAAgAEF/RgRAENwBAAsgCCACIABBAnRqNgIMIAdBkAFqJAAgCCgCDCEEIwBBEGsiACQAIAAgATYCCANAIAIgBEcEQCAAQQhqIAIoAgAQ1wEgAkEEaiECDAELCyAAKAIIIQEgAEEQaiQAIAMkACABCwUAQf8ACwgAIAAQ2AEaC0UBAX8jAEEQayICJAAjAEEQayIBJAAgAEEBOgALIABBAUEtEKwEIAFBADoADyAAIAEtAA86AAEgAUEQaiQAIAJBEGokAAsMACAAQYKGgCA2AAALCABB/////wcLDAAgAEEBQS0Q8gIaC0gBAX8jAEEQayICJAACQCABLQALQQd2RQRAIAAgASgCCDYCCCAAIAEpAgA3AgAMAQsgACABKAIAIAEoAgQQrQQLIAJBEGokAAviBAECfyMAQaACayIAJAAgACACNgKQAiAAIAE2ApgCIABBmAE2AhAgAEGYAWogAEGgAWogAEEQahClAiEHIABBkAFqIgggBCgCHCIBNgIAIAEgASgCBEEBajYCBCAIEMIBIQEgAEEAOgCPAQJAIABBmAJqIAIgAyAIIAQoAgQgBSAAQY8BaiABIAcgAEGUAWogAEGEAmoQmANFDQAgAEHmEygAADYAhwEgAEHfEykAADcDgAEgASAAQYABaiAAQYoBaiAAQfYAaiABKAIAKAIgEQcAGiAAQZcBNgIQIABBCGpBACAAQRBqIgQQpQIhAQJAIAAoApQBIAcoAgBrQeMATgRAIAAoApQBIAcoAgBrQQJqEKIBIQMgASgCACECIAEgAzYCACACBEAgAiABKAIEEQAACyABKAIARQ0BIAEoAgAhBAsgAC0AjwEEQCAEQS06AAAgBEEBaiEECyAHKAIAIQIDQCAAKAKUASACTQRAAkAgBEEAOgAAIAAgBjYCACAAQRBqIAAQkgJBAUcNACABKAIAIQIgAUEANgIAIAIEQCACIAEoAgQRAAALDAQLBSAEIABB9gBqIgMgA0EKaiACEL8CIABrIABqLQAKOgAAIARBAWohBCACQQFqIQIMAQsLENwBAAsQ3AEACyAAQZgCaiAAQZACahDGAQRAIAUgBSgCAEECcjYCAAsgACgCmAIhAiAAKAKQASIBIAEoAgRBAWsiAzYCBCADQX9GBEAgASABKAIAKAIIEQAACyAHKAIAIQEgB0EANgIAIAEEQCABIAcoAgQRAAALIABBoAJqJAAgAgumFQEKfyMAQbAEayILJAAgCyAKNgKkBCALIAE2AqgEAkAgACALQagEahDGAQRAIAUgBSgCAEEEcjYCAEEAIQAMAQsgC0GYATYCaCALIAtBiAFqIAtBkAFqIAtB6ABqIgEQpQIiDygCACIKNgKEASALIApBkANqNgKAASABENgBIREgC0HYAGoQ2AEhDiALQcgAahDYASENIAtBOGoQ2AEhDCALQShqENgBIRAjAEEQayIBJAAgCwJ/IAIEQCABIAMQnQMiAiACKAIAKAIsEQIAIAsgASgCADYAeCABIAIgAigCACgCIBECACAMIAEQ2QEgARCqBBogASACIAIoAgAoAhwRAgAgDSABENkBIAEQqgQaIAsgAiACKAIAKAIMEQEAOgB3IAsgAiACKAIAKAIQEQEAOgB2IAEgAiACKAIAKAIUEQIAIBEgARDZASABEKoEGiABIAIgAigCACgCGBECACAOIAEQ2QEgARCqBBogAiACKAIAKAIkEQEADAELIAEgAxCeAyICIAIoAgAoAiwRAgAgCyABKAIANgB4IAEgAiACKAIAKAIgEQIAIAwgARDZASABEKoEGiABIAIgAigCACgCHBECACANIAEQ2QEgARCqBBogCyACIAIoAgAoAgwRAQA6AHcgCyACIAIoAgAoAhARAQA6AHYgASACIAIoAgAoAhQRAgAgESABENkBIAEQqgQaIAEgAiACKAIAKAIYEQIAIA4gARDZASABEKoEGiACIAIoAgAoAiQRAQALNgIkIAFBEGokACAJIAgoAgA2AgAgBEGABHEiEkEJdiETQQAhA0EAIQEDQCABIQICQAJAAkACQCADQQRGDQAgACALQagEahDDAUUNAEEAIQoCQAJAAkACQAJAAkAgC0H4AGogA2osAAAOBQEABAMFCQsgA0EDRg0HIAAQxAEiAUEATgR/IAcoAgggAUH/AXFBAnRqKAIAQQFxBUEACwRAIAtB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ASEBIABBADoAvwECQCAAQegEaiACIAMgCCAEKAIEIAUgAEG/AWogASAHIABBxAFqIABB4ARqEKIDRQ0AIABB5hMoAAA2ALcBIABB3xMpAAA3A7ABIAEgAEGwAWogAEG6AWogAEGAAWogASgCACgCMBEHABogAEGXATYCECAAQQhqQQAgAEEQaiIEEKUCIQECQCAAKALEASAHKAIAa0GJA04EQCAAKALEASAHKAIAa0ECdUECahCiASEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEAAAsgASgCAEUNASABKAIAIQQLIAAtAL8BBEAgBEEtOgAAIARBAWohBAsgBygCACECA0AgACgCxAEgAk0EQAJAIARBADoAACAAIAY2AgAgAEEQaiAAEJICQQFHDQAgASgCACECIAFBADYCACACBEAgAiABKAIEEQAACwwECwUgBCAAQbABaiAAQYABaiIDIANBKGogAhDSAiADa0ECdWotAAA6AAAgBEEBaiEEIAJBBGohAgwBCwsQ3AEACxDcAQALIABB6ARqIABB4ARqENQBBEAgBSAFKAIAQQJyNgIACyAAKALoBCECIAAoAsABIgEgASgCBEEBayIDNgIEIANBf0YEQCABIAEoAgAoAggRAAALIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEAAAsgAEHwBGokACACC8YXAQp/IwBBsARrIgskACALIAo2AqQEIAsgATYCqAQCQCAAIAtBqARqENQBBEAgBSAFKAIAQQRyNgIAQQAhAAwBCyALQZgBNgJgIAsgC0GIAWogC0GQAWogC0HgAGoiARClAiIPKAIAIgo2AoQBIAsgCkGQA2o2AoABIAEQ2AEhESALQdAAahDYASEOIAtBQGsQ2AEhDSALQTBqENgBIQwgC0EgahDYASEQIwBBEGsiASQAIAsCfyACBEAgASADEKUDIgIgAigCACgCLBECACALIAEoAgA2AHggASACIAIoAgAoAiARAgAgDCABEKYDIAEQswQaIAEgAiACKAIAKAIcEQIAIA0gARCmAyABELMEGiALIAIgAigCACgCDBEBADYCdCALIAIgAigCACgCEBEBADYCcCABIAIgAigCACgCFBECACARIAEQ2QEgARCqBBogASACIAIoAgAoAhgRAgAgDiABEKYDIAEQswQaIAIgAigCACgC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gAFqEJsDIAsoAoQBIQELIAsgAUEEajYChAEgASAKNgIAQQALIQogABDTARoMAQsLAkAgCygChAEiASAPKAIARg0AIApFDQAgCygCgAEgAUYEQCAPIAtBhAFqIAtBgAFqEJsDIAsoAoQBIQELIAsgAUEEajYChAEgASAKNgIACwJAIAsoAhxBAEwNAAJAIAAgC0GoBGoQ1AFFBEACfyAAKAIAIgEoAgwiBCABKAIQRgRAIAEgASgCACgCJBEBAAwBCyAEKAIACyALKAJ0Rg0BCyAFIAUoAgBBBHI2AgBBACEADAMLA0AgABDTARogCygCHEEATA0BAkAgACALQagEahDUAUUEQCAHQcAAAn8gACgCACIBKAIMIgQgASgCEEYEQCABIAEoAgAoAiQRAQAMAQsgBCgCAAsgBygCACgCDBEEAA0BCyAFIAUoAgBBBHI2AgBBACEADAQLIAkoAgAgCygCpARGBEAgCCAJIAtBpARqEJsDCwJ/IAAoAgAiASgCDCIEIAEoAhBGBEAgASABKAIAKAIkEQEADAELIAQoAgALIQEgCSAJKAIAIgRBBGo2AgAgBCABNgIAIAsgCygCHEEBazYCHAwACwALIAIhASAIKAIAIAkoAgBHDQMgBSAFKAIAQQRyNgIAQQAhAAwBCwJAIAJFDQBBASEKA0ACfyACLQALQQd2BEAgAigCBAwBCyACLQALCyAKTQ0BAkAgACALQagEahDUAUUEQAJ/IAAoAgAiASgCDCIDIAEoAhBGBEAgASABKAIAKAIkEQEADAELIAMoAgALAn8gAi0AC0EHdgRAIAIoAgAMAQsgAgsgCkECdGooAgBGDQELIAUgBSgCAEEEcjYCAEEAIQAMAwsgABDTARogCkEBaiEKDAALAAtBASEAIA8oAgAgCygChAFGDQBBACEAIAtBADYCECARIA8oAgAgCygChAEgC0EQahCrAiALKAIQBEAgBSAFKAIAQQRyNgIADAELQQEhAAsgEBCzBBogDBCzBBogDRCzBBogDhCzBBogERCqBBogDygCACEBIA9BADYCACABBEAgASAPKAIEEQAACwwDCyACIQELIANBAWohAwwACwALIAtBsARqJAAgAAsfAQF/IAEoAgAQ1gEhAiAAIAEoAgA2AgQgACACNgIAC8IIAQR/IwBBwANrIgAkACAAIAI2ArADIAAgATYCuAMgAEGYATYCFCAAQRhqIABBIGogAEEUaiIIEKUCIQkgAEEQaiIHIAQoAhwiATYCACABIAEoAgRBAWo2AgQgBxDRASEBIABBADoADyAAQbgDaiACIAMgByAEKAIEIAUgAEEPaiABIAkgCCAAQbADahCiAwRAIwBBEGsiAiQAAkAgBi0AC0EHdgRAIAYoAgAhAyACQQA2AgwgAyACKAIMNgIAIAZBADYCBAwBCyACQQA2AgggBiACKAIINgIAIAZBADoACwsgAkEQaiQAIAAtAA8EQCAGIAFBLSABKAIAKAIsEQMAELUECyABQTAgASgCACgCLBEDACEBIAkoAgAhAiAAKAIUIghBBGshAwNAAkAgAiADTw0AIAIoAgAgAUcNACACQQRqIQIMAQsLIwBBEGsiAyQAAn8gBi0AC0EHdgRAIAYoAgQMAQsgBi0ACwshByAGIgEtAAtBB3YEfyABKAIIQf////8HcUEBawVBAQshBAJAIAggAmtBAnUiCkUNAAJ/IAEtAAtBB3YEQCAGKAIADAELIAYLIAJNBH8CfyAGLQALQQd2BEAgBigCAAwBCyAGCwJ/IAYtAAtBB3YEQCAGKAIEDAELIAYtAAsLQQJ0aiACTwVBAAtFBEAgCiAEIAdrSwRAIAYgBCAHIApqIARrIAcgBxC0BAsCfyAGLQALQQd2BEAgBigCAAwBCyAGCyAHQQJ0aiEEA0AgAiAIRwRAIAQgAigCADYCACACQQRqIQIgBEEEaiEEDAELCyADQQA2AgAgBCADKAIANgIAIAcgCmohAQJAIAYtAAtBB3YEQCAGIAE2AgQMAQsgBiABOgALCwwBCyMAQRBrIgEkACADIAIgCBCfAiABQRBqJAACfyADIgEtAAtBB3YEQCABKAIADAELIAELIQgCfyABLQALQQd2BEAgAygCBAwBCyADLQALCyECIwBBEGsiByQAAkAgAiAGIgEtAAtBB3YEfyABKAIIQf////8HcUEBawVBAQsiBgJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLIgRrTQRAIAJFDQECfyABLQALQQd2BEAgASgCAAwBCyABCyIGIARBAnRqIAggAhDQASACIARqIQICQCABLQALQQd2BEAgASACNgIEDAELIAEgAjoACwsgB0EANgIMIAYgAkECdGogBygCDDYCAAwBCyABIAYgAiAEaiAGayAEIARBACACIAgQsgQLIAdBEGokACADELMEGgsgA0EQaiQACyAAQbgDaiAAQbADahDUAQRAIAUgBSgCAEECcjYCAAsgACgCuAMhAiAAKAIQIgEgASgCBEEBayIDNgIEIANBf0YEQCABIAEoAgAoAggRAAALIAkoAgAhASAJQQA2AgAgAQRAIAEgCSgCBBEAAAsgAEHAA2okACACCwsAIABB0MEBEKQCC2EBAX8jAEEQayICJAAgAC0AC0EHdgRAIAAgACgCACAAKAIIQf////8HcRCXBAsgACABKAIINgIIIAAgASkCADcCACABQQA6AAsgAkEANgIMIAEgAigCDDYCACACQRBqJAALCwAgAEHIwQEQpAILNwEBfyMAQRBrIgIkACACIAAoAgA2AgggAiACKAIIIAFBAnRqNgIIIAIoAgghACACQRBqJAAgAAv2BgELfyMAQdADayIAJAAgACAFNwMQIAAgBjcDGCAAIABB4AJqIgc2AtwCIAcgAEEQahCTAiEJIABBlwE2AvABIABB6AFqQQAgAEHwAWoiDBClAiENIABBlwE2AvABIABB4AFqQQAgDBClAiEKAkAgCUHkAE8EQBC9AiEHIAAgBTcDACAAIAY3AwggAEHcAmogB0HqDCAAEOECIglBf0YNASANKAIAIQcgDSAAKALcAjYCACAHBEAgByANKAIEEQAACyAJEKIBIQggCigCACEHIAogCDYCACAHBEAgByAKKAIEEQAACyAKKAIARQ0BIAooAgAhDAsgAEHYAWoiCCADKAIcIgc2AgAgByAHKAIEQQFqNgIEIAgQwgEiESIHIAAoAtwCIgggCCAJaiAMIAcoAgAoAiARBwAaIAlBAEoEQCAAKALcAi0AAEEtRiEPCyACIA8gAEHYAWogAEHQAWogAEHPAWogAEHOAWogAEHAAWoQ2AEiECAAQbABahDYASIHIABBoAFqENgBIgggAEGcAWoQqgMgAEGXATYCMCAAQShqQQAgAEEwaiICEKUCIQsCfyAAKAKcASIOIAlIBEAgACgCnAECfyAHLQALQQd2BEAgBygCBAwBCyAHLQALCwJ/IAgtAAtBB3YEQCAIKAIEDAELIAgtAAsLIAkgDmtBAXRqampBAWoMAQsgACgCnAECfyAILQALQQd2BEAgCCgCBAwBCyAILQALCwJ/IActAAtBB3YEQCAHKAIEDAELIActAAsLampBAmoLIg5B5QBPBEAgDhCiASEOIAsoAgAhAiALIA42AgAgAgRAIAIgCygCBBEAAAsgCygCACICRQ0BCyACIABBJGogAEEgaiADKAIEIAwgCSAMaiARIA8gAEHQAWogACwAzwEgACwAzgEgECAHIAggACgCnAEQqwMgASACIAAoAiQgACgCICADIAQQRyECIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEAAAsgCBCqBBogBxCqBBogEBCqBBogACgC2AEiASABKAIEQQFrIgM2AgQgA0F/RgRAIAEgASgCACgCCBEAAAsgCigCACEBIApBADYCACABBEAgASAKKAIEEQAACyANKAIAIQEgDUEANgIAIAEEQCABIA0oAgQRAAALIABB0ANqJAAgAg8LENwBAAvRAwEBfyMAQRBrIgokACAJAn8gAARAIAIQnQMhAAJAIAEEQCAKIAAgACgCACgCLBECACADIAooAgA2AAAgCiAAIAAoAgAoAiARAgAMAQsgCiAAIAAoAgAoAigRAgAgAyAKKAIANgAAIAogACAAKAIAKAIcEQIACyAIIAoQ2QEgChCqBBogBCAAIAAoAgAoAgwRAQA6AAAgBSAAIAAoAgAoAhARAQA6AAAgCiAAIAAoAgAoAhQRAgAgBiAKENkBIAoQqgQaIAogACAAKAIAKAIYEQIAIAcgChDZASAKEKoEGiAAIAAoAgAoAiQRAQAMAQsgAhCeAyEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDZASAKEKoEGiAEIAAgACgCACgCDBEBADoAACAFIAAgACgCACgCEBEBADoAACAKIAAgACgCACgCFBECACAGIAoQ2QEgChCqBBogCiAAIAAoAgAoAhgRAgAgByAKENkBIAoQqgQaIAAgACgCACgCJBEBAAs2AgAgCkEQaiQAC80HAQp/IwBBEGsiEyQAIAIgADYCACADQYAEcSEWA0AgFEEERgRAAn8gDS0AC0EHdgRAIA0oAgQMAQsgDS0ACwtBAUsEQCATIA0Q1AI2AgggAiATQQhqQQEQnwMgDRDVAiACKAIA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B0HqDCAAEOECIglBf0YNASANKAIAIQcgDSAAKAK8BzYCACAHBEAgByANKAIEEQAACyAJQQJ0EKIBIQggCigCACEHIAogCDYCACAHBEAgByAKKAIEEQAACyAKKAIARQ0BIAooAgAhDAsgAEGIBGoiCCADKAIcIgc2AgAgByAHKAIEQQFqNgIEIAgQ0QEiESIHIAAoArwHIgggCCAJaiAMIAcoAgAoAjARBwAaIAlBAEoEQCAAKAK8By0AAEEtRiEPCyACIA8gAEGIBGogAEGABGogAEH8A2ogAEH4A2ogAEHoA2oQ2AEiECAAQdgDahDYASIHIABByANqENgBIgggAEHEA2oQrwMgAEGXATYCMCAAQShqQQAgAEEwaiICEKUCIQsCfyAAKALEAyIOIAlIBEAgACgCxAMCfyAHLQALQQd2BEAgBygCBAwBCyAHLQALCwJ/IAgtAAtBB3YEQCAIKAIEDAELIAgtAAsLIAkgDmtBAXRqampBAWoMAQsgACgCxAMCfyAILQALQQd2BEAgCCgCBAwBCyAILQALCwJ/IActAAtBB3YEQCAHKAIEDAELIActAAsLampBAmoLIg5B5QBPBEAgDkECdBCiASEOIAsoAgAhAiALIA42AgAgAgRAIAIgCygCBBEAAAsgCygCACICRQ0BCyACIABBJGogAEEgaiADKAIEIAwgDCAJQQJ0aiARIA8gAEGABGogACgC/AMgACgC+AMgECAHIAggACgCxAMQsAMgASACIAAoAiQgACgCICADIAQQ6gIhAiALKAIAIQEgC0EANgIAIAEEQCABIAsoAgQRAAALIAgQswQaIAcQswQaIBAQqgQaIAAoAogEIgEgASgCBEEBayIDNgIEIANBf0YEQCABIAEoAgAoAggRAAALIAooAgAhASAKQQA2AgAgAQRAIAEgCigCBBEAAAsgDSgCACEBIA1BADYCACABBEAgASANKAIEEQAACyAAQbAIaiQAIAIPCxDcAQAL0QMBAX8jAEEQayIKJAAgCQJ/IAAEQCACEKUDIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKEKYDIAoQswQaIAQgACAAKAIAKAIMEQEA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C0GMxAELCgBBjMQBEKoEGgslAEGoxAEtAABFBEBBnMQBQcj7ABDzA0GoxAFBAToAAAtBnMQBCwoAQZzEARCzBBoLCgAgABCVBBCjAQsYACAAKAIIEL0CRwRAIAAoAggQlAILIAALQgECfyMAQRBrIgEkACABIAA2AgggASgCCCECIwBBEGsiACQAIAAgAjYCCCAAKAIIIQIgAEEQaiQAIAFBEGokACACCwkAIAAgARCYBAsJACABQQQQ3gELXwEEfyMAQRBrIgAkACAAQf////8DNgIMIABB/////wc2AggjAEEQayIBJAAgAEEIaiICKAIAIABBDGoiAygCAEkhBCABQRBqJAAgAiADIAQbKAIAIQEgAEEQaiQAIAELPwEBfyMAQRBrIgIkAAJAAkAgAUEeSw0AIAAtAHgNACAAQQE6AHgMAQsgAkEIaiABEJsEIQALIAJBEGokACAACxwAIAFB/////wNLBEAQhAEACyABQQJ0QQQQ4gELJgEBfyAAKAIEIQIDQCABIAJHBEAgAkEEayECDAELCyAAIAE2AgQLCgAgABC9AjYCAAsHACAAKAIECwkAIAAgARCbBAtGAQF/IwBBEGsiAyQAAkAgAC0AC0EHdgRAIAAgAjYCBAwBCyAAIAI6AAsLIANBADoADyABIAJqIAMtAA86AAAgA0EQaiQACxYAIAAgASACQoCAgICAgICAgH8QlwILDQAgACABIAJCfxCXAgs3AQF/AkAgAEEIaiIBKAIABEAgASABKAIAQQFrIgE2AgAgAUF/Rw0BCyAAIAAoAgAoAhARAAALCzQBAX8gAEEBIAAbIQACQANAIAAQogEiAQ0BQejQASgCACIBBEAgAREMAAwBCwsQEQALIAELOgECfyABEKABIgJBDWoQpAQiA0EANgIIIAMgAjYCBCADIAI2AgAgACADQQxqIAEgAkEBahCcATYCAAsxACABQQlNBEAgACABQTBqOgAAIABBAWoPCyAAIAFBAXRBkKUBai8BADsAACAAQQJqCz8BAX8gACABQeQAbiICQQF0QZClAWovAQA7AAAgAEECaiIAIAEgAkHkAGxrQQF0QZClAWovAQA7AAAgAEECagtZAQF/IAFB4wBNBEAgACABEKYEDwsgAUHnB00EQCAAIAFB5ABuIgJBMGo6AAAgAEEBaiIAIAEgAkHkAGxrQQF0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AEZyaQBiYWRfYXJyYXlfbmV3X2xlbmd0aABnZXRQb2ludExlbmd0aABNYXJjaABBdWcAdW5zaWduZWQgbG9uZwBzdGQ6OndzdHJpbmcAYmFzaWNfc3RyaW5nAHN0ZDo6c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGluZgAlLjBMZgAlTGYAdHJ1ZQBUdWUAZmFsc2UASnVuZQBDaHVuayB0YWJsZSBvZmZzZXQgPT0gLTEgaXMgbm90IHN1cHBvcnRlZCBhdCB0aGlzIHRpbWUAZG91YmxlAHZvaWQAbGFzemlwIGVuY29kZWQAV2VkAHN0ZDo6YmFkX2FsbG9jAExBU0ZfU3BlYwBEZWMARmViAENvdWxkbid0IG9wZW4gbWVtX2ZpbGUgYXMgTEFTL0xBWgAlYSAlYiAlZCAlSDolTTolUyAlWQBQT1NJWAAlSDolTTolUwBDb3VsZG4ndCBmaW5kIExBU1pJUCBWTFIATkFOAFBNAEFNAExDX0FMTABMQU5HAExBU0YASU5GAEMAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBzdGQ6OmJhc2ljX3N0cmluZzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgAwMTIzNDU2Nzg5AEMuVVRGLTgASW52YWxpZCBMQVMgZmlsZS4gSW5jb3JyZWN0IG1hZ2ljIG51bWJlci4ASGVhZGVyIGJpdHMgaW5kaWNhdGUgdW5zdXBwb3J0ZWQgb2xkLXN0eWxlIGNvbXByZXNzaW9uLgBCYWQgY2h1bmsgdGFibGUuIEludmFsaWQgdmVyc2lvbi4AVW5leHBlY3RlZCBlbmQgb2YgZmlsZS4ATWlzc2luZyBjaHVuayB0YWJsZS4ARXJyb3IgcmVhZGluZyBjaHVuayB0YWJsZS4AQ291bGRuJ3QgcmVhZCBjaHVuayB0YWJsZS4ASGVhZGVyIGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgY29tcHJlc3NlZC4AKG51bGwpAFB1cmUgdmlydHVhbCBmdW5jdGlvbiBjYWxsZWQhAE1pc21hdGNoIGJldHdlZW4gcG9pbnQgZm9ybWF0IG9mIAAgYW5kIGNvbXByZXNzb3IgdmVyc2lvbiBvZiAANkxBU1ppcAAAAADQVQAAaQsAAFA2TEFTWmlwAAAAALBWAAB8CwAAAAAAAHQLAABQSzZMQVNaaXAAAACwVgAAmAsAAAEAAAB0CwAAaWkAdgB2aQCICwAADFUAAIgLAAB4VQAAkFUAAHZpaWlpAAAAAAAAAIAMAAAWAAAAFwAAABgAAAAZAAAAGgAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmY2cmVhZGVyOG1lbV9maWxlRU5TXzEwc2hhcmVkX3B0cklTM19FMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzNfUzNfRUVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAAA+FUAAPQLAAB4UgAATlN0M19fMjEwc2hhcmVkX3B0cklON2xhenBlcmY2cmVhZGVyOG1lbV9maWxlRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTM19TM19FRQAAAHhVAACkCwAAaWlpAAxVAACICwAAbFUAAHZpaWkAMTJDaHVua0RlY29kZXIA0FUAAAENAABQMTJDaHVua0RlY29kZXIAsFYAABgNAAAAAAAAEA0AAFBLMTJDaHVua0RlY29kZXIAAAAAsFYAADgNAAABAAAAEA0AACgNAAAMVQAAKA0AAGxVAABsVQAAeFUAAHZpaWlpaQAAAAAAACwOAAAWAAAAGwAAABwAAAAdAAAAHgAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmY2cmVhZGVyMThjaHVua19kZWNvbXByZXNzb3JFTlNfMTBzaGFyZWRfcHRySVMzX0UyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTM19TM19FRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQD4VQAAmA0AAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjZyZWFkZXIxOGNodW5rX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzNfUzNfRUUAAAAADFUAACgNAAB4VQAAdwEAABQAAAAcAAAAGgAAACIAQcQdC84DHgAAACQAAAAmAAAA7P///+T////m////3v///+z////s////4v///9z////a////AAAAAMAPAAAhAAAAIgAAACMAAAAkAAAAJQAAACYAAAAnAAAAKAAAACkAAABOU3QzX18yMTBfX2Z1bmN0aW9uNl9fZnVuY0lOU182X19iaW5kSU1ON2xhenBlcmYxMkluRmlsZVN0cmVhbTdQcml2YXRlRUZ2UGhtRUpQUzVfUktOU18xMnBsYWNlaG9sZGVyczRfX3BoSUxpMUVFRVJLTlNCX0lMaTJFRUVFRUVOU185YWxsb2NhdG9ySVNJX0VFRnZTNl9tRUVFAAAA+FUAACAPAADoHwAATlN0M19fMjZfX2JpbmRJTU43bGF6cGVyZjEySW5GaWxlU3RyZWFtN1ByaXZhdGVFRnZQaG1FSlBTM19SS05TXzEycGxhY2Vob2xkZXJzNF9fcGhJTGkxRUVFUktOUzlfSUxpMkVFRUVFRQBOU3QzX18yMThfX3dlYWtfcmVzdWx0X3R5cGVJTU43bGF6cGVyZjEySW5GaWxlU3RyZWFtN1ByaXZhdGVFRnZQaG1FRUUAAAAA0FUAADcQAAD4VQAAzA8AAIAQAEGgIQuiKw8ODQwLCgkIDgABAwYKCgkNAQIEBwsLCgwDBAUIDAwLCwYHCAkNDQwKCgsMDQ4ODQkKCwwNDg8OCAkKCwwNDg8AAQIDBAUGBwEAAQIDBAUGAgEAAQIDBAUDAgEAAQIDBAQDAgEAAQIDBQQDAgEAAQIGBQQDAgEAAQcGBQQDAgEAAAECAwQFAwQEBQUFBQUFBQEAAQMDAwMDAwMDAwMDAwMCAQIEBAQEBAQEBAMDAwMDAwMEBQQEBAQEBAQEBAQEBAQDBAQFBAQEBAQEBAQEBAQFAwQEBAUEBAQEBAQEBAQEAwMEBAQEBQQEBAQEBAQEBAQDBAQEBAQFBAQEBAQEBAQEAwQEBAQEBAUEBAQEBAQEBQMEBAQEBAQEBQQEBAQEBAUDBAQEBAQEBAQFBAQEBAQFAwMEBAQEBAQEBAUFBAQEBQMDBAQEBAQEBAQFBQUEBAUDAwQEBAQEBAQEBAUFBQQFAwMEBAQEBAQEBAQEBQUFBQMDBAQEBAQEBAQEBAQFBQABAgMEBQYHBwcHBwcHBwcBAAECAwQFBgcHBwcHBwcHAgEAAQIDBAUGBwcHBwcHBwMCAQABAgMEBQYHBwcHBwcEAwIBAAECAwQFBgcHBwcHBQQDAgEAAQIDBAUGBwcHBwYFBAMCAQABAgMEBQYHBwcHBgUEAwIBAAECAwQFBgcHBwcGBQQDAgEAAQIDBAUGBwcHBwYFBAMCAQABAgMEBQYHBwcHBgUEAwIBAAECAwQFBwcHBwcGBQQDAgEAAQIDBAcHBwcHBwYFBAMCAQABAgMHBwcHBwcHBgUEAwIBAAECBwcHBwcHBwcGBQQDAgEAAQcHBwcHBwcHBwYFBAMCAQAAAAAAJBQAACoAAAArAAAALAAAAAAAAABUFAAALQAAACsAAAAuAAAAAAAAAIQUAAAvAAAAKwAAADAAAAAAAAAAtBQAADEAAAArAAAAMgAAAAAAAADkFAAAMwAAACsAAAA0AAAAAAAAADwVAAAqAAAANQAAADYAAAAAAAAASBUAADcAAAA4AAAAOQAAAAAAAAB4FQAAOgAAADsAAAA8AAAAAAAAAKgVAAA9AAAAPgAAAD8AAABON2xhenBlcmYxNmxhc19kZWNvbXByZXNzb3JFAAAAANBVAADUEwAATjdsYXpwZXJmMjdwb2ludF9kZWNvbXByZXNzb3JfYmFzZV8xXzJFAPhVAAD8EwAA9BMAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzBFAAAAAPhVAAAwFAAAJBQAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzFFAAAAAPhVAABgFAAAJBQAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzJFAAAAAPhVAACQFAAAJBQAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzNFAAAAAPhVAADAFAAAJBQAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzZFAE43bGF6cGVyZjI3cG9pbnRfZGVjb21wcmVzc29yX2Jhc2VfMV80RQAAAAD4VQAAERUAAPQTAAD4VQAA8BQAADwVAABON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl83RQAAAAD4VQAAVBUAADwVAABON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl84RQAAAAD4VQAAhBUAADwVAAAAAAAAdBYAABYAAABAAAAAQQAAAEIAAABDAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzBFTlNfMTBzaGFyZWRfcHRySU5TMV8xNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVM1X1MyX0VFTlNfOWFsbG9jYXRvcklTMl9FRUVFAAD4VQAA0BUAAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzJfTlMxXzIwcG9pbnRfZGVjb21wcmVzc29yXzBFRUUAAAAAALAXAAAWAAAARAAAAEUAAABGAAAARwAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl8xRU5TXzEwc2hhcmVkX3B0cklOUzFfMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTNV9TMl9FRU5TXzlhbGxvY2F0b3JJUzJfRUVFRQAA+FUAAAwXAAB4UgAATlN0M19fMjEwc2hhcmVkX3B0cklON2xhenBlcmYxNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMyX05TMV8yMHBvaW50X2RlY29tcHJlc3Nvcl8xRUVFAAAAAADsGAAAFgAAAEgAAABJAAAASgAAAEsAAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQTjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfMkVOU18xMHNoYXJlZF9wdHJJTlMxXzE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzVfUzJfRUVOU185YWxsb2NhdG9ySVMyX0VFRUUAAPhVAABIGAAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTMl9OUzFfMjBwb2ludF9kZWNvbXByZXNzb3JfMkVFRQAAAAAAKBoAABYAAABMAAAATQAAAE4AAABPAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzNFTlNfMTBzaGFyZWRfcHRySU5TMV8xNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVM1X1MyX0VFTlNfOWFsbG9jYXRvcklTMl9FRUVFAAD4VQAAhBkAAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzJfTlMxXzIwcG9pbnRfZGVjb21wcmVzc29yXzNFRUUAAAAAAGQbAAAWAAAAUAAAAFEAAABSAAAAUwAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl82RU5TXzEwc2hhcmVkX3B0cklOUzFfMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTNV9TMl9FRU5TXzlhbGxvY2F0b3JJUzJfRUVFRQAA+FUAAMAaAAB4UgAATlN0M19fMjEwc2hhcmVkX3B0cklON2xhenBlcmYxNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMyX05TMV8yMHBvaW50X2RlY29tcHJlc3Nvcl82RUVFAAAAAACgHAAAFgAAAFQAAABVAAAAVgAAAFcAAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQTjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfN0VOU18xMHNoYXJlZF9wdHJJTlMxXzE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzVfUzJfRUVOU185YWxsb2NhdG9ySVMyX0VFRUUAAPhVAAD8GwAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTMl9OUzFfMjBwb2ludF9kZWNvbXByZXNzb3JfN0VFRQAAAAAA3B0AABYAAABYAAAAWQAAAFoAAABbAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzhFTlNfMTBzaGFyZWRfcHRySU5TMV8xNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVM1X1MyX0VFTlNfOWFsbG9jYXRvcklTMl9FRUVFAAD4VQAAOB0AAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzJfTlMxXzIwcG9pbnRfZGVjb21wcmVzc29yXzhFRUUAAAAAAKweAABcAAAAXQAAAF4AAABfAAAAYAAAAGEAAABiAAAAYwAAAGQAAABlAAAAZgAAAGcAAABoAAAAaQAAAE43bGF6cGVyZjdjaGFyYnVmRQAA+FUAAJgeAADIJQAATjdsYXpwZXJmNWVycm9yRQAAAAD4VQAAuB4AAOhXAAAAAAAAzB4AACAAAABuAAAAbwAAAAAAAADwHwAAIQAAAHAAAABxAAAAcgAAAHMAAAB0AAAAdQAAAHYAAAB3AAAATlN0M19fMjEwX19mdW5jdGlvbjZfX2Z1bmNJTlNfNl9fYmluZElNTjdsYXpwZXJmNnJlYWRlcjE4Y2h1bmtfZGVjb21wcmVzc29yN1ByaXZhdGVFRnZQaGlFSlBTNl9SS05TXzEycGxhY2Vob2xkZXJzNF9fcGhJTGkxRUVFUktOU0NfSUxpMkVFRUVFRU5TXzlhbGxvY2F0b3JJU0pfRUVGdlM3X21FRUUATlN0M19fMjEwX19mdW5jdGlvbjZfX2Jhc2VJRnZQaG1FRUUAANBVAADDHwAA+FUAABgfAADoHwAATlN0M19fMjZfX2JpbmRJTU43bGF6cGVyZjZyZWFkZXIxOGNodW5rX2RlY29tcHJlc3NvcjdQcml2YXRlRUZ2UGhpRUpQUzRfUktOU18xMnBsYWNlaG9sZGVyczRfX3BoSUxpMUVFRVJLTlNBX0lMaTJFRUVFRUUATlN0M19fMjE4X193ZWFrX3Jlc3VsdF90eXBlSU1ON2xhenBlcmY2cmVhZGVyMThjaHVua19kZWNvbXByZXNzb3I3UHJpdmF0ZUVGdlBoaUVFRQAA0FUAAHQgAAD4VQAA/B8AAMggAAAAAAAAQCEAAHgAAAB5AAAAegAAAHsAAAB8AAAAAAAAAGAhAAB9AAAAfgAAAH8AAACAAAAAgQAAAE43bGF6cGVyZjN2bHJFAADQVQAAFCEAAE43bGF6cGVyZjdsYXpfdmxyRQAA+FUAACwhAAAkIQAATjdsYXpwZXJmNmViX3ZsckUAAAD4VQAATCEAACQhAABOU3QzX18yMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRQAA0FUAAGwhAABOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAA0FUAALQhAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAA0FUAAPwhAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAANBVAABEIgAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURpTlNfMTFjaGFyX3RyYWl0c0lEaUVFTlNfOWFsbG9jYXRvcklEaUVFRUUAAADQVQAAkCIAAE4xMGVtc2NyaXB0ZW4zdmFsRQAA0FUAANwiAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ljRUUAANBVAAD4IgAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAADQVQAAICMAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWhFRQAA0FUAAEgjAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lzRUUAANBVAABwIwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAADQVQAAmCMAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWlFRQAA0FUAAMAjAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lqRUUAANBVAADoIwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbEVFAADQVQAAECQAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SW1FRQAA0FUAADgkAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lmRUUAANBVAABgJAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZEVFAADQVQAAiCQAAAAAAADgJAAAagAAAIMAAACEAAAATlN0M19fMjE3YmFkX2Z1bmN0aW9uX2NhbGxFAPhVAADEJAAAEFcAAAAAAADIJQAAXAAAAIUAAABeAAAAXwAAAIYAAACHAAAAYgAAAGMAAABkAAAAZQAAAGYAAABnAAAAaAAAAGkAAAAIAAAAAAAAAAAmAACIAAAAiQAAAPj////4////ACYAAIoAAACLAAAAOCUAAEwlAABOU3QzX18yOWJhc2ljX2lvc0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAAPhVAABcJQAAPCYAAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1ZkljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAAADQVQAAlCUAAE5TdDNfXzIxM2Jhc2ljX2lzdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAFRWAADQJQAAAAAAAAEAAACIJQAAA/T//wAAAAA8JgAAjAAAAI0AAABOU3QzX18yOGlvc19iYXNlRQAAANBVAAAoJgBB0MwAC9ME0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAAD/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM2wAAAADeEgSVAAAAAP///////////////4AoAAAUAAAAQy5VVEYtOABB0NEACwKUKABB8NEAC0dMQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBBwNIAC0EZAAoAGRkZAAAAAAUAAAAAAAAJAAAAAAsAAAAAAAAAABkAEQoZGRkDCgcAAQAJCxgAAAkGCwAACwAGGQAAABkZGQBBkdMACyEOAAAAAAAAAAAZAAoNGRkZAA0AAAIACQ4AAAAJAA4AAA4AQcvTAAsBDABB19MACxUTAAAAABMAAAAACQwAAAAAAAwAAAwAQYXUAAsBEABBkdQACxUPAAAABA8AAAAACRAAAAAAABAAABAAQb/UAAsBEgBBy9QACx4RAAAAABEAAAAACRIAAAAAABIAABIAABoAAAAaGhoAQYLVAAsOGgAAABoaGgAAAAAAAAkAQbPVAAsBFABBv9UACxUXAAAAABcAAAAACRQAAAAAABQAABQAQe3VAAsBFgBB+dUACykVAAAAABUAAAAACRYAAAAAABYAABYAADAxMjM0NTY3ODlBQkNERUYwLQBBtNoAC/kDAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAAHwAAACAAAAAhAAAAIgAAACMAAAAkAAAAJQAAACYAAAAnAAAAKAAAACkAAAAqAAAAKwAAACwAAAAtAAAALgAAAC8AAAAwAAAAMQAAADIAAAAzAAAANAAAADUAAAA2AAAANwAAADgAAAA5AAAAOgAAADsAAAA8AAAAPQAAAD4AAAA/AAAAQAAAAEEAAABCAAAAQwAAAEQAAABFAAAARgAAAEcAAABIAAAASQAAAEoAAABLAAAATAAAAE0AAABOAAAATwAAAFAAAABRAAAAUgAAAFMAAABUAAAAVQAAAFYAAABXAAAAWAAAAFkAAABaAAAAWwAAAFwAAABdAAAAXgAAAF8AAABgAAAAQQAAAEIAAABDAAAARAAAAEUAAABGAAAARwAAAEgAAABJAAAASgAAAEsAAABMAAAATQAAAE4AAABPAAAAUAAAAFEAAABSAAAAUwAAAFQAAABVAAAAVgAAAFcAAABYAAAAWQAAAFoAAAB7AAAAfAAAAH0AAAB+AAAAfwBBsOIACwJAMwBBxOYAC/kDAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAAHwAAACAAAAAhAAAAIgAAACMAAAAkAAAAJQAAACYAAAAnAAAAKAAAACkAAAAqAAAAKwAAACwAAAAtAAAALgAAAC8AAAAwAAAAMQAAADIAAAAzAAAANAAAADUAAAA2AAAANwAAADgAAAA5AAAAOgAAADsAAAA8AAAAPQAAAD4AAAA/AAAAQAAAAGEAAABiAAAAYwAAAGQAAABlAAAAZgAAAGcAAABoAAAAaQAAAGoAAABrAAAAbAAAAG0AAABuAAAAbwAAAHAAAABxAAAAcgAAAHMAAAB0AAAAdQAAAHYAAAB3AAAAeAAAAHkAAAB6AAAAWwAAAFwAAABdAAAAXgAAAF8AAABgAAAAYQAAAGIAAABjAAAAZAAAAGUAAABmAAAAZwAAAGgAAABpAAAAagAAAGsAAABsAAAAbQAAAG4AAABvAAAAcAAAAHEAAAByAAAAcwAAAHQAAAB1AAAAdgAAAHcAAAB4AAAAeQAAAHoAAAB7AAAAfAAAAH0AAAB+AAAAfwBBwO4ACzEwMTIzNDU2Nzg5YWJjZGVmQUJDREVGeFgrLXBQaUluTgAlSTolTTolUyAlcCVIOiVNAEGA7wALgQElAAAAbQAAAC8AAAAlAAAAZAAAAC8AAAAlAAAAeQAAACUAAABZAAAALQAAACUAAABtAAAALQAAACUAAABkAAAAJQAAAEkAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAHAAAAAAAAAAJQAAAEgAAAA6AAAAJQAAAE0AQZDwAAtlJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAAAAAAhEEAAKkAAACqAAAAqwAAAAAAAADkQQAArAAAAK0AAACrAAAArgAAAK8AAACwAAAAsQAAALIAAACzAAAAtAAAALUAQYDxAAv9AwQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAUCAAAFAAAABQAAAAUAAAAFAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAAwIAAIIAAACCAAAAggAAAIIAAACCAAAAggAAAIIAAACCAAAAggAAAIIAAACCAAAAggAAAIIAAACCAAAAggAAAEIBAABCAQAAQgEAAEIBAABCAQAAQgEAAEIBAABCAQAAQgEAAEIBAACCAAAAggAAAIIAAACCAAAAggAAAIIAAACCAAAAKgEAACoBAAAqAQAAKgEAACoBAAAqAQAAKgAAACoAAAAqAAAAKgAAACoAAAAqAAAAKgAAACoAAAAqAAAAKgAAACoAAAAqAAAAKgAAACoAAAAqAAAAKgAAACoAAAAqAAAAKgAAACoAAACCAAAAggAAAIIAAACCAAAAggAAAIIAAAAyAQAAMgEAADIBAAAyAQAAMgEAADIBAAAyAAAAMgAAADIAAAAyAAAAMgAAADIAAAAyAAAAMgAAADIAAAAyAAAAMgAAADIAAAAyAAAAMgAAADIAAAAyAAAAMgAAADIAAAAyAAAAMgAAAIIAAACCAAAAggAAAIIAAAAEAEGE+QAL7QJMQQAAtgAAALcAAACrAAAAuAAAALkAAAC6AAAAuwAAALwAAAC9AAAAvgAAAAAAAAAcQgAAvwAAAMAAAACrAAAAwQAAAMIAAADDAAAAxAAAAMUAAAAAAAAAQEIAAMYAAADHAAAAqwAAAMgAAADJAAAAygAAAMsAAADMAAAAdAAAAHIAAAB1AAAAZQAAAAAAAABmAAAAYQAAAGwAAABzAAAAZQAAAAAAAAAlAAAAbQAAAC8AAAAlAAAAZAAAAC8AAAAlAAAAeQAAAAAAAAAlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAAAAAAAAlAAAAYQAAACAAAAAlAAAAYgAAACAAAAAlAAAAZAAAACAAAAAlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACAAAAAlAAAAWQAAAAAAAAAlAAAASQAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACAAAAAlAAAAcABB/PsAC/4KJD4AAM0AAADOAAAAqwAAAE5TdDNfXzI2bG9jYWxlNWZhY2V0RQAAAPhVAAAMPgAAUFIAAAAAAACkPgAAzQAAAM8AAACrAAAA0AAAANEAAADSAAAA0wAAANQAAADVAAAA1gAAANcAAADYAAAA2QAAANoAAADbAAAATlN0M19fMjVjdHlwZUl3RUUATlN0M19fMjEwY3R5cGVfYmFzZUUAANBVAACGPgAAVFYAAHQ+AAAAAAAAAgAAACQ+AAACAAAAnD4AAAIAAAAAAAAAOD8AAM0AAADcAAAAqwAAAN0AAADeAAAA3wAAAOAAAADhAAAA4gAAAOMAAABOU3QzX18yN2NvZGVjdnRJY2MxMV9fbWJzdGF0ZV90RUUATlN0M19fMjEyY29kZWN2dF9iYXNlRQAAAADQVQAAFj8AAFRWAAD0PgAAAAAAAAIAAAAkPgAAAgAAADA/AAACAAAAAAAAAKw/AADNAAAA5AAAAKsAAADlAAAA5gAAAOcAAADoAAAA6QAAAOoAAADrAAAATlN0M19fMjdjb2RlY3Z0SURzYzExX19tYnN0YXRlX3RFRQAAVFYAAIg/AAAAAAAAAgAAACQ+AAACAAAAMD8AAAIAAAAAAAAAIEAAAM0AAADsAAAAqwAAAO0AAADuAAAA7wAAAPAAAADxAAAA8gAAAPMAAABOU3QzX18yN2NvZGVjdnRJRHNEdTExX19tYnN0YXRlX3RFRQBUVgAA/D8AAAAAAAACAAAAJD4AAAIAAAAwPwAAAgAAAAAAAACUQAAAzQAAAPQAAACrAAAA9QAAAPYAAAD3AAAA+AAAAPkAAAD6AAAA+wAAAE5TdDNfXzI3Y29kZWN2dElEaWMxMV9fbWJzdGF0ZV90RUUAAFRWAABwQAAAAAAAAAIAAAAkPgAAAgAAADA/AAACAAAAAAAAAAhBAADNAAAA/AAAAKsAAAD9AAAA/gAAAP8AAAAAAQAAAQEAAAIBAAADAQAATlN0M19fMjdjb2RlY3Z0SURpRHUxMV9fbWJzdGF0ZV90RUUAVFYAAORAAAAAAAAAAgAAACQ+AAACAAAAMD8AAAIAAABOU3QzX18yN2NvZGVjdnRJd2MxMV9fbWJzdGF0ZV90RUUAAABUVgAAKEEAAAAAAAACAAAAJD4AAAIAAAAwPwAAAgAAAE5TdDNfXzI2bG9jYWxlNV9faW1wRQAAAPhVAABsQQAAJD4AAE5TdDNfXzI3Y29sbGF0ZUljRUUA+FUAAJBBAAAkPgAATlN0M19fMjdjb2xsYXRlSXdFRQD4VQAAsEEAACQ+AABOU3QzX18yNWN0eXBlSWNFRQAAAFRWAADQQQAAAAAAAAIAAAAkPgAAAgAAAJw+AAACAAAATlN0M19fMjhudW1wdW5jdEljRUUAAAAA+FUAAARCAAAkPgAATlN0M19fMjhudW1wdW5jdEl3RUUAAAAA+FUAAChCAAAkPgAAAAAAAKRBAAAEAQAABQEAAKsAAAAGAQAABwEAAAgBAAAAAAAAxEEAAAkBAAAKAQAAqwAAAAsBAAAMAQAADQEAAAAAAABgQwAAzQAAAA4BAACrAAAADwEAABABAAARAQAAEgEAABMBAAAUAQAAFQEAABYBAAAXAQAAGAEAABkBAABOU3QzX18yN251bV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SWNFRQBOU3QzX18yMTRfX251bV9nZXRfYmFzZUUAANBVAAAmQwAAVFYAABBDAAAAAAAAAQAAAEBDAAAAAAAAVFYAAMxCAAAAAAAAAgAAACQ+AAACAAAASEMAQYSHAQvKATREAADNAAAAGgEAAKsAAAAbAQAAHAEAAB0BAAAeAQAAHwEAACABAAAhAQAAIgEAACMBAAAkAQAAJQEAAE5TdDNfXzI3bnVtX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9nZXRJd0VFAAAAVFYAAAREAAAAAAAAAQAAAEBDAAAAAAAAVFYAAMBDAAAAAAAAAgAAACQ+AAACAAAAHEQAQdiIAQveARxFAADNAAAAJgEAAKsAAAAnAQAAKAEAACkBAAAqAQAAKwEAACwBAAAtAQAALgEAAE5TdDNfXzI3bnVtX3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjlfX251bV9wdXRJY0VFAE5TdDNfXzIxNF9fbnVtX3B1dF9iYXNlRQAA0FUAAOJEAABUVgAAzEQAAAAAAAABAAAA/EQAAAAAAABUVgAAiEQAAAAAAAACAAAAJD4AAAIAAAAERQBBwIoBC74B5EUAAM0AAAAvAQAAqwAAADABAAAxAQAAMgEAADMBAAA0AQAANQEAADYBAAA3AQAATlN0M19fMjdudW1fcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yOV9fbnVtX3B1dEl3RUUAAABUVgAAtEUAAAAAAAABAAAA/EQAAAAAAABUVgAAcEUAAAAAAAACAAAAJD4AAAIAAADMRQBBiIwBC5oL5EYAADgBAAA5AQAAqwAAADoBAAA7AQAAPAEAAD0BAAA+AQAAPwEAAEABAAD4////5EYAAEEBAABCAQAAQwEAAEQBAABFAQAARgEAAEcBAABOU3QzX18yOHRpbWVfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yOXRpbWVfYmFzZUUA0FUAAJ1GAABOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUljRUUAAADQVQAAuEYAAFRWAABYRgAAAAAAAAMAAAAkPgAAAgAAALBGAAACAAAA3EYAAAAIAAAAAAAA0EcAAEgBAABJAQAAqwAAAEoBAABLAQAATAEAAE0BAABOAQAATwEAAFABAAD4////0EcAAFEBAABSAQAAUwEAAFQBAABVAQAAVgEAAFcBAABOU3QzX18yOHRpbWVfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUl3RUUAANBVAAClRwAAVFYAAGBHAAAAAAAAAwAAACQ+AAACAAAAsEYAAAIAAADIRwAAAAgAAAAAAAB0SAAAWAEAAFkBAACrAAAAWgEAAE5TdDNfXzI4dGltZV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMF9fdGltZV9wdXRFAAAA0FUAAFVIAABUVgAAEEgAAAAAAAACAAAAJD4AAAIAAABsSAAAAAgAAAAAAAD0SAAAWwEAAFwBAACrAAAAXQEAAE5TdDNfXzI4dGltZV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAAAAAFRWAACsSAAAAAAAAAIAAAAkPgAAAgAAAGxIAAAACAAAAAAAAIhJAADNAAAAXgEAAKsAAABfAQAAYAEAAGEBAABiAQAAYwEAAGQBAABlAQAAZgEAAGcBAABOU3QzX18yMTBtb25leXB1bmN0SWNMYjBFRUUATlN0M19fMjEwbW9uZXlfYmFzZUUAAAAA0FUAAGhJAABUVgAATEkAAAAAAAACAAAAJD4AAAIAAACASQAAAgAAAAAAAAD8SQAAzQAAAGgBAACrAAAAaQEAAGoBAABrAQAAbAEAAG0BAABuAQAAbwEAAHABAABxAQAATlN0M19fMjEwbW9uZXlwdW5jdEljTGIxRUVFAFRWAADgSQAAAAAAAAIAAAAkPgAAAgAAAIBJAAACAAAAAAAAAHBKAADNAAAAcgEAAKsAAABzAQAAdAEAAHUBAAB2AQAAdwEAAHgBAAB5AQAAegEAAHsBAABOU3QzX18yMTBtb25leXB1bmN0SXdMYjBFRUUAVFYAAFRKAAAAAAAAAgAAACQ+AAACAAAAgEkAAAIAAAAAAAAA5EoAAM0AAAB8AQAAqwAAAH0BAAB+AQAAfwEAAIABAACBAQAAggEAAIMBAACEAQAAhQEAAE5TdDNfXzIxMG1vbmV5cHVuY3RJd0xiMUVFRQBUVgAAyEoAAAAAAAACAAAAJD4AAAIAAACASQAAAgAAAAAAAACISwAAzQAAAIYBAACrAAAAhwEAAIgBAABOU3QzX18yOW1vbmV5X2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJY0VFAADQVQAAZksAAFRWAAAgSwAAAAAAAAIAAAAkPgAAAgAAAIBLAEGslwELmgEsTAAAzQAAAIkBAACrAAAAigEAAIsBAABOU3QzX18yOW1vbmV5X2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJd0VFAADQVQAACkwAAFRWAADESwAAAAAAAAIAAAAkPgAAAgAAACRMAEHQmAELmgHQTAAAzQAAAIwBAACrAAAAjQEAAI4BAABOU3QzX18yOW1vbmV5X3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9wdXRJY0VFAADQVQAArkwAAFRWAABoTAAAAAAAAAIAAAAkPgAAAgAAAMhMAEH0mQELmgF0TQAAzQAAAI8BAACrAAAAkAEAAJEBAABOU3QzX18yOW1vbmV5X3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjExX19tb25leV9wdXRJd0VFAADQVQAAUk0AAFRWAAAMTQAAAAAAAAIAAAAkPgAAAgAAAGxNAEGYmwELuQjsTQAAzQAAAJIBAACrAAAAkwEAAJQBAACVAQAATlN0M19fMjhtZXNzYWdlc0ljRUUATlN0M19fMjEzbWVzc2FnZXNfYmFzZUUAAAAA0FUAAMlNAABUVgAAtE0AAAAAAAACAAAAJD4AAAIAAADkTQAAAgAAAAAAAABETgAAzQAAAJYBAACrAAAAlwEAAJgBAACZAQAATlN0M19fMjhtZXNzYWdlc0l3RUUAAAAAVFYAACxOAAAAAAAAAgAAACQ+AAACAAAA5E0AAAIAAABTAAAAdQAAAG4AAABkAAAAYQAAAHkAAAAAAAAATQAAAG8AAABuAAAAZAAAAGEAAAB5AAAAAAAAAFQAAAB1AAAAZQAAAHMAAABkAAAAYQAAAHkAAAAAAAAAVwAAAGUAAABkAAAAbgAAAGUAAABzAAAAZAAAAGEAAAB5AAAAAAAAAFQAAABoAAAAdQAAAHIAAABzAAAAZAAAAGEAAAB5AAAAAAAAAEYAAAByAAAAaQAAAGQAAABhAAAAeQAAAAAAAABTAAAAYQAAAHQAAAB1AAAAcgAAAGQAAABhAAAAeQAAAAAAAABTAAAAdQAAAG4AAAAAAAAATQAAAG8AAABuAAAAAAAAAFQAAAB1AAAAZQAAAAAAAABXAAAAZQAAAGQAAAAAAAAAVAAAAGgAAAB1AAAAAAAAAEYAAAByAAAAaQAAAAAAAABTAAAAYQAAAHQAAAAAAAAASgAAAGEAAABuAAAAdQAAAGEAAAByAAAAeQAAAAAAAABGAAAAZQAAAGIAAAByAAAAdQAAAGEAAAByAAAAeQAAAAAAAABNAAAAYQAAAHIAAABjAAAAaAAAAAAAAABBAAAAcAAAAHIAAABpAAAAbAAAAAAAAABNAAAAYQAAAHkAAAAAAAAASgAAAHUAAABuAAAAZQAAAAAAAABKAAAAdQAAAGwAAAB5AAAAAAAAAEEAAAB1AAAAZwAAAHUAAABzAAAAdAAAAAAAAABTAAAAZQAAAHAAAAB0AAAAZQAAAG0AAABiAAAAZQAAAHIAAAAAAAAATwAAAGMAAAB0AAAAbwAAAGIAAABlAAAAcgAAAAAAAABOAAAAbwAAAHYAAABlAAAAbQAAAGIAAABlAAAAcgAAAAAAAABEAAAAZQAAAGMAAABlAAAAbQAAAGIAAABlAAAAcgAAAAAAAABKAAAAYQAAAG4AAAAAAAAARgAAAGUAAABiAAAAAAAAAE0AAABhAAAAcgAAAAAAAABBAAAAcAAAAHIAAAAAAAAASgAAAHUAAABuAAAAAAAAAEoAAAB1AAAAbAAAAAAAAABBAAAAdQAAAGcAAAAAAAAAUwAAAGUAAABwAAAAAAAAAE8AAABjAAAAdAAAAAAAAABOAAAAbwAAAHYAAAAAAAAARAAAAGUAAABjAAAAAAAAAEEAAABNAAAAAAAAAFAAAABNAEHcowEL/ALcRgAAQQEAAEIBAABDAQAARAEAAEUBAABGAQAARwEAAAAAAADIRwAAUQEAAFIBAABTAQAAVAEAAFUBAABWAQAAVwEAAAAAAABQUgAAFgAAAJoBAAAqAAAATlN0M19fMjE0X19zaGFyZWRfY291bnRFAAAAANBVAAA0UgAATlN0M19fMjE5X19zaGFyZWRfd2Vha19jb3VudEUAAABUVgAAWFIAAAAAAAABAAAAUFIAAAAAAAAwMDAxMDIwMzA0MDUwNjA3MDgwOTEwMTExMjEzMTQxNTE2MTcxODE5MjAyMTIyMjMyNDI1MjYyNzI4MjkzMDMxMzIzMzM0MzUzNjM3MzgzOTQwNDE0MjQzNDQ0NTQ2NDc0ODQ5NTA1MTUyNTM1NDU1NTY1NzU4NTk2MDYxNjI2MzY0NjU2NjY3Njg2OTcwNzE3MjczNzQ3NTc2Nzc3ODc5ODA4MTgyODM4NDg1ODY4Nzg4ODk5MDkxOTI5Mzk0OTU5Njk3OTg5OQBB5KYBC6YJCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUAypo7TjEwX19jeHhhYml2MTE2X19zaGltX3R5cGVfaW5mb0UAAAAA+FUAAIhTAAAEWAAATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAAAA+FUAALhTAACsUwAATjEwX19jeHhhYml2MTE3X19wYmFzZV90eXBlX2luZm9FAAAA+FUAAOhTAACsUwAATjEwX19jeHhhYml2MTE5X19wb2ludGVyX3R5cGVfaW5mb0UA+FUAABhUAAAMVAAATjEwX19jeHhhYml2MTIwX19mdW5jdGlvbl90eXBlX2luZm9FAAAAAPhVAABIVAAArFMAAE4xMF9fY3h4YWJpdjEyOV9fcG9pbnRlcl90b19tZW1iZXJfdHlwZV9pbmZvRQAAAPhVAAB8VAAADFQAAAAAAAD8VAAAmwEAAJwBAACdAQAAngEAAJ8BAABOMTBfX2N4eGFiaXYxMjNfX2Z1bmRhbWVudGFsX3R5cGVfaW5mb0UA+FUAANRUAACsUwAAdgAAAMBUAAAIVQAARG4AAMBUAAAUVQAAYgAAAMBUAAAgVQAAYwAAAMBUAAAsVQAAaAAAAMBUAAA4VQAAYQAAAMBUAABEVQAAcwAAAMBUAABQVQAAdAAAAMBUAABcVQAAaQAAAMBUAABoVQAAagAAAMBUAAB0VQAAbAAAAMBUAACAVQAAbQAAAMBUAACMVQAAeAAAAMBUAACYVQAAeQAAAMBUAACkVQAAZgAAAMBUAACwVQAAZAAAAMBUAAC8VQAAAAAAANxTAACbAQAAoAEAAJ0BAACeAQAAoQEAAKIBAACjAQAApAEAAAAAAABAVgAAmwEAAKUBAACdAQAAngEAAKEBAACmAQAApwEAAKgBAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAA+FUAABhWAADcUwAAAAAAAJxWAACbAQAAqQEAAJ0BAACeAQAAoQEAAKoBAACrAQAArAEAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAAD4VQAAdFYAANxTAAAAAAAAPFQAAJsBAACtAQAAnQEAAJ4BAACuAQAAAAAAAChXAABsAAAArwEAALABAAAAAAAAUFcAAGwAAACxAQAAsgEAAAAAAAAQVwAAbAAAALMBAAC0AQAAU3Q5ZXhjZXB0aW9uAAAAANBVAAAAVwAAU3Q5YmFkX2FsbG9jAAAAAPhVAAAYVwAAEFcAAFN0MjBiYWRfYXJyYXlfbmV3X2xlbmd0aAAAAAD4VQAANFcAAChXAAAAAAAAlFcAAG0AAAC1AQAAtgEAAAAAAADoVwAAIAAAALcBAABvAAAAU3QxMWxvZ2ljX2Vycm9yAPhVAACEVwAAEFcAAAAAAADIVwAAbQAAALgBAAC2AQAAU3QxMmxlbmd0aF9lcnJvcgAAAAD4VQAAtFcAAJRXAABTdDEzcnVudGltZV9lcnJvcgAAAPhVAADUVwAAEFcAAFN0OXR5cGVfaW5mbwAAAADQVQAA9FcAQZCwAQsJcGgBAAAAAAAFAEGksAELAY4AQbywAQsOjwAAAJAAAACoWwAAAAQAQdSwAQsBAQBB5LABCwX/////CgBBqLEBCwkYWAAAAAAAAAUAQbyxAQsBkQBB1LEBCwqPAAAAkgAAALBfAEHssQELAQIAQfyxAQsI//////////8AQcCyAQsCsFg=", d = 2 * Math.PI * 6378137, y = Math.PI / 180, K = {
  pointSize: 6,
  colorMode: "rgb",
  maxCacheSize: 100,
  sseThreshold: 8,
  depthTest: !0,
  maxCacheMemory: 100 * 1024 * 1024,
  debug: !1,
  enableEDL: !1,
  edlStrength: 0.4,
  edlRadius: 1.5,
  onInitialized: () => {
  }
};
class _ {
  constructor(A, g = {}, I = "copc-layer") {
    C(this, "id");
    C(this, "type", "custom");
    C(this, "renderingMode", "3d");
    C(this, "url");
    C(this, "map");
    C(this, "camera");
    C(this, "scene");
    C(this, "renderer");
    C(this, "worker");
    C(this, "cacheManager");
    C(this, "options");
    C(this, "visibleNodes", []);
    C(this, "workerInitialized", !1);
    C(this, "pendingRequests", /* @__PURE__ */ new Set());
    C(this, "requestQueue", []);
    C(this, "lastCameraPosition", null);
    C(this, "sceneCenter", null);
    C(this, "colorTarget");
    C(this, "depthTarget");
    C(this, "edlMaterial");
    C(this, "edlQuadScene");
    C(this, "edlQuadCamera");
    C(this, "_tempMatrix1", new n.Matrix4());
    C(this, "_tempMatrix2", new n.Matrix4());
    C(this, "_lastEdlWidth", 0);
    C(this, "_lastEdlHeight", 0);
    C(this, "_lastUpdatePointsTime", 0);
    this.id = I, this.url = A, this.options = { ...K, ...g }, this.cacheManager = new c({
      maxNodes: this.options.maxCacheSize,
      maxMemoryBytes: this.options.maxCacheMemory,
      debug: this.options.debug
    }), this.camera = new n.Camera(), this.scene = new n.Scene(), this.worker = new Y(), this.setupWorkerMessageHandlers();
  }
  setupWorkerMessageHandlers() {
    this.worker.onmessage = (A) => {
      var I, B, t;
      const g = A.data;
      switch (g.type) {
        case "initialized":
          this.workerInitialized = !0, this.requestNodeData("0-0-0-0"), (B = (I = this.options).onInitialized) == null || B.call(I, g);
          break;
        case "nodeLoaded":
          this.handleNodeLoaded(
            g.node,
            g.positions,
            g.colors
          );
          break;
        case "nodesToLoad":
          this.cancelAllPendingRequests(), this.lastCameraPosition = g.cameraPosition, this.visibleNodes = g.nodes, this.updateVisibleNodes();
          break;
        case "error":
          this.options.debug && console.error("[CopcLayer] Worker error:", g.message);
          break;
      }
      (t = this.map) == null || t.triggerRepaint();
    }, this.worker.onerror = (A) => {
      this.options.debug && console.error("[CopcLayer] Worker error event:", A);
    };
  }
  handleNodeLoaded(A, g, I) {
    this.pendingRequests.delete(A), this.removeFromRequestQueue(A);
    const B = new Float64Array(g), t = new Float32Array(I), Q = c.createNodeData(A, B, t, {
      colorMode: this.options.colorMode,
      pointSize: this.options.pointSize,
      depthTest: this.options.depthTest
    }), i = new n.BufferGeometry();
    if (this.sceneCenter) {
      const { x: D, y: w, z: h } = this.sceneCenter, o = new Float32Array(B.length);
      for (let e = 0; e < B.length; e += 3)
        o[e] = B[e] - D, o[e + 1] = B[e + 1] - w, o[e + 2] = B[e + 2] - h;
      i.setAttribute(
        "position",
        new n.BufferAttribute(o, 3)
      );
    } else
      i.setAttribute(
        "position",
        new n.BufferAttribute(new Float32Array(B), 3)
      );
    i.setAttribute("color", new n.BufferAttribute(t, 3));
    const a = this.createPointMaterial(), r = new n.Points(i, a);
    Q.geometry = i, Q.points = r;
    const s = new Set(this.visibleNodes);
    this.cacheManager.set(Q, s);
  }
  updateVisibleNodes() {
    for (; this.scene.children.length > 0; )
      this.scene.remove(this.scene.children[0]);
    const A = [];
    for (const g of this.visibleNodes) {
      const I = this.cacheManager.get(g);
      I != null && I.points ? (this.scene.add(I.points), this.needsMaterialUpdate(I) && this.updateNodeMaterial(I)) : this.pendingRequests.has(g) || A.push(g);
    }
    for (const g of this.prioritizeNodeRequests(A))
      this.requestNodeData(g);
  }
  requestNodeData(A) {
    this.pendingRequests.has(A) || (this.pendingRequests.add(A), this.requestQueue.push(A), this.worker.postMessage({ type: "loadNode", node: A }));
  }
  needsMaterialUpdate(A) {
    const { materialConfig: g } = A;
    return g.colorMode !== this.options.colorMode || g.pointSize !== this.options.pointSize || g.depthTest !== this.options.depthTest;
  }
  updateNodeMaterial(A) {
    A.points && (A.points.material instanceof n.Material && A.points.material.dispose(), A.points.material = this.createPointMaterial(), A.materialConfig = {
      colorMode: this.options.colorMode,
      pointSize: this.options.pointSize,
      depthTest: this.options.depthTest
    });
  }
  rebuildAllMaterials() {
    for (const A of this.cacheManager.getCachedNodeIds()) {
      const g = this.cacheManager.get(A);
      g && this.updateNodeMaterial(g);
    }
  }
  removeFromRequestQueue(A) {
    const g = this.requestQueue.indexOf(A);
    g > -1 && this.requestQueue.splice(g, 1);
  }
  cancelAllPendingRequests() {
    this.pendingRequests.size !== 0 && (this.worker.postMessage({
      type: "cancelRequests",
      nodes: Array.from(this.pendingRequests)
    }), this.pendingRequests.clear(), this.requestQueue.length = 0);
  }
  prioritizeNodeRequests(A) {
    if (!this.lastCameraPosition || A.length <= 1) return A;
    const [g, I] = this.lastCameraPosition, B = A.map((t) => {
      const Q = t.split("-").map(Number), [i, a, r] = Q, s = 1 / 2 ** i, D = a * s + s / 2, w = r * s + s / 2, h = D - g, o = w - I, e = Math.sqrt(h * h + o * o), f = i * 10, G = e > 0 ? 1e3 / e : 1e3, R = f + G * 0.1;
      return { nodeId: t, priority: R };
    });
    return B.sort((t, Q) => Q.priority - t.priority), B.map((t) => t.nodeId);
  }
  async onAdd(A, g) {
    this.map = A, this.worker.postMessage({
      type: "init",
      url: this.url,
      options: {
        colorMode: this.options.colorMode,
        maxCacheSize: this.options.maxCacheSize,
        wasmPath: k
      }
    }), this.renderer = new n.WebGLRenderer({
      canvas: A.getCanvas(),
      context: g
    }), this.renderer.outputColorSpace = n.LinearSRGBColorSpace, this.renderer.autoClear = !1, this.options.enableEDL && this.setupEDL();
  }
  updateCacheConfig(A) {
    Object.assign(this.options, A);
    const g = new Set(this.visibleNodes);
    this.cacheManager.updateOptions(
      {
        maxNodes: this.options.maxCacheSize,
        maxMemoryBytes: this.options.maxCacheMemory,
        debug: this.options.debug
      },
      g
    ), this.updateVisibleNodes();
  }
  setPointSize(A) {
    var g;
    this.options.pointSize = A, this.rebuildAllMaterials(), (g = this.map) == null || g.triggerRepaint();
  }
  setSseThreshold(A) {
    var g;
    this.options.sseThreshold = A, this.updatePoints(), (g = this.map) == null || g.triggerRepaint();
  }
  setDepthTest(A) {
    var g;
    this.options.depthTest = A, this.rebuildAllMaterials(), (g = this.map) == null || g.triggerRepaint();
  }
  /**
   * Compute camera altitude in meters above sea level.
   * MapLibre's getCameraAltitude() returns NaN in Globe mode because
   * the Globe transform's internal _pixelPerMeter is never initialized.
   * We replicate the formula using publicly accessible values.
   */
  computeCameraAltitude(A, g, I) {
    if (!this.map) return 0;
    const B = this.map.getCenter().lat * y, t = A * y, Q = this.map.getPitch() * y, a = 512 * 2 ** I / (d * Math.cos(B)), r = g / (2 * Math.tan(t / 2));
    return Math.cos(Q) * r / a;
  }
  updatePoints() {
    if (!this.map || !this.workerInitialized) return;
    const A = performance.now();
    if (A - this._lastUpdatePointsTime < 100) return;
    this._lastUpdatePointsTime = A;
    const g = this.map.transform.fov, I = this.map.transform.height, B = this.map.getZoom(), t = this.map.transform.getCameraLngLat().toArray(), Q = this.computeCameraAltitude(g, I, B);
    this.worker.postMessage({
      type: "updatePoints",
      cameraPosition: [...t, Q],
      mapHeight: I,
      fov: g,
      sseThreshold: this.options.sseThreshold,
      zoom: B
    });
  }
  render(A, g) {
    if (!this.map || !this.renderer) return;
    if (!this.sceneCenter || this.shouldUpdateSceneCenter()) {
      const i = this.map.getCenter();
      this.sceneCenter = l.MercatorCoordinate.fromLngLat(i), this.clearCache();
    }
    const I = this.sceneCenter.toLngLat(), B = this.map.transform.getMatrixForModel([I.lng, I.lat], 0), Q = 1 / this.sceneCenter.meterInMercatorCoordinateUnits();
    this._tempMatrix1.fromArray(g.defaultProjectionData.mainMatrix), this._tempMatrix2.fromArray(B), this._tempMatrix1.multiply(this._tempMatrix2), this._tempMatrix2.set(
      Q,
      0,
      0,
      0,
      0,
      0,
      d,
      0,
      0,
      Q,
      0,
      0,
      0,
      0,
      0,
      1
    ), this._tempMatrix1.multiply(this._tempMatrix2), this.camera.projectionMatrix.copy(this._tempMatrix1), this.updatePoints(), this.renderer.setSize(
      this.map.getCanvas().width,
      this.map.getCanvas().height,
      !1
    ), this.options.enableEDL && this.updateEDLSize(), this.renderer.resetState(), this.options.enableEDL && this.colorTarget && this.depthTarget && this.edlQuadScene && this.edlQuadCamera ? (this.renderer.setRenderTarget(this.depthTarget), this.renderer.clear(), this.renderer.render(this.scene, this.camera), this.renderer.setRenderTarget(this.colorTarget), this.renderer.clear(), this.renderer.render(this.scene, this.camera), this.renderer.setRenderTarget(null), this.renderer.render(this.edlQuadScene, this.edlQuadCamera)) : this.renderer.render(this.scene, this.camera), this.map.triggerRepaint();
  }
  shouldUpdateSceneCenter() {
    if (!this.sceneCenter || !this.map) return !0;
    const A = l.MercatorCoordinate.fromLngLat(
      this.map.getCenter()
    ), g = A.x - this.sceneCenter.x, I = A.y - this.sceneCenter.y;
    return Math.sqrt(g * g + I * I) > 1e-3;
  }
  onRemove(A, g) {
    var I, B, t, Q;
    this.worker.terminate(), this.cacheManager.clear(), this.visibleNodes.length = 0, this.pendingRequests.clear(), this.requestQueue.length = 0, (I = this.colorTarget) == null || I.dispose(), this.colorTarget = void 0, (B = this.depthTarget) == null || B.dispose(), this.depthTarget = void 0, (t = this.edlMaterial) == null || t.dispose(), this.edlMaterial = void 0, (Q = this.edlQuadScene) == null || Q.clear(), this.edlQuadScene = void 0, this.edlQuadCamera = void 0;
  }
  setupEDL() {
    if (!this.renderer || !this.map) return;
    const A = this.map.getCanvas().width, g = this.map.getCanvas().height;
    this.colorTarget = new n.WebGLRenderTarget(A, g, {
      minFilter: n.LinearFilter,
      magFilter: n.LinearFilter,
      format: n.RGBAFormat
    }), this.depthTarget = new n.WebGLRenderTarget(A, g, {
      minFilter: n.NearestFilter,
      magFilter: n.NearestFilter,
      format: n.RGBAFormat,
      depthBuffer: !0,
      depthTexture: new n.DepthTexture(A, g)
    }), this.edlMaterial = new n.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorTarget.texture },
        tDepth: { value: this.depthTarget.depthTexture },
        screenSize: { value: new n.Vector2(A, g) },
        edlStrength: { value: this.options.edlStrength },
        radius: { value: this.options.edlRadius }
      },
      vertexShader: p,
      fragmentShader: U
    }), this.edlQuadScene = new n.Scene(), this.edlQuadCamera = new n.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const I = new n.PlaneGeometry(2, 2), B = new n.Mesh(I, this.edlMaterial);
    this.edlQuadScene.add(B);
  }
  updateEDLSize() {
    if (!this.map || !this.colorTarget || !this.depthTarget || !this.edlMaterial)
      return;
    const A = this.map.getCanvas().width, g = this.map.getCanvas().height;
    A === this._lastEdlWidth && g === this._lastEdlHeight || (this._lastEdlWidth = A, this._lastEdlHeight = g, this.colorTarget.setSize(A, g), this.depthTarget.setSize(A, g), this.edlMaterial.uniforms.screenSize.value.set(A, g));
  }
  createPointMaterial() {
    if (this.options.enableEDL)
      return new n.ShaderMaterial({
        uniforms: {
          size: { value: this.options.pointSize },
          scale: { value: window.devicePixelRatio },
          useVertexColors: { value: this.options.colorMode !== "white" },
          pointColor: { value: new n.Color(16777215) }
        },
        vertexShader: S,
        fragmentShader: L,
        vertexColors: this.options.colorMode !== "white",
        depthTest: this.options.depthTest,
        depthWrite: this.options.depthTest,
        transparent: !1
      });
    const A = new n.PointsMaterial({
      vertexColors: this.options.colorMode !== "white",
      size: this.options.pointSize,
      depthTest: this.options.depthTest,
      depthWrite: this.options.depthTest,
      sizeAttenuation: !0
    });
    return this.options.colorMode === "white" && A.color.setHex(16777215), A;
  }
  // Public getters
  getPointSize() {
    return this.options.pointSize;
  }
  getColorMode() {
    return this.options.colorMode;
  }
  getSseThreshold() {
    return this.options.sseThreshold;
  }
  getDepthTest() {
    return this.options.depthTest;
  }
  getOptions() {
    return { ...this.options };
  }
  setColorMode(A) {
    var g;
    this.options.colorMode = A, this.worker.postMessage({
      type: "setOptions",
      options: { colorMode: A }
    }), this.clearCache(), (g = this.map) == null || g.triggerRepaint();
  }
  isLoading() {
    return this.pendingRequests.size > 0 || !this.workerInitialized;
  }
  getNodeStats() {
    return {
      loaded: this.cacheManager.size(),
      visible: this.visibleNodes.length
    };
  }
  getLoadedPoints() {
    return this.cacheManager.getCachedNodeIds().map((A) => this.cacheManager.get(A)).filter(Boolean).map((A) => ({
      nodeId: A.nodeId,
      positions: A.positions,
      colors: A.colors,
      pointCount: A.pointCount
    }));
  }
  clearCache() {
    this.cacheManager.clear(), this.updateVisibleNodes();
  }
  setEDLEnabled(A) {
    var g;
    this.options.enableEDL = A, A && !this.edlMaterial && this.setupEDL(), this.rebuildAllMaterials(), (g = this.map) == null || g.triggerRepaint();
  }
  updateEDLParameters(A) {
    var g;
    this.edlMaterial && (A.strength !== void 0 && (this.options.edlStrength = A.strength, this.edlMaterial.uniforms.edlStrength.value = A.strength), A.radius !== void 0 && (this.options.edlRadius = A.radius, this.edlMaterial.uniforms.radius.value = A.radius), (g = this.map) == null || g.triggerRepaint());
  }
  getEDLParameters() {
    return {
      enabled: this.options.enableEDL,
      strength: this.options.edlStrength,
      radius: this.options.edlRadius
    };
  }
}
function m(E, A) {
  const g = E[0] - A[0], I = E[1] - A[1], B = E[2] - A[2];
  return Math.sqrt(g * g + I * I + B * B);
}
function b(E, A, g, I, B, t) {
  let Q = m(E, A);
  t !== void 0 && Q > t && (Q = t);
  const i = g * (Math.PI / 180);
  return I * B / (2 * Q * Math.tan(i / 2));
}
export {
  c as CacheManager,
  _ as CopcLayer,
  b as computeScreenSpaceError,
  k as lazPerfWasmDataUri
};
