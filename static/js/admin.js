import { apiFetch, getToken } from "./api.js";

const form = document.getElementById("stockForm");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
}

(async function init(){
    if (!getToken()) {
        location.href = "/login";
        return;
    }
    statusText.textContent = "已就绪";
})();

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);

    try {
        await apiFetch("/api/admin/stocks", {
            method: "POST",
            body: fd,               // multipart 直接传 FormData
            headers: {},            // 不要手动设置 Content-Type，浏览器会自动带 boundary
        });
        showToast("发布成功");
        form.reset();
    } catch (err) {
        showToast(err.message || "发布失败");
    }
});
