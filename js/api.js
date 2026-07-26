// Central API helper. ES5 only (Kindle WebKit).
// Reads apiBase + apiToken from cookies set via settings dialog.

var DEFAULT_API_BASE = "http://localhost:8765";

function getApiBase() {
  var b = getCookie("apiBase");
  return b ? b : DEFAULT_API_BASE;
}

function setApiBase(url) {
  setCookie("apiBase", url, 30);
}

function getApiToken() {
  return getCookie("apiToken");
}

function setApiToken(token) {
  setCookie("apiToken", token, 360); // 1 year
}

// fetchJson({ method, path, body, auth })
//   callback(status, parsedOrNull)  — status is HTTP code, parsedOrNull is
//   the parsed body on success or a {error:{code,message}} object on failure.
// Never throws; XHR errors produce status=0.
function fetchJson(opts, callback) {
  var xhr = new XMLHttpRequest();
  var url = getApiBase() + opts.path;
  xhr.open(opts.method || "GET", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (opts.auth !== false && getApiToken()) {
    xhr.setRequestHeader("Authorization", "Bearer " + getApiToken());
  }
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var status = xhr.status;
    var body = null;
    try {
      body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    } catch (e) {
      body = { error: { code: "BAD_RESPONSE", message: "invalid JSON" } };
    }
    callback(status, body);
  };
  try {
    xhr.send(opts.body ? JSON.stringify(opts.body) : null);
  } catch (e) {
    callback(0, { error: { code: "NETWORK", message: String(e) } });
  }
}
