/***********************
 * 你接后端时改这里
 ***********************/
const API_BASE = ""; // 例如: "http://localhost:8080"
const ENDPOINT_PRODUCTS = "/api/products"; // GET，返回数组
// 建议商品结构：
// { id, name, price, category, sku, stock, desc, createdAt }

/***********************
 * Mock 数据（可删）
 ***********************/
const MOCK_PRODUCTS = [
    {id:1, name:"冷感机械键盘 87键", price:399, category:"数码", sku:"KB-87-COLD", stock:32, desc:"黑白灰配色，PBT键帽，静音轴体，适合办公与游戏。", createdAt:"2025-10-02"},
    {id:2, name:"极简无线鼠标", price:149, category:"数码", sku:"MS-SLIM-01", stock:58, desc:"轻量化，静音微动，Type-C 充电，冷灰涂层。", createdAt:"2025-11-12"},
    {id:3, name:"无香氛洗衣凝珠（48颗）", price:59.9, category:"日用", sku:"DAILY-POD-48", stock:120, desc:"低刺激配方，适合敏感肌，清洁力稳定。", createdAt:"2025-09-18"},
    {id:4, name:"不锈钢保温杯 450ml", price:89, category:"日用", sku:"CUP-450-SS", stock:76, desc:"双层真空，12小时保温，冷灰磨砂杯身。", createdAt:"2025-08-22"},
    {id:5, name:"基础款卫衣（冷灰）", price:169, category:"服饰", sku:"HOODIE-GRAY", stock:44, desc:"宽松版型，毛圈内里，简洁无印风格。", createdAt:"2025-12-01"},
    {id:6, name:"直筒工装裤（黑）", price:219, category:"服饰", sku:"PANTS-BLK-01", stock:27, desc:"耐磨面料，多口袋，日常通勤都能搭。", createdAt:"2025-11-25"},
    {id:7, name:"冷萃咖啡豆 500g", price:128, category:"食品", sku:"BEAN-500-CB", stock:65, desc:"中深烘焙，巧克力与坚果风味，适合冷萃。", createdAt:"2025-10-19"},
    {id:8, name:"即食燕麦杯（6杯装）", price:72, category:"食品", sku:"OAT-CUP-6", stock:90, desc:"低糖配方，早餐快速搞定，口感细腻。", createdAt:"2025-09-30"},
    {id:9, name:"桌面氛围灯（冷白光）", price:119, category:"家居", sku:"LAMP-CW-01", stock:41, desc:"三档亮度，触控开关，冷白光提升专注。", createdAt:"2025-10-28"},
    {id:10, name:"极简床品四件套（灰）", price:299, category:"家居", sku:"BED-GR-SET", stock:19, desc:"亲肤面料，低饱和灰，适配冷色卧室。", createdAt:"2025-11-06"},
];

/***********************
 * 状态
 ***********************/
let allProducts = [...MOCK_PRODUCTS];
let filtered = [];
let activeCategory = "全部";

const cart = new Map(); // id -> {product, qty}

/***********************
 * DOM
 ***********************/
const $ = (s)=>document.querySelector(s);
const grid = $("#grid");
const empty = $("#empty");
const statusText = $("#statusText");
const resultTip = $("#resultTip");

const catChips = $("#catChips");
const q = $("#q");
const minPrice = $("#minPrice");
const maxPrice = $("#maxPrice");
const sort = $("#sort");

const overlay = $("#overlay");
const drawer = $("#drawer");
const cartBtn = $("#cartBtn");
const cartCount = $("#cartCount");
const cartList = $("#cartList");
const cartTotal = $("#cartTotal");

const modalWrap = $("#modalWrap");
const modalTitle = $("#modalTitle");
const modalCat = $("#modalCat");
const modalSku = $("#modalSku");
const modalStock = $("#modalStock");
const modalPrice = $("#modalPrice");
const modalDesc = $("#modalDesc");
const modalAdd = $("#modalAdd");
const modalBuy = $("#modalBuy");

const toast = $("#toast");

let currentModalProduct = null;

/***********************
 * 工具函数
 ***********************/
const money = (n)=>`¥ ${(Number(n)||0).toFixed(2)}`;
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
function showToast(msg){
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(()=>toast.classList.remove("show"), 1800);
}

function openCart(){
    overlay.classList.add("show");
    drawer.classList.add("show");
    renderCart();
}
function closeCart(){
    overlay.classList.remove("show");
    drawer.classList.remove("show");
}

