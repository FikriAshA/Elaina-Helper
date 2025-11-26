export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, message: "URL Instagram tidak valid." });
    }

    try {
        // API 1: RapidSave (reliable untuk Instagram Reels & Post)
        const apiUrl1 = "https://v3.saveig.app/api/ajaxSearch";
        
        const response = await fetch(apiUrl1, {
            method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                q: url,
                t: "media",
                lang: "id",
            }),
        });

        if (!response.ok) {
            throw new Error("Gagal ambil data dari API pertama");
        }

        const json = await response.json();

        if (json.status !== "ok" || !json.data) {
            throw new Error("API tidak mengembalikan data yang valid");
        }

        // Parse HTML response untuk ambil download link
        const html = json.data;
        const downloadMatch = html.match(/href="([^"]+)"[^>]*class="[^"]*download-link[^"]*"/i) 
                        || html.match(/href="([^"]+)"[^>]*download/i);
        
        if (downloadMatch && downloadMatch[1]) {
            return res.status(200).json({
                success: true,
                downloadUrl: downloadMatch[1],
                message: "Video/Image berhasil ditemukan!",
            });
        }

        throw new Error("Tidak dapat menemukan link download dari response");

    } catch (err) {
        console.error(err);
        
        // Fallback ke API 2
        try {
            const apiUrl2 = "https://api.downloadgram.org/media";
            
            const response2 = await fetch(apiUrl2, {
                method: "POST",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: url,
                }),
            });

            if (!response2.ok) {
                throw new Error("API kedua juga gagal");
            }

            const json2 = await response2.json();
            
            if (json2.success && json2.download_url) {
                return res.status(200).json({
                    success: true,
                    downloadUrl: json2.download_url,
                    message: "Video/Image berhasil ditemukan (API kedua)!",
                });
            }
            
            throw new Error("Tidak dapat menemukan link download");
            
        } catch (err2) {
            console.error(err2);
            return res.status(500).json({
                success: false,
                message: "Server error, coba lagi nanti. Pastikan link valid dan post bersifat publik.",
            });
        }
    }
}
