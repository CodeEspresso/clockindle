// NAS rotation widget.
// Fetches /api/nas/devices, rotates through devices every intervalMs.

var nas_data = null;       // full { devices, intervalMs }
var nas_index = 0;
var nas_timer = null;

function nas() {
  console.log("nas update");
  fetchJson({ method: "GET", path: "/api/nas/devices", auth: false }, function (status, body) {
    if (status !== 200 || !body || !body.devices) {
      document.getElementById("nasTitle").innerHTML = "NAS 数据获取失败 (" + status + ")";
      return;
    }
    nas_data = body;
    renderNas();
    if (!nas_timer) {
      nas_timer = setInterval("renderNas()", (body.intervalMs || 30000));
    }
  });
}

function renderNas() {
  if (!nas_data || !nas_data.devices || nas_data.devices.length === 0) {
    document.getElementById("nasTitle").innerHTML = "暂未配置 NAS";
    document.getElementById("nasBody").innerHTML = "";
    return;
  }
  var d = nas_data.devices[nas_index % nas_data.devices.length];
  nas_index++;

  var html = "<div style='font-size:1.5rem'>" + d.name + "</div>";
  // Render every status field generically. Unknown keys just become "key: value".
  var keys = Object.keys(d.status || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var label = k;
    if (k === "cpu") label = "CPU";
    else if (k === "mem") label = "内存";
    else if (k === "disk") label = "磁盘";
    else if (k === "temp") label = "温度";
    html += "<div>" + label + ": " + d.status[k] + (k === "temp" ? "°C" : "%") + "</div>";
  }
  html += "<div style='font-size:0.8rem'>" + d.id + "</div>";

  document.getElementById("nasTitle").innerHTML = "设备状态";
  document.getElementById("nasBody").innerHTML = html;
}
