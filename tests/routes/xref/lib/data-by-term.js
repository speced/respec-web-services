export default {
  "event handler": [
    {
      type: "dfn",
      spec: "html",
      shortname: "html",
      status: "snapshot",
      uri: "webappapis.html#event-handlers",
    },
  ],
  "": [
    {
      type: "enum-value",
      spec: "referrer-policy-1",
      shortname: "referrer-policy",
      status: "current",
      uri: "#dom-referrerpolicy",
      for: ["ReferrerPolicy"],
    },
    {
      type: "enum-value",
      spec: "fetch",
      shortname: "fetch",
      status: "current",
      uri: "#dom-requestdestination",
      for: ["RequestDestination"],
    },
    {
      type: "enum-value",
      spec: "xhr",
      shortname: "xhr",
      status: "current",
      uri: "#dom-xmlhttprequestresponsetype",
      for: ["XMLHttpRequestResponseType"],
    },
  ],
  Baseline: [
    {
      type: "interface",
      spec: "font-metrics-api-1",
      shortname: "font-metrics-api",
      status: "current",
      uri: "#baseline",
      normative: true,
      htmlProse: "test html Prose",
    },
  ],
  baseline: [
    {
      type: "dfn",
      spec: "svg2",
      shortname: "svg",
      status: "snapshot",
      uri: "text.html#TermBaseline",
    },
    {
      type: "dfn",
      spec: "svg2",
      shortname: "svg",
      status: "current",
      uri: "text.html#TermBaseline",
    },
  ],
  body: [
    {
      shortname: "fetch",
      spec: "fetch",
      uri: "#concept-body",
      type: "dfn",
    },
    {
      shortname: "html",
      spec: "html",
      uri: "sections.html#the-body-element",
      type: "element",
    },
  ],
  script: [
    {
      type: "enum-value",
      spec: "fetch",
      shortname: "fetch",
      status: "current",
      uri: "#dom-requestdestination-script",
      for: ["RequestDestination"],
    },
    {
      type: "element",
      spec: "html",
      shortname: "html",
      status: "snapshot",
      uri: "scripting.html#script",
    },
    {
      type: "dfn",
      spec: "html",
      shortname: "html",
      status: "snapshot",
      uri: "webappapis.html#concept-script",
    },
    {
      type: "element",
      spec: "svg",
      shortname: "svg",
      status: "snapshot",
      uri: "script.html#ScriptElement",
    },
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "snapshot",
      uri: "interact.html#elementdef-script",
    },
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "current",
      uri: "interact.html#elementdef-script",
    },
  ],
  "inherited value": [
    {
      type: "dfn",
      spec: "css-cascade-3",
      shortname: "css-cascade",
      status: "snapshot",
      uri: "#inherited-value",
    },
    {
      type: "dfn",
      spec: "css-cascade-3",
      shortname: "css-cascade",
      status: "current",
      uri: "#inherited-value",
    },
    {
      type: "dfn",
      spec: "css-cascade-4",
      shortname: "css-cascade",
      status: "snapshot",
      uri: "#inherited-value",
    },
    {
      type: "dfn",
      spec: "css-cascade-4",
      shortname: "css-cascade",
      status: "current",
      uri: "#inherited-value",
    },
  ],
  marker: [
    {
      type: "dfn",
      spec: "css-lists-3",
      shortname: "css-lists",
      status: "current",
      uri: "#marker",
    },
    {
      type: "element",
      spec: "svg",
      shortname: "svg",
      status: "snapshot",
      uri: "painting.html#MarkerElement",
    },
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "snapshot",
      uri: "painting.html#elementdef-marker",
    },
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "current",
      uri: "painting.html#elementdef-marker",
    },
  ],
  EventInit: [
    {
      type: "dictionary",
      spec: "dom",
      shortname: "dom",
      status: "snapshot",
      uri: "#dictdef-eventinit",
    },
  ],
  "[[context]]": [
    {
      type: "attribute",
      spec: "web-bluetooth-1",
      shortname: "web-bluetooth",
      status: "snapshot",
      uri: "#dom-bluetoothdevice-context-slot",
      for: ["BluetoothDevice"],
    },
  ],
  event: [
    {
      type: "dfn",
      spec: "dom",
      shortname: "dom",
      status: "snapshot",
      uri: "#concept-event",
    },
    {
      type: "attribute",
      spec: "dom",
      shortname: "dom",
      status: "snapshot",
      uri: "#dom-window-event",
      for: ["Window"],
    },
    {
      type: "attribute",
      spec: "html",
      shortname: "html",
      status: "snapshot",
      uri: "obsolete.html#dom-script-event",
      for: ["HTMLScriptElement"],
    },
  ],
  "for each": [
    {
      type: "dfn",
      spec: "infra",
      shortname: "infra",
      status: "current",
      uri: "#list-iterate",
      for: ["list", "set"],
    },
  ],
  aborted: [
    {
      type: "attribute",
      spec: "dom",
      shortname: "dom",
      status: "snapshot",
      uri: "#dom-abortsignal-aborted",
      for: ["AbortSignal"],
    },
  ],
  "user agent": [
    {
      type: "dfn",
      spec: "infra",
      shortname: "infra",
      status: "current",
      uri: "#user-agent",
      normative: true,
    },
    {
      type: "dfn",
      spec: "wai-aria-1.2",
      shortname: "wai-aria",
      status: "current",
      uri: "#dfn-user-agent",
      normative: false,
    },
  ],
  foreignObject: [
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "current",
      uri: "embedded.html#elementdef-foreignObject",
    },
  ],
  clipPath: [
    {
      type: "element",
      spec: "svg2",
      shortname: "svg",
      status: "current",
      uri: "masking.html#elementdef-clipPath",
    },
  ],
  "user agents": [
    {
      type: "dfn",
      spec: "wai-aria-1.2",
      shortname: "wai-aria",
      status: "current",
      uri: "#dfn-user-agent",
      normative: false,
    },
  ],
  // The canonical URL concept is indexed under "URL" (case preserved), while a
  // distinct for-scoped "url" (the basic URL parser's local variable) exists
  // under the lowercase key. A lowercased query ("url") must still resolve the
  // canonical concept and not be shadowed by the for-scoped lowercase entry.
  URL: [
    {
      type: "dfn",
      spec: "url",
      shortname: "url",
      status: "current",
      uri: "#concept-url",
      normative: true,
    },
  ],
  url: [
    {
      type: "dfn",
      spec: "url",
      shortname: "url",
      status: "current",
      uri: "#basic-url-parser-url",
      normative: true,
      for: ["basic URL parser"],
    },
  ],
  // Production shape for a current/snapshot pair: the current entry's uri is a
  // relative fragment, the snapshot entry's is an absolute TR URL. Every other
  // pair in this fixture shares one uri, which is why a dedup keyed on uri
  // looked correct locally while duplicating every term in production.
  "credential manager": [
    {
      type: "dfn",
      spec: "credential-management-1",
      shortname: "credential-management",
      status: "snapshot",
      uri: "https://www.w3.org/TR/credential-management-1/#credential-manager",
      normative: true,
    },
    {
      type: "dfn",
      spec: "credential-management-1",
      shortname: "credential-management",
      status: "current",
      uri: "#credential-manager",
      normative: true,
    },
  ],
  // Two distinct dict-members sharing a spec, type and term, told apart only by
  // `for`. Production has 2198 such groups (e.g. Cookie Store's `name` across
  // four dictionaries), so an identity that ignores `for` silently drops them.
  name: [
    {
      type: "dict-member",
      spec: "cookiestore",
      shortname: "cookiestore",
      status: "snapshot",
      uri: "https://www.w3.org/TR/cookiestore/#dom-cookieinit-name",
      for: ["CookieInit"],
    },
    {
      type: "dict-member",
      spec: "cookiestore",
      shortname: "cookiestore",
      status: "snapshot",
      uri: "https://www.w3.org/TR/cookiestore/#dom-cookielistitem-name",
      for: ["CookieListItem"],
    },
  ],
  // The by-term store strips `term` and files every method overload under a
  // shared `name()` key (see updateDataByTerm), so these two distinct overloads
  // are indistinguishable by spec, type, term and for. They are both snapshot,
  // i.e. non-preferred by default, so they reach the dedup path. Production has
  // 76 groups with more than one uri at the same status, 18 of them snapshot;
  // only 6 of those also lack a preferred twin, which is the case this pins.
  "get()": [
    {
      type: "method",
      spec: "webxr-hand-input-1",
      shortname: "webxr-hand-input",
      status: "snapshot",
      uri: "https://www.w3.org/TR/webxr-hand-input-1/#dom-xrhand-get",
      for: ["XRHand"],
    },
    {
      type: "method",
      spec: "webxr-hand-input-1",
      shortname: "webxr-hand-input",
      status: "snapshot",
      uri: "https://www.w3.org/TR/webxr-hand-input-1/#dom-xrhand-get-jointname",
      for: ["XRHand"],
    },
  ],
};
