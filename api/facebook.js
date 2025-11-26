export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, message: "URL Facebook tidak valid." });
    }

    try {
        // Try API 1: FBVideoDown (paling reliable untuk format baru)
        const apiUrl1 = "https://fbvideodown.com/api/";
        
        const response = await fetch(apiUrl1, {
            method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                url: url,
            }),
        });

        if (!response.ok) {
            throw new Error("Gagal ambil data dari API pertama");
        }

        const json = await response.json();

        if (json.code !== 0 || !json.data || !json.data.play) {
            throw new Error("API tidak mengembalikan link video yang valid");
        }

        // Direct link video (tanpa watermark)
        const downloadUrl = json.data.play; // direct link video

        return res.status(200).json({
            success: true,
            downloadUrl: downloadUrl,
            message: "Video berhasil ditemukan!",
        });

    } catch (err) {
        console.error(err);
        
        // Fallback ke API 2 jika API 1 gagal
        try {
            const apiUrl2 = "https://www.getfvid.com/downloader";
            const formData = new URLSearchParams();
            formData.append('url', url);
            
            const response2 = await fetch(apiUrl2, {
                method: "POST",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            });

            const html = await response2.text();
            
            // Parse HTML untuk ambil download link
            const hdMatch = html.match(/href="([^"]+)"[^>]*>Download in HD Quality/i);
            const sdMatch = html.match(/href="([^"]+)"[^>]*>Download in SD Quality/i);
            
            let downloadUrl = null;
            if (hdMatch && hdMatch[1]) {
                downloadUrl = hdMatch[1];
            } else if (sdMatch && sdMatch[1]) {
                downloadUrl = sdMatch[1];
            }
            
            if (downloadUrl) {
                return res.status(200).json({
                    success: true,
                    downloadUrl: downloadUrl,
                    message: "Video berhasil ditemukan (API kedua)!",
                });
            }
            
            throw new Error("Tidak dapat menemukan link download");
            
        } catch (err2) {
            console.error(err2);
            return res.status(500).json({
                success: false,
                message: "Server error, coba lagi nanti. Pastikan link valid dan video bersifat publik.",
            });
        }
    }
}
