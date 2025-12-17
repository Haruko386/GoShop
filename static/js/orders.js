import { apiFetch, getToken, clearToken } from "./api.js";

const $ = (s) => document.querySelector(s);

const statusText = $("#statusText");
const orderList = $("#orderList");
const empty = $("#empty");

const detailBox = $("#detailBox");
const detailHint = $("#detailHint");

const toast = $("#toast");

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function money(n) {
    return `¥ ${(Number(n) || 0).toFixed(2)}`;
}

function statusBadge(s) {
    const map = {
        pending: "待支付",
        paid: "已支付",
        canceled: "已取消",
    };
    return map[s] || s || "-";
}

function ensureLogin() {
    if (!getToken()) {
        location.href = "/login";
        throw new Error("NOT_LOGIN");
    }
}

async function loadOrders() {
    ensureLogin();
    statusText.textContent = "加载中…";
    const data = await apiFetch("/api/orders?page=1&page_size=20");
    const list = data.list || [];
    statusText.textContent = `共 ${data.total ?? list.length} 笔`;

    if (!list.length) {
        empty.style.display = "block";
        orderList.innerHTML = "";
        detailBox.innerHTML = `<div class="muted small">—</div>`;
        detailHint.textContent = "选择一笔订单查看";
        return;
    }

    empty.style.display = "none";

    orderList.innerHTML = list.map(o => `
    <div class="cartItem" style="grid-template-columns: 1fr auto; align-items:start;" data-id="${o.id || o.ID}">
      <div>
        <p class="ciTitle">订单 #${o.id || o.ID}</p>
        <div class="ciSub">状态：${statusBadge(o.status)}</div>
        <div class="ciSub">总价：${money((o.total_price || 0) / 100)}</div>
      </div>
      <div class="qty" style="gap:6px;">
        <button data-action="detail">详情</button>
        <button data-action="pay">支付</button>
        <button data-action="cancel">取消</button>
      </div>
    </div>
  `).join("");
}

async function loadDetail(orderID) {
    ensureLogin();
    detailHint.textContent = `订单 #${orderID}`;
    const o = await apiFetch(`/api/orders/${orderID}`);
    const items = o.items || [];

    detailBox.innerHTML = `
    <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
      <div>
        <div class="muted small">状态</div>
        <div class="price">${statusBadge(o.status)}</div>
      </div>
      <div>
        <div class="muted small">总价</div>
        <div class="price">${money((o.total_price || 0) / 100)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="muted small" style="margin-bottom:8px;">订单项</div>
    ${items.length ? items.map(it => `
      <div class="cartItem" style="grid-template-columns: 1fr auto;">
        <div>
          <p class="ciTitle">${escapeHtml(it.name)}</p>
          <div class="ciSub">${money((it.price || 0) / 100)} × ${it.qty}</div>
        </div>
        <div class="tag">StockID ${it.stock_id}</div>
      </div>
    `).join("") : `<div class="muted small">无订单项</div>`}
  `;
}

async function pay(orderID) {
    ensureLogin();
    await apiFetch(`/api/orders/${orderID}/pay`, { method: "POST" });
    showToast("支付成功");
    await loadOrders();
    await loadDetail(orderID);
}

async function cancel(orderID) {
    ensureLogin();
    await apiFetch(`/api/orders/${orderID}/cancel`, { method: "POST" });
    showToast("已取消");
    await loadOrders();
    await loadDetail(orderID);
}

orderList.addEventListener("click", async (e) => {
    const box = e.target.closest("[data-id]");
    if (!box) return;
    const orderID = box.dataset.id;
    const act = e.target.closest("button")?.dataset?.action;
    try {
        if (act === "detail") await loadDetail(orderID);
        if (act === "pay") await pay(orderID);
        if (act === "cancel") await cancel(orderID);
    } catch (err) {
        showToast(err.message || "操作失败");
    }
});

$("#refreshBtn").addEventListener("click", () => loadOrders().catch(err => showToast(err.message)));
$("#logoutBtn").addEventListener("click", () => {
    clearToken();
    location.href = "/login";
});

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (s) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[s]));
}

// init
(async function init() {
    try {
        await loadOrders();
    } catch (err) {
        if (err.message !== "NOT_LOGIN") showToast(err.message || "加载失败");
    }
})();