function openModal(p){
    currentModalProduct = p;
    modalTitle.textContent = p.name;
    modalCat.textContent = p.category || "—";
    modalSku.textContent = `SKU: ${p.sku || "-"}`;
    modalStock.textContent = `库存: ${p.stock ?? "-"}`;
    modalPrice.textContent = money(p.price);
    modalDesc.textContent = p.desc || "暂无描述。";
    modalWrap.classList.add("show");
}
function closeModal(){
    modalWrap.classList.remove("show");
    currentModalProduct = null;
}

/***********************
 * 渲染
 ***********************/
function renderCategories(){
    const cats = ["全部", ...Array.from(new Set(allProducts.map(p=>p.category).filter(Boolean)))];
    catChips.innerHTML = cats.map(c=>`
      <button class="chip ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>
    `).join("");
}

function renderGrid(list){
    grid.innerHTML = list.map(p=>`
      <article class="card" data-id="${p.id}">
        <div class="thumb"></div>
        <div class="cardBody">
          <h4 class="title">${escapeHtml(p.name)}</h4>
          <div class="meta">
            <span class="tag">${escapeHtml(p.category || "未分类")}</span>
            <span class="tag">SKU ${escapeHtml(p.sku || "-")}</span>
            <span class="tag">库存 ${p.stock ?? "-"}</span>
          </div>
          <div class="priceRow">
            <div>
              <div class="price">${money(p.price)}</div>
              <div class="muted small">上架 ${escapeHtml((p.createdAt||"—").slice(0,10))}</div>
            </div>
            <div class="cardActions">
              <button class="iconBtn" data-action="detail">详情</button>
              <button class="iconBtn solid" data-action="add">加入</button>
            </div>
          </div>
        </div>
      </article>
    `).join("");

    empty.style.display = list.length ? "none" : "block";
    resultTip.textContent = `共 ${list.length} 件商品`;
}

function renderCart(){
    const items = Array.from(cart.values());
    cartCount.textContent = items.reduce((s,it)=>s+it.qty,0);

    if(items.length===0){
        cartList.innerHTML = `<div class="muted small" style="padding:14px 2px;">购物车空空的，去挑点商品吧。</div>`;
        cartTotal.textContent = money(0);
        return;
    }

    let total = 0;
    cartList.innerHTML = items.map(({product:p, qty})=>{
        total += (Number(p.price)||0) * qty;
        return `
        <div class="cartItem" data-id="${p.id}">
          <div class="miniThumb"></div>
          <div>
            <p class="ciTitle">${escapeHtml(p.name)}</p>
            <div class="ciSub">${money(p.price)} · ${escapeHtml(p.category||"—")}</div>
            <div class="ciSub danger" style="display:${(p.stock!=null && qty>p.stock) ? 'block':'none'}">超出库存</div>
          </div>
          <div class="qty">
            <button data-action="minus">−</button>
            <span>${qty}</span>
            <button data-action="plus">＋</button>
          </div>
        </div>
      `;
    }).join("");

    cartTotal.textContent = money(total);
}

/***********************
 * 过滤/排序
 ***********************/
function applyFilters(){
    const keyword = q.value.trim().toLowerCase();
    const min = minPrice.value === "" ? null : Number(minPrice.value);
    const max = maxPrice.value === "" ? null : Number(maxPrice.value);

    let list = [...allProducts];

    if(activeCategory !== "全部"){
        list = list.filter(p => (p.category||"") === activeCategory);
    }
    if(keyword){
        list = list.filter(p=>{
            const hay = `${p.name||""} ${p.sku||""} ${p.category||""} ${p.desc||""}`.toLowerCase();
            return hay.includes(keyword);
        });
    }
    if(min != null && !Number.isNaN(min)) list = list.filter(p => Number(p.price) >= min);
    if(max != null && !Number.isNaN(max)) list = list.filter(p => Number(p.price) <= max);

    const s = sort.value;
    if(s === "price_asc") list.sort((a,b)=>Number(a.price)-Number(b.price));
    if(s === "price_desc") list.sort((a,b)=>Number(b.price)-Number(a.price));
    if(s === "newest") list.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

    filtered = list;
    renderGrid(filtered);
}

/***********************
 * 购物车逻辑
 ***********************/
function addToCart(p, n=1){
    const cur = cart.get(p.id);
    const nextQty = (cur?.qty || 0) + n;
    cart.set(p.id, {product:p, qty: Math.max(1, nextQty)});
    renderCart();
    showToast("已加入购物车");
}
function changeQty(id, delta){
    const it = cart.get(id);
    if(!it) return;
    const q = it.qty + delta;
    if(q <= 0){ cart.delete(id); }
    else { it.qty = q; cart.set(id, it); }
    renderCart();
}
function clearCart(){
    cart.clear();
    renderCart();
    showToast("已清空购物车");
}

