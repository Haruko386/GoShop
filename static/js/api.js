// static/js/api.js
export function getToken() {
    return localStorage.getItem("token") || "";
}

export function setToken(token) {
    localStorage.setItem("token", token);
}

export function clearToken() {
    localStorage.removeItem("token");
}

export async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    const isForm = options.body instanceof FormData;
    if (!headers.has("Content-Type") && options.body && !isForm) {
        headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", "Bearer " + token);

    const res = await fetch(url, { ...options, headers });

    // 未登录/过期：统一处理
    if (res.status === 401) {
        clearToken();
        // 你也可以改成弹 toast，这里简单跳转
        if (!location.pathname.includes("login")) {
            location.href = "/login";
        }
        throw new Error("UNAUTHORIZED");
    }

    // 读 json（兼容空响应）
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
        const msg = data?.msg || data?.error || "请求失败";
        throw new Error(msg);
    }
    return data;
}
