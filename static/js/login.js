// static/js/login.js
import { apiFetch, setToken } from "./api.js";

const form = document.getElementById("loginForm");
const toast = document.getElementById("toast");

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const payload = {
        account: fd.get("account"),
        password: fd.get("password"),
    };

    try {
        const data = await apiFetch("/api/login", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        setToken(data.token);
        showToast("登录成功");
        setTimeout(() => (location.href = "/"), 500);
    } catch (err) {
        showToast(err.message || "登录失败");
    }
});
