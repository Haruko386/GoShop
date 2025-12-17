import { apiFetch, getToken, clearToken } from "./api.js";

const $ = (s) => document.querySelector(s);

const statusText = $("#statusText");
const grid = $("#grid");
const empty = $("#empty");

const cartBtn = $("#cartBtn");
const cartCount = $("#cartCount");
const overlay = $("#overlay");
const drawer = $("#drawer");
const closeCart = $("#closeCart");
const cartList = $("#cartList");
const cartTotal = $("#cartTotal");
const checkoutBtn = $("#checkoutBtn");
const clearCartBtn = $("#clearCart");

const loginBtn = $("#loginBtn");
const toast = $("#toast");

let products = [];
let cartItems = []; // 后端 cart list

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function money(n) {
    return `¥ ${(Number(n) || 0).toFixed(2)}`;
}

function openCart() {
    overlay.classList.add("show");
    drawer.classList.add("show");
}
function hideCart() {
    overlay.classList.remove("show");
    drawer.classList.remove("show");
}

// -------------------- 登录态显示 --------------------
async function refreshAuthUI() {
    const token = getToken();
    if (!token) {
        loginBtn.textContent = "登录";
        loginBtn.onclick = () => (location.href = "/login");
        return;
    }

    try {
        const me = await apiFetch("/api/me");
        if (me.id === 1) {
            const a = document.createElement("a");
            a.className = "pill";
            a.href = "/admin";
            a.textContent = "发布商品";
            document.getElementById("topActions").prepend(a);
        }
        loginBtn.textContent = `退出（${me.username}）`;
        loginBtn.onclick = () => {
            clearToken();
            showToast("已退出");
            setTimeout(() => location.reload(), 300);
        };
    } catch {
        // apiFetch 已处理 401
    }
}

// -------------------- 商品 --------------------
function renderProducts(list) {
    grid.innerHTML = list
        .map(
            (p) => `
    <article class="card" data-id="${p.ID || p.id}">
      <div class="thumb"></div>
      <div class="cardBody">
        <h4 class="title">${escapeHtml(p.name)}</h4>
        <div class="meta">
          <span class="tag">${escapeHtml(p.category || "未分类")}</span>
          <span class="tag">库存 ${p.inventory ?? "-"}</span>
        </div>
        <div class="priceRow">
          <div>
            <div class="price">${money(p.price)}</div>
          </div>
          <div class="cardActions">
            <button class="iconBtn solid" data-action="add">加入</button>
          </div>
        </div>
      </div>
    </article>
  `
        )
        .join("");

    empty.style.display = list.length ? "none" : "block";
}

async function loadProducts() {
    statusText.textContent = "加载商品…";
    try {
        products = await apiFetch("/api/products"); // 不需要登录
        statusText.textContent = `已加载 ${products.length} 件`;
        renderProducts(products);
    } catch (err) {
        statusText.textContent = "商品加载失败";
        showToast(err.message || "商品加载失败");
    }
}

// -------------------- 购物车（全部走后端） --------------------
function calcTotal(items) {
    let total = 0;
    for (const it of items) {
        const price = it.Stock?.price ?? it.stock?.price ?? 0;
        total += price * it.quantity;
    }
    return total;
}

function renderCart(items) {
    const cnt = items.reduce((s, it) => s + (it.quantity || 0), 0);
    cartCount.textContent = String(cnt);

    if (!items.length) {
        cartList.innerHTML = `<div class="muted small" style="padding:14px 2px;">购物车空空的。</div>`;
        cartTotal.textContent = money(0);
        return;
    }

    cartList.innerHTML = items
        .map((it) => {
            const stock = it.Stock || it.stock || {};
            return `
      <div class="cartItem" data-id="${it.ID || it.id}">
        <div class="miniThumb"></div>
        <div>
          <p class="ciTitle">${escapeHtml(stock.name || "")}</p>
          <div class="ciSub">${money(stock.price)} · ${escapeHtml(stock.category || "")}</div>
        </div>
        <div class="qty">
          <button data-action="minus">−</button>
          <span>${it.quantity}</span>
          <button data-action="plus">＋</button>
          <button data-action="del" title="删除" style="margin-left:6px;">🗑</button>
        </div>
      </div>
    `;
        })
        .join("");

    cartTotal.textContent = money(calcTotal(items));
}

async function loadCart() {
    // 未登录：不请求购物车（也可以提示登录）
    if (!getToken()) {
        cartItems = [];
        renderCart(cartItems);
        return;
    }
    try {
        const data = await apiFetch("/api/cart");
        cartItems = Array.isArray(data) ? data : [];
        renderCart(cartItems);
    } catch (err) {
        showToast(err.message || "购物车加载失败");
    }
}

async function addToCart(stockID, qty = 1) {
    if (!getToken()) {
        showToast("请先登录");
        location.href = "/login";
        return;
    }
    await apiFetch("/api/cart", {
        method: "POST",
        body: JSON.stringify({ stock_id: stockID, quantity: qty }),
    });
    showToast("已加入购物车");
    await loadCart();
}

// 修改数量：PUT /api/cart/:id  { quantity }
async function updateCartQty(cartID, quantity) {
    await apiFetch(`/api/cart/${cartID}`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
    });
    await loadCart();
}

// 删除：DELETE /api/cart/:id
async function deleteCartItem(cartID) {
    await apiFetch(`/api/cart/${cartID}`, { method: "DELETE" });
    await loadCart();
}

// 清空：把每项删掉（你后端也可以做一个 /api/cart/clear 更快）
async function clearCart() {
    for (const it of cartItems) {
        await deleteCartItem(it.ID || it.id);
    }
    showToast("已清空");
}

// 结算：POST /api/orders
async function checkout() {
    if (!getToken()) {
        showToast("请先登录");
        location.href = "/login";
        return;
    }
    if (!cartItems.length) return showToast("购物车为空");

    await apiFetch("/api/orders", { method: "POST" });
    showToast("下单成功（pending）");
    await loadCart();
    hideCart();
}

// -------------------- 事件绑定 --------------------
grid.addEventListener("click", async (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const act = e.target.closest("button")?.dataset?.action;
    if (act !== "add") return;

    const id = Number(card.dataset.id);
    await addToCart(id, 1);
});

cartBtn.addEventListener("click", async () => {
    await loadCart();
    openCart();
});
closeCart.addEventListener("click", hideCart);
overlay.addEventListener("click", hideCart);

cartList.addEventListener("click", async (e) => {
    const item = e.target.closest(".cartItem");
    if (!item) return;
    const cartID = Number(item.dataset.id);
    const act = e.target.closest("button")?.dataset?.action;
    const cur = cartItems.find((x) => Number(x.ID || x.id) === cartID);
    if (!cur) return;

    if (act === "minus") {
        const next = cur.quantity - 1;
        if (next <= 0) await deleteCartItem(cartID);
        else await updateCartQty(cartID, next);
    }
    if (act === "plus") {
        await updateCartQty(cartID, cur.quantity + 1);
    }
    if (act === "del") {
        await deleteCartItem(cartID);
    }
});

checkoutBtn.addEventListener("click", async () => {
    try {
        await checkout();
    } catch (err) {
        showToast(err.message || "结算失败");
    }
});
clearCartBtn.addEventListener("click", async () => {
    try {
        await clearCart();
    } catch (err) {
        showToast(err.message || "清空失败");
    }
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
    await refreshAuthUI();
    await loadProducts();
    await loadCart(); // 更新右上角数量
})();
