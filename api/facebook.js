export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, message: "URL Facebook tidak valid." });
    }

    // Try multiple APIs
    const apis = [
        // API 1: Facebook Video Downloader
        async () => {
            const apiUrl = "https://facebook-video-downloader-api.vercel.app/api";
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const data = await response.json();
            if (data.success && data.video && data.video.length > 0) {
                return data.video[0].url;
            }
            throw new Error("No video found");
        },
        // API 2: Cobalt (support FB format baru)
        async () => {
            const apiUrl = "https://api.cobalt.tools/api/json";
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { 
                    "Accept": "application/json",
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ url, vCodec: "h264", vQuality: "720" }),
            });
            const data = await response.json();
            if (data.url) return data.url;
            throw new Error("Cobalt failed");
        },
        // API 3: SnapSave
        async () => {
            const apiUrl = "https://snapsave.app/action.php";
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ url }),
            });
            const html = await response.text();
            const match = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
            if (match) return match[1];
            throw new Error("SnapSave failed");
        },
    ];

    // Try each API
    for (let i = 0; i < apis.length; i++) {
        try {
            console.log(`Trying Facebook API ${i + 1}...`);
            const downloadUrl = await apis[i]();
            return res.status(200).json({
                success: true,
                downloadUrl: downloadUrl,
                message: "Video berhasil ditemukan!",
            });
        } catch (err) {
            console.error(`API ${i + 1} failed:`, err.message);
            if (i === apis.length - 1) {
                return res.status(500).json({
                    success: false,
                    message: "Gagal mengambil video Facebook. Link format /share/v/ mungkin butuh waktu lebih lama atau coba link format lama (fb.watch/xxx atau facebook.com/username/videos/id).",
                });
            }
        }
    }
}
