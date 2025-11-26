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

    try {
        // API yang reliable untuk Facebook (support format baru)
        const apiUrl = "https://www.tikwm.com/api/";
        
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                url: url,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }),
        });

        const data = await response.json();
        
        // Check if video data exists
        if (data.code === 0 && data.data) {
            let downloadUrl = null;
            
            // Try HD first, then SD
            if (data.data.hdplay) {
                downloadUrl = data.data.hdplay;
            } else if (data.data.play) {
                downloadUrl = data.data.play;
            } else if (data.data.wmplay) {
                downloadUrl = data.data.wmplay;
            }
            
            if (downloadUrl) {
                return res.status(200).json({
                    success: true,
                    downloadUrl: downloadUrl,
                    message: "Video berhasil ditemukan!",
                });
            }
        }
        
        throw new Error("TikWm API failed");
        
    } catch (err) {
        console.error("Primary API failed:", err.message);
        
        // Fallback: Try Cobalt API
        try {
            const cobaltUrl = "https://api.cobalt.tools/api/json";
            
            const response = await fetch(cobaltUrl, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: url,
                    vCodec: "h264",
                    vQuality: "720",
                    isAudioOnly: false,
                }),
            });
            
            const data = await response.json();
            
            if (data.status === "redirect" || data.status === "stream") {
                return res.status(200).json({
                    success: true,
                    downloadUrl: data.url,
                    message: "Video berhasil ditemukan (Cobalt API)!",
                });
            }
            
            throw new Error("Cobalt API failed");
            
        } catch (err2) {
            console.error("Fallback API failed:", err2.message);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil video Facebook. Format link /share/v/ atau /reel/ mungkin belum fully support. Coba gunakan link format lama: fb.watch/xxx atau facebook.com/username/videos/id",
            });
        }
    }
}
