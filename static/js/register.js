// static/js/register.js
import { apiFetch } from "./api.js";

const form = document.getElementById("regForm");
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

    const password = fd.get("password");
    const password2 = fd.get("password2");
    if (String(password).length < 6) return showToast("密码至少 6 位");
    if (password !== password2) return showToast("两次密码不一致");

    const payload = {
        username: fd.get("username"),
        password: password,
        email: fd.get("email"),
        phone_num: fd.get("phone_num") || "",
    };

    try {
        await apiFetch("/api/register", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        showToast("注册成功，请登录");
        setTimeout(() => (location.href = "/login"), 700);
    } catch (err) {
        showToast(err.message || "注册失败");
    }
});
