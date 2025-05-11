function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/") || ua.includes("Edge/") || ua.includes("EdgA/")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Trident") || ua.includes("MSIE")) return "IE";
    if (ua.includes("MicroMessenger")) return "微信内置浏览器";
    if (ua.includes("QQ/")) return "QQ内置浏览器";
    if (ua.includes("360")) return "360浏览器";
    if (us.includes("QQBrowser")) return "QQ浏览器";
    return "神秘浏览器";
}
function getOSName() {
    const ua = navigator.userAgent;
    if (ua.includes("NT 10.0")) return "Windows 10/11";
    if (ua.includes("NT 6.1")) return "Windows 7";
    if (ua.includes("NT 5.1")) return "Windows XP";
    if (ua.includes("iPhone")) return "iOS";
    if (ua.includes("Android")) {
        const androidVersionMatch = ua.match(/Android\s([0-9.]+)/);
        return androidVersionMatch ? `Android ${androidVersionMatch[1]}` : "Android";
    }
    if (ua.includes("Mac")) return "Mac OS/iPad";
    if (ua.includes("Ubuntu")) return "Ubuntu";
    if (ua.includes("X11")) return "Linux";
    return "神秘系统";
}
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const day = now.getDate();
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const weekday = weekdays[now.getDay()];
fetch('https://my.ip.cn/json/')
    .then(response => response.json())
    .then(data => {
        const location = data.data ? `${data.data.province || "火星"}${data.data.city || ""}${data.data.district || ""}`.trim() : "火星";
        const isp = data.data?.isp || "2G";
        const browser = getBrowserName();
        const os = getOSName();

        info.innerHTML = `今天是 <span id="info-highlight">${year} 年 ${month} 月 ${day} 日 星期${weekday}</span>，来自 <span id="info-highlight">${location}</span> 的你正使用 <span id="info-highlight">${isp}</span> 并通过 <span id="info-highlight">${os}</span> 上的 <span id="info-highlight">${browser}</span> 浏览此页面。你的屏幕分辨率是 <span id="info-highlight">${window.screen.width} x ${window.screen.height}</span>。`;
    })
    .catch(() => {
        const browser = getBrowserName();
        info.innerHTML = `今天是 ${year} 年 ${month} 月 ${day} 日 星期${weekday}，来自 火星 的你正使用 2G 并通过 ${browser} 浏览此页面。`;
    });