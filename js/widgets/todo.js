// Todo widget (read-only this task; write is Task 7).

var todo_data = null;
var todo_timer = null;

function todo() {
  console.log("todo update");
  fetchJson({ method: "GET", path: "/api/todo", auth: false }, function (status, body) {
    if (status !== 200 || !body || !body.items) {
      // silent: clock+todo layout will fall back to clock-only when todo_data is null
      return;
    }
    todo_data = body;
    renderTodo();
    if (!todo_timer) {
      todo_timer = setInterval("todo()", (body.intervalMs || 600000));
    }
  });
}

function renderTodo() {
  var ul = document.getElementById("todo_list");
  if (!ul) return;
  if (!todo_data || !todo_data.items || todo_data.items.length === 0) {
    ul.innerHTML = "<li style='opacity:0.4'>没有待办</li>";
    return;
  }
  var html = "";
  for (var i = 0; i < todo_data.items.length; i++) {
    var it = todo_data.items[i];
    // Checkbox rendering: filled square for done, empty for pending.
    // Click handler is wired in Task 7.
    var box = it.done ? "☑" : "☐";
    var row = "<li data-id='" + it.id + "'>"
            + "<span class='todo_box'>" + box + "</span> "
            + escapeHtml(it.title)
            + "</li>";
    html += row;
  }
  ul.innerHTML = html;
}

function escapeHtml(s) {
  // Tiny HTML escaper for todo titles. Titles come from the user (mini-program).
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
