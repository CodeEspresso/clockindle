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
    bindTodoClick();
    if (!todo_timer) {
      todo_timer = setInterval("todo()", (body.intervalMs || 600000));
    }
  });
}

function renderTodo() {
  var ul = document.getElementById("todo_list");
  if (!ul) return;
  // Always re-evaluate layout, regardless of population state.
  applyTodoLayout();
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

var todo_click_bound = false;
function bindTodoClick() {
  if (todo_click_bound) return;
  var ul = document.getElementById("todo_list");
  if (!ul) return;
  ul.addEventListener("click", function (e) {
    var li = e.target && e.target.closest && e.target.closest("li[data-id]");
    if (!li) return;
    var id = li.getAttribute("data-id");
    if (!id) return;
    toggleTodo(id, li);
  });
  todo_click_bound = true;
}

function toggleTodo(id, liEl) {
  if (!getApiToken()) {
    alert("尚未配置 API Token,无法标记完成。请先打开右上角设置填写。");
    return;
  }
  var currentDone = liEl.querySelector(".todo_box").innerHTML === "☑";
  var nextDone = !currentDone;
  // optimistic UI: flip the box immediately so the e-ink user sees feedback
  liEl.querySelector(".todo_box").innerHTML = nextDone ? "☑" : "☐";
  fetchJson({ method: "PATCH", path: "/api/todo/" + encodeURIComponent(id), body: { done: nextDone } }, function (status, body) {
    if (status !== 200) {
      // revert on failure
      liEl.querySelector(".todo_box").innerHTML = currentDone ? "☑" : "☐";
      console.error("toggle failed", status, body);
    } else {
      // update local cache so next renderTodo() reflects the new state
      if (todo_data && todo_data.items) {
        for (var i = 0; i < todo_data.items.length; i++) {
          if (todo_data.items[i].id === id) todo_data.items[i].done = nextDone;
        }
      }
    }
  });
}

function applyTodoLayout() {
  var middle = document.getElementById("middle");
  var todo = document.getElementById("todo_container");
  if (!middle || !todo) return;
  var hasItems = todo_data && todo_data.items && todo_data.items.length > 0;
  todo.style.display = hasItems ? "block" : "none";
  if (hasItems) middle.classList.add("shrunk");
  else middle.classList.remove("shrunk");
}
