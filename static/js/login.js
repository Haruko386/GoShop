// 你接后端时改这里
const API_BASE = "";                 // e.g. http://localhost:8080
const ENDPOINT_LOGIN = "/api/login"; // POST

const toast = document.getElementById("toast");
function showToast(msg){
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(()=>toast.classList.remove("show"), 1800);
}

document.getElementById("forgotBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    showToast("忘记密码（演示）");
});

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
        account: fd.get("account"),
        password: fd.get("password"),
        remember: !!fd.get("remember")
    };

    // 演示：若未配置 API_BASE 就只提示成功
    if(!API_BASE){
        showToast("登录成功（演示）");
        setTimeout(()=>location.href="./index.html", 600);
        return;
    }

    try{
        const res = await fetch(API_BASE + ENDPOINT_LOGIN, {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error("登录失败");
        showToast("登录成功");
        setTimeout(()=>location.href="./index.html", 600);
    }catch(err){
        console.warn(err);
        showToast("登录失败：请检查接口");
    }
});