/***********************
 * 后端对接：拉取商品
 ***********************/
async function fetchProducts(){
    statusText.textContent = "加载中…";
    try{
        const url = (API_BASE || "") + ENDPOINT_PRODUCTS;
        const res = await fetch(url, { headers: { "Accept":"application/json" } });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if(!Array.isArray(data)) throw new Error("返回值不是数组");
        // 轻度容错：字段名不一致时自己映射
        allProducts = data.map(x=>({
            id: x.id ?? x.ID ?? x.product_id,
            name: x.name ?? x.title,
            price: x.price ?? x.sale_price ?? 0,
            category: x.category ?? x.cat ?? "未分类",
            sku: x.sku ?? x.SKU ?? "",
            stock: x.stock ?? x.inventory ?? null,
            desc: x.desc ?? x.description ?? "",
            createdAt: x.createdAt ?? x.created_at ?? x.create_time ?? ""
        })).filter(p=>p.id!=null);

        statusText.textContent = `已加载 ${allProducts.length} 件`;
        renderCategories();
        applyFilters();
        showToast("已从接口加载商品");
    }catch(e){
        console.warn(e);
        statusText.textContent = "接口不可用（已保留 Mock）";
        showToast("拉取失败：请确认 /api/products");
    }
}

/***********************
 * 事件绑定
 ***********************/
// 分类 chips
catChips.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-cat]");
    if(!btn) return;
    activeCategory = btn.dataset.cat;
    renderCategories();
    applyFilters();
});

// 商品卡片事件（详情/加入）
grid.addEventListener("click", (e)=>{
    const card = e.target.closest(".card");
    if(!card) return;
    const id = Number(card.dataset.id);
    const p = allProducts.find(x=>Number(x.id)===id);
    if(!p) return;

    const act = e.target.closest("button")?.dataset?.action;
    if(act === "detail") openModal(p);
    if(act === "add") addToCart(p, 1);
});

// 搜索实时
q.addEventListener("input", ()=>{
    applyFilters();
});

$("#applyBtn").addEventListener("click", applyFilters);
$("#resetBtn").addEventListener("click", ()=>{
    activeCategory = "全部";
    q.value = "";
    minPrice.value = "";
    maxPrice.value = "";
    sort.value = "reco";
    renderCategories();
    applyFilters();
});

// cart open/close
cartBtn.addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", ()=>{
    closeCart();
    closeModal();
});

// cart qty
cartList.addEventListener("click", (e)=>{
    const item = e.target.closest(".cartItem");
    if(!item) return;
    const id = Number(item.dataset.id);
    const act = e.target.closest("button")?.dataset?.action;
    if(act === "minus") changeQty(id, -1);
    if(act === "plus") changeQty(id, +1);
});

$("#clearCart").addEventListener("click", clearCart);
$("#checkoutBtn").addEventListener("click", ()=>{
    const total = cartTotal.textContent;
    if(cart.size===0) return showToast("购物车为空");
    // 这里只做UI演示：接后端时改成创建订单接口
    showToast(`已生成结算（演示） · ${total}`);
});

// modal
$("#closeModal").addEventListener("click", closeModal);
modalWrap.addEventListener("click", (e)=>{
    if(e.target === modalWrap) closeModal();
});
modalAdd.addEventListener("click", ()=>{
    if(!currentModalProduct) return;
    addToCart(currentModalProduct, 1);
});
modalBuy.addEventListener("click", ()=>{
    if(!currentModalProduct) return;
    addToCart(currentModalProduct, 1);
    closeModal();
    openCart();
});

// hero buttons
$("#mockBtn").addEventListener("click", ()=>{
    allProducts = [...MOCK_PRODUCTS];
    statusText.textContent = `使用 Mock（${allProducts.length} 件）`;
    renderCategories();
    applyFilters();
    showToast("已切换为 Mock 数据");
});
$("#apiBtn").addEventListener("click", fetchProducts);

// top actions demo
$("#loginBtn").addEventListener("click", ()=>showToast("登录 UI（待接后端）"));
$("#homeBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    window.scrollTo({top:0, behavior:"smooth"});
});

// init
function escapeHtml(str){
    return String(str ?? "").replace(/[&<>"']/g, s => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[s]));
}
renderCategories();
applyFilters();
renderCart();

// 键盘 ESC 关闭
document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){ closeCart(); closeModal(); }
});