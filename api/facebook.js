export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      message: "URL Facebook tidak valid.",
    });
  }

  try {
    const apiUrl = "https://fdown.isuru.eu.org/download";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        quality: "best",
      }),
    });

    if (!response.ok) {
      throw new Error("Gagal menghubungi provider Facebook.");
    }

    const json = await response.json();

    if (json.status !== "success" || !json.download_url) {
      throw new Error(
        json.message || "Provider tidak mengembalikan link video yang valid."
      );
    }

    const downloadUrl = json.download_url;

    let thumbnail = null;
    try {
      const thumbnailResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });

      if (thumbnailResponse.ok) {
        const html = await thumbnailResponse.text();
        
        const patterns = [
          /"og:image"\s+content="([^"]+)"/i,
          /"thumbnailUrl":"([^"]+)"/i,
          /"image":\s*{\s*"uri":"([^"]+)"/i,
          /<meta property="og:image" content="([^"]+)"/i,
        ];

        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            thumbnail = match[1].replace(/\\u0025/g, '%').replace(/\\/g, '');
            break;
          }
        }
      }
    } catch (thumbnailError) {
      console.log("Thumbnail scraping failed (non-critical):", thumbnailError.message);
    }

    return res.status(200).json({
      success: true,
      downloadUrl,
      thumbnail,
    });
  } catch (err) {
    console.error("FB provider error:", err);
    return res.status(500).json({
      success: false,
      message:
        err.message ||
        "Server error FBdownder, atau provider lagi bermasalah. Coba lagi nanti.",
    });
  }
}
